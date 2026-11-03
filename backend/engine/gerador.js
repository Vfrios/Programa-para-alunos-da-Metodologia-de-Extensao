// Geração automática de perguntas + dicas. Nada de perguntas no banco.
const FAIXAS = { 1: [1, 5], 2: [1, 10], 3: [10, 99], 4: [100, 999], 5: [100, 999] };
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

const DICAS = {
  soma: 'Conte nos dedos', subtracao: 'Tire do primeiro número', multiplicacao: 'É o mesmo que somar várias vezes',
  formas: 'Conte os lados', medidas: 'Compare com objetos conhecidos', par_impar: 'Veja o último número',
  maior_menor: 'Conte nos dedos', antecessor_sucessor: 'Pense no número que vem antes ou depois.',
  sequencia: 'Descubra quanto aumenta ou diminui de um número para o seguinte.'
};

const criarModelos = (aberturas, perguntas) =>
  aberturas.flatMap((abertura) => perguntas.map((pergunta) => `${abertura}${pergunta}`));
const ABERTURAS = [
  '',
  'Desafio matemático: ',
  'Ajude o robô: ',
  'Pense e responda: ',
  'Sua missão de hoje: ',
  'Vamos calcular: ',
  'Atenção, matemático: ',
  'Mostre o que sabe: ',
  'Hora do desafio: ',
  'Para você resolver: ',
  'Fique esperto: ',
  'Um passo de cada vez: ',
  'Use a cabeça: ',
  'Rápido e certo: ',
  'Conta nova na tela: ',
  'Vamos treinar: ',
  'Só para você: ',
  'Exercício do dia: ',
  'Descubra agora: ',
  'Vamos nessa: ',
  'Pequeno gênio: ',
  'Tente resolver: ',
  'Quem sabe acerta: ',
  'Matemática divertida: ',
  'Vamos praticar: ',
];
const MODELOS_ENUNCIADO = {
  soma: criarModelos(ABERTURAS, [
    '{x} + {y} = ?',
    'Quanto é {x} mais {y}?',
    'Some {x} e {y}. Qual é o resultado?',
    'Junte {x} com {y}. Quantos são ao todo?',
    'Qual é a soma de {x} e {y}?',
    'Havia {x} objetos e chegaram mais {y}. Quantos há agora?',
    'Se eu tenho {x} balas e ganho mais {y}, com quantas fico?',
    'Uma caixa tem {x} lápis. Colocaram mais {y}. Quantos ficaram?',
    '{x} mais {y} dá quanto?',
    'Calcule a soma entre {x} e {y}.',
    'Aumente {x} em {y} unidades. Qual é o novo valor?',
    'Some {y} a {x} e me diga o total.',
    'No pomar havia {x} maçãs. Caíram mais {y} do pé. Quantas há?',
    'O placar estava {x} e aumentou {y}. Ficou quanto?',
    'Junte os grupos {x} e {y}. Qual é o total?',
    'Qual o resultado de {x} somado com {y}?',
    'Adicione {y} ao número {x}. Onde chegamos?',
    'Tenho {x} figurinhas e comprei mais {y}. Quantas são?',
    'Se somar {x} e {y}, qual número aparece?',
    '{y} + {x} = ? (a ordem não muda o total)',
    'Quantos dedos são {x} dedos mais {y} dedos?',
    'Um ônibus tinha {x} passageiros e entraram {y}. Quantos estão?',
    'Junte um grupo com {x} itens a outro com {y}. Quanto fica?',
    'Some {x} e {y}; depois, confira se o total chega a uma centena.',
    'Efetue: {x} mais {y} unidades.',
  ]),
  subtracao: criarModelos(ABERTURAS, [
    '{x} − {y} = ?',
    'Quanto é {x} menos {y}?',
    'Tire {y} de {x}. Quanto sobra?',
    'Qual é a diferença entre {x} e {y}?',
    'Você tinha {x} objetos e usou {y}. Quantos restaram?',
    'De {x}, retire {y}. Qual número fica?',
    'Havia {x} balas e comi {y}. Quantas sobraram?',
    'Uma caixa tinha {x} lápis. Perdi {y}. Quantos ficaram?',
    '{x} menos {y} dá quanto?',
    'Calcule a diferença entre {x} e {y}.',
    'Diminua {x} em {y} unidades. Qual é o novo valor?',
    'Subtraia {y} de {x} e diga o resultado.',
    'O placar estava {x} e caiu {y} pontos. Quanto ficou?',
    'Se eu devo {x} e pago {y}, quanto falta?',
    'O termômetro marcava {x} graus e caiu {y}. Quanto marca agora?',
    'Retire {y} unidades do número {x}. Onde chegamos?',
    'Tenho {x} figurinhas e perdi {y}. Quantas ainda tenho?',
    'Qual o resultado de {y} subtraído de {x}?',
    'Um ônibus tinha {x} passageiros e desceram {y}. Quantos ficaram?',
    'Se {x} é o todo e {y} é uma parte, qual é a outra parte?',
    'Quanto falta para {y} chegar a {x}?',
    'Efetue: {x} menos {y} unidades.',
    'De um grupo de {x}, quantos sobram se tirarmos {y}?',
    'Qual número somado a {y} resulta em {x}?',
    'A diferença entre {x} e {y} é maior ou menor que 10? Calcule.',
  ]),
  multiplicacao: criarModelos(ABERTURAS, [
    '{x} × {y} = ?',
    'Quanto é {x} vezes {y}?',
    'Some {x} grupos de {y}. Qual é o total?',
    'Há {y} grupos com {x} objetos em cada um. Quantos objetos há?',
    'Se cada grupo tem {x} itens e há {y} grupos, quantos itens são?',
    'Descubra o resultado de {x} multiplicado por {y}.',
    'Se eu tenho {y} caixas com {x} figurinhas em cada, quantas figurinhas tenho?',
    'Um pacote tem {x} balas. Quantas balas há em {y} pacotes?',
    '{x} vezes {y} dá quanto?',
    'Calcule o produto de {x} por {y}.',
    'Multiplique {x} por {y} e me diga o total.',
    'Se cada fileira tem {x} cadeiras e há {y} fileiras, quantas cadeiras são?',
    'Quantos pés há em {y} animais, se cada um tem {x} pés?',
    '{y} grupos iguais de {x} formam quantos no total?',
    'Qual o resultado de {x} × {y}?',
    'Se cada grupo tem {x} itens e há {y} grupos iguais, quantos itens há?',
    'Um livro tem {x} páginas por capítulo. Quantas páginas há em {y} capítulos?',
    'Se multiplicar {x} e {y}, qual número aparece?',
    'Quantos dedos há em {y} mãos, considerando {x} dedos por mão?',
    'Um carro tem {x} rodas. Quantas rodas há em {y} carros?',
    'Repita {x} unidades {y} vezes. Qual é o total?',
    'Efetue: {x} multiplicado por {y}.',
    'Qual é o total de {y} grupos de {x} elementos?',
    'Se um pacote tem {x} adesivos, quantos há em {y} pacotes?',
    'O produto entre {x} e {y} é maior ou menor que 50? Calcule.',
  ]),
  sequencia: criarModelos(ABERTURAS, [
    'Complete: {sequencia}',
    'Qual número está faltando? {sequencia}',
    'Descubra o próximo passo da sequência: {sequencia}',
    'Que número deve ocupar o espaço vazio? {sequencia}',
    'Observe o padrão e complete: {sequencia}',
    'Ajude o trem numérico a continuar: {sequencia}',
    'Encontre o número que falta: {sequencia}',
    'O padrão da sequência está em qual número? {sequencia}',
    'Qual número completa a sequência numérica? {sequencia}',
    'Continue a contagem: {sequencia}',
    'Descubra a regra e preencha: {sequencia}',
    'Qual número vem no lugar do espaço vazio? {sequencia}',
    'A sequência segue um ritmo. Complete: {sequencia}',
    'Complete o padrão numérico: {sequencia}',
    'Qual número deve aparecer no meio? {sequencia}',
    'A regra está escondida. Descubra: {sequencia}',
    'Preencha o espaço e continue a sequência: {sequencia}',
    'Se a sequência continuar, qual número entra? {sequencia}',
    'O que falta para a sequência ficar completa? {sequencia}',
    'Descubra o número que está fora de ordem: {sequencia}',
    'Qual valor encaixa no vazio? {sequencia}',
    'Complete a contagem com o número que falta: {sequencia}',
    'Siga a regra e diga o próximo número: {sequencia}',
    'Descubra o padrão de aumento ou diminuição: {sequencia}',
    'Qual número completa o padrão? {sequencia}',
  ]),
  antecessor_sucessor: criarModelos(ABERTURAS, [
    'Qual número vem {direcao} de {base}?',
    'Encontre o {nome} de {base}.',
    'Dê um passo para {lado} a partir de {base}. Em qual número chega?',
    'O sapo está no número {base}. Para qual número ele pula {lado}?',
    'Conte um número para {lado} de {base}. Onde chega?',
    'Qual vizinho fica {lado} de {base}?',
    'Se você está no {base} e anda uma casa para {lado}, onde para?',
    'O número que vem {direcao} de {base} é qual?',
    'Qual é o {nome} de {base}?',
    'Complete a vizinhança do número {base}: quem vem {direcao}?',
    'Um passo para {lado} do {base}. Qual número aparece?',
    'Se subir ou descer uma unidade de {base}, qual número fica?',
    'O {nome} do número {base} é qual?',
    'Pule uma casa para {lado} do {base}. Onde você cai?',
    'Qual número fica imediatamente {direcao} de {base}?',
    'Estou no {base}. Vou para {lado}. Qual número encontro?',
    'Qual é o vizinho {direcao} do {base}?',
    'Some ou tire 1 de {base} e me diga o resultado.',
    'Se {base} é o número atual, qual vem {direcao}?',
    'Andando para {lado}, partindo do {base}, onde paramos?',
    'Qual número completa a sequência ao redor de {base}?',
    'Um passo na reta numérica: {base} para {lado} resulta em?',
    'Qual número está imediatamente {direcao} de {base}?',
    'O vizinho {direcao} do {base} é qual número?',
    'Se eu caminhar uma unidade para {lado} a partir de {base}, chego em qual?',
  ]),
  par_impar: criarModelos(ABERTURAS, [
    'O número {x} é par ou ímpar?',
    'Separe {x} no grupo dos pares ou dos ímpares.',
    'Se formar duplas com {x} objetos, sobra algum sem par?',
    'A quantidade {x} pode ser dividida em pares certinhos?',
    'Classifique o número {x}: par ou ímpar?',
    'Imagine {x} objetos em duplas. Fica um objeto sozinho?',
    'O número {x} termina em par ou ímpar?',
    'Se {x} crianças formarem duplas, todas ficam em par?',
    '{x} é um número par ou ímpar?',
    'Ao dividir {x} por 2, sobra resto? Então é par ou ímpar?',
    'Coloque {x} na turma dos pares ou dos ímpares.',
    'Se {x} objetos forem agrupados de dois em dois, sobra algum?',
    'Qual é a classificação do número {x}?',
    'O número {x} pode ser formado por pares?',
    'Formando duplas com {x} itens, sobra 1?',
    '{x} pertence aos pares ou aos ímpares?',
    'Pense em {x} e diga: par ou ímpar?',
    'Se contar de 2 em 2 até {x}, chega certinho?',
    'O {x} é par ou ímpar? Responda.',
    'Duas duplas, quatro duplas… {x} é par?',
    'Ao agrupar {x} em pares, o que acontece?',
    'Classifique {x}: pode ser dividido em pares iguais?',
    'Qual grupo recebe {x}: pares ou ímpares?',
    'Se {x} termina em 0, 2, 4, 6 ou 8, é par. E {x}?',
    'O número {x} é múltiplo de 2? Então é par ou ímpar?',
  ]),
  maior_menor: criarModelos(ABERTURAS, [
    'Qual número é {termo}: {x} ou {y}?',
    'Entre {x} e {y}, qual é o {termo}?',
    'Toque no valor {termo}. Compare {x} com {y}.',
    'Qual quantidade é {termo}, {x} ou {y}?',
    'Compare os números {x} e {y}. Qual é o {termo}?',
    'O número {termo} é {x} ou {y}?',
    'Olhe {x} e {y}. Qual deles é o {termo}?',
    'Se {x} e {y} estão na balança, qual é o {termo}?',
    'Aponte o número {termo} entre {x} e {y}.',
    'Qual é o {termo}: {x} ou {y}? Escolha.',
    'Compare {x} e {y} e diga qual é {termo}.',
    'Entre os números {x} e {y}, qual é {termo}?',
    'Quem é {termo}, {x} ou {y}?',
    'Indique o valor {termo} entre {x} e {y}.',
    'Fazendo a comparação, {x} ou {y} é {termo}?',
    'Na reta numérica, {x} e {y}: qual fica {termo}?',
    'Escolha o número {termo}: {x} ou {y}.',
    'Dois números: {x} e {y}. Qual é o {termo}?',
    'Observe {x} e {y}. O {termo} é qual?',
    'Clique no valor {termo} entre {x} e {y}.',
    'Qual leva a taça do {termo}: {x} ou {y}?',
    'Se ordenar {x} e {y}, qual vem como {termo}?',
    '{x} é {termo} ou {y} é {termo}?',
    'Qual número {termo} você encontra: {x} ou {y}?',
    'Na disputa entre {x} e {y}, qual é o {termo}?',
  ]),
  formas: criarModelos(ABERTURAS, [
    'Encontre a forma {forma}.',
    'Qual figura geométrica é o {forma}?',
    'Toque na figura que tem o nome {forma}.',
    'Escolha o desenho do {forma}.',
    'Procure entre as figuras: onde está o {forma}?',
    'Qual forma tem {lados} lados? Encontre o {forma}.',
    'Aponte para o {forma}.',
    'Reconheça a figura: qual é o {forma}?',
    'Onde está o {forma} na tela?',
    'Clique na figura geométrica {forma}.',
    'Identifique o {forma} entre as opções.',
    'Qual desenho representa o {forma}?',
    'Encontre a figura com {lados} lados (o {forma}).',
    'Selecione o {forma}.',
    'Qual das figuras é o {forma}?',
    'Marque a figura geométrica correta: {forma}.',
    'Encontre o {forma} para continuar.',
    'Qual forma combina com o nome {forma}?',
    'Toque no desenho do {forma}.',
    'Escolha a figura com o formato de {forma}.',
    'O {forma} tem quantos lados? Encontre-o.',
    'Localize a figura: {forma}.',
    'Qual é o {forma} entre as opções?',
    'Aponte a figura que tem o nome {forma}.',
    'Encontre a figura de {lados} lados chamada {forma}.',
  ]),
  medidas: criarModelos(ABERTURAS, [
    'Qual unidade combina com {objeto}?',
    'Escolha a unidade usada para medir {objeto}.',
    'Para medir {objeto}, qual unidade você usaria?',
    'Encontre a unidade adequada para {objeto}.',
    'Como podemos medir {objeto}? Escolha a unidade.',
    'Associe {objeto} à unidade de medida correta.',
    'Que unidade usamos para medir {objeto}?',
    'Qual é a unidade certa para {objeto}?',
    'Para saber o tamanho de {objeto}, usamos qual unidade?',
    'Escolha a unidade que combina com {objeto}.',
    'Qual unidade mede {objeto}?',
    'Selecione a unidade de medida de {objeto}.',
    'Qual unidade faz sentido para {objeto}?',
    'Como medir {objeto}? Escolha a unidade.',
    'A unidade correta para {objeto} é qual?',
    'Associe a medida certa: {objeto}.',
    'Para medir {objeto}, qual é a unidade?',
    'Marque a unidade usada para medir {objeto}.',
    'Qual unidade corresponde a {objeto}?',
    'Encontre a unidade que mede {objeto}.',
    'Que unidade escolher para {objeto}?',
    'Aponte a unidade adequada para {objeto}.',
    'Qual das unidades mede {objeto}?',
    'Com qual unidade medimos {objeto}?',
    'Selecione a unidade de medida que combina com {objeto}.',
  ]),
};
const preencherModelo = (modelo, valores) =>
  modelo.replace(/\{(\w+)\}/g, (_, chave) => String(valores[chave]));

