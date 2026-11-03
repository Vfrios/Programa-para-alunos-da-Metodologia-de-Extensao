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
    professor: 'A definir',
  });
  assert.equal((await chamar('/api/admin/salas')).find((sala) => sala.id === salaId).professor, '');
  const data = new Date();
  const dataFmt = `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;

  const abrir = (rotulo) => chamar('/api/admin/sessoes', 'POST', { sala_id: salaId, rotulo });
  const encerrar = (id) => chamar(`/api/admin/sessoes/${id}/encerrar`, 'POST');
  const cancelar = (id) => chamar(`/api/admin/sessoes/${id}/cancelar`, 'POST');
  const excluir = (id) => chamar(`/api/admin/sessoes/${id}`, 'DELETE');
  const contador = async () => (await chamar('/api/admin/salas')).find((sala) => sala.id === salaId)._contadorAtividades;
  const primeira = await abrir(`Atividade 1 - ${dataFmt}`);
  assert.equal(primeira.rotulo, `Atividade 1 - ${dataFmt}`);
  await encerrar(primeira.id);

  const segunda = await abrir(`Atividade 1 - ${dataFmt}`);
  assert.equal(segunda.rotulo, `Atividade 2 - ${dataFmt}`);
  assert.deepEqual(await cancelar(segunda.id), { ok: true, cancelada: true });
  assert.equal(await contador(), 1);
  assert.deepEqual((await chamar('/api/admin/painel')).map((sessao) => sessao.id), []);
  assert.equal((await chamar('/api/admin/sessoes-encerradas')).some((sessao) => sessao.id === segunda.id), false);

  const reutilizada = await abrir(null);
  assert.equal(reutilizada.rotulo, `Atividade 2 - ${dataFmt}`);
  await encerrar(reutilizada.id);

  const personalizada = await abrir('Sessão especial');
  assert.equal(personalizada.rotulo, 'Sessão especial');
  await encerrar(personalizada.id);

  const cancelada = await abrir(null);
  assert.equal(cancelada.rotulo, `Atividade 4 - ${dataFmt}`);
  assert.deepEqual(await cancelar(cancelada.id), { ok: true, cancelada: true });
  assert.deepEqual((await chamar('/api/admin/painel')).map((sessao) => sessao.id), []);
  assert.equal((await chamar('/api/admin/sessoes-encerradas')).some((sessao) => sessao.id === cancelada.id), false);
  assert.equal(await contador(), 3);

  const quinta = await abrir(null);
  assert.equal(quinta.rotulo, `Atividade 4 - ${dataFmt}`);
  await encerrar(quinta.id);
  await chamar('/api/admin/usuarios', 'POST', {
    usuario: 'professor_teste',
    senha: 'senha1234',
    tipo_acesso: 'professor',
  });
  const loginProfessor = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ usuario: 'professor_teste', senha: 'senha1234' }),
  });
  const tokenProfessor = (await loginProfessor.json()).token;
  const exclusaoProfessor = await fetch(`${base}/api/admin/sessoes/${quinta.id}`, {
    method: 'DELETE',
    headers: { 'x-token': tokenProfessor },
  });
  assert.equal(exclusaoProfessor.status, 403);

  const sexta = await abrir(null);
  assert.equal(sexta.rotulo, `Atividade 5 - ${dataFmt}`);
  const exclusaoEmEspera = await fetch(`${base}/api/admin/sessoes/${sexta.id}`, {
    method: 'DELETE',
    headers: { 'x-token': token },
  });
  assert.equal(exclusaoEmEspera.status, 400);
  await cancelar(sexta.id);

  const comAluno = await abrir(null);
  const aluno = await chamar('/api/alunos', 'POST', { nome: 'Aluno de teste' });
  await chamar(`/api/admin/sessoes/${comAluno.id}/iniciar`, 'POST');
  await encerrar(comAluno.id);
  assert.ok((await chamar('/api/admin/alunos')).some((registro) => registro.id === aluno.alunoId));
  await excluir(comAluno.id);
  assert.equal((await chamar('/api/admin/alunos')).some((registro) => registro.id === aluno.alunoId), false);
  assert.equal((await chamar('/api/admin/sessoes-encerradas')).some((sessao) => sessao.id === comAluno.id), false);
  const relatorioExcluido = await fetch(`${base}/api/admin/relatorio?tipo=sessao&sessao_id=${comAluno.id}`, {
    headers: { 'x-token': token },
  });
  assert.equal(relatorioExcluido.status, 400);
  assert.equal(await contador(), 4);

  await excluir(quinta.id);
  assert.equal((await chamar('/api/admin/sessoes-encerradas')).some((sessao) => sessao.id === quinta.id), false);
  assert.equal(await contador(), 3);
  const depoisDeExcluir = await abrir(null);
  assert.equal(depoisDeExcluir.rotulo, `Atividade 4 - ${dataFmt}`);
});
