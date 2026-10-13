const crypto = require('node:crypto');
const { ATIVIDADES_POR_ANO } = require('./gerador');

function sugerirConteudo2Ano(salaId, aluno) {
  const conteudos = ATIVIDADES_POR_ANO[2];
  const chave = `${salaId}:${String(aluno ?? '').trim().toLocaleLowerCase('pt-BR')}`;
  const indice = crypto.createHash('sha256').update(chave, 'utf8').digest().readUInt32BE(0) % conteudos.length;
  return conteudos[indice];
}

function inicializarSugestoesRevisao(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`DELETE FROM sugestoes_revisao
      WHERE NOT EXISTS (
        SELECT 1 FROM alunos_importados ai
        JOIN importacoes_sala i ON i.id=ai.importacao_id
        JOIN salas s ON s.id=i.sala_id
        WHERE ai.id=sugestoes_revisao.aluno_importado_id AND s.ano=2
          AND EXISTS (SELECT 1 FROM horarios h WHERE h.sala_id=s.id AND h.dia=1)
      )`);
    const inserir = db.prepare(`INSERT OR IGNORE INTO sugestoes_revisao(aluno_importado_id,atividade)
      VALUES(?,?)`);
    const alunos = db.prepare(`SELECT ai.id,ai.nome,s.id AS sala_id FROM alunos_importados ai
      JOIN importacoes_sala i ON i.id=ai.importacao_id
      JOIN salas s ON s.id=i.sala_id
      WHERE s.ano=2 AND EXISTS (SELECT 1 FROM horarios h WHERE h.sala_id=s.id AND h.dia=1)
      ORDER BY ai.id`).all();
    alunos.forEach((aluno) => inserir.run(aluno.id, sugerirConteudo2Ano(aluno.sala_id, aluno.nome)));
    db.exec('COMMIT');
    return alunos.length;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { sugerirConteudo2Ano, inicializarSugestoesRevisao };
