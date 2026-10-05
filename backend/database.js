// Usa o SQLite embutido do Node (node:sqlite) — sem compilar nada.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs'), path = require('path');
const { sincronizarCadastros } = require('./database-seed');
const caminhoBase = path.resolve(__dirname, '../database/matematica.db');
const caminhoBanco = process.env.DB_FILE === ':memory:' ? ':memory:'
  : process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : caminhoBase;
if (caminhoBanco !== ':memory:') fs.mkdirSync(path.dirname(caminhoBanco), { recursive: true });
const db = new DatabaseSync(caminhoBanco);
db.exec(fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8'));
const colunasSalas = new Set(db.prepare('PRAGMA table_info(salas)').all().map((coluna) => coluna.name));
for (const [nome, definicao] of [
  ['periodo', 'TEXT NOT NULL DEFAULT "Manhã"'],
  ['dificuldade', 'TEXT NOT NULL DEFAULT "Básico"'],
  ['conteudo_maior_dificuldade', 'TEXT']
]) {
  if (!colunasSalas.has(nome)) db.exec(`ALTER TABLE salas ADD COLUMN ${nome} ${definicao}`);
}
if (caminhoBanco !== caminhoBase && caminhoBanco !== ':memory:') {
  const origem = new DatabaseSync(caminhoBase, { readOnly: true });
  try {
    const sincronizadas = sincronizarCadastros(db, origem);
    if (sincronizadas.salasImportadas || sincronizadas.horariosImportados || sincronizadas.conteudosImportados) {
      console.log(`Cadastros sincronizados do banco incluído: ${sincronizadas.salasImportadas} salas, ${sincronizadas.horariosImportados} horários e ${sincronizadas.conteudosImportados} conteúdos.`);
    }
  } finally {
    origem.close();
  }
}
module.exports = db;
