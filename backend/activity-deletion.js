function excluirAtividade(db, sessaoId) {
  const sessao = db.prepare('SELECT id,status,importacao_id FROM sessoes WHERE id=?').get(sessaoId);
  if (!sessao) throw new Error('Atividade não encontrada.');
  if (sessao.status !== 'encerrada') throw new Error('Só é possível excluir atividades encerradas.');

  db.exec('BEGIN IMMEDIATE');
  try {
    const alunos = db.prepare('SELECT id FROM alunos WHERE sessao_id=?').all(sessaoId);
    if (sessao.importacao_id) {
      db.prepare(`INSERT INTO exclusoes_alunos_importados(sala_id,arquivo,linha_origem,nome)
        SELECT i.sala_id,i.arquivo,ai.linha_origem,NULL
        FROM alunos_importados ai JOIN importacoes_sala i ON i.id=ai.importacao_id
        WHERE i.id=?
        ON CONFLICT(sala_id,arquivo,linha_origem) DO UPDATE SET nome=NULL`)
        .run(sessao.importacao_id);
      db.prepare(`DELETE FROM sugestoes_revisao WHERE aluno_importado_id IN
        (SELECT id FROM alunos_importados WHERE importacao_id=?)`).run(sessao.importacao_id);
      db.prepare(`DELETE FROM alunos_importados_atividades WHERE aluno_importado_id IN
        (SELECT id FROM alunos_importados WHERE importacao_id=?)`).run(sessao.importacao_id);
      db.prepare('DELETE FROM alunos_importados WHERE importacao_id=?').run(sessao.importacao_id);
    }

    for (const tabela of ['respostas', 'desafios', 'premiacoes', 'historico_ranking']) {
      db.prepare(`DELETE FROM ${tabela} WHERE sessao_id=?`).run(sessaoId);
    }
    db.prepare(`DELETE FROM perfis WHERE aluno_id IN
      (SELECT id FROM alunos WHERE sessao_id=?)`).run(sessaoId);
    db.prepare('DELETE FROM alunos WHERE sessao_id=?').run(sessaoId);
    db.prepare("UPDATE sessoes SET status='excluida' WHERE id=?").run(sessaoId);
    db.exec('COMMIT');
    return alunos.map((aluno) => aluno.id);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { excluirAtividade };
