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
- Existem somente dois tipos de acesso: **Professor** e **Administrador**. Professores usam o painel de aula; qualquer Administrador também pode gerenciar usuários e senhas. Na aba **Usuários**, um Administrador pode criar contas, trocar senhas e excluir acessos. Senhas são armazenadas como hash e não podem ser consultadas; para alterar uma, use **Trocar senha**.

Todos os dispositivos devem estar na mesma rede e acessar o mesmo computador/servidor. Se o Windows perguntar, permita Node.js na rede privada. O servidor atende vários alunos simultaneamente; mantenha apenas uma instância em execução para a turma.

O endereço `Rede local` não funciona pela internet pública. Para acesso fora da escola/casa, hospede o sistema com HTTPS e autenticação ou conecte os dispositivos por uma VPN privada. Não exponha diretamente a porta 3000 no roteador: a aplicação não foi preparada para ficar aberta na internet.

O sistema usa exclusivamente `database\matematica.db`; não configure `DB_FILE` para outro arquivo. Se o OneDrive estiver bloqueando o banco, feche o servidor antes de tentar novamente.
Perguntas por aluno (padrão 10): `$env:TOTAL_PERGUNTAS=15`.

## Hospedar no Render

O arquivo `render.yaml` configura um Web Service Node.js no plano gratuito do Render, sem Persistent Disk. No Render, crie ou atualize o Blueprint a partir deste repositório. O usuário inicial é `professor`; o Render gera `ADMIN_PASS` como segredo. Consulte-o no painel do serviço e troque-o antes de compartilhar o endereço. Em produção, `ADMIN_USER` e `ADMIN_PASS` configurados no Render atualizam a conta de administrador comum já existente no banco incluído no deploy.

Não há mais uma conta de administrador primário separada. No banco, contas antigas desse tipo passam a ser **Administrador**; a conta configurada por `ADMIN_USER` e `ADMIN_PASS` também tem esse acesso. Administradores podem criar contas de Professor ou Administrador pela aba **Usuários**.

O `DB_FILE` do Render aponta para `/opt/render/project/src/database/matematica.db`, o único banco SQLite autorizado e localizado na pasta do projeto; qualquer caminho diferente é recusado. Nenhum diretório temporário ou disco pago é usado. Nos logs, o app informa o caminho do arquivo aberto. **Limitação do plano gratuito:** o sistema de arquivos do serviço é efêmero; alterações no banco podem desaparecer quando o Render suspender, reiniciar ou publicar uma nova versão. SQLite funciona nesse modo, mas o Render não garante persistência dos dados sem armazenamento durável. O SQLite usa journal tradicional e `synchronous=FULL`; arquivos de journal são temporários durante as gravações e removidos ao concluir. O Render fornece HTTPS no endereço publicado.

Como o caminho do Render é o próprio `database\matematica.db` incluído no deploy, salas, horários, conteúdos e registros agregados são servidos diretamente desse arquivo. Para publicar alterações feitas localmente, inclua o banco atualizado no deploy da branch configurada no Render.

### Baixar uma cópia do banco atual do Render

O backup contém todos os dados do sistema, inclusive dados pessoais e hashes de senhas. A exportação só é permitida para uma conta **Administrador** autenticada; não compartilhe o arquivo baixado. Não há botão nem comando visível na interface. Para baixar a cópia atual do banco:

1. Abra o endereço do Render seguido de `/admin.html` e entre com uma conta Administrador.
2. Abra as ferramentas do desenvolvedor do navegador (F12), selecione **Console** e cole o comando abaixo. Ele baixa `matematica-render.db` para a pasta de downloads do navegador.

```js
(async () => {
  const token = sessionStorage.getItem('t');
  if (!token) throw new Error('Entre no painel do Render como Administrador antes de executar.');
  const resposta = await fetch('/api/admin/backup/exportar', { headers: { 'x-token': token } });
  if (!resposta.ok) throw new Error(`Falha ao exportar o banco: HTTP ${resposta.status} - ${await resposta.text()}`);
  const url = URL.createObjectURL(await resposta.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'matematica-render.db';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
})().catch(console.error);
```

Para usar os dados no computador local, primeiro pare o servidor local. No PowerShell, a partir da pasta do projeto, faça uma cópia de segurança do banco local e depois substitua-o pelo arquivo baixado (ajuste o caminho se a pasta de downloads for diferente):

```powershell
Copy-Item database\matematica.db database\matematica-local-antes-render.db
Copy-Item "$HOME\Downloads\matematica-render.db" database\matematica.db -Force
```

O banco do Render não é alterado por essa exportação. Guarde o backup local até confirmar que os dados estão corretos; a cópia baixada pode conter dados recentes que ainda não existiam no banco local.

