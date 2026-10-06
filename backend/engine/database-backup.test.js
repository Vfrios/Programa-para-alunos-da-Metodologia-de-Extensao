const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { serializeDatabase, restoreDatabase } = require('./database-backup');

function criarBanco() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8'));
  return db;
}

test('exporta e restaura todas as tabelas do SQLite', () => {
  const origem = criarBanco();
  const destino = criarBanco();
  try {
    origem.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)').run('2º ano - Terça', 2, 'Professora');
    origem.prepare('INSERT INTO sessoes(sala_id,aberta_em) VALUES(?,?)').run(1, '2026-10-06T12:00:00.000Z');
    origem.prepare("UPDATE sessoes SET status='encerrada' WHERE id=1").run();
    origem.prepare('INSERT INTO alunos(sessao_id,sala_id,nome) VALUES(?,?,?)').run(1, 1, 'Criança Teste');
    destino.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)').run('Sala antiga', 3, 'Outro');

    restoreDatabase(destino, serializeDatabase(origem));

    assert.equal(destino.prepare('SELECT nome FROM salas').get().nome, '2º ano - Terça');
    assert.equal(destino.prepare('SELECT nome FROM alunos').get().nome, 'Criança Teste');
    assert.equal(destino.prepare('SELECT COUNT(*) AS total FROM sessoes').get().total, 1);
  } finally {
    origem.close();
    destino.close();
  }
});

test('rejeita backup inválido sem alterar os dados existentes', () => {
  const db = criarBanco();
  try {
    db.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)').run('Sala preservada', 2, 'Professora');
    assert.throws(() => restoreDatabase(db, Buffer.from('não é sqlite')), /Arquivo inválido/);
    assert.equal(db.prepare('SELECT nome FROM salas').get().nome, 'Sala preservada');
  } finally {
    db.close();
  }
});

test('rejeita restauração de backup com aula em andamento', () => {
  const backup = criarBanco();
  const atual = criarBanco();
  try {
    backup.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)').run('Sala de backup', 2, 'Professora');
    backup.prepare('INSERT INTO sessoes(sala_id,aberta_em) VALUES(?,?)').run(1, '2026-10-06T12:00:00.000Z');
    atual.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)').run('Sala atual', 3, 'Professor');
    assert.throws(() => restoreDatabase(atual, serializeDatabase(backup)), /contém aulas em andamento/);
    assert.equal(atual.prepare('SELECT nome FROM salas').get().nome, 'Sala atual');
  } finally {
    backup.close();
    atual.close();
  }
});

test('informa quando a restauração não altera dados', () => {
  const backup = criarBanco();
  const atual = criarBanco();
  try {
    const sala = ['Sala igual', 2, 'Professora'];
    backup.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)').run(...sala);
    atual.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)').run(...sala);
    const resultado = restoreDatabase(atual, serializeDatabase(backup));
    assert.equal(resultado.dadosAlterados, false);
    assert.equal(resultado.tabelasAlteradas, 0);
  } finally {
    backup.close();
    atual.close();
  }
});

test('restaura backup de banco em arquivo com WAL habilitado', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'matematica-backup-file-test-'));
  const origem = new DatabaseSync(path.join(diretorio, 'origem.sqlite'));
  const destino = new DatabaseSync(path.join(diretorio, 'destino.sqlite'));
  try {
    for (const db of [origem, destino]) {
      db.exec(fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8'));
      db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    }
    origem.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)').run('Sala de arquivo', 2, 'Professora');
    destino.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)').run('Sala atual', 3, 'Professor');

    const resultado = restoreDatabase(destino, serializeDatabase(origem));

    assert.equal(resultado.dadosAlterados, true);
    assert.equal(destino.prepare('SELECT nome FROM salas').get().nome, 'Sala de arquivo');
  } finally {
    origem.close();
    destino.close();
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
});
