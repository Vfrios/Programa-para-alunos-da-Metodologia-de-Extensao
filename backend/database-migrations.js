function migrateActivityMetrics(db) {
  const columns = new Map(
    db.prepare('PRAGMA table_info(alunos_importados_atividades)').all().map((column) => [column.name, column])
  );
  if (!columns.get('acertos')?.notnull && !columns.get('pontos_total')?.notnull) return;

  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE alunos_importados_atividades_nova(
      id INTEGER PRIMARY KEY AUTOINCREMENT, aluno_importado_id INTEGER NOT NULL, atividade TEXT NOT NULL,
      perguntas INTEGER NOT NULL, acertos INTEGER, percentual_acerto REAL, pontos_total INTEGER,
      tempo_medio_s REAL, UNIQUE(aluno_importado_id, atividade));
      INSERT INTO alunos_importados_atividades_nova
      (id,aluno_importado_id,atividade,perguntas,acertos,percentual_acerto,pontos_total,tempo_medio_s)
      SELECT id,aluno_importado_id,atividade,perguntas,acertos,percentual_acerto,pontos_total,tempo_medio_s
      FROM alunos_importados_atividades;
      DROP TABLE alunos_importados_atividades;
      ALTER TABLE alunos_importados_atividades_nova RENAME TO alunos_importados_atividades;
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrateSessionLabels(db) {
  const colunas = new Set(db.prepare('PRAGMA table_info(sessoes)').all().map((coluna) => coluna.name));
  if (!colunas.has('rotulo')) {
    db.exec('ALTER TABLE sessoes ADD COLUMN rotulo TEXT');
  }
}

function backfillSessionLabels(db) {
  const sessoes = db.prepare(`
    SELECT id, sala_id, aberta_em, iniciada_em
    FROM sessoes
    WHERE rotulo IS NULL
    ORDER BY sala_id ASC, COALESCE(iniciada_em, aberta_em) ASC, id ASC
  `).all();

  const contarPorSala = db.prepare(`
    SELECT COUNT(*) AS n
    FROM sessoes
    WHERE sala_id = ? AND COALESCE(iniciada_em, aberta_em) <= ?
  `);
  const atualizar = db.prepare('UPDATE sessoes SET rotulo = ? WHERE id = ? AND rotulo IS NULL');

  const formatarData = (iso) => {
    if (!iso) return new Date().toLocaleDateString('pt-BR');
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return new Date().toLocaleDateString('pt-BR');
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  if (sessoes.length === 0) return;

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const sessao of sessoes) {
      const data = sessao.iniciada_em || sessao.aberta_em || new Date().toISOString();
      const ordem = contarPorSala.get(sessao.sala_id, data).n;
      const rotulo = `Atividade ${ordem} - ${formatarData(data)}`;
      atualizar.run(rotulo, sessao.id);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrateReportIndexes(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessoes_sala ON sessoes(sala_id);
      CREATE INDEX IF NOT EXISTS idx_sessoes_status ON sessoes(status);
      CREATE INDEX IF NOT EXISTS idx_sessoes_data ON sessoes(COALESCE(iniciada_em, aberta_em));
      CREATE INDEX IF NOT EXISTS idx_respostas_sessao ON respostas(sessao_id);
      CREATE INDEX IF NOT EXISTS idx_respostas_sessao_atividade ON respostas(sessao_id, atividade);
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const MARCADORES_PROFESSOR_AUSENTE = new Set([
  'a definir',
  'importacao historica (responsavel nao informado)',
]);
function normalizarNomeProfessor(valor) {
  const nome = String(valor || '').trim();
  const marcador = nome.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  return MARCADORES_PROFESSOR_AUSENTE.has(marcador) ? '' : nome;
}

function removerMarcadoresDeProfessor(db) {
  const salas = db.prepare('SELECT id,professor FROM salas').all();
  const limpar = db.prepare("UPDATE salas SET professor='' WHERE id=? AND professor<>''");
  return salas.reduce((total, sala) => total +
    (normalizarNomeProfessor(sala.professor) === '' && String(sala.professor || '').trim()
      ? Number(limpar.run(sala.id).changes) : 0), 0);
}

function migrateRespostaFlags(db) {
  const colunas = new Map(
    db.prepare('PRAGMA table_info(respostas)').all().map((coluna) => [coluna.name, coluna])
  );

  db.exec('BEGIN IMMEDIATE');
  try {
    if (!colunas.has('tentativas')) {
      db.exec('ALTER TABLE respostas ADD COLUMN tentativas INTEGER NOT NULL DEFAULT 1');
    }
    if (!colunas.has('dica')) {
      db.exec('ALTER TABLE respostas ADD COLUMN dica INTEGER NOT NULL DEFAULT 0');
    }
    db.exec(`UPDATE respostas SET tentativas = 1 WHERE tentativas IS NULL OR tentativas < 1`);
    db.exec(`UPDATE respostas SET dica = 0 WHERE dica IS NULL OR dica NOT IN (0, 1)`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrateImportedActivitySessions(db) {
  const tabelasHistoricas = ['importacoes_sala', 'alunos_importados', 'alunos_importados_atividades'];
  const datasEsperadas = new Map([
    ['2:2', '2026-10-08'],
    ['2:4', '2026-10-06'],
    ['2:7', '2026-10-05'],
    ['2:8', '2026-10-08'],
    ['3:5', '2026-10-06'],
    ['3:6', '2026-10-08'],
    ['3:7', '2026-10-05'],
    ['3:8', '2026-10-08'],
  ]);
  const avisos = [];

  db.exec('BEGIN IMMEDIATE');
  try {
    const colunas = new Set(db.prepare('PRAGMA table_info(sessoes)').all().map((coluna) => coluna.name));
    if (!colunas.has('importacao_id')) {
      db.exec('ALTER TABLE sessoes ADD COLUMN importacao_id INTEGER');
    }
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sessoes_importacao
      ON sessoes(importacao_id) WHERE importacao_id IS NOT NULL`);

    const tabelasExistentes = new Set(db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('importacoes_sala','alunos_importados','alunos_importados_atividades')"
    ).all().map((tabela) => tabela.name));
    if (tabelasHistoricas.every((tabela) => tabelasExistentes.has(tabela))) {
      const salas = db.prepare('SELECT id, nome FROM salas ORDER BY id').all();
      const importacoesPorSala = db.prepare(
        'SELECT id FROM importacoes_sala WHERE sala_id = ? ORDER BY id'
      );
      const horariosPorSala = db.prepare(
        'SELECT data, hora, fim FROM horarios WHERE sala_id = ? AND data = ? ORDER BY hora'
      );
      const importacaoVinculada = db.prepare(
        'SELECT id FROM sessoes WHERE importacao_id = ?'
      );
      const inserirSessao = db.prepare(`INSERT INTO sessoes
        (sala_id, status, aberta_em, iniciada_em, encerrada_em, rotulo, importacao_id)
        VALUES(?, 'encerrada', ?, ?, ?, ?, ?)`);

      for (const sala of salas) {
        const correspondencia = sala.nome.match(/^([23])º ano\s*-\s*(\d+)/);
        if (!correspondencia) continue;

        const chaveTurma = `${correspondencia[1]}:${correspondencia[2]}`;
        const data = datasEsperadas.get(chaveTurma);
        if (!data) continue;

        const importacoes = importacoesPorSala.all(sala.id);
        if (importacoes.length !== 1) {
          avisos.push({
            sala: sala.nome,
            motivo: importacoes.length === 0 ? 'sem importação histórica' : 'múltiplas importações históricas',
          });
          continue;
        }

        const importacao = importacoes[0];
        if (importacaoVinculada.get(importacao.id)) continue;

        const horario = horariosPorSala.get(sala.id, data);
        if (!horario || !horario.hora) {
          avisos.push({ sala: sala.nome, motivo: `sem horário para ${data}` });
          continue;
        }

        const inicio = `${data}T${horario.hora}:00-03:00`;
        const fim = horario.fim ? `${data}T${horario.fim}:00-03:00` : null;
        const [ano, mes, dia] = data.split('-');
        const rotulo = `Atividade 1 - ${dia}/${mes}/${ano}`;
        inserirSessao.run(sala.id, inicio, inicio, fim, rotulo, importacao.id);

        const sessoes = db.prepare(`SELECT id, rotulo, importacao_id,
            COALESCE(iniciada_em, aberta_em) AS data
          FROM sessoes WHERE sala_id=? AND status NOT IN ('cancelada','excluida')
          ORDER BY COALESCE(iniciada_em, aberta_em), id`).all(sala.id);
        const atualizarRotulo = db.prepare(
          'UPDATE sessoes SET rotulo = ? WHERE id = ? AND rotulo = ?'
        );
        sessoes.forEach((sessao, indice) => {
          if (sessao.importacao_id || !/^Atividade \d+ - \d{2}\/\d{2}\/\d{4}$/.test(sessao.rotulo || '')) return;
          const instante = new Date(sessao.data);
          if (Number.isNaN(instante.getTime())) return;
          const dataSessao = `${String(instante.getUTCDate()).padStart(2, '0')}/${String(instante.getUTCMonth() + 1).padStart(2, '0')}/${instante.getUTCFullYear()}`;
          atualizarRotulo.run(`Atividade ${indice + 1} - ${dataSessao}`, sessao.id, sessao.rotulo);
        });
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  if (avisos.length > 0) {
    console.warn('[migração] Atividades históricas não vinculadas:', avisos);
  }
}

function verificarSessoesEsperadas(db) {
  const salasEsperadas = ['2:2', '2:4', '2:7', '2:8', '3:5', '3:6', '3:7', '3:8'];
  const salas = db.prepare('SELECT id, nome FROM salas ORDER BY id').all();
  if (salas.length === 0) return;
  const faltando = [];

  for (const chave of salasEsperadas) {
    const sala = salas.find((candidata) => {
      const correspondencia = candidata.nome.match(/^([23])º ano\s*-\s*(\d+)/);
      return correspondencia && `${correspondencia[1]}:${correspondencia[2]}` === chave;
    });
    if (!sala) {
      faltando.push({ turma: chave, motivo: 'sala não existe' });
      continue;
    }

    const total = db.prepare('SELECT COUNT(*) AS n FROM sessoes WHERE sala_id = ?').get(sala.id).n;
    if (total === 0) {
      faltando.push({ nome: sala.nome, motivo: 'sem sessão' });
    }
  }

  if (faltando.length > 0) {
    console.warn('[migração] Turmas sem sessão/atividade:', faltando);
  }
}

module.exports = {
  migrateActivityMetrics,
  migrateSessionLabels,
  normalizarNomeProfessor,
  removerMarcadoresDeProfessor,
  backfillSessionLabels,
  migrateReportIndexes,
  migrateRespostaFlags,
  migrateImportedActivitySessions,
  verificarSessoesEsperadas,
};
