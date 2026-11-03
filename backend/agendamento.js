const TZ = 'America/Sao_Paulo';
exports.DURACAO_MIN = 55;
exports.LIMITE_ALUNOS_INICIO_AUTOMATICO = 12;
exports.adicionarMinutos = (hora, minutos) => {
  const total = (exports.paraMin(hora) + minutos) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
exports.horaFim = (inicio, fim) => fim || exports.adicionarMinutos(inicio, exports.DURACAO_MIN);
exports.sobrepoe = (inicioA, fimA, inicioB, fimB) =>
  exports.paraMin(inicioA) < exports.paraMin(fimB) && exports.paraMin(inicioB) < exports.paraMin(fimA);
exports.agora = () => {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
    .formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
  const data = `${p.year}-${p.month}-${p.day}`;
  return { dia: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday], data, min: (+p.hour % 24) * 60 + +p.minute };
};
exports.paraMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
exports.diaDaData = (data) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const dataUTC = new Date(`${data}T00:00:00.000Z`);
  if (!Number.isFinite(dataUTC.getTime()) || dataUTC.toISOString().slice(0, 10) !== data) return null;
  return dataUTC.getUTCDay();
};
exports.horarioOcorre = (horario, atual) => horario.data
  ? horario.data === atual.data : horario.dia === atual.dia;
exports.horariosSeSobrepoem = (a, b) => a.dia === b.dia &&
  !(a.data && b.data && a.data !== b.data) && exports.sobrepoe(a.hora, a.fim, b.hora, b.fim);
exports.limiteInicioAutomatico = (horario, atual, agoraReal = new Date()) => {
  const espera = Number(horario.inicio_espera_min ?? 8);
  const segundos = agoraReal.getSeconds() * 1000 + agoraReal.getMilliseconds();
  const minutosRestantes = exports.paraMin(horario.hora) + espera - atual.min;
  return new Date(agoraReal.getTime() + minutosRestantes * 60000 - segundos).toISOString();
};
exports.deveIniciarAutomaticamente = (alunosProntos, limite, agoraReal = Date.now()) =>
  alunosProntos >= exports.LIMITE_ALUNOS_INICIO_AUTOMATICO || (limite != null && Date.parse(limite) <= agoraReal);