function opcoesNumericas(resposta, quantidade = 3, limite = Infinity) {
  const opcoes = new Set([resposta]);
  let tentativas = 0;
  while (opcoes.size < quantidade && tentativas < 50) {
    tentativas++;
    const delta = rnd(1, Math.max(3, Math.floor(Math.abs(resposta) * 0.3) + 3)) * (Math.random() < 0.5 ? -1 : 1);
    const tentativa = Math.max(0, Math.min(limite, resposta + delta));
    if (tentativa !== resposta) opcoes.add(tentativa);
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

// Sorteador de valores numéricos para evitar perguntas repetidas
function criarSorteadorNumerico(chave) {
  const usados = new Set();
  return (gerador) => {
    for (let tentativa = 0; tentativa < 30; tentativa++) {
      const valor = gerador();
      const assinatura = String(valor);
      if (!usados.has(assinatura)) {
        usados.add(assinatura);
        if (usados.size > 40) {
          const primeiro = usados.values().next().value;
          usados.delete(primeiro);
        }
        return valor;
      }
    }
    return gerador();
  };
}

const G = {
  soma(n, sortearModelo, limite, sortearNumero) {
    const [a, b] = FAIXAS[n];
    const maxX = Math.min(b, limite - a);
    const x = sortearNumero ? sortearNumero(() => rnd(a, maxX)) : rnd(a, maxX);
    const y = sortearNumero ? sortearNumero(() => rnd(a, Math.min(b, limite - x))) : rnd(a, Math.min(b, limite - x));
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.soma, sortearModelo), { x, y });
    return { texto, tipo: 'digitar', resposta: x + y };
  },
  subtracao(n, sortearModelo, limite, sortearNumero) {
    const [a, b] = FAIXAS[n];
    let x, y;
    if (sortearNumero) {
      x = sortearNumero(() => rnd(a, Math.min(b, limite)));
      y = sortearNumero(() => rnd(a, Math.min(x - 1, b)));
      if (y >= x) y = Math.max(a, x - 1);
    } else {
      x = rnd(a, Math.min(b, limite));
      y = rnd(a, Math.min(x - 1, b));
      if (y >= x) y = Math.max(a, x - 1);
    }
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.subtracao, sortearModelo), { x, y });
    return { texto, tipo: 'digitar', resposta: x - y };
  },
  antecessor_sucessor(n, sortearModelo, limite) {
    const [min, max] = FAIXAS[n];
    const tipo = Math.random() < 0.5 ? 'antecessor' : 'sucessor';
    const base = rnd(Math.max(2, min), Math.min(max, limite - (tipo === 'sucessor' ? 1 : 0)));
    const valor = tipo === 'antecessor' ? base - 1 : base + 1;
    const direcao = tipo === 'antecessor' ? 'antes' : 'depois';
    const lado = tipo === 'antecessor' ? 'trás' : 'à frente';
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.antecessor_sucessor, sortearModelo),
      { base, direcao, lado, nome: tipo });
    return { texto, tipo: 'digitar', resposta: String(valor) };
  },
  multiplicacao(n, sortearModelo) {
    const [a, b] = FATOR[n];
    const x = rnd(a, b);
    const y = rnd(2, Math.min(2 + n, 6));
    const r = x * y;
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.multiplicacao, sortearModelo), { x, y });
    return {
      texto, tipo: 'arrastar', opcoes: opcoesNumericas(r), resposta: r,
      dica: { texto: `${x} × ${y} é o mesmo que ${Array(y).fill(x).join(' + ')}`, visual: `${Array(y).fill('🍎'.repeat(x)).join(' + ')} = ${r} 🍎` }
    };
  },
  sequencia(n, sortearModelo, limite, sortearNumero) {
    const passos = PASSOS_SEQUENCIA[n];
    const passo = sortearNumero ? sortearNumero(() => passos[rnd(0, passos.length - 1)]) : passos[rnd(0, passos.length - 1)];
    const direcao = Math.random() < 0.5 ? 1 : -1;
    const multiplicadorMaximo = Math.min(10, Math.max(4, Math.floor(limite / passo) - 3));
    const inicio = rnd(4, multiplicadorMaximo) * passo;
    const lacuna = rnd(1, 3);
    const valores = Array.from({ length: 4 }, (_, i) => inicio + direcao * passo * i);
    const resposta = valores[lacuna];
    valores[lacuna] = '__';
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.sequencia, sortearModelo), { sequencia: valores.join(', ') });
    return {
      texto, tipo: 'clicar', opcoes: opcoesNumericas(resposta, 3, limite), resposta,
      dica: { texto: `A sequência avança ou volta de ${passo} em ${passo}.` }
    };
  },
  formas(n, sortearModelo) {
    const ok = FORMAS.filter((f) => f.min <= n), f = ok[rnd(0, ok.length - 1)];
    const outras = mix(ok.filter((x) => x !== f)).slice(0, 2);
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.formas, sortearModelo),
      { forma: f.n, lados: f.l });
    return {
      texto, tipo: 'arrastar', opcoes: mix([f, ...outras]).map((x) => x.g), resposta: f.g,
      dica: { texto: f.l ? `Conte os lados: o ${f.n} tem ${f.l}` : 'Conte os lados: o círculo é redondo e não tem lados' }
    };
  },
  medidas(n, sortearModelo) {
    const ok = MEDIDAS.filter((m) => m.min <= n), m = ok[rnd(0, ok.length - 1)];
    const outras = mix(UNID.filter(([u, min]) => min <= n && u !== m.u).map((x) => x[0])).slice(0, 2);
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.medidas, sortearModelo), { objeto: m.o });
    return { texto, tipo: 'arrastar', opcoes: mix([m.u, ...outras]), resposta: m.u };
  },
  par_impar(n, sortearModelo, limite, sortearNumero) {
    const [a, b] = FAIXAS[n];
    const x = sortearNumero ? sortearNumero(() => rnd(a, Math.min(b, limite))) : rnd(a, Math.min(b, limite));
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.par_impar, sortearModelo), { x });
    return { texto, tipo: 'clicar', opcoes: ['Par', 'Ímpar'], resposta: x % 2 === 0 ? 'Par' : 'Ímpar' };
  },
  maior_menor(n, sortearModelo, limite, sortearNumero) {
    const [a, b] = FAIXAS[n];
    const limiteEfetivo = Math.min(b, limite);
    let x, y;
    if (sortearNumero) {
      x = sortearNumero(() => rnd(a, limiteEfetivo));
      y = sortearNumero(() => { let v; do { v = rnd(a, limiteEfetivo); } while (v === x); return v; });
    } else {
      x = rnd(a, limiteEfetivo);
      do { y = rnd(a, limiteEfetivo); } while (y === x);
    }
    const maior = Math.random() < 0.5, termo = maior ? 'maior' : 'menor';
    const texto = preencherModelo(escolher(MODELOS_ENUNCIADO.maior_menor, sortearModelo), { x, y, termo });
    return { texto, tipo: 'clicar', opcoes: [String(x), String(y)], resposta: String(maior ? Math.max(x, y) : Math.min(x, y)) };
  },
};

