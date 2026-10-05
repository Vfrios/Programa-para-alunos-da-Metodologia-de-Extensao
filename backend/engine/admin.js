const crypto = require('node:crypto');

const hash = (senha, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(senha, salt, 32).toString('hex')}`;

const confere = (senha, senhaHash) => {
  const [salt, chave] = String(senhaHash || '').split(':');
  if (!salt || !chave || !/^[\da-f]{64}$/i.test(chave)) return false;
  return crypto.timingSafeEqual(Buffer.from(chave, 'hex'), crypto.scryptSync(senha, salt, 32));
};

function configurarAdmin(db, usuario, senha, producao, adminPrimario = {}) {
  if (producao && (!usuario || !senha)) {
    throw new Error('Configure ADMIN_USER e ADMIN_PASS antes de iniciar em produção.');
  }
  const { usuario: usuarioPrimario, senha: senhaPrimaria } = adminPrimario;
  if (Boolean(usuarioPrimario) !== Boolean(senhaPrimaria)) {
    throw new Error('Configure PRIMARY_ADMIN_USER e PRIMARY_ADMIN_PASS juntos.');
  }
  if (usuarioPrimario && usuarioPrimario === usuario) {
    throw new Error('O login primário deve ser diferente do login administrativo comum.');
  }

  const adminExistente = db.prepare('SELECT id FROM admins WHERE usuario=?').get(usuario)
    || (producao ? db.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get() : null);

  if (adminExistente && producao) {
    db.prepare("UPDATE admins SET usuario=?, senha_hash=?, papel='admin' WHERE id=?")
      .run(usuario, hash(senha), adminExistente.id);
  } else if (!adminExistente) {
    db.prepare("INSERT INTO admins(usuario,senha_hash,papel) VALUES(?,?,'admin')").run(usuario, hash(senha));
  } else {
    db.prepare("UPDATE admins SET papel='admin' WHERE id=?").run(adminExistente.id);
  }

  db.prepare("UPDATE admins SET papel='admin' WHERE papel='primario'").run();
  if (usuarioPrimario) {
    const primarioExistente = db.prepare('SELECT id FROM admins WHERE usuario=?').get(usuarioPrimario);
    if (primarioExistente) {
      db.prepare("UPDATE admins SET senha_hash=?, papel='primario' WHERE id=?")
        .run(hash(senhaPrimaria), primarioExistente.id);
    } else {
      db.prepare("INSERT INTO admins(usuario,senha_hash,papel) VALUES(?,?,'primario')")
        .run(usuarioPrimario, hash(senhaPrimaria));
    }
  }
}

module.exports = { configurarAdmin, confere };
