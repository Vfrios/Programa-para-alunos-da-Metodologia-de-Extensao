const crypto = require('node:crypto');

const hash = (senha, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(senha, salt, 32).toString('hex')}`;

const confere = (senha, senhaHash) => {
  const [salt, chave] = String(senhaHash || '').split(':');
  if (!salt || !chave || !/^[\da-f]{64}$/i.test(chave)) return false;
  return crypto.timingSafeEqual(Buffer.from(chave, 'hex'), crypto.scryptSync(senha, salt, 32));
};

function configurarAdmin(db, usuario, senha, producao) {
  if (producao && (!usuario || !senha)) {
    throw new Error('Configure ADMIN_USER e ADMIN_PASS antes de iniciar em produção.');
  }

  const adminExistente = db.prepare('SELECT id FROM admins WHERE usuario=?').get(usuario)
    || (producao ? db.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get() : null);

  if (adminExistente && producao) {
    db.prepare('UPDATE admins SET usuario=?, senha_hash=? WHERE id=?')
      .run(usuario, hash(senha), adminExistente.id);
  } else if (!adminExistente) {
    db.prepare('INSERT INTO admins(usuario,senha_hash) VALUES(?,?)').run(usuario, hash(senha));
  }
}

module.exports = { configurarAdmin, confere };