// Cache de sorteadores numéricos por aluno (limpa ao trocar de sessão)
const sorteadoresNumericos = new Map();

function gerarPergunta(atividade, nivel, sortearModelo, ano = 3, alunoId = null) {
  const g = G[atividade];
  if (!g) throw new Error('Atividade inválida');
  const limiteNivel = Number(ano) === 2 ? 3 : 4;
  const n = Math.max(1, Math.min(limiteNivel, Math.floor(nivel)));
  const limiteNumero = Number(ano) === 2 ? 99 : 999;
  let sortearNumero = null;
  if (alunoId != null) {
    const chave = `${alunoId}:${atividade}`;
    if (!sorteadoresNumericos.has(chave)) {
      sorteadoresNumericos.set(chave, criarSorteadorNumerico(chave));
    }
    sortearNumero = sorteadoresNumericos.get(chave);
  }
  const p = g(n, sortearModelo, limiteNumero, sortearNumero);
  return {
    atividade, nivel: n, ...p, resposta: String(p.resposta),
    dica: p.dica || { texto: DICAS[atividade] }
  };
}

function limparSorteadoresNumericos(alunoId) {
  if (alunoId == null) {
    sorteadoresNumericos.clear();
    return;
  }
  for (const chave of [...sorteadoresNumericos.keys()]) {
    if (chave.startsWith(`${alunoId}:`)) sorteadoresNumericos.delete(chave);
  }
}

module.exports = {
  ATIVIDADES: Object.keys(G),
  ATIVIDADES_POR_ANO,
  MODELOS_ENUNCIADO,
  gerarPergunta,
  criarSorteadorDeAtividades,
  criarSorteadorDeModelos,
  criarSorteadorNumerico,
  limparSorteadoresNumericos,
};
