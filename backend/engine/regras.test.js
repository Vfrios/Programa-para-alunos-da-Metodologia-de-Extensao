const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularPontos, ajustarNivel } = require('./regras');
const { ATIVIDADES, ATIVIDADES_POR_ANO, MODELOS_ENUNCIADO, gerarPergunta, criarSorteadorDeAtividades, criarSorteadorDeModelos } = require('./gerador');

function simularPerguntas(respostas) {
  const aleatorioOriginal = Math.random;
  Math.random = () => 0;
  try {
    let nivelSalvo = 1;
    return respostas.map(({ correta, segundos, tentativas = 1 }) => {
      const pergunta = gerarPergunta('soma', nivelSalvo);
      const nivelApos = ajustarNivel(nivelSalvo, correta, segundos, tentativas);
      const resultado = { nivelAplicado: pergunta.nivel, nivelApos };
      nivelSalvo = nivelApos;
      return resultado;
    });
  } finally {
    Math.random = aleatorioOriginal;
  }
}

test('pontuacao por pergunta segue o esquema oficial do jogo', () => {
  const acertoPrimeira = calcularPontos({ nivel: 1, tempoSegundos: 3, tentativas: 1, dica: 0, correta: true, combo: 1 });
  const combo2 = calcularPontos({ nivel: 1, tempoSegundos: 3, tentativas: 1, dica: 0, correta: true, combo: 2 });
  const combo4 = calcularPontos({ nivel: 1, tempoSegundos: 3, tentativas: 1, dica: 0, correta: true, combo: 4 });
  const combo10 = calcularPontos({ nivel: 5, tempoSegundos: 12, tentativas: 1, dica: 0, correta: true, combo: 10 });
  const comErro = calcularPontos({ nivel: 3, tempoSegundos: 8, tentativas: 2, dica: 0, correta: true, combo: 0 });
  const comDica = calcularPontos({ nivel: 3, tempoSegundos: 8, tentativas: 4, dica: 1, correta: true, combo: 0 });

  assert.equal(acertoPrimeira, 100);
  assert.equal(combo2, 110);
  assert.equal(combo4, 120);
  assert.equal(combo10, 150);
  assert.equal(comErro, 50);
  assert.equal(comDica, 10);
  assert.ok(acertoPrimeira <= 150);
  assert.ok(combo2 <= 150);
  assert.ok(combo10 <= 150);
});

test('nivel sobe com acerto rapido e desce com erro persistente', () => {
  assert.equal(ajustarNivel(1, true, 3), 1.5);
  assert.equal(ajustarNivel(2, true, 15), 2);
  assert.equal(ajustarNivel(2, false, 25), 1.5);
  assert.equal(ajustarNivel(2, true, 3, 2), 2);
});

