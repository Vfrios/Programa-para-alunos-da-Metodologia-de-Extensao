const TZ = 'America/Sao_Paulo';
exports.DURACAO_MIN = 50;
exports.agora = () => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
  return { dia: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday], min: (+p.hour % 24) * 60 + +p.minute };
};
exports.paraMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