Após uma quantidade aleatória de perguntas, sempre a partir da 7ª, há um desafio de pausa: memória, cálculo, sequência, paridade ou comparação, nessa ordem. Cada tipo só volta depois de cinco desafios; cada desafio resolvido no prazo adiciona 50 pontos ao ranking, e acertar antes faz a próxima atividade começar imediatamente. Todos os desafios têm limite de 15 segundos. Para o 2º ano, os desafios usam níveis mais simples e memória com dois pares; para o 3º ano, permanecem três pares.

Nas perguntas respondidas pelo teclado numérico, a resposta correta é enviada automaticamente após a digitação; o botão **OK** continua disponível para enviar respostas manualmente.

No painel do professor, cada sessão em andamento mostra o tempo decorrido desde o início da atividade. Os relatórios por criança incluem perguntas respondidas, acertos, percentual médio de acerto, pontos e desempenho por conteúdo. O percentual considera as tentativas: acerto na primeira vale 100%, após um erro vale 75%, após dois erros vale 25%, e respostas incorretas ou acertos após três erros valem 0%. A contagem de **Acertos** continua indicando quantas respostas foram registradas como corretas; por isso pode diferir do percentual ponderado. O relatório **Geral** reúne o ranking de todas as salas e permite expandir cada sala para consultar o desempenho das crianças, os resultados por atividade da turma e por criança; as exportações CSV e PDF incluem o ranking e os dados de todas as salas. Administradores podem excluir permanentemente atividades encerradas nos relatórios, incluindo seus resultados e dados históricos associados; essas exclusões são preservadas nas sincronizações. O relatório **Por sala** também destaca, por criança, os conteúdos com menor percentual de acerto e lista os conteúdos de menor acerto da turma. Esses indicadores usam respostas por atividade registradas no sistema; históricos agregados de planilhas sem informação por atividade aparecem como indisponíveis, sem estimativas.

Cada conteúdo possui 25 enunciados-base e 25 aberturas, totalizando 625 combinações diferentes. O sistema embaralha e percorre todas as combinações antes de repetir um modelo para a mesma criança e conteúdo; números, sequências, figuras e objetos também continuam variando conforme a atividade e o nível.

Os dados agregados das planilhas entram nos relatórios **Geral** e **Por sala**, junto com os dados das atividades atuais. Eles estão no banco incluído no deploy e também são sincronizados para um banco remoto configurado por `DB_FILE` na inicialização do Render, sem duplicar registros. As quatro planilhas aparecem como **Planilha** nos relatórios. Os dados por atividade são agregados e não representam respostas individuais reais; médias de tempo ausentes permanecem indisponíveis.

### Importar a planilha da próxima aula

Exporte a planilha do Excel como **CSV UTF-8**. O relatório pode conter uma ou várias salas, mas importe uma sala por vez usando o ID da sala no banco. O comando atualiza a carga mais recente daquela sala, sem duplicar os alunos, e preserva exclusões feitas por um administrador:

```powershell
node backend\importar-planilha.js --sala 13 --arquivo "C:\caminho\relatorio-geral.csv"
```

Confira os IDs das salas no painel do professor em **Salas** ou no arquivo `database\matematica.db`. Para publicar os dados no Render, inclua o banco `database\matematica.db` atualizado no próximo commit/deploy; se `DB_FILE` aponta para o banco remoto, os dados agregados e atividades serão sincronizados quando o serviço iniciar. Guarde um backup antes de substituir uma carga existente.

## Como testar sem esperar o horário

1. Admin → **Salas** → crie uma sala (nome, ano, professor, dia, horário de início e de fim, conteúdo) → Salvar.
2. Admin → **Aula** → escolha a sala → **Abrir sessão**.
3. Em cada computador/celular, abra o endereço do servidor (localhost no computador servidor ou o IP da rede local nos demais) e cadastre os alunos → tela de espera.
4. Admin → **Iniciar atividade** → todos recebem a 1ª pergunta ao mesmo tempo.
5. Se abriu por engano, use **Cancelar atividade** enquanto aguarda o início; ela sai do painel e não entra nos relatórios. O número da atividade cancelada poderá ser reutilizado. **Encerrar sessão** finaliza uma aula iniciada e salva ranking, histórico e prêmios.

Em **Salas**, selecione um ou mais conteúdos para reforçar; todos os conteúdos escolhidos recebem o ajuste de nível configurado para a turma. Cadastre também o dia, o horário de início, o fim e o tempo de espera para início automático (de 0 a 60 minutos; padrão de 8). O fim padrão fica 55 minutos depois do início (por exemplo, 14:40–15:35), mas pode ser alterado. No horário programado, a sessão abre sozinha e começa quando 12 alunos estiverem cadastrados ou quando a espera terminar, o que ocorrer primeiro. Alunos podem entrar depois do início, e a sessão encerra no horário de fim configurado, sem estender a aula pela espera. Sessões abertas fora de um horário cadastrado continuam podendo ser iniciadas manualmente.

## Estrutura

backend/ (server.js, database.js, agendamento.js, engine/) · frontend/ (index.html, admin.html) · database/schema.sql · render.yaml
