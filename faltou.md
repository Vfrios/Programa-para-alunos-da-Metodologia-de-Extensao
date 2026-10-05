# Pendências do Sistema

Lista elaborada comparando a documentação de [doc.md](doc.md) com o código atual. Os itens abaixo distinguem funcionalidades ausentes ou parciais de tarefas de configuração e validação.

## Implementação

1. **Alinhar o fluxo do aluno com a documentação.** Em `doc.md`, seção 8.2, a sessão define a sala automaticamente, e as perguntas sorteiam entre as atividades habilitadas pelo professor. Decidir se essas escolhas devem ser implementadas ou se o fluxo documentado deve ser atualizado.

2. **Manter o perfil do aluno entre aulas.** A seção 11 descreve um perfil individual por atividade. Hoje, o perfil está vinculado ao registro do aluno daquela sessão; ao encerrar a aula, um novo cadastro cria outro registro. Implementar uma identificação persistente do aluno para preservar níveis, acertos, erros e tempo médio entre sessões.

3. **Implementar suporte a PostgreSQL para produção.** A seção 7.3 cita SQLite para desenvolvimento e PostgreSQL para produção. O código atual usa `node:sqlite` e o schema é específico de SQLite. Criar a camada de acesso/migração para PostgreSQL e configurar a persistência no ambiente de hospedagem escolhido.

4. **Completar o ranking geral do professor.** As seções 13.2 e 15.1 descrevem o ranking geral de todos os alunos. A consulta atual limita o resultado aos 50 primeiros, embora a documentação preveja cerca de 140 alunos. Remover o limite ou implementar paginação para disponibilizar a lista completa.

5. **Automatizar a geração de PDF, se for necessária sem diálogo de impressão.** O botão atual abre a impressão do navegador, que permite salvar como PDF, mas não gera e baixa um arquivo diretamente. Definir se esse comportamento atende ao requisito ou implementar a exportação direta.

## Configuração e Validação

1. **Cadastrar a configuração inicial das sete salas.** A tabela de horários da seção 6 lista salas e horários, mas não há carga inicial desses dados no banco. Criar as salas, associar ano, professor, horários e conteúdos na implantação inicial, ou preparar uma carga de dados repetível.

2. **Alinhar a faixa etária.** A documentação define o público como 7 a 8 anos; a tela de cadastro atualmente oferece idades de 6 a 9 anos. Definir a faixa correta e alinhar interface e documentação.

3. **Criar e executar testes automatizados.** O projeto não tem suíte de testes nem comando `test`. Cobrir regras de pontuação e adaptação, geração de perguntas, agendamento, autenticação, relatórios e os fluxos de aula descritos nas seções 19 e 20.

4. **Validar carga e estabilidade.** A seção 19.2 pede testes de desempenho e estresse. Testar o cenário previsto de sete salas e aproximadamente 140 alunos, incluindo conexões simultâneas, atualização de ranking, desconexões e encerramento automático de sessões.

## Pendências do Projeto Extensionista

Estes itens dependem de informações e registros reais, não de novas funcionalidades do sistema:

- Substituir os campos entre colchetes em `doc.md` por escola, responsáveis, nomes do grupo, cidade, datas, período e número de alunos.
- Registrar presença e reunir fotos e vídeos das aulas, respeitando as autorizações necessárias.
- Obter a declaração assinada pela professora ou responsável pela instituição e anexá-la ao relatório final.

## Já Implementado

Para evitar duplicidade, o sistema já possui as sete atividades descritas, adaptação por atividade durante a sessão, dicas após erros, pontuação e premiação, agendamento e encerramento de aulas, histórico de rankings, gerenciamento de salas e horários, relatórios por aluno/sala/geral e exportação CSV. O ranking geral permanece restrito ao painel do professor; os alunos veem apenas o ranking da própria sala.
