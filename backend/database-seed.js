function sincronizarCadastros(destino, origem) {
  const normalizarNome = (nome) => String(nome || '').trim().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const origemTemFim = origem.prepare('PRAGMA table_info(horarios)').all().some((coluna) => coluna.name === 'fim');
  const origemTemHistorico = origem.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='importacoes_sala'").get()
    && origem.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='alunos_importados'").get();
  const destinoTemHistorico = destino.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='importacoes_sala'").get()
    && destino.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='alunos_importados'").get();
  const destinoTemExclusoes = Boolean(destino.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='exclusoes_alunos_importados'").get());
  const origemTemMetricas = new Set(origem.prepare('PRAGMA table_info(alunos_importados)').all().map((coluna) => coluna.name));
  const destinoTemMetricas = new Set(destino.prepare('PRAGMA table_info(alunos_importados)').all().map((coluna) => coluna.name));
  const sincronizaMetricas = ['acertos', 'percentual_acerto', 'estimado'].every((coluna) => origemTemMetricas.has(coluna) && destinoTemMetricas.has(coluna));
  const origemTemAtividades = Boolean(origem.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='alunos_importados_atividades'").get());
  const destinoTemAtividades = Boolean(destino.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='alunos_importados_atividades'").get());
  const sincronizaAtividades = origemTemAtividades && destinoTemAtividades;
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
    ? destino.prepare(sincronizaMetricas ? `INSERT INTO alunos_importados
      (importacao_id,linha_origem,nome,total_respostas,pontos_total,tempo_medio_s,acertos,percentual_acerto,estimado) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(importacao_id,linha_origem) DO UPDATE SET nome=excluded.nome,
      total_respostas=excluded.total_respostas,pontos_total=excluded.pontos_total,
      tempo_medio_s=excluded.tempo_medio_s,acertos=excluded.acertos,
      percentual_acerto=excluded.percentual_acerto,estimado=excluded.estimado
      WHERE nome IS NOT excluded.nome OR total_respostas IS NOT excluded.total_respostas
      OR pontos_total IS NOT excluded.pontos_total OR tempo_medio_s IS NOT excluded.tempo_medio_s
      OR acertos IS NOT excluded.acertos OR percentual_acerto IS NOT excluded.percentual_acerto
      OR estimado IS NOT excluded.estimado`
      : `INSERT INTO alunos_importados
      (importacao_id,linha_origem,nome,total_respostas,pontos_total,tempo_medio_s) VALUES(?,?,?,?,?,?)
      ON CONFLICT(importacao_id,linha_origem) DO UPDATE SET nome=excluded.nome,
      total_respostas=excluded.total_respostas,pontos_total=excluded.pontos_total,
      tempo_medio_s=excluded.tempo_medio_s
      WHERE nome IS NOT excluded.nome OR total_respostas IS NOT excluded.total_respostas
      OR pontos_total IS NOT excluded.pontos_total OR tempo_medio_s IS NOT excluded.tempo_medio_s`) : null;
  const inserirAtividadeImportada = sincronizaAtividades
    ? destino.prepare(`INSERT INTO alunos_importados_atividades
      (aluno_importado_id,atividade,perguntas,acertos,percentual_acerto,pontos_total,tempo_medio_s) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(aluno_importado_id,atividade) DO UPDATE SET perguntas=excluded.perguntas,
      acertos=excluded.acertos,percentual_acerto=excluded.percentual_acerto,
      pontos_total=excluded.pontos_total,tempo_medio_s=excluded.tempo_medio_s
      WHERE perguntas IS NOT excluded.perguntas OR acertos IS NOT excluded.acertos
      OR percentual_acerto IS NOT excluded.percentual_acerto OR pontos_total IS NOT excluded.pontos_total
      OR tempo_medio_s IS NOT excluded.tempo_medio_s`) : null;
  const removerAtividadesOrfas = sincronizaAtividades
    ? destino.prepare(`DELETE FROM alunos_importados_atividades
      WHERE NOT EXISTS (SELECT 1 FROM alunos_importados
        WHERE alunos_importados.id=alunos_importados_atividades.aluno_importado_id)`) : null;
  let salasImportadas = 0, horariosImportados = 0, conteudosImportados = 0;
  let importacoesHistoricas = 0, alunosHistoricos = 0, alunosHistoricosRemovidos = 0;

  destino.exec('BEGIN IMMEDIATE');
  try {
    removerAtividadesOrfas?.run();
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
          const alunosOrigem = origem.prepare(`SELECT id,linha_origem,nome,total_respostas,pontos_total,tempo_medio_s${sincronizaMetricas ? ',acertos,percentual_acerto,estimado' : ''}
            FROM alunos_importados WHERE importacao_id=? ORDER BY linha_origem`).all(importacao.id);
          const exclusoes = destinoTemExclusoes
            ? destino.prepare(`SELECT linha_origem,nome FROM exclusoes_alunos_importados
              WHERE sala_id=? AND arquivo=?`).all(sala.id, importacao.arquivo)
            : [];
          const linhasExcluidas = new Set(exclusoes.filter((registro) => !registro.nome)
            .map((registro) => registro.linha_origem));
          const nomesExcluidos = new Set(exclusoes.filter((registro) => registro.nome)
            .map((registro) => normalizarNome(registro.nome)));
          const alunos = alunosOrigem.filter((aluno) => !linhasExcluidas.has(aluno.linha_origem)
            && !nomesExcluidos.has(normalizarNome(aluno.nome)));
          const linhasAtivas = alunos.map((aluno) => aluno.linha_origem);
          if (linhasAtivas.length) {
            const marcadores = linhasAtivas.map(() => '?').join(',');
            if (sincronizaAtividades) {
              destino.prepare(`DELETE FROM alunos_importados_atividades
                WHERE aluno_importado_id IN (SELECT id FROM alunos_importados
                  WHERE importacao_id=? AND linha_origem NOT IN (${marcadores}))`)
                .run(destinoImportacao.id, ...linhasAtivas);
            }
            alunosHistoricosRemovidos += Number(destino.prepare(`DELETE FROM alunos_importados
              WHERE importacao_id=? AND linha_origem NOT IN (${marcadores})`)
              .run(destinoImportacao.id, ...linhasAtivas).changes);
          } else {
            if (sincronizaAtividades) {
              destino.prepare(`DELETE FROM alunos_importados_atividades WHERE aluno_importado_id IN
                (SELECT id FROM alunos_importados WHERE importacao_id=?)`).run(destinoImportacao.id);
            }
            alunosHistoricosRemovidos += Number(destino.prepare('DELETE FROM alunos_importados WHERE importacao_id=?')
              .run(destinoImportacao.id).changes);
          }
          for (const aluno of alunos) {
            const parametros = [destinoImportacao.id, aluno.linha_origem, aluno.nome, aluno.total_respostas,
              aluno.pontos_total, aluno.tempo_medio_s];
            if (sincronizaMetricas) parametros.push(aluno.acertos, aluno.percentual_acerto, aluno.estimado);
            alunosHistoricos += Number(inserirAlunoImportado.run(...parametros).changes);
            if (sincronizaAtividades) {
              const destinoAluno = destino.prepare('SELECT id FROM alunos_importados WHERE importacao_id=? AND linha_origem=?')
                .get(destinoImportacao.id, aluno.linha_origem);
              const atividades = origem.prepare(`SELECT atividade,perguntas,acertos,percentual_acerto,pontos_total,tempo_medio_s
                FROM alunos_importados_atividades WHERE aluno_importado_id=?`).all(aluno.id)
              if (atividades.length) {
                const marcadores = atividades.map(() => '?').join(',');
                destino.prepare(`DELETE FROM alunos_importados_atividades WHERE aluno_importado_id=? AND atividade NOT IN (${marcadores})`)
                  .run(destinoAluno.id, ...atividades.map((atividade) => atividade.atividade));
              } else {
                destino.prepare('DELETE FROM alunos_importados_atividades WHERE aluno_importado_id=?').run(destinoAluno.id);
              }
              atividades.forEach((atividade) => inserirAtividadeImportada.run(destinoAluno.id, atividade.atividade,
                  atividade.perguntas, atividade.acertos, atividade.percentual_acerto,
                  atividade.pontos_total, atividade.tempo_medio_s));
            }
          }
        }
      }
    }
    destino.exec('COMMIT');
  } catch (error) {
    destino.exec('ROLLBACK');
    throw error;
  }

  return { salasImportadas, horariosImportados, conteudosImportados, importacoesHistoricas, alunosHistoricos, alunosHistoricosRemovidos };
}

module.exports = { sincronizarCadastros };
