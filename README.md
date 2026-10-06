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

O arquivo `render.yaml` configura um Web Service Node.js no plano Starter do Render, necessário para usar o Persistent Disk que mantém o banco real entre deploys e reinicializações. No Render, crie ou atualize o Blueprint a partir deste repositório e aguarde o deploy; confira o valor do plano e os custos antes de confirmar. O usuário inicial é `professor`; o Render gera `ADMIN_PASS` como segredo. Consulte-o no painel do serviço e troque-o antes de compartilhar o endereço. Em produção, `ADMIN_USER` e `ADMIN_PASS` configurados no Render atualizam a conta de administrador comum já existente no banco incluído no deploy.

Para ativar o acesso exclusivo de administração primária, configure no painel do Render as variáveis secretas `PRIMARY_ADMIN_USER` e `PRIMARY_ADMIN_PASS`, com credenciais diferentes das variáveis `ADMIN_USER` e `ADMIN_PASS`. Somente esse login separado vê a aba **Dados de crianças** e pode excluir registros; a API também recusa exclusões feitas por administradores comuns. Se as duas variáveis primárias não estiverem configuradas, a exclusão fica desativada. Não coloque essas senhas no código nem em commits.

O serviço usa uma única instância e o `render.yaml` já configura um Persistent Disk de 1 GB montado em `/var/data`, com `DB_FILE=/var/data/matematica.db`. Sem esse disco montado e acessível, o serviço falha no início propositalmente em vez de usar um banco temporário e perder arquivos. O SQLite também usa WAL e `synchronous=FULL` para confirmar as gravações com segurança. O Render fornece HTTPS no endereço publicado.

Se `DB_FILE` estiver definido no Render, as salas, horários, conteúdos e registros agregados do banco incluído no repositório são sincronizados na inicialização para esse banco, sem duplicar itens nem substituir salas remotas com IDs conflitantes. Registros removidos da fonte deixam de aparecer também no histórico sincronizado. Para publicar salas novas criadas localmente, inclua o banco atualizado em um commit enviado à branch configurada no Render; o app não sincroniza automaticamente as alterações do SQLite de volta ao computador.

Após uma quantidade aleatória de perguntas, sempre a partir da 7ª, há um desafio de pausa: memória, cálculo, sequência, paridade ou comparação, nessa ordem. Cada tipo só volta depois de cinco desafios; cada desafio resolvido no prazo adiciona 50 pontos ao ranking. Para o 2º ano, os desafios usam níveis mais simples, memória com dois pares e 30 segundos; para o 3º ano, permanecem três pares e 15 segundos.

No painel do professor, cada sessão em andamento mostra o tempo decorrido desde o início da atividade. Os relatórios por criança incluem perguntas respondidas, acertos, percentual médio de acerto, pontos e desempenho por conteúdo. O relatório **Por sala** também destaca, por criança, os conteúdos com menor percentual de acerto e lista os conteúdos de menor acerto da turma. Esses indicadores usam respostas por atividade registradas no sistema; históricos agregados de planilhas sem informação por atividade aparecem como indisponíveis, sem estimativas.

Cada conteúdo possui 30 modelos diferentes de enunciado. O sistema os embaralha e percorre os 30 antes de repetir um modelo para a mesma criança e conteúdo; os números, sequências, figuras e objetos também continuam variando conforme a atividade e o nível.

Os dados agregados das planilhas entram nos relatórios **Geral** e **Por sala**, junto com os dados das atividades atuais. Eles estão no banco incluído no deploy e também são sincronizados para um banco remoto configurado por `DB_FILE` na inicialização do Render, sem duplicar registros. As quatro planilhas aparecem como **Planilha** nos relatórios. Os dados por atividade são agregados e não representam respostas individuais reais; médias de tempo ausentes permanecem indisponíveis.

## Como testar sem esperar o horário

1. Admin → **Salas** → crie uma sala (nome, ano, professor, dia, horário de início e de fim, conteúdo) → Salvar.
2. Admin → **Aula** → escolha a sala → **Abrir sessão**.
3. Em cada computador/celular, abra o endereço do servidor (localhost no computador servidor ou o IP da rede local nos demais) e cadastre os alunos → tela de espera.
4. Admin → **Iniciar atividade** → todos recebem a 1ª pergunta ao mesmo tempo.
5. **Encerrar sessão** → ranking final, histórico e prêmios são salvos.

Cadastre o dia, o horário de início e o fim de cada aula em **Salas**. O fim padrão fica 55 minutos depois do início (por exemplo, 14:40–15:35), mas pode ser alterado. No início programado, a sessão abre sozinha e encerra no horário de fim configurado.

## Estrutura

backend/ (server.js, database.js, agendamento.js, engine/) · frontend/ (index.html, admin.html) · database/schema.sql · render.yaml
