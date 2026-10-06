const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function serializeDatabase(db) {
  return Buffer.from(db.serialize());
}

function restoreDatabase(db, image) {
  if (!Buffer.isBuffer(image) || image.length < 100 || image.subarray(0, 16).toString() !== 'SQLite format 3\0') {
    throw new Error('Arquivo inválido. Selecione um backup SQLite exportado pelo sistema.');
  }

  const diretorioBackup = fs.mkdtempSync(path.join(os.tmpdir(), 'matematica-backup-'));
  const caminhoBackup = path.join(diretorioBackup, 'backup.sqlite');
  let backup;
  try {
    fs.writeFileSync(caminhoBackup, image, { flag: 'wx' });
    backup = new DatabaseSync(caminhoBackup, { readOnly: true });
    const integrity = backup.prepare('PRAGMA integrity_check').get();
    if (integrity.integrity_check !== 'ok') throw new Error('O arquivo de backup está corrompido.');
    if (backup.prepare("SELECT 1 AS ativa FROM sessoes WHERE status!='encerrada' LIMIT 1").get()) {
      throw new Error('O backup contém aulas em andamento. Encerre todas as aulas e exporte um novo backup.');
    }

    const tabelas = (database) => database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `).all().map((row) => row.name);
    const tabelasAtuais = tabelas(db);
    const tabelasBackup = tabelas(backup);
    if (tabelasAtuais.length !== tabelasBackup.length ||
        tabelasAtuais.some((nome, indice) => nome !== tabelasBackup[indice])) {
      throw new Error('O backup pertence a outra versão ou estrutura do sistema.');
    }

    const conteudos = tabelasBackup.map((tabela) => {
      const colunasAtuais = db.prepare(`PRAGMA table_info("${tabela}")`).all().map((coluna) => coluna.name);
      const colunasBackup = backup.prepare(`PRAGMA table_info("${tabela}")`).all().map((coluna) => coluna.name);
      if (colunasAtuais.length !== colunasBackup.length ||
          colunasAtuais.some((nome, indice) => nome !== colunasBackup[indice])) {
        throw new Error(`A estrutura da tabela "${tabela}" não corresponde à versão atual.`);
      }
      return { tabela, colunas: colunasBackup, linhas: backup.prepare(`SELECT * FROM "${tabela}"`).all() };
    });

    const resumirTabela = (database, tabela) => {
      const linhas = database.prepare(`SELECT * FROM "${tabela}"`).all()
        .map((linha) => JSON.stringify(linha))
        .sort();
      return {
        registros: linhas.length,
        hash: crypto.createHash('sha256').update(linhas.join('\n')).digest('hex'),
      };
    };
    const diferencas = tabelasBackup.map((tabela) => {
      const atual = resumirTabela(db, tabela);
      const restaurado = resumirTabela(backup, tabela);
      return {
        tabela,
        registrosAntes: atual.registros,
        registrosDepois: restaurado.registros,
        alterada: atual.hash !== restaurado.hash,
      };
    });

    db.exec('BEGIN IMMEDIATE');
    try {
      tabelasAtuais.forEach((tabela) => db.exec(`DELETE FROM "${tabela}"`));
      conteudos.forEach(({ tabela, colunas, linhas }) => {
        if (!linhas.length) return;
        const nomes = colunas.map((coluna) => `"${coluna}"`).join(',');
        const parametros = colunas.map(() => '?').join(',');
        const inserir = db.prepare(`INSERT INTO "${tabela}" (${nomes}) VALUES (${parametros})`);
        linhas.forEach((linha) => inserir.run(...colunas.map((coluna) => linha[coluna])));
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const tabelasAlteradas = diferencas.filter((tabela) => tabela.alterada);
    return {
      dadosAlterados: tabelasAlteradas.length > 0,
      tabelasAlteradas: tabelasAlteradas.length,
      diferencas,
    };
  } finally {
    if (backup) backup.close();
    fs.rmSync(diretorioBackup, { recursive: true, force: true });
  }
}

module.exports = { serializeDatabase, restoreDatabase };
