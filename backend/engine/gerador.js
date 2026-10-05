// Geração automática de perguntas + dicas. Nada de perguntas no banco.
const FAIXAS = { 1: [1, 5], 2: [1, 10], 3: [10, 99], 4: [100, 999], 5: [1000, 9999] };
const FATOR  = { 1: [1, 3], 2: [2, 5], 3: [2, 7], 4: [3, 9], 5: [5, 10] };
const PASSOS_SEQUENCIA = { 1: [1], 2: [1, 2], 3: [2, 5], 4: [5, 10], 5: [10, 100] };
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const mix = (a) => {
  const resultado = [...a];
  for (let i = resultado.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }
  return resultado;
};
const escolher = (opcoes, sortearModelo = (itens) => itens[rnd(0, itens.length - 1)]) => sortearModelo(opcoes);
const ATIVIDADES_POR_ANO = {
  2: ['soma', 'subtracao', 'sequencia', 'par_impar', 'antecessor_sucessor'],
  3: ['soma', 'subtracao', 'multiplicacao', 'sequencia', 'par_impar', 'maior_menor', 'formas', 'medidas']
};

const FORMAS = [
  { n: 'triângulo', g: '▲', l: 3, min: 1 }, { n: 'quadrado', g: '■', l: 4, min: 1 }, { n: 'círculo', g: '●', l: 0, min: 1 },
  { n: 'retângulo', g: '▬', l: 4, min: 2 }, { n: 'pentágono', g: '⬟', l: 5, min: 3 }, { n: 'hexágono', g: '⬢', l: 6, min: 4 },
];
const MEDIDAS = [
  { o: '✏️ um lápis', u: 'cm', min: 1 }, { o: '🚪 uma porta', u: 'm', min: 1 }, { o: '🛣️ uma estrada', u: 'km', min: 1 },
  { o: '🍼 uma garrafa de água', u: 'L', min: 1 }, { o: '🍚 um saco de arroz', u: 'kg', min: 1 },
  { o: '🐜 uma formiga', u: 'mm', min: 3 }, { o: '🍬 uma balinha', u: 'g', min: 3 }, { o: '🥄 uma colher de xarope', u: 'mL', min: 3 },
];
const UNID = [['mm', 3], ['cm', 1], ['m', 1], ['km', 1], ['g', 3], ['kg', 1], ['mL', 3], ['L', 1]];

const DICAS = { soma: 'Conte nos dedos', subtracao: 'Tire do primeiro número', multiplicacao: 'É o mesmo que somar várias vezes',
  formas: 'Conte os lados', medidas: 'Compare com objetos conhecidos', par_impar: 'Veja o último número', maior_menor: 'Conte nos dedos',
  antecessor_sucessor: 'Pense no número que vem antes ou depois.', sequencia: 'Descubra quanto aumenta ou diminui de um número para o seguinte.' };

const criarModelos = (aberturas, perguntas) =>
  aberturas.flatMap((abertura) => perguntas.map((pergunta) => `${abertura}${pergunta}`));
