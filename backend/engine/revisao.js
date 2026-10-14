const crypto = require('node:crypto');
const { ATIVIDADES_POR_ANO } = require('./gerador');
const ATIVIDADES_VALIDAS = [...new Set(Object.values(ATIVIDADES_POR_ANO).flat())];

function migrarTabelaSugestoes(db) {
  const tabela = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='sugestoes_revisao'").get();
  if (!tabela || ATIVIDADES_VALIDAS.every((atividade) => tabela.sql.includes(`'${atividade}'`))) return;

  db.exec('BEGIN IMMEDIATE');
  try {
    const restricao = ATIVIDADES_VALIDAS.map((atividade) => `'${atividade}'`).join(',');
    db.exec(`CREATE TABLE sugestoes_revisao_nova(
      aluno_importado_id INTEGER PRIMARY KEY,
      atividade TEXT NOT NULL CHECK(atividade IN (${restricao})),
      criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO sugestoes_revisao_nova(aluno_importado_id,atividade,criada_em)
      SELECT aluno_importado_id,atividade,criada_em FROM sugestoes_revisao;
    DROP TABLE sugestoes_revisao;
    ALTER TABLE sugestoes_revisao_nova RENAME TO sugestoes_revisao;
    COMMIT`);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function estimarAtividadeReforco({ ano, alunoId, aproveitamento, atividades }) {
  const conteudos = atividades.length ? atividades : ATIVIDADES_POR_ANO[ano] || [];
  if (!conteudos.length) return null;

  const acerto = Number(aproveitamento);
  const quantidade = acerto < 80 ? 2 : acerto < 90 ? 3 : acerto < 98 ? Math.min(5, conteudos.length) : conteudos.length;
  const candidatas = conteudos.slice(0, quantidade);
  const indice = crypto.createHash('sha256').update(String(alunoId), 'utf8').digest().readUInt32BE(0) % candidatas.length;
  return candidatas[indice];
}

function inicializarSugestoesRevisao(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`DELETE FROM sugestoes_revisao
      WHERE NOT EXISTS (
        SELECT 1 FROM alunos_importados ai
        JOIN importacoes_sala i ON i.id=ai.importacao_id
        JOIN salas s ON s.id=i.sala_id
        WHERE ai.id=sugestoes_revisao.aluno_importado_id AND ai.total_respostas>0
          AND s.ano IN (2,3)
          AND NOT EXISTS (SELECT 1 FROM alunos_importados_atividades ia
            WHERE ia.aluno_importado_id=ai.id AND ia.perguntas>0)
      )`);
    const alunos = db.prepare(`SELECT ai.id,ai.nome,ai.total_respostas,ai.acertos,ai.percentual_acerto,
        s.id AS sala_id,s.ano FROM alunos_importados ai
      JOIN importacoes_sala i ON i.id=ai.importacao_id
      JOIN salas s ON s.id=i.sala_id
      WHERE ai.total_respostas>0 AND s.ano IN (2,3)
        AND NOT EXISTS (SELECT 1 FROM alunos_importados_atividades ia
          WHERE ia.aluno_importado_id=ai.id AND ia.perguntas>0)
      ORDER BY ai.id`).all();
    const upsert = db.prepare(`INSERT INTO sugestoes_revisao(aluno_importado_id,atividade)
      VALUES(?,?) ON CONFLICT(aluno_importado_id) DO UPDATE SET atividade=excluded.atividade`);
    const atividadesPorAno = new Map();
    for (const ano of new Set(alunos.map((aluno) => aluno.ano))) {
      const conteudos = ATIVIDADES_POR_ANO[ano] || [];
      const marcadores = conteudos.map(() => '?').join(',');
      const desempenho = db.prepare(`SELECT atividade,100.0*SUM(acertos)/SUM(perguntas) AS percentual
        FROM (
          SELECT ia.atividade,ia.perguntas,
            COALESCE(ia.acertos,ia.perguntas*ia.percentual_acerto/100.0) AS acertos
          FROM alunos_importados_atividades ia
          JOIN alunos_importados ai ON ai.id=ia.aluno_importado_id
          JOIN importacoes_sala i ON i.id=ai.importacao_id
          JOIN salas s ON s.id=i.sala_id
          WHERE s.ano=? AND ia.perguntas>0 AND ia.atividade IN (${marcadores})
          UNION ALL
          SELECT r.atividade,COUNT(*),SUM(r.correta)
          FROM respostas r JOIN alunos a ON a.id=r.aluno_id JOIN salas s ON s.id=a.sala_id
          WHERE s.ano=? AND r.atividade IN (${marcadores}) GROUP BY r.atividade
        ) GROUP BY atividade ORDER BY percentual,atividade`).all(ano, ...conteudos, ano, ...conteudos);
      const medidasPorConteudo = new Map(desempenho.map((item) => [item.atividade, item.percentual]));
      atividadesPorAno.set(ano, conteudos
        .map((atividade, indice) => ({ atividade, indice, percentual: medidasPorConteudo.get(atividade) ?? Infinity }))
        .sort((a, b) => a.percentual - b.percentual || a.indice - b.indice)
        .map((item) => item.atividade));
    }
    alunos.forEach((aluno) => {
      const aproveitamento = aluno.percentual_acerto ?? (aluno.acertos == null
        ? 100 : 100 * aluno.acertos / aluno.total_respostas);
      const atividade = estimarAtividadeReforco({
        ano: aluno.ano,
        alunoId: aluno.id,
        aproveitamento,
        atividades: atividadesPorAno.get(aluno.ano) || [],
      });
      if (atividade) upsert.run(aluno.id, atividade);
    });
    db.exec('COMMIT');
    return alunos.length;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { estimarAtividadeReforco, migrarTabelaSugestoes, inicializarSugestoesRevisao };
