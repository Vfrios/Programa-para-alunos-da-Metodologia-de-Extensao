const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const caminhoBanco = path.resolve(__dirname, '../database/matematica.db');
const db = new DatabaseSync(caminhoBanco, { readOnly: true });

console.log('=== SALAS ===');
for (const s of db.prepare('SELECT id, nome, ano FROM salas ORDER BY id').all()) {
  console.log(`  id=${s.id}  ano=${s.ano}  nome="${s.nome}"  (bytes: ${Buffer.from(s.nome).toString('hex')})`);
}

console.log('\n=== SESSÕES ===');
for (const se of db.prepare(`
  SELECT se.id, se.sala_id, sa.nome AS sala, se.status, se.aberta_em, se.iniciada_em, se.encerrada_em
  FROM sessoes se LEFT JOIN salas sa ON sa.id = se.sala_id
  ORDER BY se.id
`).all()) {
  console.log(`  id=${se.id}  sala_id=${se.sala_id}  sala="${se.sala}"  status=${se.status}  aberta=${se.aberta_em}  iniciada=${se.iniciada_em}`);
}

console.log('\n=== CONTAGEM POR SALA ===');
for (const c of db.prepare(`
  SELECT sa.id, sa.nome, COUNT(se.id) AS sessoes
  FROM salas sa LEFT JOIN sessoes se ON se.sala_id = sa.id
  GROUP BY sa.id ORDER BY sa.id
`).all()) {
  console.log(`  id=${c.id}  "${c.nome}"  sessões=${c.sessoes}`);
}

db.close();
