# -*- coding: utf-8 -*-
"""
Corrige o banco matematica.db:
  1) Preenche sugestoes_revisao com a atividade de MENOR percentual (mais erros)
  2) Reduz o percentual_acerto (correção por nº de perguntas)
  3) Faz backup antes de alterar
"""

import sqlite3
import shutil
import os
from datetime import datetime

# ============================================================
# CONFIGURAÇÃO
# ============================================================
DB_PATH = os.path.join("database", "matematica.db")

# Regras de correção (ajuste se quiser)
CORRECAO_MIN = 5.0      # redução mínima em pontos percentuais
CORRECAO_MAX = 15.0     # redução máxima
FATOR_PERGUNTAS = 10.0  # correção = perguntas / FATOR (limitada por MIN/MAX)

# ============================================================
# BACKUP
# ============================================================
if not os.path.exists(DB_PATH):
    raise SystemExit(f"Banco não encontrado: {DB_PATH}")

backup = DB_PATH + ".backup_" + datetime.now().strftime("%Y%m%d_%H%M%S")
shutil.copy2(DB_PATH, backup)
print(f"[backup] {backup}")

# ============================================================
# CONEXÃO
# ============================================================
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# ============================================================
# FUNÇÃO DE CORREÇÃO
# ============================================================
def corrigir(pct, perguntas):
    if pct is None:
        return None
    perguntas = perguntas or 0
    correcao = perguntas / FATOR_PERGUNTAS
    correcao = max(CORRECAO_MIN, min(CORRECAO_MAX, correcao))
    novo = max(0.0, pct - correcao)
    return round(novo, 1)

# ============================================================
# 1) SUGESTÕES DE REVISÃO (atividade com mais erros)
# ============================================================
# Para cada aluno_importado_id, pega a atividade de MENOR percentual_acerto
cur.execute("""
    SELECT a.aluno_importado_id, a.atividade, a.percentual_acerto
    FROM alunos_importados_atividades a
    INNER JOIN (
        SELECT aluno_importado_id, MIN(percentual_acerto) AS menor
        FROM alunos_importados_atividades
        WHERE percentual_acerto IS NOT NULL
        GROUP BY aluno_importado_id
    ) m
      ON m.aluno_importado_id = a.aluno_importado_id
     AND m.menor = a.percentual_acerto
""")
sugestoes = cur.fetchall()
print(f"[sugestoes] {len(sugestoes)} alunos com atividade de reforço")

for s in sugestoes:
    cur.execute("""
        INSERT INTO sugestoes_revisao(aluno_importado_id, atividade)
        VALUES (?, ?)
        ON CONFLICT(aluno_importado_id)
        DO UPDATE SET atividade = excluded.atividade
    """, (s["aluno_importado_id"], s["atividade"]))

# ============================================================
# 2) CORRIGIR percentual_acerto em alunos_importados_atividades
# ============================================================
cur.execute("""
    SELECT id, percentual_acerto, perguntas
    FROM alunos_importados_atividades
    WHERE percentual_acerto IS NOT NULL
""")
linhas = cur.fetchall()
print(f"[atividades] corrigindo {len(linhas)} linhas")

for r in linhas:
    novo = corrigir(r["percentual_acerto"], r["perguntas"])
    cur.execute(
        "UPDATE alunos_importados_atividades SET percentual_acerto = ? WHERE id = ?",
        (novo, r["id"])
    )

# ============================================================
# 3) CORRIGIR percentual_acerto geral em alunos_importados
# ============================================================
cur.execute("""
    SELECT id, percentual_acerto, total_respostas
    FROM alunos_importados
    WHERE percentual_acerto IS NOT NULL
""")
linhas = cur.fetchall()
print(f"[alunos] corrigindo {len(linhas)} linhas")

for r in linhas:
    novo = corrigir(r["percentual_acerto"], r["total_respostas"])
    cur.execute(
        "UPDATE alunos_importados SET percentual_acerto = ? WHERE id = ?",
        (novo, r["id"])
    )

# ============================================================
# COMMIT
# ============================================================
conn.commit()
conn.close()
print("[ok] Banco atualizado com sucesso.")
