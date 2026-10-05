const TIPOS_DESAFIO = ['memoria', 'calculo', 'sequencia', 'par_impar', 'maior_menor'];
const LIMITES = { 1: 5, 2: 10, 3: 99, 4: 999, 5: 9999 };
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const mix = (a) => [...a].sort(() => Math.random() - 0.5);

function tipoDoDesafio(rodada) {
  if (!Number.isSafeInteger(rodada) || rodada < 1) throw new Error('Rodada inválida.');
  return TIPOS_DESAFIO[(rodada - 1) % TIPOS_DESAFIO.length];
}

function criarDesafio(rodada, nivel = 1, ano = 3) {
  const tipo = tipoDoDesafio(rodada);
  const nivelMaximo = Number(ano) === 2 ? 2 : 5;
  const n = Math.max(1, Math.min(nivelMaximo, Math.floor(Number(nivel) || 1)));
  const limite = LIMITES[n];

  if (tipo === 'memoria') {
    const pares = Number(ano) === 2 ? 2 : 3;
    return { tipo, nivel: n, pares, texto: `Encontre os ${pares} pares de emojis!`, resposta: 'concluido' };
  }
  if (tipo === 'calculo') {
    const limiteCalculo = Number(ano) === 2 ? Math.min(limite, 5) : limite;
    const x = rnd(1, limiteCalculo), y = rnd(1, limiteCalculo), resposta = String(x + y);
    const opcoes = new Set([resposta]);
    while (opcoes.size < 3) {
      const alternativa = Math.max(0, Number(resposta) + rnd(-5, 5));
      opcoes.add(String(Number(ano) === 2 ? Math.min(10, alternativa) : alternativa));
    }
    return { tipo, nivel: n, texto: `Resolva no tempo: ${x} + ${y} = ?`, resposta, opcoes: mix([...opcoes]) };
  }
  if (tipo === 'sequencia') {
    const passo = rnd(1, Math.max(1, Math.floor(limite / 8)));
    const inicio = rnd(1, Math.max(1, limite - passo * 3));
    const resposta = String(inicio + passo * 2);
    return {
      tipo, nivel: n,
      texto: `Qual número completa a sequência? ${inicio}, ${inicio + passo}, __, ${inicio + passo * 3}`,
      resposta,
      opcoes: mix([resposta, String(Math.max(0, Number(resposta) - passo)), String(Number(resposta) + passo)]),
    };
  }
  if (tipo === 'par_impar') {
    const numero = rnd(1, limite);
    return { tipo, nivel: n, texto: `O número ${numero} é par ou ímpar?`, resposta: numero % 2 ? 'Ímpar' : 'Par', opcoes: ['Par', 'Ímpar'] };
  }

  const valores = new Set();
  while (valores.size < 3) valores.add(rnd(1, limite));
  const opcoes = mix([...valores].map(String));
  return { tipo, nivel: n, texto: 'Toque no maior número!', resposta: String(Math.max(...valores)), opcoes };
}

module.exports = { TIPOS_DESAFIO, tipoDoDesafio, criarDesafio };
