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

  const colunas = new Set(db.prepare('PRAGMA table_info(admins)').all().map(({ name }) => name));
  const atualizaTipoAcesso = colunas.has('tipo_acesso') ? ",tipo_acesso='admin'" : '';
  const existente = db.prepare('SELECT id FROM admins WHERE usuario=?').get(usuario)
    || (producao ? db.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get() : null);

  if (existente && producao) {
    db.prepare(`UPDATE admins SET usuario=?,senha_hash=?,papel='admin'${atualizaTipoAcesso} WHERE id=?`)
      .run(usuario, hash(senha), existente.id);
  } else if (!existente) {
    const tipoAcesso = colunas.has('tipo_acesso') ? ',tipo_acesso' : '';
    const valorTipoAcesso = colunas.has('tipo_acesso') ? ",'admin'" : '';
    db.prepare(`INSERT INTO admins(usuario,senha_hash,papel${tipoAcesso}) VALUES(?,?,'admin'${valorTipoAcesso})`)
      .run(usuario, hash(senha));
  } else {
    db.prepare(`UPDATE admins SET papel='admin'${atualizaTipoAcesso} WHERE id=?`).run(existente.id);
  }

  db.prepare("UPDATE admins SET papel='admin' WHERE papel<>'admin'").run();
}

module.exports = { configurarAdmin, confere, hash };
