const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { parseCSV, importarPlanilha } = require('./importar-planilha');

const schema = fs.readFileSync(path.resolve(__dirname, '../database/schema.sql'), 'utf8');

function executarImportacao(db, texto, nomeArquivo = 'planilha.csv') {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = importarPlanilha(db, texto, 1, nomeArquivo);
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function criarBanco() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.prepare('INSERT INTO salas(id,nome,ano,professor) VALUES(1,?,?,?)').run('Turma 1', 2, 'Docente');
  return db;
}

const relatorio = (perguntas = 10, nome2 = 'Bruno') => `Sala: Turma 1 — Relatório geral
indicador,valor
Perguntas,14
aluno,perguntas,acertos,percentual_acerto,pontos_total,tempo_medio_s
"Ana, Maria",${perguntas},9,90,500,12
${nome2},4,3,75,200,
atividade,perguntas,acertos,percentual_acerto
soma,14,12,85.7
aluno_id,aluno,atividade,perguntas,percentual_acerto
,"Ana, Maria",soma,5,80
,${nome2},subtracao,4,75
`;

test('analisa CSV UTF-8, aspas escapadas, vírgulas e quebras de linha em campos', () => {
  assert.deepEqual(parseCSV('\uFEFFnome,observacao\r\n"Ana, Maria","linha 1\nlinha 2"\r\n"João ""J""",ok'),
    [['nome', 'observacao'], ['Ana, Maria', 'linha 1\nlinha 2'], ['João "J"', 'ok']]);
});

test('importa e atualiza a carga mais recente da sala sem duplicar registros', () => {
  const db = criarBanco();
  const primeira = executarImportacao(db, relatorio(), 'aula.csv');
  assert.deepEqual(primeira, {
    sala: 'Turma 1', arquivo: 'aula.csv', alunosImportados: 2, alunosIgnoradosPorExclusao: 0,
    atividadesImportadas: 2, linhasDetalheAmbiguas: 0
  });
  executarImportacao(db, relatorio(12, 'Bruno'), 'novo-nome.csv');

  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM importacoes_sala').get().total, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM alunos_importados').get().total, 2);
  assert.equal(db.prepare('SELECT total_respostas FROM alunos_importados WHERE nome=?').get('Ana, Maria').total_respostas, 12);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM alunos_importados_atividades').get().total, 2);
  const atividade = db.prepare(`SELECT acertos,pontos_total,percentual_acerto
    FROM alunos_importados_atividades WHERE atividade='soma'`).get();
  assert.deepEqual(Object.values(atividade), [null, null, 80]);
  db.close();
});

test('importa CSV simples exportado para uma única sala e deixa métricas ausentes indisponíveis', () => {
  const db = criarBanco();
  const resultado = executarImportacao(db, '\uFEFFaluno,total_respostas,pontos_total,tempo_medio_s\r\nAna,8,400,10\r\nBruno,6,250,\r\n', 'aula.csv');
  assert.equal(resultado.alunosImportados, 2);
  assert.equal(db.prepare('SELECT total_respostas,acertos,percentual_acerto FROM alunos_importados WHERE nome=?')
    .get('Ana').total_respostas, 8);
  const metricas = db.prepare('SELECT acertos,percentual_acerto FROM alunos_importados WHERE nome=?').get('Ana');
  assert.equal(metricas.acertos, null);
  assert.equal(metricas.percentual_acerto, null);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM importacoes_sala').get().total, 1);
  db.close();
});

test('filtra o CSV geral exportado pelo sistema e aceita cabeçalhos do Excel em português', () => {
  const db = criarBanco();
  const resultado = executarImportacao(db, '\uFEFF"Aluno","Sala","Perguntas","Acertos","Aproveitamento (%)","Pontos","Tempo médio (s)"\r\n'
    + '"Ana, Maria","Outra turma",20,18,90,900,10\r\n'
    + '"Ana, Maria","Turma 1",8,7,87.5,350,11\r\n', 'geral.csv');
  assert.equal(resultado.alunosImportados, 1);
  assert.equal(db.prepare('SELECT total_respostas,pontos_total FROM alunos_importados').get().total_respostas, 8);
  assert.equal(db.prepare('SELECT pontos_total FROM alunos_importados').get().pontos_total, 350);
  db.close();
});

