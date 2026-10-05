// Geração automática de perguntas + dicas. Nada de perguntas no banco.
const FAIXAS = { 1: [1, 5], 2: [1, 10], 3: [10, 99], 4: [100, 999], 5: [1000, 9999] };
const FATOR  = { 1: [1, 3], 2: [2, 5], 3: [2, 7], 4: [3, 9], 5: [5, 10] };
const PASSOS_SEQUENCIA = { 1: [1], 2: [1, 2], 3: [2, 5], 4: [5, 10], 5: [10, 100] };
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const mix = (a) => [...a].sort(() => Math.random() - 0.5);
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

const PROBLEMAS_SOMA = [
  (x, y) => `Uma papelaria recebeu ${x} caixas de lápis e depois mais ${y}. Quantas caixas recebeu ao todo?`,
  (x, y) => `Uma cooperativa recolheu ${x} quilos de plástico em uma semana e ${y} na seguinte. Quantos quilos recolheu no total?`,
  (x, y) => `Um parque recebeu ${x} visitantes no sábado e ${y} no domingo. Quantas pessoas visitaram o parque?`,
  (x, y) => `Uma fábrica produziu ${x} chocolates pela manhã e ${y} à tarde. Quantos chocolates produziu?`,
  (x, y) => `O robô encontrou ${x} blocos azuis e ${y} amarelos. Quantos blocos encontrou?`,
  (x, y) => `No aquário nadavam ${x} peixes. Chegaram mais ${y}. Quantos peixes há agora?`,
  (x, y) => `O foguete coletou ${x} pedras lunares e depois mais ${y}. Quantas coletou?`,
  (x, y) => `Na festa foram colocados ${x} balões vermelhos e ${y} verdes. Quantos balões enfeitam a festa?`,
  (x, y) => `Uma cesta tinha ${x} maçãs e recebeu mais ${y}. Quantas maçãs ficaram na cesta?`,
  (x, y) => `O trem levou ${x} passageiros e embarcaram mais ${y} na estação. Quantos passageiros seguiram viagem?`,
  (x, y) => `No jardim havia ${x} flores. Desabrocharam mais ${y}. Quantas flores há no jardim?`,
  (x, y) => `A equipe construiu ${x} castelos de areia de manhã e ${y} à tarde. Quantos construiu?`,
];
const PROBLEMAS_SUBTRACAO = [
  (x, y) => `Uma editora tinha ${x} livretos e descartou ${y} com defeito. Quantos livretos sobraram?`,
  (x, y) => `Uma papelaria tinha ${x} caixas de lápis e vendeu ${y}. Quantas caixas restaram?`,
  (x, y) => `Magali colheu ${x} maçãs e doou ${y}. Com quantas maçãs ficou?`,
  (x, y) => `Um depósito tinha ${x} garrafas e vendeu ${y}. Quantas garrafas ainda tem?`,
  (x, y) => `Havia ${x} balões no céu e ${y} estouraram. Quantos balões sobraram?`,
  (x, y) => `O celeiro abrigava ${x} animais. ${y} foram para o pasto. Quantos ficaram?`,
  (x, y) => `O foguete tinha ${x} estrelas no mapa e apagou ${y}. Quantas continuam acesas?`,
  (x, y) => `A cesta tinha ${x} biscoitos. As crianças comeram ${y}. Quantos restaram?`,
  (x, y) => `O ônibus levava ${x} passageiros e ${y} desceram. Quantos continuaram no ônibus?`,
  (x, y) => `A tartaruga precisava dar ${x} passos e já deu ${y}. Quantos faltam?`,
  (x, y) => `A equipe tinha ${x} peças para montar um robô e usou ${y}. Quantas restaram?`,
  (x, y) => `No aquário havia ${x} peixes. ${y} foram para outro tanque. Quantos ficaram?`,
];
const PROBLEMAS_MULTIPLICACAO = [
  (x, y) => `Há ${y} caixas com ${x} lápis em cada uma. Quantos lápis há ao todo?`,
  (x, y) => `O robô usa ${x} rodas. Quantas rodas são necessárias para montar ${y} robôs?`,
  (x, y) => `Cada vagão leva ${x} passageiros. Quantos passageiros cabem em ${y} vagões?`,
  (x, y) => `Foram montados ${y} grupos com ${x} blocos cada. Quantos blocos foram usados?`,
  (x, y) => `Cada robô precisa de ${x} adesivos. Quantos adesivos são necessários para montar ${y} robôs?`,
  (x, y) => `Cada cesta tem ${x} maçãs. Quantas maçãs há em ${y} cestas?`,
];

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

