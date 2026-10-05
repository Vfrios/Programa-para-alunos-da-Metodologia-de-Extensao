// Pontuação, adaptação por perfil, notas e prêmios
const clamp = (n) => Math.max(1, Math.min(5, n));
const arredondarNivel = (n) => Number(Math.max(1, Math.min(5, Math.round((n || 1) * 2) / 2)).toFixed(1));

exports.calcularPontos = ({ nivel = 1, tempoSegundos = 0, tentativas = 1, dica = 0, correta = true, combo = 0 } = {}) => {
  const erros = Math.max(0, Number(tentativas || 1) - 1);
  let base = 100 * Math.pow(0.5, erros);
  if (dica) base *= 0.5;

  const bonusCombo = (() => {
    const comboAtual = Math.max(0, Number(combo) || 0);
    if (comboAtual <= 1) return 0;
    if (comboAtual <= 3) return 0.1;
    if (comboAtual <= 5) return 0.2;
    if (comboAtual <= 7) return 0.3;
    if (comboAtual <= 9) return 0.4;
    return 0.5;
  })();

  const total = base * (1 + (correta ? bonusCombo : 0));
  return Math.max(10, Math.min(150, Math.round(total)));
};

exports.ajustarNivel = (nivel, correta, s, tentativas = 1) => {
  let novo = Number(nivel) || 1;
  if (correta && tentativas > 1) return arredondarNivel(novo);

  if (correta) {
    if (s <= 5) novo += 0.5;
    else if (s <= 10) novo += 0.25;
    else if (s <= 20) novo += 0.1;
  } else {
    if (s <= 10) novo -= 0.1;
    else if (s <= 20) novo -= 0.25;
    else novo -= 0.5;
  }

  return arredondarNivel(clamp(novo));
};

exports.mensagemErro = (n) => ({ 1: 'Tente de novo!', 2: 'Quase!', 4: 'Tente mais uma vez!' }[n] || '');
exports.premio = (m) => (m <= 20 ? 'Bronze' : m <= 40 ? 'Prata' : m <= 60 ? 'Ouro' : m <= 80 ? 'Troféu' : 'Coroa');
exports.nota = (m) => (m >= 80 ? 'Nota máxima' : m >= 60 ? 'Médio' : m >= 40 ? 'Menor' : 'Baixíssima');
