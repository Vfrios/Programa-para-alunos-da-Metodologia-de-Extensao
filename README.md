# Matemática Divertida

Documentação oficial do projeto: [doc.md](doc.md)

## Rodar (PowerShell, Node 22.13+)

```powershell
cd backend
pnpm install
pnpm start
```

O backend usa o modo watch do Node.js e reinicia automaticamente quando arquivos JavaScript do servidor são alterados. O Node 22.13+ é necessário.

- No próprio computador: [http://localhost:3000](http://localhost:3000)
- Em outros dispositivos na mesma rede Wi-Fi/cabeada: use o endereço `Rede local` mostrado no terminal, por exemplo `http://192.168.0.25:3000`.
- Painel do professor: acrescente `/admin.html` ao mesmo endereço. Login padrão `admin` / `admin123`.
  (troque com `$env:ADMIN_USER="..."; $env:ADMIN_PASS="..."` antes do primeiro start; a senha é gravada criptografada)
- No ambiente local, o login do administrador primário é `vitor` / `adm1`. Ele pode acessar a aba **Dados de crianças**, editar nomes e excluir registros. Para trocar essas credenciais localmente, defina `$env:PRIMARY_ADMIN_USER` e `$env:PRIMARY_ADMIN_PASS` antes de iniciar.

Todos os dispositivos devem estar na mesma rede e acessar o mesmo computador/servidor. Se o Windows perguntar, permita Node.js na rede privada. O servidor atende vários alunos simultaneamente; mantenha apenas uma instância em execução para a turma.

O endereço `Rede local` não funciona pela internet pública. Para acesso fora da escola/casa, hospede o sistema com HTTPS e autenticação ou conecte os dispositivos por uma VPN privada. Não exponha diretamente a porta 3000 no roteador: a aplicação não foi preparada para ficar aberta na internet.

Se o OneDrive travar o banco: `$env:DB_FILE="C:\temp\matematica.db"`.
Perguntas por aluno (padrão 10): `$env:TOTAL_PERGUNTAS=15`.

## Hospedar no Render

O arquivo `render.yaml` configura um Web Service Node.js no plano gratuito do Render, sem Persistent Disk. No Render, crie ou atualize o Blueprint a partir deste repositório. O usuário inicial é `professor`; o Render gera `ADMIN_PASS` como segredo. Consulte-o no painel do serviço e troque-o antes de compartilhar o endereço. Em produção, `ADMIN_USER` e `ADMIN_PASS` configurados no Render atualizam a conta de administrador comum já existente no banco incluído no deploy.

Para ativar o acesso exclusivo de administração primária, configure no painel do Render as variáveis secretas `PRIMARY_ADMIN_USER` e `PRIMARY_ADMIN_PASS`, com credenciais diferentes das variáveis `ADMIN_USER` e `ADMIN_PASS`. Somente esse login separado vê a aba **Dados de crianças** e pode excluir registros; a API também recusa exclusões feitas por administradores comuns. Se as duas variáveis primárias não estiverem configuradas, a exclusão fica desativada. Não coloque essas senhas no código nem em commits.

O `DB_FILE` aponta para `/opt/render/project/src/database/matematica.db`, o banco SQLite dentro da pasta do projeto; nenhum diretório temporário ou disco pago é usado. Nos logs, o app informa o caminho do arquivo aberto. **Limitação do plano gratuito:** o sistema de arquivos do serviço é efêmero; alterações no banco podem desaparecer quando o Render suspender, reiniciar ou publicar uma nova versão. SQLite funciona nesse modo, mas o Render não garante persistência dos dados sem armazenamento durável. O SQLite usa WAL e `synchronous=FULL` para confirmar as gravações enquanto a instância está ativa. O Render fornece HTTPS no endereço publicado.

Na aba **Backup**, o administrador primário pode baixar um arquivo SQLite com os dados de todas as turmas/aulas. Guarde uma cópia fora do Render. Antes de restaurar, o sistema pede confirmação explícita mostrando o nome do arquivo e avisa que todos os dados serão trocados. A restauração só funciona com as aulas encerradas; ao concluir, informa se o conteúdo realmente mudou e quantas tabelas diferem, e exige novo login usando as credenciais do backup. Restaure um backup criado por uma versão compatível do sistema.

Se `DB_FILE` estiver definido no Render, as salas, horários, conteúdos e registros agregados do banco incluído no repositório são sincronizados na inicialização para esse banco, sem duplicar itens nem substituir salas remotas com IDs conflitantes. Registros removidos da fonte deixam de aparecer também no histórico sincronizado. Para publicar salas novas criadas localmente, inclua o banco atualizado em um commit enviado à branch configurada no Render; o app não sincroniza automaticamente as alterações do SQLite de volta ao computador.

Após uma quantidade aleatória de perguntas, sempre a partir da 7ª, há um desafio de pausa: memória, cálculo, sequência, paridade ou comparação, nessa ordem. Cada tipo só volta depois de cinco desafios; cada desafio resolvido no prazo adiciona 50 pontos ao ranking, e acertar antes faz a próxima atividade começar imediatamente. Todos os desafios têm limite de 15 segundos. Para o 2º ano, os desafios usam níveis mais simples e memória com dois pares; para o 3º ano, permanecem três pares.

Nas perguntas respondidas pelo teclado numérico, a resposta correta é enviada automaticamente após a digitação; o botão **OK** continua disponível para enviar respostas manualmente.

No painel do professor, cada sessão em andamento mostra o tempo decorrido desde o início da atividade. Os relatórios por criança incluem perguntas respondidas, acertos, percentual médio de acerto, pontos e desempenho por conteúdo. O percentual considera as tentativas: acerto na primeira vale 100%, após um erro vale 75%, após dois erros vale 25%, e respostas incorretas ou acertos após três erros valem 0%. A contagem de **Acertos** continua indicando quantas respostas foram registradas como corretas; por isso pode diferir do percentual ponderado. O relatório **Geral** reúne o ranking de todas as salas e permite expandir cada sala para consultar o desempenho das crianças, os resultados por atividade da turma e por criança; as exportações CSV e PDF incluem o ranking e os dados de todas as salas. O relatório **Por sala** também destaca, por criança, os conteúdos com menor percentual de acerto e lista os conteúdos de menor acerto da turma. Esses indicadores usam respostas por atividade registradas no sistema; históricos agregados de planilhas sem informação por atividade aparecem como indisponíveis, sem estimativas.

Cada conteúdo possui 30 modelos diferentes de enunciado. O sistema os embaralha e percorre os 30 antes de repetir um modelo para a mesma criança e conteúdo; os números, sequências, figuras e objetos também continuam variando conforme a atividade e o nível.

Os dados agregados das planilhas entram nos relatórios **Geral** e **Por sala**, junto com os dados das atividades atuais. Eles estão no banco incluído no deploy e também são sincronizados para um banco remoto configurado por `DB_FILE` na inicialização do Render, sem duplicar registros. As quatro planilhas aparecem como **Planilha** nos relatórios. Os dados por atividade são agregados e não representam respostas individuais reais; médias de tempo ausentes permanecem indisponíveis.

### Importar a planilha da próxima aula

Exporte a planilha do Excel como **CSV UTF-8**. O relatório pode conter uma ou várias salas, mas importe uma sala por vez usando o ID da sala no banco. O comando atualiza a carga mais recente daquela sala, sem duplicar os alunos, e preserva exclusões feitas pelo administrador primário:

```powershell
node backend\importar-planilha.js --sala 13 --arquivo "C:\caminho\relatorio-geral.csv"
```

Confira os IDs das salas no painel do professor em **Salas** ou no arquivo `database\matematica.db`. Para publicar os dados no Render, inclua o banco `database\matematica.db` atualizado no próximo commit/deploy; se `DB_FILE` aponta para o banco remoto, os dados agregados e atividades serão sincronizados quando o serviço iniciar. Guarde um backup antes de substituir uma carga existente.

## Como testar sem esperar o horário

1. Admin → **Salas** → crie uma sala (nome, ano, professor, dia, horário de início e de fim, conteúdo) → Salvar.
2. Admin → **Aula** → escolha a sala → **Abrir sessão**.
3. Em cada computador/celular, abra o endereço do servidor (localhost no computador servidor ou o IP da rede local nos demais) e cadastre os alunos → tela de espera.
4. Admin → **Iniciar atividade** → todos recebem a 1ª pergunta ao mesmo tempo.
5. **Encerrar sessão** → ranking final, histórico e prêmios são salvos.

Em **Salas**, selecione um ou mais conteúdos para reforçar; todos os conteúdos escolhidos recebem o ajuste de nível configurado para a turma. Cadastre também o dia, o horário de início e o fim de cada aula. O fim padrão fica 55 minutos depois do início (por exemplo, 14:40–15:35), mas pode ser alterado. No início programado, a sessão abre sozinha e encerra no horário de fim configurado.

## Estrutura

backend/ (server.js, database.js, agendamento.js, engine/) · frontend/ (index.html, admin.html) · database/schema.sql · render.yaml