test('simula 15 perguntas com acertos rapidos e progressao gradual', () => {
  const respostas = Array.from({ length: 15 }, () => ({ correta: true, segundos: 4 }));
  const percurso = simularPerguntas(respostas);

  assert.deepEqual(percurso.map(({ nivelAplicado }) => nivelAplicado), [1, 1, 2, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
  assert.deepEqual(percurso.map(({ nivelApos }) => nivelApos), [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5, 5, 5, 5, 5, 5, 5]);
});

test('simula 15 perguntas e reduz a faixa apos erros persistentes', () => {
  const respostas = Array.from({ length: 15 }, (_, indice) => ({
    correta: indice < 6,
    segundos: indice < 6 ? 4 : 25,
  }));
  const percurso = simularPerguntas(respostas);

  assert.deepEqual(percurso.map(({ nivelAplicado }) => nivelAplicado), [1, 1, 2, 2, 3, 3, 4, 3, 3, 2, 2, 1, 1, 1, 1]);
  assert.deepEqual(percurso.map(({ nivelApos }) => nivelApos), [1.5, 2, 2.5, 3, 3.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 1, 1, 1]);
});

test('nivel inicial gera a conta basica 1 + 1', () => {
  const aleatorioOriginal = Math.random;
  Math.random = () => 0;
  try {
    const pergunta = gerarPergunta('soma', 1);
    assert.equal(pergunta.texto, '1 + 1 = ?');
    assert.equal(pergunta.resposta, '2');
  } finally {
    Math.random = aleatorioOriginal;
  }
});

test('a turma do 3º ano limita as perguntas a numeros de ate tres digitos', () => {
  const aleatorioOriginal = Math.random;
  Math.random = () => 0.99999;
  try {
    const pergunta = gerarPergunta('soma', 5, undefined, 3);
    assert.equal(pergunta.nivel, 4);
    assert.match(pergunta.texto, /899/);
    assert.equal(Number(pergunta.resposta), 999);
  } finally {
    Math.random = aleatorioOriginal;
  }
});

test('a turma do 2º ano nunca recebe numeros com mais de dois digitos', () => {
  for (const atividade of ATIVIDADES_POR_ANO[2]) {
    for (let tentativa = 0; tentativa < 100; tentativa++) {
      const pergunta = gerarPergunta(atividade, 5, undefined, 2);
      const numeros = [...pergunta.texto.matchAll(/\d+/g)].map(([numero]) => Number(numero));
      const opcoes = (pergunta.opcoes || []).map(Number).filter(Number.isFinite);
      assert.equal(pergunta.nivel, 3);
      assert.ok([...numeros, ...opcoes, Number(pergunta.resposta)].filter(Number.isFinite).every((numero) => numero <= 99),
        `${atividade}: ${pergunta.texto} = ${pergunta.resposta}`);
    }
  }
});

test('a turma do 3º ano nunca recebe numeros com mais de tres digitos', () => {
  for (const atividade of ATIVIDADES) {
    for (let tentativa = 0; tentativa < 100; tentativa++) {
      const pergunta = gerarPergunta(atividade, 5, undefined, 3);
      const numeros = [...pergunta.texto.matchAll(/\d+/g)].map(([numero]) => Number(numero));
      const opcoes = (pergunta.opcoes || []).map(Number).filter(Number.isFinite);
      assert.equal(pergunta.nivel, 4);
      assert.ok([...numeros, ...opcoes, Number(pergunta.resposta)].filter(Number.isFinite).every((numero) => numero <= 999),
        `${atividade}: ${pergunta.texto} = ${pergunta.resposta}`);
    }
  }
});

test('ano 2 e ano 3 possuem conteudos basicos esperados', () => {
  assert.deepEqual(ATIVIDADES_POR_ANO[2], ['soma', 'subtracao', 'sequencia', 'par_impar', 'antecessor_sucessor']);
  assert.ok(ATIVIDADES_POR_ANO[3].includes('sequencia'));
  assert.ok(!ATIVIDADES.includes('divisao'));
  assert.ok(!ATIVIDADES.includes('decomposicao'));
  assert.ok(ATIVIDADES.includes('antecessor_sucessor'));
  assert.ok(gerarPergunta('antecessor_sucessor', 2).tipo === 'digitar');
});

test('sequencias variam os passos e apresentam a opcao correta', () => {
  const aleatorioOriginal = Math.random;
  const numerosAleatorios = [0, 0, 0, 0, 0, 0.9, 0.1];
  let indiceAleatorio = 0;
  Math.random = () => numerosAleatorios[indiceAleatorio++ % numerosAleatorios.length];
  try {
    const sequencia = gerarPergunta('sequencia', 1);
    assert.equal(sequencia.texto, 'Complete: 4, __, 6, 7');
    assert.equal(sequencia.resposta, '5');
    assert.equal(sequencia.tipo, 'clicar');
    assert.ok(sequencia.opcoes.includes(sequencia.resposta));
    assert.throws(() => gerarPergunta('divisao', 1), /Atividade inválida/);
    assert.throws(() => gerarPergunta('decomposicao', 1), /Atividade inválida/);
  } finally {
    Math.random = aleatorioOriginal;
  }
});

test('sorteio percorre todos os conteudos antes de repetir atividade', () => {
  const sortear = criarSorteadorDeAtividades();
  const conteudos = ['soma', 'subtracao', 'sequencia'];
  const sorteados = Array.from({ length: 9 }, () => sortear(conteudos));

  assert.notEqual(sorteados[0], sorteados[1]);
  assert.notEqual(sorteados[1], sorteados[2]);
  assert.notEqual(sorteados[2], sorteados[3]);
  assert.notEqual(sorteados[3], sorteados[4]);
  assert.notEqual(sorteados[4], sorteados[5]);
  assert.notEqual(sorteados[5], sorteados[6]);
  assert.notEqual(sorteados[6], sorteados[7]);
  assert.notEqual(sorteados[7], sorteados[8]);
  assert.deepEqual(new Set(sorteados.slice(0, 3)), new Set(conteudos));
  assert.deepEqual(new Set(sorteados.slice(3, 6)), new Set(conteudos));
  assert.deepEqual(new Set(sorteados.slice(6, 9)), new Set(conteudos));
});

test('modelos de enunciado percorrem opções diferentes antes de repetir', () => {
  const sortear = criarSorteadorDeModelos();
  const modelos = ['equacao', 'historia', 'imagem'];
  const primeiraVolta = modelos.map(() => sortear(modelos));
  const segundaVolta = modelos.map(() => sortear(modelos));

  assert.deepEqual(new Set(primeiraVolta), new Set(modelos));
  assert.deepEqual(new Set(segundaVolta), new Set(modelos));
  assert.notEqual(primeiraVolta.at(-1), segundaVolta[0]);
});

test('cada conteúdo tem 30 enunciados diferentes antes de repetir um modelo', () => {
  for (const modelos of Object.values(MODELOS_ENUNCIADO)) {
    assert.equal(modelos.length, 30);
    assert.equal(new Set(modelos).size, 30);
    const sortear = criarSorteadorDeModelos();
    const primeiraVolta = Array.from({ length: 30 }, () => sortear(modelos));
    const segundaVolta = Array.from({ length: 30 }, () => sortear(modelos));
    assert.equal(new Set(primeiraVolta).size, 30);
    assert.equal(new Set(segundaVolta).size, 30);
    assert.notEqual(primeiraVolta.at(-1), segundaVolta[0]);
  }
});

test('cada pergunta gerada percorre 30 enunciados distintos por conteúdo', () => {
  const aleatorioOriginal = Math.random;
  let semente = 137;
  Math.random = () => {
    semente = (semente * 16807) % 2147483647;
    return (semente - 1) / 2147483646;
  };
  try {
    for (const atividade of ATIVIDADES) {
      const sortearModelo = criarSorteadorDeModelos();
      const perguntas = Array.from({ length: 30 }, () => gerarPergunta(atividade, 1, sortearModelo));
      assert.equal(new Set(perguntas.map((pergunta) => pergunta.texto)).size, 30, atividade);
    }
  } finally {
    Math.random = aleatorioOriginal;
  }
});

test('todos os geradores produzem resposta válida e alternativas sem repetição', () => {
  for (const atividade of ATIVIDADES) {
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const pergunta = gerarPergunta(atividade, tentativa % 5 + 1);
      assert.ok(pergunta.texto.length > 0);
      assert.ok(pergunta.resposta.length > 0);
      if (pergunta.opcoes) {
        assert.equal(new Set(pergunta.opcoes).size, pergunta.opcoes.length);
        assert.ok(pergunta.opcoes.includes(pergunta.resposta));
      }
    }
  }
});
