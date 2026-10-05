const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { configurarAdmin, confere } = require('./admin');

function bancoDeTeste() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE admins(id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT UNIQUE NOT NULL, senha_hash TEXT NOT NULL)');
  return db;
}

test('credenciais do Render atualizam a conta já existente no banco incluído', () => {
  const db = bancoDeTeste();
  db.prepare('INSERT INTO admins(usuario,senha_hash) VALUES(?,?)').run('admin', 'hash-antigo');

  configurarAdmin(db, 'admin', 'senha-configurada-no-render', true);

  const admin = db.prepare('SELECT usuario,senha_hash FROM admins').get();
  assert.equal(admin.usuario, 'admin');
  assert.equal(confere('senha-configurada-no-render', admin.senha_hash), true);
  assert.equal(confere('admin123', admin.senha_hash), false);
  db.close();
});

test('credenciais configuradas substituem a conta inicial quando o usuário difere', () => {
  const db = bancoDeTeste();
  db.prepare('INSERT INTO admins(usuario,senha_hash) VALUES(?,?)').run('admin', 'hash-antigo');

  configurarAdmin(db, 'professor', 'outra-senha-segura', true);

  assert.equal(db.prepare('SELECT COUNT(*) n FROM admins').get().n, 1);
  const admin = db.prepare('SELECT usuario,senha_hash FROM admins').get();
  assert.equal(admin.usuario, 'professor');
  assert.equal(confere('outra-senha-segura', admin.senha_hash), true);
  db.close();
});

test('ambiente de produção não inicia sem usuário e senha definidos', () => {
  const db = bancoDeTeste();
  assert.throws(() => configurarAdmin(db, 'admin', '', true), /ADMIN_USER e ADMIN_PASS/);
  db.close();
});
