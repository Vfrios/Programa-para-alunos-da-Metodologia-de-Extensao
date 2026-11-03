const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { excluirAtividade } = require('./activity-deletion');

function criarBanco() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE sessoes(id INTEGER PRIMARY KEY, status TEXT NOT NULL, importacao_id INTEGER);
    CREATE TABLE alunos(id INTEGER PRIMARY KEY, sessao_id INTEGER NOT NULL);
    CREATE TABLE respostas(id INTEGER PRIMARY KEY, sessao_id INTEGER NOT NULL);
    CREATE TABLE desafios(id INTEGER PRIMARY KEY, sessao_id INTEGER NOT NULL);
    CREATE TABLE premiacoes(id INTEGER PRIMARY KEY, sessao_id INTEGER NOT NULL);
    CREATE TABLE historico_ranking(id INTEGER PRIMARY KEY, sessao_id INTEGER NOT NULL);
    CREATE TABLE perfis(aluno_id INTEGER NOT NULL);
    CREATE TABLE importacoes_sala(id INTEGER PRIMARY KEY, sala_id INTEGER, arquivo TEXT);
    CREATE TABLE alunos_importados(id INTEGER PRIMARY KEY, importacao_id INTEGER, linha_origem INTEGER);
    CREATE TABLE alunos_importados_atividades(id INTEGER PRIMARY KEY, aluno_importado_id INTEGER);
    CREATE TABLE sugestoes_revisao(aluno_importado_id INTEGER PRIMARY KEY);
    CREATE TABLE exclusoes_alunos_importados(
      sala_id INTEGER NOT NULL, arquivo TEXT NOT NULL, linha_origem INTEGER NOT NULL, nome TEXT,
      UNIQUE(sala_id,arquivo,linha_origem)
    );
  `);
  return db;
}

test('exclui atividade encerrada e todos os dados associados', () => {
  const db = criarBanco();
  db.prepare('INSERT INTO sessoes VALUES(1,?,NULL)').run('encerrada');
  db.prepare('INSERT INTO alunos VALUES(10,1)').run();
  for (const tabela of ['respostas', 'desafios', 'premiacoes', 'historico_ranking']) {
    db.prepare(`INSERT INTO ${tabela} VALUES(1,1)`).run();
  }
  db.prepare('INSERT INTO perfis VALUES(10)').run();

  assert.deepEqual(excluirAtividade(db, 1), [10]);
  assert.equal(db.prepare("SELECT status FROM sessoes WHERE id=1").get().status, 'excluida');
  for (const tabela of ['alunos', 'respostas', 'desafios', 'premiacoes', 'historico_ranking', 'perfis']) {
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get().n, 0, tabela);
  }
  db.close();
});

test('exclui dados históricos importados e persiste exclusões para futuras sincronizações', () => {
  const db = criarBanco();
  db.prepare('INSERT INTO sessoes VALUES(1,?,5)').run('encerrada');
  db.prepare('INSERT INTO importacoes_sala VALUES(5,2,?)').run('relatorio.csv');
  db.prepare('INSERT INTO alunos_importados VALUES(9,5,3)').run();
  db.prepare('INSERT INTO alunos_importados_atividades VALUES(7,9)').run();
  db.prepare('INSERT INTO sugestoes_revisao VALUES(9)').run();
  db.prepare(`INSERT INTO exclusoes_alunos_importados(sala_id,arquivo,linha_origem,nome)
    VALUES(2,'relatorio.csv',3,'Nome antigo')`).run();

  excluirAtividade(db, 1);

  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM alunos_importados').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM alunos_importados_atividades').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sugestoes_revisao').get().n, 0);
  assert.equal(db.prepare(`SELECT nome FROM exclusoes_alunos_importados
    WHERE sala_id=2 AND arquivo='relatorio.csv' AND linha_origem=3`).get().nome, null);
  assert.equal(db.prepare('SELECT importacao_id FROM sessoes WHERE id=1').get().importacao_id, 5);
  db.close();
});

test('não altera sessões que não foram encerradas nem sessões inexistentes', () => {
  const db = criarBanco();
  db.prepare('INSERT INTO sessoes VALUES(1,?,NULL)').run('aguardando');

  assert.throws(() => excluirAtividade(db, 1), /Só é possível excluir atividades encerradas/);
  assert.throws(() => excluirAtividade(db, 2), /Atividade não encontrada/);
  assert.equal(db.prepare('SELECT status FROM sessoes WHERE id=1').get().status, 'aguardando');
  db.close();
});
