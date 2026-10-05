// Usa o SQLite embutido do Node (node:sqlite) — sem compilar nada.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs'), path = require('path');
const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, '../database/matematica.db'));
db.exec(fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8'));
const colunasSalas = new Set(db.prepare('PRAGMA table_info(salas)').all().map((coluna) => coluna.name));
for (const [nome, definicao] of [
  ['periodo', 'TEXT NOT NULL DEFAULT "Manhã"'],
  ['dificuldade', 'TEXT NOT NULL DEFAULT "Básico"'],
  ['conteudo_maior_dificuldade', 'TEXT']
]) {
  if (!colunasSalas.has(nome)) db.exec(`ALTER TABLE salas ADD COLUMN ${nome} ${definicao}`);
}
module.exports = db;
