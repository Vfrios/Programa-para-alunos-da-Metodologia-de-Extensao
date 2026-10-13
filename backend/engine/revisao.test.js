const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { ATIVIDADES_POR_ANO } = require('./gerador');
const { sugerirConteudo2Ano, inicializarSugestoesRevisao } = require('./revisao');

test('sugestão de prática do 2º ano é estável e usa conteúdos permitidos para a série', () => {
  const sugestao = sugerirConteudo2Ano(12, 'Ana');

  assert.equal(sugestao, sugerirConteudo2Ano(12, ' Ana '));
  assert.ok(ATIVIDADES_POR_ANO[2].includes(sugestao));
  assert.notEqual(sugestao, sugerirConteudo2Ano(13, 'Ana'));
});

test('sugestões variam entre os alunos de uma turma', () => {
  const sugestoes = new Set(Array.from({ length: 20 }, (_, indice) =>
    sugerirConteudo2Ano(12, `Aluno ${indice}`)));

  assert.ok(sugestoes.size > 1);
});

test('persiste sugestões apenas para alunos importados de turmas do 2º ano na segunda-feira', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.resolve(__dirname, '../../database/schema.sql'), 'utf8'));
  const salaSegunda = Number(db.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)')
    .run('2º ano - Segunda', 2, 'Docente').lastInsertRowid);
  const salaTerca = Number(db.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)')
    .run('2º ano - Terça', 2, 'Docente').lastInsertRowid);
  const horario = db.prepare('INSERT INTO horarios(sala_id,dia,hora) VALUES(?,?,?)');
  horario.run(salaSegunda, 1, '14:00');
  horario.run(salaTerca, 2, '14:00');
  const importacao = db.prepare('INSERT INTO importacoes_sala(sala_id,arquivo) VALUES(?,?)');
  const segundaId = Number(importacao.run(salaSegunda, 'segunda.csv').lastInsertRowid);
  const tercaId = Number(importacao.run(salaTerca, 'terca.csv').lastInsertRowid);
  const aluno = db.prepare(`INSERT INTO alunos_importados
    (importacao_id,linha_origem,nome,total_respostas,pontos_total) VALUES(?,?,?,?,?)`);
  const segundaAlunoId = Number(aluno.run(segundaId, 2, 'Ana', 10, 500).lastInsertRowid);
  aluno.run(tercaId, 2, 'Bia', 10, 500);

  assert.equal(inicializarSugestoesRevisao(db), 1);
  const sugestao = db.prepare('SELECT atividade FROM sugestoes_revisao WHERE aluno_importado_id=?').get(segundaAlunoId);
  assert.ok(ATIVIDADES_POR_ANO[2].includes(sugestao.atividade));
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM sugestoes_revisao').get().total, 1);
  assert.equal(inicializarSugestoesRevisao(db), 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM sugestoes_revisao').get().total, 1);
  db.close();
});
