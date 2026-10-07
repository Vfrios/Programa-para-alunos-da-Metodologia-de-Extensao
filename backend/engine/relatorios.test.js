const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { aproveitamentoResposta } = require('./relatorios');

test('percentual ponderado dá crédito conforme tentativas registradas', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE respostas(correta INTEGER NOT NULL,tentativas INTEGER NOT NULL)');
  const inserir = db.prepare('INSERT INTO respostas(correta,tentativas) VALUES(?,?)');
  [[1, 1], [1, 2], [1, 3], [1, 4], [0, 4], [0, 5]].forEach((resposta) => inserir.run(...resposta));

  const resultados = db.prepare(`SELECT ${aproveitamentoResposta('respostas')} AS credito FROM respostas`).all();

  assert.deepEqual(resultados.map(({ credito }) => credito), [1, 0.75, 0.25, 0, 0, 0]);
  db.close();
});
