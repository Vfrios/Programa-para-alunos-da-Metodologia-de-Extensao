const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { ATIVIDADES_POR_ANO } = require('./gerador');
const { estimarAtividadeReforco, migrarTabelaSugestoes, inicializarSugestoesRevisao } = require('./revisao');

test('estima atividade conforme o ano e prioriza os conteúdos de menor aproveitamento', () => {
  const atividade = estimarAtividadeReforco({
    ano: 3, alunoId: 1, aproveitamento: 75,
    atividades: ['multiplicacao'],
  });

  assert.equal(atividade, 'multiplicacao');
  assert.ok(ATIVIDADES_POR_ANO[3].includes(atividade));
});

test('distribui atividades de reforço entre alunos de alto aproveitamento', () => {
  const atividades = new Set(Array.from({ length: 20 }, (_, indice) =>
    estimarAtividadeReforco({
      ano: 2, alunoId: indice + 1, aproveitamento: 100,
      atividades: ATIVIDADES_POR_ANO[2],
    })));

  assert.ok(atividades.size > 1);
});

test('persiste estimativas para alunos sem detalhe em todas as turmas e séries', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.resolve(__dirname, '../../database/schema.sql'), 'utf8'));
  const salaSegunda = Number(db.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)')
    .run('2º ano - Segunda', 2, 'Docente').lastInsertRowid);
  const salaTerceiroAno = Number(db.prepare('INSERT INTO salas(nome,ano,professor) VALUES(?,?,?)')
    .run('3º ano - Terça', 3, 'Docente').lastInsertRowid);
  const importacao = db.prepare('INSERT INTO importacoes_sala(sala_id,arquivo) VALUES(?,?)');
  const segundaId = Number(importacao.run(salaSegunda, 'segunda.csv').lastInsertRowid);
  const terceiroAnoId = Number(importacao.run(salaTerceiroAno, 'terceiro.csv').lastInsertRowid);
  const aluno = db.prepare(`INSERT INTO alunos_importados
    (importacao_id,linha_origem,nome,total_respostas,pontos_total,acertos,percentual_acerto) VALUES(?,?,?,?,?,?,?)`);
  const segundaAlunoId = Number(aluno.run(segundaId, 2, 'Ana', 10, 500, 8, 80).lastInsertRowid);
  const terceiroAlunoId = Number(aluno.run(terceiroAnoId, 2, 'Bia', 10, 500, 10, 100).lastInsertRowid);
  const alunoComDetalhes = Number(aluno.run(terceiroAnoId, 3, 'Caio', 10, 500, 10, 100).lastInsertRowid);
  db.prepare(`INSERT INTO alunos_importados_atividades
    (aluno_importado_id,atividade,perguntas,acertos,percentual_acerto) VALUES(?,?,?,?,?)`)
    .run(alunoComDetalhes, 'soma', 10, 10, 100);
  db.prepare(`INSERT INTO alunos_importados_atividades
    (aluno_importado_id,atividade,perguntas,acertos,percentual_acerto) VALUES(?,?,?,?,?)`)
    .run(alunoComDetalhes, 'multiplicacao', 10, 5, 50);
  db.prepare('INSERT INTO sugestoes_revisao(aluno_importado_id,atividade) VALUES(?,?)')
    .run(alunoComDetalhes, 'soma');

  assert.equal(inicializarSugestoesRevisao(db), 2);
  const buscarEstimativa = db.prepare('SELECT atividade FROM sugestoes_revisao WHERE aluno_importado_id=?');
  const estimativaSegundoAno = buscarEstimativa.get(segundaAlunoId);
  const estimativaTerceiroAno = buscarEstimativa.get(terceiroAlunoId);
  assert.ok(ATIVIDADES_POR_ANO[2].includes(estimativaSegundoAno.atividade));
  assert.ok(ATIVIDADES_POR_ANO[3].includes(estimativaTerceiroAno.atividade));
  assert.ok(['multiplicacao', 'subtracao'].includes(estimativaTerceiroAno.atividade));
  assert.equal(buscarEstimativa.get(alunoComDetalhes), undefined);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM sugestoes_revisao').get().total, 2);

  db.prepare('UPDATE alunos_importados SET percentual_acerto=75 WHERE id=?').run(segundaAlunoId);
  assert.equal(inicializarSugestoesRevisao(db), 2);
  assert.ok(ATIVIDADES_POR_ANO[2].includes(buscarEstimativa.get(segundaAlunoId).atividade));
  db.close();
});

test('migra a tabela existente para aceitar conteúdos de todas as séries', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE sugestoes_revisao(
    aluno_importado_id INTEGER PRIMARY KEY,
    atividade TEXT NOT NULL CHECK(atividade IN ('soma','subtracao','sequencia','par_impar','antecessor_sucessor')),
    criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO sugestoes_revisao(aluno_importado_id,atividade) VALUES(1,'soma');`);

  migrarTabelaSugestoes(db);

  assert.equal(db.prepare('SELECT atividade FROM sugestoes_revisao WHERE aluno_importado_id=1').get().atividade, 'soma');
  assert.doesNotThrow(() => db.prepare('INSERT INTO sugestoes_revisao(aluno_importado_id,atividade) VALUES(2,?)')
    .run('multiplicacao'));
  db.close();
});