const ABERTURAS = ['', 'Desafio matemático: ', 'Ajude o robô: ', 'Pense e responda: ', 'Sua missão de hoje: '];
const MODELOS_ENUNCIADO = {
  soma: criarModelos(ABERTURAS, [
    '{x} + {y} = ?',
    'Quanto é {x} mais {y}?',
    'Some {x} e {y}. Qual é o resultado?',
    'Junte {x} com {y}. Quantos são ao todo?',
    'Qual é a soma de {x} e {y}?',
    'Havia {x} objetos e chegaram mais {y}. Quantos há agora?',
  ]),
  subtracao: criarModelos(ABERTURAS, [
    '{x} − {y} = ?',
    'Quanto é {x} menos {y}?',
    'Tire {y} de {x}. Quanto sobra?',
    'Qual é a diferença entre {x} e {y}?',
    'Você tinha {x} objetos e usou {y}. Quantos restaram?',
    'De {x}, retire {y}. Qual número fica?',
  ]),
  multiplicacao: criarModelos(ABERTURAS, [
    '{x} × {y} = ?',
    'Quanto é {x} vezes {y}?',
    'Some {x} grupos de {y}. Qual é o total?',
    'Há {y} grupos com {x} objetos em cada um. Quantos objetos há?',
    'Se cada grupo tem {x} itens e há {y} grupos, quantos itens são?',
    'Descubra o resultado de {x} multiplicado por {y}.',
  ]),
  sequencia: criarModelos(ABERTURAS, [
    'Complete: {sequencia}',
    'Qual número está faltando? {sequencia}',
    'Descubra o próximo passo da sequência: {sequencia}',
    'Que número deve ocupar o espaço vazio? {sequencia}',
    'Observe o padrão e complete: {sequencia}',
    'Ajude o trem numérico a continuar: {sequencia}',
  ]),
  antecessor_sucessor: criarModelos(ABERTURAS, [
    'Qual número vem {direcao} de {base}?',
    'Encontre o {nome} de {base}.',
    'Dê um passo para {lado} a partir de {base}. Em qual número chega?',
    'O sapo está no número {base}. Para qual número ele pula {lado}?',
    'Conte um número para {lado} de {base}. Onde chega?',
    'Qual vizinho fica {lado} de {base}?',
  ]),
  par_impar: criarModelos(ABERTURAS, [
    'O número {x} é par ou ímpar?',
    'Separe {x} no grupo dos pares ou dos ímpares.',
    'Se formar duplas com {x} objetos, sobra algum sem par?',
    'A quantidade {x} pode ser dividida em pares certinhos?',
    'Classifique o número {x}: par ou ímpar?',
    'Imagine {x} objetos em duplas. Fica um objeto sozinho?',
  ]),
  maior_menor: criarModelos(ABERTURAS, [
    'Qual número é {termo}: {x} ou {y}?',
    'Entre {x} e {y}, qual é o {termo}?',
    'Toque no valor {termo}. Compare {x} com {y}.',
    'Qual quantidade é {termo}, {x} ou {y}?',
    'Compare os números {x} e {y}. Qual é o {termo}?',
    'O número {termo} é {x} ou {y}?',
  ]),
  formas: criarModelos(ABERTURAS, [
    'Encontre a forma {forma}.',
    'Qual figura geométrica é o {forma}?',
    'Toque na figura que tem o nome {forma}.',
    'Escolha o desenho do {forma}.',
    'Procure entre as figuras: onde está o {forma}?',
    'Qual forma tem {lados} lados? Encontre o {forma}.',
  ]),
  medidas: criarModelos(ABERTURAS, [
    'Qual unidade combina com {objeto}?',
    'Escolha a unidade usada para medir {objeto}.',
    'Para medir {objeto}, qual unidade você usaria?',
    'Encontre a unidade adequada para {objeto}.',
    'Como podemos medir {objeto}? Escolha a unidade.',
    'Associe {objeto} à unidade de medida correta.',
  ]),
};
const preencherModelo = (modelo, valores) =>
  modelo.replace(/\{(\w+)\}/g, (_, chave) => String(valores[chave]));

function opcoesNumericas(resposta, quantidade = 3) {
  const opcoes = new Set([resposta]);
  while (opcoes.size < quantidade) {
    const tentativa = resposta + rnd(-5, 5);
    if (tentativa >= 0 && tentativa !== resposta) opcoes.add(tentativa);
  }
  return mix([...opcoes].map(String));
}

function criarSorteadorDeAtividades() {
  let assinatura = '', restantes = [], ultima = null;
  return (atividades) => {
    const disponiveis = [...new Set(atividades)];
    if (!disponiveis.length) return null;
    const novaAssinatura = [...disponiveis].sort().join('|');
    if (novaAssinatura !== assinatura || !restantes.length) {
      assinatura = novaAssinatura;
      restantes = mix(disponiveis);
      if (restantes.length > 1 && restantes[0] === ultima) [restantes[0], restantes[1]] = [restantes[1], restantes[0]];
    }
    ultima = restantes.shift();
    return ultima;
  };
}

function criarSorteadorDeModelos() {
  const ciclos = new Map();
  return (opcoes) => {
    const chave = opcoes.join('|');
    let ciclo = ciclos.get(chave);
    if (!ciclo || !ciclo.restantes.length) {
      const restantes = mix(opcoes);
      if (ciclo && restantes.length > 1 && restantes[0] === ciclo.ultimo) {
        [restantes[0], restantes[1]] = [restantes[1], restantes[0]];
      }
      ciclo = { restantes, ultimo: null };
      ciclos.set(chave, ciclo);
    }
    ciclo.ultimo = ciclo.restantes.shift();
    return ciclo.ultimo;
  };
}

