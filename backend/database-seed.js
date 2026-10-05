function sincronizarCadastros(destino, origem) {
  const origemTemFim = origem.prepare('PRAGMA table_info(horarios)').all().some((coluna) => coluna.name === 'fim');
  const origemTemHistorico = origem.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='importacoes_sala'").get()
    && origem.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='alunos_importados'").get();
  const destinoTemHistorico = destino.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='importacoes_sala'").get()
    && destino.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='alunos_importados'").get();
  const salas = origem.prepare(`SELECT id,nome,ano,professor,periodo,dificuldade,conteudo_maior_dificuldade
    FROM salas ORDER BY id`).all();
  const inserirSala = destino.prepare(`INSERT OR IGNORE INTO salas
    (id,nome,ano,professor,periodo,dificuldade,conteudo_maior_dificuldade) VALUES(?,?,?,?,?,?,?)`);
  const buscarSala = destino.prepare('SELECT nome,ano,professor FROM salas WHERE id=?');
  const inserirHorario = destino.prepare(`INSERT INTO horarios(sala_id,dia,hora,fim)
    SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE sala_id=? AND dia=? AND hora=?)`);
  const inserirConteudo = destino.prepare('INSERT OR IGNORE INTO conteudos(sala_id,atividade) VALUES(?,?)');
  const inserirImportacao = origemTemHistorico && destinoTemHistorico
    ? destino.prepare('INSERT OR IGNORE INTO importacoes_sala(sala_id,arquivo,importado_em) VALUES(?,?,?)') : null;
  const buscarImportacao = origemTemHistorico && destinoTemHistorico
    ? destino.prepare('SELECT id FROM importacoes_sala WHERE sala_id=? AND arquivo=?') : null;
  const inserirAlunoImportado = origemTemHistorico && destinoTemHistorico
    ? destino.prepare(`INSERT OR IGNORE INTO alunos_importados
      (importacao_id,linha_origem,nome,total_respostas,pontos_total,tempo_medio_s) VALUES(?,?,?,?,?,?)`) : null;
  let salasImportadas = 0, horariosImportados = 0, conteudosImportados = 0;
  let importacoesHistoricas = 0, alunosHistoricos = 0;

  destino.exec('BEGIN IMMEDIATE');
  try {
    for (const sala of salas) {
      const resultado = inserirSala.run(sala.id, sala.nome, sala.ano, sala.professor, sala.periodo,
        sala.dificuldade, sala.conteudo_maior_dificuldade);
      salasImportadas += Number(resultado.changes);

      const existente = buscarSala.get(sala.id);
      if (!existente || existente.nome !== sala.nome || existente.ano !== sala.ano || existente.professor !== sala.professor) continue;

      const horarios = origem.prepare(`SELECT dia,hora,${origemTemFim ? 'fim' : 'NULL AS fim'} FROM horarios WHERE sala_id=?`).all(sala.id);
      for (const horario of horarios) {
        horariosImportados += Number(inserirHorario.run(sala.id, horario.dia, horario.hora, horario.fim,
          sala.id, horario.dia, horario.hora).changes);
      }
      for (const conteudo of origem.prepare('SELECT atividade FROM conteudos WHERE sala_id=?').all(sala.id)) {
        conteudosImportados += Number(inserirConteudo.run(sala.id, conteudo.atividade).changes);
      }
      if (inserirImportacao) {
        const importacoes = origem.prepare(`SELECT id,arquivo,importado_em FROM importacoes_sala WHERE sala_id=? ORDER BY id`).all(sala.id);
        for (const importacao of importacoes) {
          importacoesHistoricas += Number(inserirImportacao.run(sala.id, importacao.arquivo, importacao.importado_em).changes);
          const destinoImportacao = buscarImportacao.get(sala.id, importacao.arquivo);
          const alunos = origem.prepare(`SELECT linha_origem,nome,total_respostas,pontos_total,tempo_medio_s
            FROM alunos_importados WHERE importacao_id=? ORDER BY linha_origem`).all(importacao.id);
          for (const aluno of alunos) {
            alunosHistoricos += Number(inserirAlunoImportado.run(destinoImportacao.id, aluno.linha_origem,
              aluno.nome, aluno.total_respostas, aluno.pontos_total, aluno.tempo_medio_s).changes);
          }
        }
      }
    }
    destino.exec('COMMIT');
  } catch (error) {
    destino.exec('ROLLBACK');
    throw error;
  }

  return { salasImportadas, horariosImportados, conteudosImportados, importacoesHistoricas, alunosHistoricos };
}

module.exports = { sincronizarCadastros };
