function sincronizarCadastros(destino, origem) {
  const origemTemFim = origem.prepare('PRAGMA table_info(horarios)').all().some((coluna) => coluna.name === 'fim');
  const salas = origem.prepare(`SELECT id,nome,ano,professor,periodo,dificuldade,conteudo_maior_dificuldade
    FROM salas ORDER BY id`).all();
  const inserirSala = destino.prepare(`INSERT OR IGNORE INTO salas
    (id,nome,ano,professor,periodo,dificuldade,conteudo_maior_dificuldade) VALUES(?,?,?,?,?,?,?)`);
  const buscarSala = destino.prepare('SELECT nome,ano,professor FROM salas WHERE id=?');
  const inserirHorario = destino.prepare(`INSERT INTO horarios(sala_id,dia,hora,fim)
    SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE sala_id=? AND dia=? AND hora=?)`);
  const inserirConteudo = destino.prepare('INSERT OR IGNORE INTO conteudos(sala_id,atividade) VALUES(?,?)');
  let salasImportadas = 0, horariosImportados = 0, conteudosImportados = 0;

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
    }
    destino.exec('COMMIT');
  } catch (error) {
    destino.exec('ROLLBACK');
    throw error;
  }

  return { salasImportadas, horariosImportados, conteudosImportados };
}

module.exports = { sincronizarCadastros };