const G = {
  soma(n, sortearModelo) { const [a, b] = FAIXAS[n]; const x = rnd(a, b), y = rnd(a, b);
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.soma, sortearModelo), { x, y });
    return { texto, tipo: 'digitar', resposta: x + y }; },
  subtracao(n, sortearModelo) { const [a, b] = FAIXAS[n]; let x = rnd(a, b), y = rnd(a, b); if (x === y) y = y === b ? y - 1 : y + 1; if (y > x) [x, y] = [y, x];
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.subtracao, sortearModelo), { x, y });
    return { texto, tipo: 'digitar', resposta: x - y }; },
  antecessor_sucessor(n, sortearModelo) {
    const [min, max] = FAIXAS[n], base = rnd(Math.max(2, min), max);
    const tipo = Math.random() < 0.5 ? 'antecessor' : 'sucessor';
    const valor = tipo === 'antecessor' ? base - 1 : base + 1;
    const direcao = tipo === 'antecessor' ? 'antes' : 'depois';
    const lado = tipo === 'antecessor' ? 'trás' : 'à frente';
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.antecessor_sucessor, sortearModelo),
      { base, direcao, lado, nome: tipo });
    return { texto, tipo: 'digitar', resposta: String(valor) };
  },
  multiplicacao(n, sortearModelo) {
    const [a, b] = FATOR[n]; const x = rnd(a, b), y = rnd(2, Math.min(2 + n, 6)), r = x * y;
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.multiplicacao, sortearModelo), { x, y });
    return { texto, tipo: 'arrastar', opcoes: opcoesNumericas(r), resposta: r,
      dica: { texto: `${x} × ${y} é o mesmo que ${Array(y).fill(x).join(' + ')}`, visual: `${Array(y).fill('🍎'.repeat(x)).join(' + ')} = ${r} 🍎` } };
  },
  sequencia(n, sortearModelo) {
    const passos = PASSOS_SEQUENCIA[n], passo = passos[rnd(0, passos.length - 1)];
    const direcao = Math.random() < 0.5 ? 1 : -1;
    const inicio = rnd(4, 10) * passo, lacuna = rnd(1, 3);
    const valores = Array.from({ length: 4 }, (_, i) => inicio + direcao * passo * i);
    const resposta = valores[lacuna];
    valores[lacuna] = '__';
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.sequencia, sortearModelo), { sequencia: valores.join(', ') });
    return { texto, tipo: 'clicar', opcoes: opcoesNumericas(resposta), resposta,
      dica: { texto: `A sequência avança ou volta de ${passo} em ${passo}.` } };
  },
  formas(n, sortearModelo) {
    const ok = FORMAS.filter((f) => f.min <= n), f = ok[rnd(0, ok.length - 1)];
    const outras = mix(ok.filter((x) => x !== f)).slice(0, 2);
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.formas, sortearModelo),
      { forma: f.n, lados: f.l });
    return { texto, tipo: 'arrastar', opcoes: mix([f, ...outras]).map((x) => x.g), resposta: f.g,
      dica: { texto: f.l ? `Conte os lados: o ${f.n} tem ${f.l}` : 'Conte os lados: o círculo é redondo e não tem lados' } };
  },
  medidas(n, sortearModelo) {
    const ok = MEDIDAS.filter((m) => m.min <= n), m = ok[rnd(0, ok.length - 1)];
    const outras = mix(UNID.filter(([u, min]) => min <= n && u !== m.u).map((x) => x[0])).slice(0, 2);
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.medidas, sortearModelo), { objeto: m.o });
    return { texto, tipo: 'arrastar', opcoes: mix([m.u, ...outras]), resposta: m.u };
  },
  par_impar(n, sortearModelo) { const [a, b] = FAIXAS[n]; const x = rnd(a, b);
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.par_impar, sortearModelo), { x });
    return { texto, tipo: 'clicar', opcoes: ['Par', 'Ímpar'], resposta: x % 2 === 0 ? 'Par' : 'Ímpar' }; },
  maior_menor(n, sortearModelo) { const [a, b] = FAIXAS[n]; const x = rnd(a, b); let y; do { y = rnd(a, b + 1); } while (y === x);
    const maior = Math.random() < 0.5, termo = maior ? 'maior' : 'menor';
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.maior_menor, sortearModelo), { x, y, termo });
    return { texto, tipo: 'clicar', opcoes: [String(x), String(y)], resposta: maior ? Math.max(x, y) : Math.min(x, y) }; },
};

function gerarPergunta(atividade, nivel, sortearModelo) {
  const g = G[atividade]; if (!g) throw new Error('Atividade inválida');
  const n = Math.max(1, Math.min(5, Math.floor(nivel))), p = g(n, sortearModelo);
  return { atividade, nivel: n, ...p, resposta: String(p.resposta), dica: p.dica || { texto: DICAS[atividade] } };
}
module.exports = { ATIVIDADES: Object.keys(G), ATIVIDADES_POR_ANO, MODELOS_ENUNCIADO, gerarPergunta, criarSorteadorDeAtividades, criarSorteadorDeModelos };
