const TIPOS_DESAFIO = ['memoria', 'calculo', 'sequencia', 'par_impar', 'maior_menor'];
const LIMITES = { 1: 5, 2: 10, 3: 99, 4: 999, 5: 999 };
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

function mix(a) {
  const resultado = [...a];
  for (let i = resultado.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }
  return resultado;
}

function tipoDoDesafio(rodada) {
  if (!Number.isSafeInteger(rodada) || rodada < 1) throw new Error('Rodada inválida.');
  return TIPOS_DESAFIO[(rodada - 1) % TIPOS_DESAFIO.length];
}

const MEMORIA_TEMAS = [
  ['🐸', '🚀', '🍎'], ['🐟', '🐢', '🦀'], ['🐶', '🐱', '🐰'],
  ['🌙', '⭐', '☁️'], ['🚒', '🚜', '✈️'], ['🦋', '🌼', '🐝'],
  ['🍕', '🍔', '🍟'], ['⚽', '🏀', '🎾'], ['🎈', '🎁', '🎨'],
  ['🐘', '🦁', '🐯'], ['🌈', '☀️', '🌊'], ['🍓', '🍇', '🍊'],
];

function criarDesafio(rodada, nivel = 1, ano = 3) {
  const tipo = tipoDoDesafio(rodada);
  const nivelMaximo = Number(ano) === 2 ? 2 : 4;
  const n = Math.max(1, Math.min(nivelMaximo, Math.floor(Number(nivel) || 1)));
  const limiteBase = LIMITES[n];
  const limite = Number(ano) === 2 ? Math.min(limiteBase, 99) : limiteBase;

  if (tipo === 'memoria') {
    const pares = Number(ano) === 2 ? 2 : 3;
    const tema = MEMORIA_TEMAS[(rodada - 1) % MEMORIA_TEMAS.length];
    const emojis = tema.slice(0, pares);
    return {
      tipo, nivel: n, pares, emojis,
      texto: `Encontre os ${pares} pares de emojis!`, resposta: 'concluido'
    };
  }

  if (tipo === 'calculo') {
    const limiteCalculo = Number(ano) === 2 ? Math.min(limite, 10) : limite;
    const maxX = Math.max(2, limiteCalculo - 1);
    const x = rnd(1, maxX);
    const y = rnd(1, Math.max(1, limiteCalculo - x));
    const resposta = String(x + y);
    const opcoes = new Set([resposta]);
    let tentativas = 0;
    while (opcoes.size < 3 && tentativas < 30) {
      tentativas++;
      const delta = rnd(-5, 5) || 1;
      const alternativa = Math.max(0, Math.min(limiteCalculo, Number(resposta) + delta));
      if (String(alternativa) !== resposta) opcoes.add(String(alternativa));
    }
    return { tipo, nivel: n, texto: `Resolva no tempo: ${x} + ${y} = ?`, resposta, opcoes: mix([...opcoes]) };
  }

  if (tipo === 'sequencia') {
    const passoMax = Math.max(1, Math.floor(limite / 10));
    const passo = rnd(1, passoMax);
    const inicio = rnd(1, Math.max(1, limite - passo * 3));
    const resposta = String(inicio + passo * 2);
    const opcoes = new Set([resposta]);
    opcoes.add(String(Math.max(0, Number(resposta) - passo)));
    opcoes.add(String(Number(resposta) + passo));
    while (opcoes.size < 3) opcoes.add(String(Number(resposta) + rnd(1, passo)));
    return {
      tipo, nivel: n,
      texto: `Qual número completa a sequência? ${inicio}, ${inicio + passo}, __, ${inicio + passo * 3}`,
      resposta, opcoes: mix([...opcoes]),
    };
  }

  if (tipo === 'par_impar') {
    const numero = rnd(1, limite);
    return {
      tipo, nivel: n, texto: `O número ${numero} é par ou ímpar?`,
      resposta: numero % 2 ? 'Ímpar' : 'Par', opcoes: ['Par', 'Ímpar']
    };
  }

  const valores = new Set();
  let tentativas = 0;
  while (valores.size < 3 && tentativas < 30) {
    tentativas++;
    valores.add(rnd(1, limite));
  }
  const opcoes = mix([...valores].map(String));
  return { tipo, nivel: n, texto: 'Toque no maior número!', resposta: String(Math.max(...valores)), opcoes };
}

module.exports = { TIPOS_DESAFIO, tipoDoDesafio, criarDesafio };
