# Matemática Divertida

Documentação oficial do projeto: [doc.md](doc.md)

## Rodar (PowerShell, Node 22.13+)

```powershell
cd backend
pnpm install
pnpm start
```

- No próprio computador: [http://localhost:3000](http://localhost:3000)
- Em outros dispositivos na mesma rede Wi-Fi/cabeada: use o endereço `Rede local` mostrado no terminal, por exemplo `http://192.168.0.25:3000`.
- Painel do professor: acrescente `/admin.html` ao mesmo endereço. Login padrão `admin` / `admin123`.
  (troque com `$env:ADMIN_USER="..."; $env:ADMIN_PASS="..."` antes do primeiro start; a senha é gravada criptografada)

Todos os dispositivos devem estar na mesma rede e acessar o mesmo computador/servidor. Se o Windows perguntar, permita Node.js na rede privada. O servidor atende vários alunos simultaneamente; mantenha apenas uma instância em execução para a turma.

O endereço `Rede local` não funciona pela internet pública. Para acesso fora da escola/casa, hospede o sistema com HTTPS e autenticação ou conecte os dispositivos por uma VPN privada. Não exponha diretamente a porta 3000 no roteador: a aplicação não foi preparada para ficar aberta na internet.

Se o OneDrive travar o banco: `$env:DB_FILE="C:\temp\matematica.db"`.
Perguntas por aluno (padrão 10): `$env:TOTAL_PERGUNTAS=15`.

## Hospedar no Render

O arquivo `render.yaml` configura um Web Service Node.js no plano gratuito. No Render, crie um Blueprint a partir deste repositório e aguarde o deploy. O usuário inicial é `professor`; o Render gera `ADMIN_PASS` como segredo. Consulte-o no painel do serviço e troque-o antes de compartilhar o endereço. Em produção, `ADMIN_USER` e `ADMIN_PASS` configurados no Render atualizam a conta de administrador já existente no banco incluído no deploy, então use esses mesmos valores para entrar.

O serviço usa uma única instância. No plano gratuito não há disco persistente: o banco do repositório é incluído no deploy, mas alterações feitas durante a execução podem ser perdidas quando o serviço reiniciar ou for atualizado. O Render fornece HTTPS no endereço publicado.

Se `DB_FILE` estiver definido no Render, as salas, horários e conteúdos do banco incluído no repositório são importados na inicialização para esse banco, sem duplicar itens nem substituir salas remotas com IDs conflitantes. Para publicar salas novas criadas localmente, inclua o banco atualizado em um commit enviado à branch configurada no Render; o app não sincroniza automaticamente as alterações do SQLite de volta ao computador.

As rodadas têm seis perguntas. Ao final, há um desafio de pausa de até 20 segundos: memória, cálculo, sequência, paridade ou comparação, nessa ordem. Cada tipo só volta depois de cinco desafios; cada desafio resolvido no prazo adiciona 50 pontos ao ranking.

## Como testar sem esperar o horário

1. Admin → **Salas** → crie uma sala (nome, ano, professor, horários, conteúdo) → Salvar.
2. Admin → **Aula** → escolha a sala → **Abrir sessão**.
3. Em cada computador/celular, abra o endereço do servidor (localhost no computador servidor ou o IP da rede local nos demais) e cadastre os alunos → tela de espera.
4. Admin → **Iniciar atividade** → todos recebem a 1ª pergunta ao mesmo tempo.
5. **Encerrar sessão** → ranking final, histórico e prêmios são salvos.

No horário cadastrado, a sessão abre sozinha e encerra sozinha após 50 minutos.

## Estrutura

backend/ (server.js, database.js, agendamento.js, engine/) · frontend/ (index.html, admin.html) · database/schema.sql · render.yaml
