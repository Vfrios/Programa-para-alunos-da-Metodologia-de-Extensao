function migrateActivityMetrics(db) {
  const columns = new Map(
    db.prepare('PRAGMA table_info(alunos_importados_atividades)').all().map((column) => [column.name, column])
  );
  if (!columns.get('acertos')?.notnull && !columns.get('pontos_total')?.notnull) return;

  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE alunos_importados_atividades_nova(
      id INTEGER PRIMARY KEY AUTOINCREMENT, aluno_importado_id INTEGER NOT NULL, atividade TEXT NOT NULL,
      perguntas INTEGER NOT NULL, acertos INTEGER, percentual_acerto REAL, pontos_total INTEGER,
      tempo_medio_s REAL, UNIQUE(aluno_importado_id, atividade));
      INSERT INTO alunos_importados_atividades_nova
      (id,aluno_importado_id,atividade,perguntas,acertos,percentual_acerto,pontos_total,tempo_medio_s)
      SELECT id,aluno_importado_id,atividade,perguntas,acertos,percentual_acerto,pontos_total,tempo_medio_s
      FROM alunos_importados_atividades;
      DROP TABLE alunos_importados_atividades;
      ALTER TABLE alunos_importados_atividades_nova RENAME TO alunos_importados_atividades;
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { migrateActivityMetrics };
