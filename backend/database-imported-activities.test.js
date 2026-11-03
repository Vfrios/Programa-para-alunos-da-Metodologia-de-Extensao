const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { migrateImportedActivitySessions } = require('./database-migrations');
const { detalharAtividadeImportada } = require('./imported-activity-report');

const turmas = [
  ['2º ano - 2 - Quinta 13:50', 2, '2026-10-08', '13:50', '14:45'],
  ['2º ano - 4 - Terça 14:40', 2, '2026-10-06', '14:40', '15:35'],
  ['2º ano - 7 - Segunda 14:40', 2, '2026-10-05', '14:40', '15:35'],
  ['2º ano - 8 - Quinta 13:00', 2, '2026-10-08', '13:00', '13:55'],
  ['3º ano - 5-  Terça 16:30', 3, '2026-10-06', '16:30', '17:25'],
  ['3º ano - 6 - Quinta 14:40', 3, '2026-10-08', '14:40', '15:35'],
  ['3º ano - 7 - Segunda 13:30', 3, '2026-10-05', '13:30', '14:25'],
  ['3º ano - 8 - Quinta 16:30', 3, '2026-10-08', '16:30', '17:25'],
];

function bancoHistorico() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE salas(id INTEGER PRIMARY KEY, nome TEXT NOT NULL, ano INTEGER NOT NULL);
    CREATE TABLE horarios(id INTEGER PRIMARY KEY, sala_id INTEGER, data TEXT, hora TEXT, fim TEXT);
    CREATE TABLE sessoes(
      id INTEGER PRIMARY KEY AUTOINCREMENT, sala_id INTEGER NOT NULL, status TEXT NOT NULL,
      aberta_em TEXT NOT NULL, iniciada_em TEXT, encerrada_em TEXT, fim_previsto_em TEXT, rotulo TEXT
    );
    CREATE TABLE importacoes_sala(id INTEGER PRIMARY KEY, sala_id INTEGER, arquivo TEXT, importado_em TEXT);
    CREATE TABLE alunos_importados(
      id INTEGER PRIMARY KEY, importacao_id INTEGER, nome TEXT, total_respostas INTEGER,
      pontos_total INTEGER, tempo_medio_s REAL, acertos INTEGER, percentual_acerto REAL
    );
    CREATE TABLE alunos_importados_atividades(
      id INTEGER PRIMARY KEY, aluno_importado_id INTEGER, atividade TEXT, perguntas INTEGER,
      acertos INTEGER, percentual_acerto REAL, tempo_medio_s REAL
    );
  `);
  return db;
}

test('migra as oito importações históricas para atividades 1 e mantém registros originais', () => {
  const db = bancoHistorico();
  const inserirSala = db.prepare('INSERT INTO salas(id,nome,ano) VALUES(?,?,?)');
  const inserirHorario = db.prepare('INSERT INTO horarios(sala_id,data,hora,fim) VALUES(?,?,?,?)');
  const inserirImportacao = db.prepare('INSERT INTO importacoes_sala(id,sala_id,arquivo) VALUES(?,?,?)');
  for (const [indice, [nome, ano, data, hora, fim]] of turmas.entries()) {
    const salaId = indice + 1;
    inserirSala.run(salaId, nome, ano);
    inserirHorario.run(salaId, data, hora, fim);
    inserirImportacao.run(salaId + 100, salaId, `turma-${salaId}.csv`);
  }
  db.prepare(`INSERT INTO alunos_importados
    (id,importacao_id,nome,total_respostas,pontos_total,tempo_medio_s,acertos,percentual_acerto)
    VALUES(1,101,'Ana',10,500,8,9,90)`).run();
  db.prepare(`INSERT INTO alunos_importados_atividades
    (id,aluno_importado_id,atividade,perguntas,acertos,percentual_acerto,tempo_medio_s)
    VALUES(1,1,'soma',10,9,90,8)`).run();

  db.prepare(`INSERT INTO sessoes(sala_id,status,aberta_em,iniciada_em,encerrada_em,rotulo)
    VALUES(7,'encerrada','2026-10-19T13:30:00-03:00','2026-10-19T13:30:00-03:00',
      '2026-10-19T14:25:00-03:00','Atividade 1 - 19/10/2026')`).run();
  const existingSessionId = db.prepare('SELECT id FROM sessoes').get().id;

  migrateImportedActivitySessions(db);

  const sessoes = db.prepare(`SELECT id,sala_id,rotulo,importacao_id
    FROM sessoes ORDER BY sala_id,COALESCE(iniciada_em,aberta_em)`).all();
  assert.equal(sessoes.length, 9);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM importacoes_sala').get().n, 8);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM alunos_importados').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM alunos_importados_atividades').get().n, 1);
  for (const [indice, [, , data]] of turmas.entries()) {
    const sessao = db.prepare('SELECT rotulo,importacao_id FROM sessoes WHERE sala_id=? AND importacao_id=?')
      .get(indice + 1, indice + 101);
    assert.ok(sessao);
    assert.equal(sessao.rotulo, `Atividade 1 - ${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`);
  }
  assert.equal(db.prepare('SELECT id FROM sessoes WHERE sala_id=7 AND importacao_id IS NULL').get().id, existingSessionId);
  assert.equal(db.prepare('SELECT rotulo FROM sessoes WHERE id=?').get(existingSessionId).rotulo, 'Atividade 2 - 19/10/2026');

  const beforeSecondRun = db.prepare('SELECT id,sala_id,rotulo,importacao_id FROM sessoes ORDER BY id').all();
  migrateImportedActivitySessions(db);
  assert.deepEqual(db.prepare('SELECT id,sala_id,rotulo,importacao_id FROM sessoes ORDER BY id').all(), beforeSecondRun);
  db.close();
});

test('relatório da atividade vinculada preserva os totais do relatório histórico', () => {
  const db = bancoHistorico();
  db.prepare('INSERT INTO importacoes_sala VALUES(101,8,?,?)')
    .run('relatorio-antigo.csv', '2026-10-08 13:00:00');
  db.prepare('INSERT INTO alunos_importados VALUES(1,101,?,?,?,?,?,?)')
    .run('Ana', 10, 500, 8, 9, 90);
  db.prepare('INSERT INTO alunos_importados VALUES(2,101,?,?,?,?,?,?)')
    .run('Bia', 5, 250, 10, 4, 80);
  db.prepare('INSERT INTO alunos_importados_atividades VALUES(1,1,?,?,?,?,?)')
    .run('soma', 6, 6, 100, 4);
  db.prepare('INSERT INTO alunos_importados_atividades VALUES(2,1,?,?,?,?,?)')
    .run('subtracao', 4, 3, 75, 6);
  db.prepare('INSERT INTO alunos_importados_atividades VALUES(3,2,?,?,?,?,?)')
    .run('soma', 5, 4, 80, 10);

  const relatorio = detalharAtividadeImportada(db, {
    id: 25,
    sala_id: 8,
    importacao_id: 101,
    sala: 'Turma',
    ano: 2,
    status: 'encerrada',
    rotulo: 'Atividade 1 - 08/10/2026',
    aberta_em: '2026-10-08T13:00:00-03:00',
    iniciada_em: '2026-10-08T13:00:00-03:00',
    encerrada_em: '2026-10-08T13:55:00-03:00',
  });

  assert.equal(relatorio.rotulo, 'Atividade 1 - 08/10/2026');
  assert.deepEqual(relatorio.totais, {
    criancas: 2,
    perguntas_max: 10,
    acertos: 13,
    respostas: 15,
    pontos: 750,
    aproveitamento_soma: 13,
    percentual_geral: 86.7,
  });
  assert.deepEqual(relatorio.por_atividade.map(({ atividade, perguntas, acertos, percentual_acerto }) => ({
    atividade, perguntas, acertos, percentual_acerto,
  })), [
    { atividade: 'subtracao', perguntas: 4, acertos: 3, percentual_acerto: 75 },
    { atividade: 'soma', perguntas: 11, acertos: 10, percentual_acerto: 90.9 },
  ]);
  assert.equal(relatorio.alunos.length, 2);
  assert.equal(relatorio.por_aluno_atividade.length, 3);
  assert.equal(relatorio.duracao_min, 55);
  db.close();
});

test('banco de seed contém uma atividade histórica vinculada para cada turma atual', () => {
  const db = new DatabaseSync(path.resolve(__dirname, '../database/matematica.db'), { readOnly: true });
  try {
    const atividades = db.prepare(`SELECT sa.nome, se.rotulo, se.status,
        i.id AS importacao_id, COUNT(DISTINCT ai.id) AS alunos,
        COUNT(aa.id) AS atividades_importadas
      FROM salas sa
      JOIN sessoes se ON se.sala_id=sa.id
      JOIN importacoes_sala i ON i.id=se.importacao_id
      LEFT JOIN alunos_importados ai ON ai.importacao_id=i.id
      LEFT JOIN alunos_importados_atividades aa ON aa.aluno_importado_id=ai.id
      GROUP BY se.id ORDER BY sa.nome`).all();
    const esperado = new Map([
      ['2:2', 'Atividade 1 - 08/10/2026'],
      ['2:4', 'Atividade 1 - 06/10/2026'],
      ['2:7', 'Atividade 1 - 05/10/2026'],
      ['2:8', 'Atividade 1 - 08/10/2026'],
      ['3:5', 'Atividade 1 - 06/10/2026'],
      ['3:6', 'Atividade 1 - 08/10/2026'],
      ['3:7', 'Atividade 1 - 05/10/2026'],
      ['3:8', 'Atividade 1 - 08/10/2026'],
    ]);

    assert.equal(atividades.length, 8);
    for (const atividade of atividades) {
      const [, ano, turma] = atividade.nome.match(/^([23])º ano\s*-\s*(\d+)/);
      assert.equal(atividade.rotulo, esperado.get(`${ano}:${turma}`));
      assert.equal(atividade.status, 'encerrada');
      assert.ok(atividade.importacao_id);
      assert.ok(atividade.alunos > 0);
      assert.ok(atividade.atividades_importadas > 0);
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM importacoes_sala').get().n, 8);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM alunos_importados').get().n, 151);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM alunos_importados_atividades').get().n, 831);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM respostas').get().n, 261);
  } finally {
    db.close();
  }
});
