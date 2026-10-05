const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { configurarAdmin, confere } = require('./admin');

function bancoDeTeste() {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE admins(id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT UNIQUE NOT NULL, senha_hash TEXT NOT NULL, papel TEXT NOT NULL DEFAULT 'admin')");
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
  db.prepare('INSERT INTO admins(usuario,senha_hash) VALUES(?,?)').run('admin', 'hash-antigo');

  configurarAdmin(db, 'professor', 'outra-senha-segura', true);

  assert.equal(db.prepare('SELECT COUNT(*) n FROM admins').get().n, 1);
  const admin = db.prepare('SELECT usuario,senha_hash,papel FROM admins').get();
  assert.equal(admin.usuario, 'professor');
  assert.equal(admin.papel, 'admin');
  assert.equal(confere('outra-senha-segura', admin.senha_hash), true);
  db.close();
});

test('ambiente de produção não inicia sem usuário e senha definidos', () => {
  const db = bancoDeTeste();
  assert.throws(() => configurarAdmin(db, 'admin', '', true), /ADMIN_USER e ADMIN_PASS/);
  db.close();
});

test('cria login primário separado e reconcilia o papel nas inicializações', () => {
  const db = bancoDeTeste();
  configurarAdmin(db, 'professor', 'senha-admin', true, {
    usuario: 'dono',
    senha: 'senha-primaria',
  });

  const primario = db.prepare('SELECT usuario,senha_hash,papel FROM admins WHERE usuario=?').get('dono');
  assert.equal(primario.papel, 'primario');
  assert.equal(confere('senha-primaria', primario.senha_hash), true);
  assert.equal(db.prepare('SELECT papel FROM admins WHERE usuario=?').get('professor').papel, 'admin');

  configurarAdmin(db, 'professor', 'senha-admin', true);
  assert.equal(db.prepare('SELECT papel FROM admins WHERE usuario=?').get('dono').papel, 'admin');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM admins WHERE papel='primario'").get().n, 0);
  db.close();
});

test('não permite compartilhar o login nem configurar apenas metade das credenciais primárias', () => {
  const db = bancoDeTeste();
  assert.throws(() => configurarAdmin(db, 'professor', 'senha', true, {
    usuario: 'professor',
    senha: 'outra-senha',
  }), /diferente do login administrativo comum/);
  assert.throws(() => configurarAdmin(db, 'professor', 'senha', true, {
    usuario: 'dono',
  }), /PRIMARY_ADMIN_USER e PRIMARY_ADMIN_PASS juntos/);
  db.close();
});
