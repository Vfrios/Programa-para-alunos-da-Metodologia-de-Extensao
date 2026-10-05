const test = require('node:test');
const assert = require('node:assert/strict');
const { TIPOS_DESAFIO, tipoDoDesafio, criarDesafio } = require('./desafios');

test('o primeiro desafio é memória e os tipos só se repetem depois de cinco rodadas', () => {
  const tipos = Array.from({ length: 15 }, (_, i) => tipoDoDesafio(i + 1));
  assert.equal(tipos[0], 'memoria');
  assert.notEqual(tipos[1], 'memoria');
  assert.deepEqual(new Set(tipos.slice(0, 5)), new Set(TIPOS_DESAFIO));
  assert.deepEqual(tipos.slice(0, 5), tipos.slice(5, 10));
  assert.deepEqual(tipos.slice(5, 10), tipos.slice(10, 15));
});

test('todos os desafios geram resposta válida e opções distintas no nível do aluno', () => {
  for (let rodada = 1; rodada <= TIPOS_DESAFIO.length; rodada++) {
    for (let nivel = 1; nivel <= 5; nivel++) {
      const desafio = criarDesafio(rodada, nivel);
      assert.equal(desafio.tipo, tipoDoDesafio(rodada));
      assert.ok(desafio.texto.length > 0);
      assert.ok(desafio.resposta.length > 0);
      if (desafio.opcoes) {
        assert.equal(new Set(desafio.opcoes).size, desafio.opcoes.length);
        assert.ok(desafio.opcoes.includes(desafio.resposta));
      }
    }
  }
});
