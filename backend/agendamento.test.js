const test = require('node:test');
const assert = require('node:assert/strict');
const {
  adicionarMinutos, deveIniciarAutomaticamente, diaDaData, horarioOcorre,
  horariosSeSobrepoem, horaFim, limiteInicioAutomatico, sobrepoe,
} = require('./agendamento');

test('calcula o fim padrão 55 minutos após o início', () => {
  assert.equal(adicionarMinutos('14:40', 55), '15:35');
  assert.equal(horaFim('14:40', null), '15:35');
});

test('prioriza o fim informado para o horário', () => {
  assert.equal(horaFim('13:30', '14:30'), '14:30');
});

test('detecta sobreposição sem rejeitar horários adjacentes', () => {
  assert.equal(sobrepoe('09:00', '10:00', '09:30', '10:30'), true);
  assert.equal(sobrepoe('09:00', '10:00', '10:00', '11:00'), false);
});

test('horário com data ocorre somente nessa data e sem data continua semanal', () => {
  const atual = { dia: 1, data: '2026-10-19' };
  assert.equal(horarioOcorre({ dia: 1, data: '2026-10-19' }, atual), true);
  assert.equal(horarioOcorre({ dia: 1, data: '2026-10-05' }, atual), false);
  assert.equal(horarioOcorre({ dia: 1, data: null }, atual), true);
  assert.equal(horarioOcorre({ dia: 2, data: null }, atual), false);
});

test('valida a data civil e obtém o dia da semana sem depender do fuso local', () => {
  assert.equal(diaDaData('2026-10-05'), 1);
  assert.equal(diaDaData('2026-10-06'), 2);
  assert.equal(diaDaData('2026-10-08'), 4);
  assert.equal(diaDaData('2026-02-30'), null);
  assert.equal(diaDaData('05/10/2026'), null);
});

test('permite horários sobrepostos em datas diferentes, mas bloqueia ocorrências coincidentes', () => {
  const horario = { dia: 1, hora: '13:30', fim: '14:25', data: '2026-10-05' };
  assert.equal(horariosSeSobrepoem(horario, { ...horario, data: '2026-10-12' }), false);
  assert.equal(horariosSeSobrepoem(horario, { ...horario, data: '2026-10-05' }), true);
  assert.equal(horariosSeSobrepoem(horario, { ...horario, data: null }), true);
});

test('limita o início automático ao horário agendado mais a espera configurada', () => {
  const agora = new Date('2026-11-03T16:01:30.500-03:00');
  const limite = limiteInicioAutomatico(
    { hora: '13:00', inicio_espera_min: 8 },
    { min: 13 * 60 + 1 },
    agora
  );
  assert.equal(limite, '2026-11-03T19:08:00.000Z');
});

test('inicia automaticamente ao alcançar 12 alunos ou ao terminar a espera', () => {
  const limite = '2026-11-03T16:08:00.000-03:00';
  assert.equal(deveIniciarAutomaticamente(11, limite, Date.parse('2026-11-03T16:07:59-03:00')), false);
  assert.equal(deveIniciarAutomaticamente(12, limite, Date.parse('2026-11-03T16:07:00-03:00')), true);
  assert.equal(deveIniciarAutomaticamente(2, limite, Date.parse('2026-11-03T16:08:00-03:00')), true);
});
