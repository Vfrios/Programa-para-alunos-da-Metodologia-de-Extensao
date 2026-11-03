const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { configurarAdmin, confere } = require('./admin');

function bancoDeTeste(comTipoAcesso = false) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE admins(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL DEFAULT 'admin' CHECK(papel IN ('admin','primario'))
    ${comTipoAcesso ? ",tipo_acesso TEXT NOT NULL DEFAULT 'admin' CHECK(tipo_acesso IN ('professor','admin'))" : ''}
  )`);
  return db;
}

test('credenciais do Render atualizam a conta já existente no banco incluído', () => {
  const db = bancoDeTeste();
  db.prepare('INSERT INTO admins(usuario,senha_hash) VALUES(?,?)').run('admin', 'hash-antigo');

  configurarAdmin(db, 'admin', 'senha-configurada-no-render', true);

  const admin = db.prepare('SELECT usuario,senha_hash,papel FROM admins').get();
  assert.equal(admin.usuario, 'admin');
  assert.equal(admin.papel, 'admin');
  assert.equal(confere('senha-configurada-no-render', admin.senha_hash), true);
  assert.equal(confere('admin123', admin.senha_hash), false);
  db.close();
});

test('credenciais configuradas substituem a conta inicial quando o usuário difere', () => {
  const db = bancoDeTeste();
  db.prepare('INSERT INTO admins(usuario,senha_hash,papel) VALUES(?,?,?)').run('adm principal', 'hash-antigo', 'primario');

  configurarAdmin(db, 'admin-configurado', 'outra-senha-segura', true);

  assert.equal(db.prepare('SELECT COUNT(*) n FROM admins').get().n, 1);
  const admin = db.prepare('SELECT usuario,senha_hash,papel FROM admins').get();
  assert.equal(admin.usuario, 'admin-configurado');
  assert.equal(admin.papel, 'admin');
  assert.equal(confere('outra-senha-segura', admin.senha_hash), true);
  db.close();
});

test('ambiente de produção não inicia sem usuário e senha definidos', () => {
  const db = bancoDeTeste();
  assert.throws(() => configurarAdmin(db, 'admin', '', true), /ADMIN_USER e ADMIN_PASS/);
  db.close();
});

test('converte logins primários antigos em administradores sem elevar professores', () => {
  const db = bancoDeTeste(true);
  db.prepare('INSERT INTO admins(usuario,senha_hash,papel,tipo_acesso) VALUES(?,?,?,?)')
    .run('adm principal', 'hash-legado', 'primario', 'admin');
  db.prepare('INSERT INTO admins(usuario,senha_hash,papel,tipo_acesso) VALUES(?,?,?,?)')
    .run('docente', 'hash-professor', 'admin', 'professor');

  configurarAdmin(db, 'adm principal', 'nova-senha', false);

  assert.equal(db.prepare('SELECT papel,tipo_acesso FROM admins WHERE usuario=?').get('adm principal').papel, 'admin');
  assert.equal(db.prepare('SELECT tipo_acesso FROM admins WHERE usuario=?').get('docente').tipo_acesso, 'professor');
  assert.equal(db.prepare('SELECT senha_hash FROM admins WHERE usuario=?').get('adm principal').senha_hash, 'hash-legado');
  db.close();
});
