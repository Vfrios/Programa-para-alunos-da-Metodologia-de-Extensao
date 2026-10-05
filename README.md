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

## Como testar sem esperar o horário

1. Admin → **Salas** → crie uma sala (nome, ano, professor, horários, conteúdo) → Salvar.
2. Admin → **Aula** → escolha a sala → **Abrir sessão**.
3. Em cada computador/celular, abra o endereço do servidor (localhost no computador servidor ou o IP da rede local nos demais) e cadastre os alunos → tela de espera.
4. Admin → **Iniciar atividade** → todos recebem a 1ª pergunta ao mesmo tempo.
5. **Encerrar sessão** → ranking final, histórico e prêmios são salvos.

No horário cadastrado, a sessão abre sozinha e encerra sozinha após 50 minutos.

## Estrutura

backend/ (server.js, database.js, agendamento.js, engine/gerador.js, engine/regras.js) · frontend/ (index.html, admin.html) · database/schema.sql
