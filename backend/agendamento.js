const TZ = 'America/Sao_Paulo';
exports.DURACAO_MIN = 55;
exports.adicionarMinutos = (hora, minutos) => {
  const total = (exports.paraMin(hora) + minutos) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
exports.horaFim = (inicio, fim) => fim || exports.adicionarMinutos(inicio, exports.DURACAO_MIN);
exports.sobrepoe = (inicioA, fimA, inicioB, fimB) =>
  exports.paraMin(inicioA) < exports.paraMin(fimB) && exports.paraMin(inicioB) < exports.paraMin(fimA);
exports.agora = () => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
  return { dia: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday], min: (+p.hour % 24) * 60 + +p.minute };
};
exports.paraMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
