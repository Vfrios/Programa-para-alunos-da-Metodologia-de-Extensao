// Usa o SQLite embutido do Node (node:sqlite) — sem compilar nada.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs'), path = require('path');
const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, '../database/matematica.db'));
db.exec(fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8'));
for (const stmt of [
  'ALTER TABLE salas ADD COLUMN periodo TEXT NOT NULL DEFAULT "Manhã"',
  'ALTER TABLE salas ADD COLUMN dificuldade TEXT NOT NULL DEFAULT "Básico"',
  'ALTER TABLE salas ADD COLUMN conteudo_maior_dificuldade TEXT'
]) {
  try { db.exec(stmt); } catch (e) {}
}
module.exports = db;
