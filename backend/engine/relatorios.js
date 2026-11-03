// Aproveitamento ponderado conforme regra do jogo:
//  - 1 tentativa e acertou = 1.0
//  - 2 tentativas e acertou = 0.75
//  - 3 tentativas e acertou = 0.25
//  - 4+ tentativas, ou errou = 0.0
//  - Errou = 0.0
exports.aproveitamentoResposta = (alias) => `CASE WHEN ${alias}.correta=1 THEN
  CASE WHEN ${alias}.tentativas<=1 THEN 1.0
       WHEN ${alias}.tentativas=2 THEN 0.75
       WHEN ${alias}.tentativas=3 THEN 0.25
       ELSE 0.0 END
  ELSE 0.0 END`;
