const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { after, test } = require('node:test');
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

test('sessões recebem numeração sequencial e preservam rótulos personalizados', async (contexto) => {
  const port = await portaDisponivel();
  const processo = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: { ...process.env, DB_FILE: ':memory:', NODE_ENV: 'test', PORT: String(port) },
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
        body: JSON.stringify({ usuario: 'admin', senha: 'admin123' }),
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
    nome: 'Turma de teste',
    ano: 2,
    professor: 'Teste',
  });
  const data = new Date();
  const dataFmt = `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;

  const abrir = (rotulo) => chamar('/api/admin/sessoes', 'POST', { sala_id: salaId, rotulo });
  const encerrar = (id) => chamar(`/api/admin/sessoes/${id}/encerrar`, 'POST');
  const primeira = await abrir(`Atividade 1 - ${dataFmt}`);
  assert.equal(primeira.rotulo, `Atividade 1 - ${dataFmt}`);
  await encerrar(primeira.id);

  const segunda = await abrir(`Atividade 1 - ${dataFmt}`);
  assert.equal(segunda.rotulo, `Atividade 2 - ${dataFmt}`);
  await encerrar(segunda.id);

  const personalizada = await abrir('Sessão especial');
  assert.equal(personalizada.rotulo, 'Sessão especial');
  await encerrar(personalizada.id);

  const quarta = await abrir(null);
  assert.equal(quarta.rotulo, `Atividade 4 - ${dataFmt}`);
});
