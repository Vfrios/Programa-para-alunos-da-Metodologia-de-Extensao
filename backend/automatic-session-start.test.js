const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

async function portaDisponivel() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

test('sessão agendada inicia com 12 alunos, aceita atrasados e mantém o fim previsto', async (contexto) => {
  const agoraPartes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date()).reduce((partes, parte) => {
    partes[parte.type] = parte.value;
    return partes;
  }, {});
  const data = `${agoraPartes.year}-${agoraPartes.month}-${agoraPartes.day}`;
  const inicioMinutos = Number(agoraPartes.hour) * 60 + Number(agoraPartes.minute);
  if (inicioMinutos + 10 >= 24 * 60) {
    contexto.skip('O teste precisa de dez minutos restantes no dia local.');
    return;
  }
  const hora = `${agoraPartes.hour}:${agoraPartes.minute}`;
  const fimMinutos = inicioMinutos + 10;
  const fim = `${String(Math.floor(fimMinutos / 60)).padStart(2, '0')}:${String(fimMinutos % 60).padStart(2, '0')}`;
  const dia = new Date(`${data}T00:00:00.000Z`).getUTCDay();

  const port = await portaDisponivel();
  const processo = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: {
      ...process.env,
      DB_FILE: ':memory:',
      NODE_ENV: 'test',
      PORT: String(port),
      ADMIN_USER: 'admin-teste',
      ADMIN_PASS: 'senha-admin-teste',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let erroProcesso = '';
  processo.stderr.setEncoding('utf8').on('data', (texto) => { erroProcesso += texto; });
  contexto.after(() => processo.kill());

  const base = `http://127.0.0.1:${port}`;
  let token;
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (processo.exitCode !== null) throw new Error(`Servidor terminou antes de iniciar: ${erroProcesso}`);
    try {
      const resposta = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ usuario: 'admin-teste', senha: 'senha-admin-teste' }),
      });
      if (resposta.ok) {
        token = (await resposta.json()).token;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(token, `Servidor não iniciou. ${erroProcesso}`);

  const chamar = async (rota, metodo = 'GET', corpo) => {
    const resposta = await fetch(`${base}${rota}`, {
      method: metodo,
      headers: { 'content-type': 'application/json', 'x-token': token },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
    const dados = await resposta.json();
    assert.equal(resposta.ok, true, dados.erro || `HTTP ${resposta.status}`);
    return dados;
  };
  const { id: salaId } = await chamar('/api/admin/salas', 'POST', {
    nome: 'Turma de início automático',
    ano: 2,
    professor: 'Teste',
    horarios: [{ dia, data, hora, fim, inicio_espera_min: 8 }],
  });
  const salaSalva = (await chamar('/api/admin/salas')).find((sala) => sala.id === salaId);
  assert.equal(salaSalva.horarios[0].inicio_espera_min, 8);
  const esperadoInicio = new Date(Date.parse(`${data}T${hora}:00-03:00`) + 8 * 60000).toISOString();
  const esperadoFim = new Date(`${data}T${fim}:00-03:00`).toISOString();
  const aluno = (indice) => chamar('/api/alunos', 'POST', { nome: `Aluno Teste${indice}` });

  let sessao;
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const sessoes = await chamar('/api/admin/painel');
    sessao = sessoes.find((item) => item.sala_id === salaId);
    if (sessao) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(sessao, `Agendador não abriu a sessão. ${erroProcesso}`);
  assert.equal(sessao.status, 'aguardando');
  assert.equal(sessao.iniciar_ate_em, esperadoInicio);
  assert.equal(sessao.fim_previsto_em, esperadoFim);

  for (let indice = 1; indice <= 11; indice++) await aluno(indice);
  sessao = (await chamar('/api/admin/painel')).find((item) => item.sala_id === salaId);
  assert.equal(sessao.status, 'aguardando');

  const decimoSegundo = await aluno(12);
  assert.equal(decimoSegundo.status, 'iniciada');
  const alunoAtrasado = await aluno(13);
  assert.equal(alunoAtrasado.status, 'iniciada');
  sessao = (await chamar('/api/admin/painel')).find((item) => item.sala_id === salaId);
  assert.equal(sessao.status, 'iniciada');
  assert.equal(sessao.alunos, 13);
  assert.equal(sessao.fim_previsto_em, esperadoFim);

  await chamar(`/api/admin/sessoes/${sessao.id}/encerrar`, 'POST');
});
