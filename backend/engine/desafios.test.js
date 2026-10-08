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

test('os desafios do 2º ano limitam o nível e reduzem a memória para dois pares', () => {
  for (let rodada = 1; rodada <= TIPOS_DESAFIO.length; rodada++) {
    const desafio = criarDesafio(rodada, 5, 2);
    assert.equal(desafio.nivel, 2);
    if (desafio.tipo === 'memoria') {
      assert.equal(desafio.pares, 2);
      assert.match(desafio.texto, /2 pares/);
    }
  }
});

test('os desafios do 3º ano limitam o nível a três dígitos e mantêm três pares de memória', () => {
  const desafio = criarDesafio(1, 5, 3);
  assert.equal(desafio.nivel, 4);
  assert.equal(desafio.pares, 3);
});

test('os desafios numéricos do 2º ano usam valores de até dez', () => {
  for (const rodada of [2, 3, 4, 5]) {
    const desafio = criarDesafio(rodada, 5, 2);
    const numeros = [...desafio.texto.matchAll(/\d+/g)].map(([numero]) => Number(numero));
    const opcoes = (desafio.opcoes || []).map(Number).filter(Number.isFinite);
    assert.ok([...numeros, ...opcoes].every((numero) => numero <= 10));
  }
});

test('os desafios numéricos do 3º ano não ultrapassam três dígitos', () => {
  for (const rodada of [2, 3, 4, 5]) {
    for (let tentativa = 0; tentativa < 100; tentativa++) {
      const desafio = criarDesafio(rodada, 5, 3);
      const numeros = [...desafio.texto.matchAll(/\d+/g)].map(([numero]) => Number(numero));
      const opcoes = (desafio.opcoes || []).map(Number).filter(Number.isFinite);
      assert.ok([...numeros, ...opcoes, Number(desafio.resposta)].filter(Number.isFinite).every((numero) => numero <= 999),
        `${desafio.texto} = ${desafio.resposta}`);
    }
  }
});
