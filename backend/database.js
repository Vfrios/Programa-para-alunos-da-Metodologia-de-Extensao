// Usa o SQLite embutido do Node (node:sqlite) — sem compilar nada.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs'), path = require('path');
const { sincronizarCadastros } = require('./database-seed');
const { horaFim } = require('./agendamento');
const caminhoBase = path.resolve(__dirname, '../database/matematica.db');
const caminhoBanco = process.env.DB_FILE === ':memory:' ? ':memory:'
  : process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : caminhoBase;
if (caminhoBanco !== ':memory:') {
  const diretorioBanco = path.dirname(caminhoBanco);
  if (process.env.NODE_ENV === 'production' && process.env.DB_FILE) {
    try {
      fs.accessSync(diretorioBanco, fs.constants.W_OK);
    } catch (error) {
      throw new Error(
        `DB_FILE=${caminhoBanco} não está acessível (${error.code || error.message}). Anexe um Persistent Disk ao serviço Render, montado em ${diretorioBanco}, e confirme que ele aparece na página Disks do serviço. O app não usará banco temporário.`,
        { cause: error }
      );
    }
  } else {
    fs.mkdirSync(diretorioBanco, { recursive: true });
  }
}
const db = new DatabaseSync(caminhoBanco);
console.log(`Banco SQLite em uso: ${caminhoBanco}`);
db.exec(fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA wal_autocheckpoint=1000;');
for (const [tabela, coluna, definicao] of [
  ['admins', 'papel', `TEXT NOT NULL DEFAULT 'admin' CHECK (papel IN ('admin','primario'))`],
  ['historico_ranking', 'aluno_id', 'INTEGER'],
  ['horarios', 'fim', 'TEXT'],
  ['sessoes', 'fim_previsto_em', 'TEXT'],
  ['alunos_importados', 'acertos', 'INTEGER'],
  ['alunos_importados', 'percentual_acerto', 'REAL'],
  ['alunos_importados', 'estimado', 'INTEGER NOT NULL DEFAULT 0']
]) {
  const colunas = new Set(db.prepare(`PRAGMA table_info(${tabela})`).all().map((coluna) => coluna.name));
  if (!colunas.has(coluna)) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
}
db.exec(`UPDATE historico_ranking SET aluno_id=(
  SELECT MIN(a.id) FROM alunos a
  WHERE a.sessao_id=historico_ranking.sessao_id AND a.nome=historico_ranking.aluno
) WHERE aluno_id IS NULL AND (
  SELECT COUNT(*) FROM alunos a
  WHERE a.sessao_id=historico_ranking.sessao_id AND a.nome=historico_ranking.aluno
)=1`);
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
    if (Object.values(sincronizadas).some(Boolean)) {
      console.log(`Dados sincronizados do banco incluído: ${sincronizadas.salasImportadas} salas, ${sincronizadas.horariosImportados} horários, ${sincronizadas.conteudosImportados} conteúdos, ${sincronizadas.importacoesHistoricas} relatórios, ${sincronizadas.alunosHistoricos} registros de alunos adicionados e ${sincronizadas.alunosHistoricosRemovidos} removidos.`);
    }
  } finally {
    origem.close();
  }
}
const horariosSemFim = db.prepare('SELECT id,hora FROM horarios WHERE fim IS NULL').all();
const atualizarFimHorario = db.prepare('UPDATE horarios SET fim=? WHERE id=?');
horariosSemFim.forEach((horario) => atualizarFimHorario.run(horaFim(horario.hora), horario.id));
module.exports = db;
