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

test('administradores gerenciam usuários, trocam senhas e excluem acessos', async (contexto) => {
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
  const requisitar = async (rota, metodo = 'GET', token, corpo) => {
    const resposta = await fetch(`${base}${rota}`, {
      method: metodo,
      headers: {
        'content-type': 'application/json',
        ...(token ? { 'x-token': token } : {}),
      },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
    return { status: resposta.status, dados: await resposta.json() };
  };
  const entrar = async (usuario, senha) => {
    for (let tentativa = 0; tentativa < 100; tentativa++) {
      if (processo.exitCode !== null) throw new Error(`Servidor terminou antes de iniciar: ${erroProcesso}`);
      try {
        const resultado = await requisitar('/api/admin/login', 'POST', null, { usuario, senha });
        if (resultado.status === 200) return resultado.dados.token;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Servidor não iniciou. ${erroProcesso}`);
  };

  const adminToken = await entrar('admin-teste', 'senha-admin-teste');
  const listaInicial = await requisitar('/api/admin/usuarios', 'GET', adminToken);
  assert.equal(listaInicial.status, 200);
  const rotaDadosAntiga = await fetch(`${base}/api/admin/dados-alunos`, {
    headers: { 'x-token': adminToken },
  });
  assert.equal(rotaDadosAntiga.status, 404);
  assert.deepEqual(listaInicial.dados.map(({ usuario, tipo_acesso }) => ({ usuario, tipo_acesso })), [
    { usuario: 'admin-teste', tipo_acesso: 'admin' },
  ]);
  assert.equal(JSON.stringify(listaInicial.dados).includes('senha_hash'), false);

  const tipoInvalido = await requisitar('/api/admin/usuarios', 'POST', adminToken, {
    usuario: 'novo-primario',
    senha: 'senha-segura-123',
    tipo_acesso: 'primario',
  });
  assert.equal(tipoInvalido.status, 400);

  const professorCriado = await requisitar('/api/admin/usuarios', 'POST', adminToken, {
    usuario: '  novo-professor  ',
    senha: 'senha-segura-123',
    tipo_acesso: 'professor',
  });
  assert.equal(professorCriado.status, 201);
  let usuarios = await requisitar('/api/admin/usuarios', 'GET', adminToken);
  const professor = usuarios.dados.find(({ usuario }) => usuario === 'novo-professor');
  assert.equal(professor.tipo_acesso, 'professor');
  const professorToken = await entrar('novo-professor', 'senha-segura-123');
  assert.deepEqual((await requisitar('/api/admin/sessao', 'GET', professorToken)).dados, {
    papel: 'professor',
    usuario: 'novo-professor',
  });
  assert.equal((await requisitar('/api/admin/usuarios', 'GET', professorToken)).status, 403);
  const rotaBackupAntiga = await fetch(`${base}/api/admin/backup`, {
    headers: { 'x-token': professorToken },
  });
  assert.equal(rotaBackupAntiga.status, 404);

  assert.equal((await requisitar(`/api/admin/usuarios/${professor.id}/senha`, 'PUT', adminToken, {
    senha: 'curta',
  })).status, 400);
  const trocaSenha = await requisitar(`/api/admin/usuarios/${professor.id}/senha`, 'PUT', adminToken, {
    senha: 'nova-senha-professor',
  });
  assert.equal(trocaSenha.status, 200);
  const loginAntigo = await requisitar('/api/admin/login', 'POST', null, {
    usuario: 'novo-professor',
    senha: 'senha-segura-123',
  });
  assert.equal(loginAntigo.status, 401);
  const loginNovo = await requisitar('/api/admin/login', 'POST', null, {
    usuario: 'novo-professor',
    senha: 'nova-senha-professor',
  });
  assert.equal(loginNovo.status, 200);

  const adminCriado = await requisitar('/api/admin/usuarios', 'POST', adminToken, {
    usuario: 'novo-admin',
    senha: 'senha-admin-novo',
    tipo_acesso: 'admin',
  });
  assert.equal(adminCriado.status, 201);
  const novoAdminToken = await entrar('novo-admin', 'senha-admin-novo');
  assert.equal((await requisitar('/api/admin/usuarios', 'GET', novoAdminToken)).status, 200);

  assert.equal((await requisitar(`/api/admin/usuarios/${professor.id}`, 'DELETE', adminToken)).status, 200);
  assert.equal((await requisitar('/api/admin/login', 'POST', null, {
    usuario: 'novo-professor',
    senha: 'nova-senha-professor',
  })).status, 401);

  const listaFinal = await requisitar('/api/admin/usuarios', 'GET', adminToken);
  assert.deepEqual(listaFinal.dados.map(({ usuario, tipo_acesso }) => ({ usuario, tipo_acesso })), [
    { usuario: 'admin-teste', tipo_acesso: 'admin' },
    { usuario: 'novo-admin', tipo_acesso: 'admin' },
  ]);
  const excluirUsuarioAtual = await requisitar(`/api/admin/usuarios/${listaFinal.dados[0].id}`, 'DELETE', adminToken);
  assert.equal(excluirUsuarioAtual.status, 200);
  assert.equal(excluirUsuarioAtual.dados.sessaoEncerrada, true);
  assert.equal((await requisitar('/api/admin/usuarios', 'GET', adminToken)).status, 401);
  assert.equal((await requisitar(`/api/admin/usuarios/${listaFinal.dados[1].id}`, 'DELETE', novoAdminToken)).status, 400);
});
