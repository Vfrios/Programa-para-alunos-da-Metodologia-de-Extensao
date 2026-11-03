function percentual(row, quantidade, acertos) {
  if (row.percentual_acerto != null) return Number(row.percentual_acerto);
  if (quantidade > 0 && acertos != null) return Math.round(1000 * acertos / quantidade) / 10;
  return null;
}

function dataComDuracao(sessao) {
  const inicio = sessao.iniciada_em || sessao.aberta_em;
  if (!inicio || !sessao.encerrada_em) return null;
  return Math.max(0, Math.round((new Date(sessao.encerrada_em) - new Date(inicio)) / 60000));
}

function detalharAtividadeImportada(db, sessao) {
  if (!sessao.importacao_id) return null;
  if (!db.prepare('SELECT 1 FROM importacoes_sala WHERE id=?').get(sessao.importacao_id)) {
    throw new Error(`Relatório vinculado ${sessao.importacao_id} não encontrado.`);
  }

  const alunosOriginais = db.prepare(`SELECT id, nome, total_respostas, pontos_total, tempo_medio_s,
      acertos, percentual_acerto
    FROM alunos_importados
    WHERE importacao_id=?
    ORDER BY pontos_total DESC, nome`).all(sessao.importacao_id);
  const atividadesOriginais = db.prepare(`SELECT ai.id AS aluno_id, ai.nome AS aluno,
      aa.atividade, aa.perguntas, aa.acertos, aa.percentual_acerto, aa.tempo_medio_s
    FROM alunos_importados_atividades aa
    JOIN alunos_importados ai ON ai.id=aa.aluno_importado_id
    WHERE ai.importacao_id=?
    ORDER BY ai.nome, aa.atividade`).all(sessao.importacao_id);

  const alunos = alunosOriginais.map((aluno) => ({
    id: aluno.id,
    nome: aluno.nome,
    perguntas: aluno.total_respostas,
    acertos: aluno.acertos,
    percentual_acerto: percentual(aluno, aluno.total_respostas, aluno.acertos),
    pontos_total: aluno.pontos_total,
    tempo_medio_s: aluno.tempo_medio_s,
    nivel_maximo: null,
  }));
  const totalRespostas = alunosOriginais.reduce((total, aluno) => total + aluno.total_respostas, 0);
  const totalAcertos = alunosOriginais.reduce((total, aluno) => total + (aluno.acertos || 0), 0);
  const totalPontos = alunosOriginais.reduce((total, aluno) => total + (aluno.pontos_total || 0), 0);
  const perguntasMax = alunosOriginais.reduce(
    (maximo, aluno) => Math.max(maximo, aluno.total_respostas || 0), 0
  );
  const pesosPercentuais = alunosOriginais.reduce((total, aluno) => {
    const aproveitamento = percentual(aluno, aluno.total_respostas, aluno.acertos);
    return aproveitamento == null ? total : total + aproveitamento * aluno.total_respostas;
  }, 0);
  const respostasComPercentual = alunosOriginais.reduce((total, aluno) => (
    percentual(aluno, aluno.total_respostas, aluno.acertos) == null
      ? total
      : total + aluno.total_respostas
  ), 0);
  const percentualGeral = respostasComPercentual
    ? Math.round(10 * pesosPercentuais / respostasComPercentual) / 10
    : 0;

  const acumuladoPorAtividade = new Map();
  for (const linha of atividadesOriginais) {
    const atual = acumuladoPorAtividade.get(linha.atividade) || {
      atividade: linha.atividade,
      perguntas: 0,
      acertos: 0,
      pontosPercentuais: 0,
      respostasComPercentual: 0,
      tempoPonderado: 0,
      respostasComTempo: 0,
    };
    const perguntas = linha.perguntas || 0;
    const aproveitamento = percentual(linha, perguntas, linha.acertos);
    atual.perguntas += perguntas;
    if (linha.acertos != null) atual.acertos += linha.acertos;
    if (aproveitamento != null) {
      atual.pontosPercentuais += aproveitamento * perguntas;
      atual.respostasComPercentual += perguntas;
    }
    if (linha.tempo_medio_s != null) {
      atual.tempoPonderado += linha.tempo_medio_s * perguntas;
      atual.respostasComTempo += perguntas;
    }
    acumuladoPorAtividade.set(linha.atividade, atual);
  }

  const porAtividade = [...acumuladoPorAtividade.values()].map((atividade) => ({
    atividade: atividade.atividade,
    perguntas: atividade.perguntas,
    acertos: atividade.acertos,
    percentual_acerto: atividade.respostasComPercentual
      ? Math.round(10 * atividade.pontosPercentuais / atividade.respostasComPercentual) / 10
      : null,
    tempo_medio_s: atividade.respostasComTempo
      ? Math.round(10 * atividade.tempoPonderado / atividade.respostasComTempo) / 10
      : null,
  })).sort((a, b) => (a.percentual_acerto ?? 0) - (b.percentual_acerto ?? 0) ||
    a.atividade.localeCompare(b.atividade));
  const porAlunoAtividade = atividadesOriginais.map((linha) => ({
    ...linha,
    percentual_acerto: percentual(linha, linha.perguntas, linha.acertos),
  }));
  const atividadeMaisDificil = porAtividade.find((atividade) => atividade.percentual_acerto < 100) || null;
  const inicio = sessao.iniciada_em || sessao.aberta_em;

  return {
    id: sessao.id,
    sala_id: sessao.sala_id,
    sala: sessao.sala,
    ano: sessao.ano,
    rotulo: sessao.rotulo,
    status: sessao.status,
    aberta_em: sessao.aberta_em,
    iniciada_em: sessao.iniciada_em,
    encerrada_em: sessao.encerrada_em,
    duracao_min: dataComDuracao(sessao),
    totais: {
      criancas: alunosOriginais.length,
      perguntas_max: perguntasMax,
      acertos: totalAcertos,
      respostas: totalRespostas,
      pontos: totalPontos,
      aproveitamento_soma: pesosPercentuais / 100,
      percentual_geral: percentualGeral,
    },
    atividade_mais_dificil: atividadeMaisDificil,
    alunos,
    por_atividade: porAtividade,
    por_aluno_atividade: porAlunoAtividade,
  };
}

module.exports = { detalharAtividadeImportada };
