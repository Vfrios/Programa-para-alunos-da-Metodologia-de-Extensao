const test = require('node:test');
const assert = require('node:assert/strict');
const { adicionarMinutos, horaFim, sobrepoe } = require('./agendamento');

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
