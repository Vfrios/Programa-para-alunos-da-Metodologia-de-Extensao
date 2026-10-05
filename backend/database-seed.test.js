const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sincronizarCadastros } = require('./database-seed');

test('guarda relatórios importados separados das respostas da aplicação', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.resolve(__dirname, '../database/schema.sql'), 'utf8'));
  const salaId = Number(db.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)').run('Turma A', 2, 'Docente').lastInsertRowid);
  const importacaoId = Number(db.prepare('INSERT INTO importacoes_sala(sala_id,arquivo) VALUES(?,?)').run(salaId, 'relatorio.csv').lastInsertRowid);
  const inserir = db.prepare(`INSERT INTO alunos_importados
    (importacao_id,linha_origem,nome,total_respostas,pontos_total,tempo_medio_s) VALUES(?,?,?,?,?,?)`);
  inserir.run(importacaoId, 2, 'Ana', 10, 900, 8.5);
  inserir.run(importacaoId, 3, 'Bia', 0, 0, null);

  assert.equal(db.prepare('SELECT COUNT(*) n FROM alunos_importados WHERE importacao_id=?').get(importacaoId).n, 2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM respostas').get().n, 0);
  assert.equal(db.prepare('SELECT tempo_medio_s FROM alunos_importados WHERE linha_origem=3').get().tempo_medio_s, null);
  db.close();
});

function criarBanco(comFim = false) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE salas(id INTEGER PRIMARY KEY, nome TEXT NOT NULL, ano INTEGER NOT NULL, professor TEXT NOT NULL,
      periodo TEXT NOT NULL DEFAULT 'Manhã', dificuldade TEXT NOT NULL DEFAULT 'Básico', conteudo_maior_dificuldade TEXT);
    CREATE TABLE horarios(id INTEGER PRIMARY KEY AUTOINCREMENT, sala_id INTEGER NOT NULL, dia INTEGER NOT NULL, hora TEXT NOT NULL${comFim ? ', fim TEXT' : ''});
    CREATE TABLE conteudos(sala_id INTEGER NOT NULL, atividade TEXT NOT NULL, PRIMARY KEY(sala_id,atividade));
  `);
  return db;
}

test('importa salas, horários e conteúdos do banco incluído sem duplicar em reinicializações', () => {
  const origem = criarBanco(), destino = criarBanco(true);
  origem.prepare('INSERT INTO salas(id,nome,ano,professor) VALUES(?,?,?,?)').run(1, 'Turma A', 2, 'Professora');
  origem.prepare('INSERT INTO horarios(sala_id,dia,hora) VALUES(?,?,?)').run(1, 2, '09:00');
  origem.prepare('INSERT INTO conteudos(sala_id,atividade) VALUES(?,?)').run(1, 'soma');

  assert.deepEqual(sincronizarCadastros(destino, origem), {
    salasImportadas: 1, horariosImportados: 1, conteudosImportados: 1
  });
  assert.deepEqual(sincronizarCadastros(destino, origem), {
    salasImportadas: 0, horariosImportados: 0, conteudosImportados: 0
  });
  assert.equal(destino.prepare('SELECT COUNT(*) n FROM salas').get().n, 1);
  assert.equal(destino.prepare('SELECT COUNT(*) n FROM horarios').get().n, 1);
  assert.equal(destino.prepare('SELECT COUNT(*) n FROM conteudos').get().n, 1);
  origem.close(); destino.close();
});

test('preserva sala remota com ID conflitante e importa as salas faltantes', () => {
  const origem = criarBanco(), destino = criarBanco(true);
  origem.prepare('INSERT INTO salas(id,nome,ano,professor) VALUES(?,?,?,?)').run(1, 'Sala local', 2, 'Docente local');
  origem.prepare('INSERT INTO salas(id,nome,ano,professor) VALUES(?,?,?,?)').run(2, 'Sala nova', 3, 'Docente local');
  origem.prepare('INSERT INTO horarios(sala_id,dia,hora) VALUES(?,?,?)').run(1, 2, '09:00');
  origem.prepare('INSERT INTO conteudos(sala_id,atividade) VALUES(?,?)').run(1, 'soma');
  destino.prepare('INSERT INTO salas(id,nome,ano,professor) VALUES(?,?,?,?)').run(1, 'Sala remota', 3, 'Docente remoto');

  assert.deepEqual(sincronizarCadastros(destino, origem), {
    salasImportadas: 1, horariosImportados: 0, conteudosImportados: 0
  });
  assert.equal(destino.prepare('SELECT nome FROM salas WHERE id=1').get().nome, 'Sala remota');
  assert.equal(destino.prepare('SELECT nome FROM salas WHERE id=2').get().nome, 'Sala nova');
  assert.equal(destino.prepare('SELECT COUNT(*) n FROM horarios').get().n, 0);
  assert.equal(destino.prepare('SELECT COUNT(*) n FROM conteudos').get().n, 0);
  origem.close(); destino.close();
});

test('importa o horário de fim quando a origem já o possui', () => {
  const origem = criarBanco(true), destino = criarBanco(true);
  origem.prepare('INSERT INTO salas(id,nome,ano,professor) VALUES(?,?,?,?)').run(1, 'Turma A', 2, 'Professora');
  origem.prepare('INSERT INTO horarios(sala_id,dia,hora,fim) VALUES(?,?,?,?)').run(1, 1, '13:30', '14:30');

  assert.equal(sincronizarCadastros(destino, origem).horariosImportados, 1);
  assert.equal(destino.prepare('SELECT fim FROM horarios WHERE sala_id=1').get().fim, '14:30');
  origem.close(); destino.close();
});

test('inicializar com DB_FILE importa os cadastros do banco que acompanha o deploy', () => {
  const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'matematica-db-seed-'));
  const caminhoBanco = path.join(pastaTemporaria, 'render.db');
  try {
    execFileSync(process.execPath, ['-e', "require('./database').close()"], {
      cwd: __dirname,
      env: { ...process.env, DB_FILE: caminhoBanco },
      stdio: 'pipe',
    });
    const banco = new DatabaseSync(caminhoBanco, { readOnly: true });
    const base = new DatabaseSync(path.resolve(__dirname, '../database/matematica.db'), { readOnly: true });
    for (const tabela of ['salas', 'horarios', 'conteudos']) {
      assert.equal(banco.prepare(`SELECT COUNT(*) n FROM ${tabela}`).get().n,
        base.prepare(`SELECT COUNT(*) n FROM ${tabela}`).get().n);
    }
    assert.ok(banco.prepare('PRAGMA table_info(horarios)').all().some((coluna) => coluna.name === 'fim'));
    assert.ok(banco.prepare('PRAGMA table_info(sessoes)').all().some((coluna) => coluna.name === 'fim_previsto_em'));
    assert.equal(banco.prepare('SELECT COUNT(*) n FROM horarios WHERE fim IS NULL').get().n, 0);
    banco.close(); base.close();
  } finally {
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  }
});