const G = {
  soma(n) { const [a, b] = FAIXAS[n]; const x = rnd(a, b), y = rnd(a, b);
    const texto = Math.random() < 0.5 ? `${x} + ${y} = ?` : mix(PROBLEMAS_SOMA)[0](x, y);
    return { texto, tipo: 'digitar', resposta: x + y }; },
  subtracao(n) { const [a, b] = FAIXAS[n]; let x = rnd(a, b), y = rnd(a, b); if (x === y) y = y === b ? y - 1 : y + 1; if (y > x) [x, y] = [y, x];
    const texto = Math.random() < 0.5 ? `${x} − ${y} = ?` : mix(PROBLEMAS_SUBTRACAO)[0](x, y);
    return { texto, tipo: 'digitar', resposta: x - y }; },
  antecessor_sucessor(n) {
    const [min, max] = FAIXAS[n], base = rnd(Math.max(2, min), max);
    const tipo = Math.random() < 0.5 ? 'antecessor' : 'sucessor';
    const valor = tipo === 'antecessor' ? base - 1 : base + 1;
    const modelos = [
      () => `Qual é o ${tipo} de ${base}?`,
      () => `O sapo está na pedra ${base}. Para qual número ele pula ${tipo === 'sucessor' ? 'à frente' : 'para trás'}?`,
      () => `O robô contou até ${base}. Qual número vem ${tipo === 'sucessor' ? 'depois' : 'antes'}?`,
    ];
    return { texto: modelos[rnd(0, modelos.length - 1)](), tipo: 'digitar', resposta: String(valor) };
  },
  multiplicacao(n) {
    const [a, b] = FATOR[n]; const x = rnd(a, b), y = rnd(2, Math.min(2 + n, 6)), r = x * y;
    const texto = Math.random() < 0.5 ? `${x} × ${y} = ?` : mix(PROBLEMAS_MULTIPLICACAO)[0](x, y);
    return { texto, tipo: 'arrastar', opcoes: opcoesNumericas(r), resposta: r,
      dica: { texto: `${x} × ${y} é o mesmo que ${Array(y).fill(x).join(' + ')}`, visual: `${Array(y).fill('🍎'.repeat(x)).join(' + ')} = ${r} 🍎` } };
  },
  sequencia(n) {
    const passos = PASSOS_SEQUENCIA[n], passo = passos[rnd(0, passos.length - 1)];
    const direcao = Math.random() < 0.5 ? 1 : -1;
    const inicio = rnd(4, 10) * passo, lacuna = rnd(1, 3);
    const valores = Array.from({ length: 4 }, (_, i) => inicio + direcao * passo * i);
    const resposta = valores[lacuna];
    valores[lacuna] = '__';
    const modelos = [
      (itens) => `Complete a sequência: ${itens}`,
      (itens) => `Qual número está faltando? ${itens}`,
      (itens) => `Ajude o trem a seguir: ${itens}`,
    ];
    return { texto: modelos[rnd(0, modelos.length - 1)](valores.join(', ')), tipo: 'clicar', opcoes: opcoesNumericas(resposta), resposta,
      dica: { texto: `A sequência avança ou volta de ${passo} em ${passo}.` } };
  },
  formas(n) {
    const ok = FORMAS.filter((f) => f.min <= n), f = ok[rnd(0, ok.length - 1)];
    const outras = mix(ok.filter((x) => x !== f)).slice(0, 2);
    const modelos = [
      () => `Arraste o ${f.n.toUpperCase()}`,
      () => `Escolha a forma ${f.n}`,
      () => f.l ? `Qual figura é o ${f.n}?` : 'Qual figura é redonda e não tem lados?',
    ];
    return { texto: modelos[rnd(0, modelos.length - 1)](), tipo: 'arrastar', opcoes: mix([f, ...outras]).map((x) => x.g), resposta: f.g,
      dica: { texto: f.l ? `Conte os lados: o ${f.n} tem ${f.l}` : 'Conte os lados: o círculo é redondo e não tem lados' } };
  },
  medidas(n) {
    const ok = MEDIDAS.filter((m) => m.min <= n), m = ok[rnd(0, ok.length - 1)];
    const outras = mix(UNID.filter(([u, min]) => min <= n && u !== m.u).map((x) => x[0])).slice(0, 2);
    const modelos = [
      () => `Arraste a unidade para medir ${m.o}`,
      () => `Qual unidade usamos para medir ${m.o}?`,
      () => `Escolha a unidade adequada para ${m.o}`,
    ];
    return { texto: modelos[rnd(0, modelos.length - 1)](), tipo: 'arrastar', opcoes: mix([m.u, ...outras]), resposta: m.u };
  },
  par_impar(n) { const [a, b] = FAIXAS[n]; const x = rnd(a, b);
    const texto = Math.random() < 0.5 ? `O número ${x} é...` : `Separe o ${x} no grupo par ou ímpar.`;
    return { texto, tipo: 'clicar', opcoes: ['Par', 'Ímpar'], resposta: x % 2 === 0 ? 'Par' : 'Ímpar' }; },
  maior_menor(n) { const [a, b] = FAIXAS[n]; const x = rnd(a, b); let y; do { y = rnd(a, b + 1); } while (y === x);
    const maior = Math.random() < 0.5;
    const comandos = maior ? ['Qual número é o MAIOR?', 'Qual valor é maior?', 'Aponte a maior quantidade.'] : ['Qual número é o MENOR?', 'Qual valor é menor?', 'Aponte a menor quantidade.'];
    return { texto: comandos[rnd(0, comandos.length - 1)], tipo: 'clicar', opcoes: [String(x), String(y)], resposta: maior ? Math.max(x, y) : Math.min(x, y) }; },
};

function gerarPergunta(atividade, nivel) {
  const g = G[atividade]; if (!g) throw new Error('Atividade inválida');
  const n = Math.max(1, Math.min(5, Math.floor(nivel))), p = g(n);
  return { atividade, nivel: n, ...p, resposta: String(p.resposta), dica: p.dica || { texto: DICAS[atividade] } };
}
module.exports = { ATIVIDADES: Object.keys(G), ATIVIDADES_POR_ANO, gerarPergunta, criarSorteadorDeAtividades };