test('respeita exclusões salvas e não associa detalhe a nomes duplicados', () => {
  const db = criarBanco();
  executarImportacao(db, relatorio(), 'aula.csv');
  db.prepare(`INSERT INTO exclusoes_alunos_importados(sala_id,arquivo,linha_origem)
    VALUES(1,'aula.csv',2)`).run();
  const resultado = executarImportacao(db, `Sala: Turma 1
aluno,perguntas,acertos,percentual_acerto,pontos_total,tempo_medio_s
"Ana, Maria",10,9,90,500,12
Bruno,4,3,75,200,
aluno_id,aluno,atividade,perguntas,percentual_acerto
,Ana,soma,5,80
,Bruno,subtracao,4,75
`, 'atualizado.csv');

  assert.equal(resultado.alunosImportados, 1);
  assert.equal(resultado.alunosIgnoradosPorExclusao, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM alunos_importados').get().total, 1);
  assert.equal(db.prepare('SELECT nome FROM alunos_importados').get().nome, 'Bruno');

  db.prepare('DELETE FROM exclusoes_alunos_importados').run();
  const duplicados = `Sala: Turma 1
aluno,perguntas,acertos,percentual_acerto,pontos_total
Ana,4,3,75,200
Ana,5,4,80,250
aluno_id,aluno,atividade,perguntas,percentual_acerto
,Ana,soma,3,75
`;
  const resultadoDuplicados = executarImportacao(db, duplicados, 'duplicados.csv');
  assert.equal(resultadoDuplicados.alunosImportados, 2);
  assert.equal(resultadoDuplicados.linhasDetalheAmbiguas, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM alunos_importados_atividades').get().total, 1);
  db.close();
});

test('preserva a identidade dos registros excluídos mesmo se a planilha vier reordenada', () => {
  const db = criarBanco();
  executarImportacao(db, relatorio(), 'aula.csv');
  db.prepare(`INSERT INTO exclusoes_alunos_importados(sala_id,arquivo,linha_origem,nome)
    VALUES(1,'aula.csv',2,'Ana, Maria')`).run();
  db.prepare(`DELETE FROM alunos_importados_atividades WHERE aluno_importado_id IN
    (SELECT id FROM alunos_importados WHERE linha_origem=2)`).run();
  db.prepare('DELETE FROM alunos_importados WHERE linha_origem=2').run();

  const resultado = executarImportacao(db, `aluno,perguntas,acertos,percentual_acerto,pontos_total
Bruno,6,4,66.7,300
"Ana, Maria",10,9,90,500
Carla,3,2,66.7,100`, 'atualizado.csv');

  assert.equal(resultado.alunosImportados, 2);
  assert.equal(resultado.alunosIgnoradosPorExclusao, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM alunos_importados').get().total, 2);
  assert.equal(db.prepare('SELECT linha_origem,total_respostas FROM alunos_importados WHERE nome=?')
    .get('Bruno').linha_origem, 3);
  assert.equal(db.prepare('SELECT total_respostas FROM alunos_importados WHERE nome=?').get('Bruno').total_respostas, 6);
  assert.equal(db.prepare('SELECT linha_origem FROM alunos_importados WHERE nome=?').get('Carla').linha_origem, 4);
  db.close();
});

test('recusa linhas inválidas, sala ausente e CSV malformado', () => {
  const db = criarBanco();
  assert.throws(() => executarImportacao(db, 'Sala: Outra turma\naluno,perguntas,acertos,percentual_acerto,pontos_total\nAna,1,1,100,10'),
    /não contém uma seção/);
  assert.throws(() => executarImportacao(db, `Sala: Turma 1
aluno,perguntas,acertos,percentual_acerto,pontos_total
Ana,1,2,100,10`), /Métricas inválidas/);
  assert.throws(() => parseCSV('"campo sem fechamento'), /sem fechamento/);
  db.close();
});
