Perfeito! Segue a **documentação completa e definitiva (v2.7.2)**, já com todas as correções:

- **Turma = Sala** (mesma coisa).
- Cada turma tem **1 aula por semana**, com **50 minutos de atividade** e 5 minutos finais para encerramento.
- Ranking **por turma**, salvo em histórico, novo ranking para a próxima turma.
- Sala de espera estilo Kahoot com início controlado pelo professor.
- Contagem regressiva sincronizada.
- Tratamento de alunos atrasados.
- **Pontuação base** por erro/dica (100 → 50 → 25 → 12,5 → 10).
- **Combo percentual único** que **só vale se acertar de primeira**.
- **Erro, dica ou resposta zera o combo** e a pergunta **não ganha bônus**.
- **Tempo não interfere no combo** — só no nível de adaptação.
- **Combo incide apenas sobre a pergunta atual**, nunca sobre o total.
- **Teto de 150 pontos por pergunta**.
- Painel administrativo com abas: Configuração, Controle da Aula, Rankings Salvos.
- Grade real de horários com 7 turmas.
- Visão de produto comercializável.

---

# Sistema Adaptativo de Matemática com Perfil de Aluno

## Documentação Oficial do Projeto

**Versão:** 2.7.2
**Autor:** [seu nome]
**Data:** [data]
**Status:** Planejamento / Especificação

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Objetivos](#2-objetivos)
3. [Público-Alvo](#3-público-alvo)
4. [Grade de Horários Oficial](#4-grade-de-horários-oficial)
5. [Requisitos Funcionais](#5-requisitos-funcionais)
6. [Requisitos Não Funcionais](#6-requisitos-não-funcionais)
7. [Arquitetura do Sistema](#7-arquitetura-do-sistema)
8. [Modelo de Dados (Conceitual)](#8-modelo-de-dados-conceitual)
9. [Regras de Negócio](#9-regras-de-negócio)
10. [Fluxos Principais](#10-fluxos-principais)
11. [Perfis de Usuário](#11-perfis-de-usuário)
12. [Casos de Uso](#12-casos-de-uso)
13. [Painel Administrativo (Detalhado)](#13-painel-administrativo-detalhado)
14. [Estrutura de Pastas (Conceitual)](#14-estrutura-de-pastas-conceitual)
15. [Tecnologias Utilizadas](#15-tecnologias-utilizadas)
16. [Roadmap de Implementação](#16-roadmap-de-implementação)
17. [Riscos e Mitigações](#17-riscos-e-mitigações)
18. [Visão de Produto (Comercial)](#18-visão-de-produto-comercial)
19. [Glossário](#19-glossário)

---

## 1. Visão Geral

O **Sistema Adaptativo de Matemática** é uma aplicação web educacional desenvolvida para atender turmas do **Ensino Fundamental I** (2º e 3º ano), com aproximadamente **20 alunos por turma**.

O sistema funciona em um **laboratório de informática**, onde cada aluno acessa o jogo em seu próprio computador. **Não há login nem senha**: o aluno apenas digita seu **nome** no início da aula. A turma já está **automaticamente identificada** pelo horário configurado no painel administrativo.

Antes de começar, os alunos entram em uma **sala de espera estilo Kahoot**. O professor vê em tempo real quem já está conectado e, quando decidir, clica em **"Iniciar Atividade"**. Todos os alunos começam **no mesmo instante**, após uma **contagem regressiva de 3 segundos**. Isso garante **justiça total** no ranking — ninguém "farma pontos" enquanto os outros ainda estão se acomodando.

O professor acompanha o desempenho, e o sistema adapta automaticamente a dificuldade das perguntas conforme o desempenho individual de cada aluno.

O grande diferencial é o **motor de adaptação por perfil**: cada aluno tem seu próprio nível em cada tipo de atividade, e esse nível sobe ou desce com base no **tempo de resposta** e no **acerto ou erro**. Isso permite que alunos com dificuldades recebam perguntas mais fáceis e alunos avançados recebam desafios maiores — tudo em tempo real e sem intervenção manual.

Além disso, o sistema possui:
- **Agendamento automático** das aulas.
- **Ranking por turma**, salvo em histórico, com novo ranking para a próxima turma.
- **Sistema de combo percentual único**, que só vale se o aluno acertar de primeira.
- **Sala de espera e início controlado** pelo professor.
- **Perguntas bônus** em marcos de combo.

> **Importante:** neste projeto, **turma = sala**. Cada turma tem **um único horário por semana**. O horário de início e o de fim são configurados para cada aula; o horário padrão termina 55 minutos após o início, com 50 minutos de atividade e 5 minutos finais para encerramento.

---

## 2. Objetivos

### 2.1 Objetivo Geral

Criar uma plataforma educacional adaptativa que auxilie alunos do 2º e 3º ano do Ensino Fundamental a praticarem matemática de forma personalizada, divertida e competitiva saudável — com configuração extremamente simples (apenas o nome do aluno), início controlado pelo professor e pronta para ser comercializada para professores e escolas.

### 2.2 Objetivos Específicos

- **Adaptar automaticamente** a dificuldade das perguntas ao nível de cada aluno.
- **Registrar o desempenho** de cada aluno por tipo de atividade.
- **Garantir justiça no ranking** com início sincronizado via sala de espera.
- **Gerar ranking por turma** e ranking geral, em tempo real.
- **Automatizar o agendamento** das aulas por dia, hora, turma e conteúdo.
- **Notificar os alunos** nos últimos 5 minutos de aula.
- **Salvar o ranking** de cada turma e **preservar o histórico**.
- **Oferecer dicas e respostas** após tentativas falhas, como apoio pedagógico.
- **Recompensar consistência** com sistema de combo percentual único.
- **Fornecer relatórios** de desempenho para o professor.
- **Funcionar em rede local** com sincronização em tempo real entre os computadores.
- **Ser configurável em minutos** pelo professor, sem conhecimento técnico.

---

## 3. Público-Alvo

### 3.1 Usuários Primários

| Perfil | Descrição |
|---|---|
| **Aluno** | Crianças de 7 a 9 anos, do 2º e 3º ano do Ensino Fundamental |
| **Professor** | Responsável por conduzir as aulas e acompanhar o desempenho |
| **Administrador** | Responsável por configurar anos, conteúdos, turmas, horários e atividades |

### 3.2 Contexto de Uso

- **Local:** Laboratório de informática da escola
- **Dispositivo:** Computadores desktop (um por aluno)
- **Duração:** configurada pelo horário de início e fim de cada aula (55 minutos na grade padrão: 50 minutos de atividade e 5 minutos finais para encerramento)
- **Frequência:** 1 aula por semana por turma
- **Conexão:** Rede local (Wi-Fi ou cabo)
- **Acesso do aluno:** apenas o **nome** — sem login, sem senha, sem cadastro prévio
- **Início da atividade:** controlado pelo professor (estilo Kahoot)

---

## 4. Grade de Horários Oficial

A grade abaixo é a **configuração real** do sistema:

| Dia | Horário | Ano | Turma | Duração | Notificação |
|---|---|---|---|---|---|
| Segunda | 13:30–14:25 | 3º ano | Turma 7 | 55 min | 50 min |
| Segunda | 14:40–15:35 | 2º ano | Turma 7 | 55 min | 50 min |
| Terça | 14:40–15:35 | 2º ano | Turma 4 | 55 min | 50 min |
| Terça | 16:30–17:25 | 3º ano | Turma 5 | 55 min | 50 min |
| Quinta | 13:00–13:55 | 2º ano | Turma 8 | 55 min | 50 min |
| Quinta | 14:40–15:35 | 3º ano | Turma 6 | 55 min | 50 min |
| Quinta | 16:30–17:25 | 3º ano | Turma 8 | 55 min | 50 min |

> **Total:** 7 turmas, 7 aulas por semana, 1 aula por turma.
> **Observação:** os horários de início e fim são cadastrados no painel por sala. Na grade padrão, são 50 minutos de atividade e os últimos 5 minutos para encerramento.

---

## 5. Requisitos Funcionais

### RF01 — Identificação do Aluno

O sistema deve permitir que o aluno se identifique informando **apenas o nome**.

- Não há login, senha ou cadastro prévio.
- A **turma** já está automaticamente identificada pelo horário ativo no momento.
- O aluno digita o nome e entra na **sala de espera**.
- Se o nome já existir naquela turma, o sistema **retoma o perfil existente**.
- Se for a primeira vez, o sistema **cria automaticamente**:
  - Um perfil de adaptação para o aluno.
  - Um registro de ranking para o aluno naquela turma.

> **Importante:** o aluno **não** informa idade, professor ou turma. A turma é inferida pelo horário configurado.

---

### RF02 — Seleção de Atividades

O sistema deve oferecer **9 tipos de atividades**:

| Atividade | Descrição |
|---|---|
| Soma | Operações de adição |
| Subtração | Operações de subtração |
| Multiplicação | Operações de multiplicação com apoio visual |
| Sequências numéricas | Completar sequências contando para frente ou para trás |
| Formas | Reconhecimento de figuras geométricas |
| Medidas | Associação de objetos a unidades de medida |
| Par ou Ímpar | Classificação de números |
| Maior ou Menor | Comparação de números |
| Antecessor e sucessor | Identificar o número anterior ou seguinte |

> **Nota:** a disponibilidade de cada atividade pode variar conforme o **ano** (2º ou 3º) e o **conteúdo** configurado pelo professor no painel administrativo.

---

### RF03 — Geração Adaptativa de Perguntas

O sistema deve gerar perguntas **automaticamente** com base no **nível atual do aluno** em cada atividade.

- O nível varia de **1 a 5**.
- Quanto maior o nível, maior a dificuldade.
- Cada atividade tem sua própria lógica de geração.

---

### RF04 — Adaptação por Perfil

O sistema deve ajustar o nível do aluno após **cada resposta**, com base em:

- **Tempo de resposta** (em segundos)
- **Acerto ou erro**

Regras de ajuste:

| Situação | Ajuste no Nível |
|---|---|
| Acertou rápido (0–5s) | +1 |
| Acertou normal (5–10s) | +0,5 |
| Acertou devagar (10–20s) | 0 |
| Acertou muito devagar (20s+) | 0 |
| Errou rápido (0–10s) | 0 |
| Errou devagar (10–20s) | −0,25 |
| Errou muito devagar (20s+) | −0,5 |

- **Nível mínimo:** 1
- **Nível máximo:** 5
- O nível é arredondado para múltiplos de 0,5

> **Observação:** o erro **não derruba mais** o nível tão agressivamente. A ideia é **não desmotivar** a criança.

---

### RF05 — Sistema de Dicas e Respostas

- Após **3 erros** na mesma pergunta, o sistema deve exibir uma **dica**.
- Após **5 erros** na mesma pergunta, o sistema deve exibir a **resposta correta**.
- O uso de dica é registrado no histórico do aluno.
- O uso de dica ou resposta **zera o combo** do aluno.

---

### RF06 — Pontuação Base

O sistema deve calcular pontos com base na **quantidade de erros e dicas** na pergunta.

**Regras:**

- Toda pergunta começa valendo **100 pontos**.
- **Cada erro** reduz **50%** do valor restante.
- **Cada dica** reduz **50%** do valor restante.
- **Mínimo:** o aluno **nunca ganha menos de 10 pontos** por pergunta tentada.

| Situação | Cálculo | Pontos Base |
|---|---|---|
| Acertou de primeira | 100 | **100** |
| Errou 1 vez, depois acertou | 100 ÷ 2 = 50 | **50** |
| Errou 2 vezes, depois acertou | 50 ÷ 2 = 25 | **25** |
| Errou 3 vezes → **dica** → acertou | 25 ÷ 2 = 12,5 | **12,5** |
| Errou 4 vezes → dica → acertou | 12,5 ÷ 2 = 6,25 | **mínimo 10** |
| Errou 5 vezes → **resposta** → acertou | — | **10** |
| Errou 5 vezes e não acertou | — | **10** (consolação) |

> **Regra de ouro:** o aluno **nunca sai com 0 pontos**. O mínimo é **10 pontos** por pergunta tentada.

---

### RF07 — Sistema de Combo Percentual Único

O sistema deve recompensar **consistência** com um **único combo percentual**, que **só vale se o aluno acertar de primeira**.

**Definição de acerto de primeira:**

- Acertou **sem errar**, **sem dica**, **sem resposta**.

**Comportamento:**

- O combo **sobe** apenas com acertos de primeira.
- O combo **zera** com erro, dica ou resposta.
- O combo **incide apenas sobre os pontos da pergunta atual**, nunca sobre o total.
- O combo **só é aplicado se o aluno acertou de primeira**.
- Se o aluno errou, o combo já zerou — a pergunta **não ganha bônus**.
- O **tempo não interfere** no combo. Só no nível de adaptação.

#### Multiplicador percentual

| Acertos seguidos (de primeira) | Multiplicador | Ganho extra |
|---|---|---|
| 0 | +0% | — |
| 2 | +10% | +10% na pergunta |
| 4 | +20% | +20% na pergunta |
| 6 | +30% | +30% na pergunta |
| 8 | +40% | +40% na pergunta |
| 10 | +50% | +50% na pergunta |

> **Observação:** o multiplicador **não é x2, x3** — é **+10%, +20%, +30%**. Muito mais suave e previsível. O teto é **+50%**.

#### Fórmula

```
Se acertou de primeira:
    Pontos da pergunta = 100 × (1 + Multiplicador do combo)

Se errou, usou dica ou viu resposta:
    Combo zera
    Pontos da pergunta = pontos base (sem bônus)
```

#### Exemplos

| Situação | Combo | Pontos base | Cálculo | Pontos finais |
|---|---|---|---|---|
| Acertou de primeira | +20% | 100 | 100 × 1,20 | **120** |
| Acertou de primeira | +50% | 100 | 100 × 1,50 | **150** |
| Errou 1 vez e acertou | +0% (zerou) | 50 | 50 × 1,00 | **50** |
| Errou 3 vezes (dica) e acertou | +0% (zerou) | 12,5 | 12,5 × 1,00 | **12,5** |
| Errou 5 vezes (resposta) | +0% (zerou) | 10 | 10 × 1,00 | **10** |

> **Observação:** o teto é **150 pontos por pergunta** (100 base × 1,50). Nunca mais que isso.

#### Regras do combo

1. **Combo só sobe** com acertos **de primeira** (sem erro, sem dica, sem resposta).
2. **Combo zera** com erro, dica ou resposta.
3. **Multiplicador é percentual** (+10%, +20%, +30%, +40%, +50%).
4. **Multiplicador incide apenas sobre os pontos da pergunta atual**, não sobre o total.
5. **Multiplicador só é aplicado se o aluno acertou de primeira**.
6. **Se o aluno errou, o combo já zerou — a pergunta não ganha bônus**.
7. **Tempo não interfere no combo** — só no nível de adaptação.
8. **Barra visual** sempre visível no topo da tela.
9. **Pontuação mínima** por pergunta: **10 pontos**.
10. **Perguntas com erro não recebem bônus de combo**.

---

### RF08 — Perguntas Bônus

Em marcos específicos de combo, o sistema exibe uma **pergunta bônus**:

| Marco | Recompensa |
|---|---|
| 4 acertos de primeira | +10% extra na pergunta bônus |
| 6 acertos de primeira | +20% extra na pergunta bônus |
| 8 acertos de primeira | +30% extra na pergunta bônus |
| 10 acertos de primeira | +50% extra + prêmio especial |

**Como funciona:**

- Ao atingir o marco, o sistema exibe uma **pergunta bônus** (nível um pouco acima do atual).
- Se o aluno acertar **de primeira**, ganha a pontuação **com o percentual extra**.
- Se o aluno errar, **não perde o combo** (a pergunta bônus é uma "carta na manga").
- Após a pergunta bônus, o combo continua de onde parou.

---

### RF09 — Barra de Combo

O sistema deve exibir uma **barra visual de combo** no topo da tela do jogo, sempre visível:

```
┌─────────────────────────────────────────────────────────┐
│  🔥 COMBO: 4 acertos de primeira                         │
│                                                          │
│  [████████░░░░░░░░░░░░]  +20% na próxima pergunta        │
│                                                          │
│  Próximo nível: 6 acertos → +30%                         │
└─────────────────────────────────────────────────────────┘
```

**Estados da barra:**

- **Combo 0:** barra vazia, cinza, "+0%".
- **Combo 2:** barra 20%, verde claro, "+10%".
- **Combo 4:** barra 40%, verde, "+20%".
- **Combo 6:** barra 60%, laranja, "+30%".
- **Combo 8:** barra 80%, vermelho, "+40%".
- **Combo 10:** barra 100%, dourada, "+50%".

**Animações:**

- A cada acerto de primeira, a barra **enche** com animação.
- A cada erro, a barra **zera** com animação de "quebra".
- Ao atingir um marco, a barra **brilha** e exibe "BÔNUS!".

---

### RF10 — Ranking

O sistema deve manter **dois tipos de ranking**:

- **Ranking por turma:** alunos daquela turma específica.
- **Ranking geral:** todos os alunos de todas as turmas.

O ranking é atualizado **em tempo real** via WebSocket.

**Comportamento:**

- Cada **turma** tem seu **próprio ranking**, identificado por **turma + data + horário**.
- Ao final de uma aula, o ranking daquela turma é **salvo no histórico**.
- No **próximo horário**, que é de **outra turma**, o sistema **gera/retoma o ranking daquela outra turma**.
- O ranking da turma anterior **permanece salvo** e consultável.
- O ranking geral é a soma de todos os rankings de todas as turmas.

> **Resumo:** o ranking é **por turma**. Cada turma tem o seu. Ao final da aula, ele é salvo. Na aula seguinte (outra turma), o sistema usa o ranking daquela outra turma.

---

### RF11 — Agendamento Automático

O sistema deve:

- Identificar automaticamente **qual turma está ativa** com base no dia e horário.
- Considerar a **duração da atividade** (50 minutos), além dos 5 minutos finais para encerramento.
- Informar ao aluno **quanto tempo resta** de aula.
- Nos **últimos 5 minutos**, exibir uma **notificação de término** para os alunos.

---

### RF12 — Encerramento e Ranking por Turma

Ao final de cada aula, o sistema deve:

1. **Salvar o ranking final** daquela turma no histórico (com data e hora).
2. **Notificar os alunos** de que a aula terminou.
3. **Encerrar a sessão daquela turma.**
4. **Preparar o ranking da próxima turma** (que é outra turma, em outro horário).
5. **Não apagar** rankings anteriores — todos ficam disponíveis para consulta.

---

### RF13 — Relatórios

O sistema deve gerar relatórios:

- **Por aluno:** histórico de respostas, níveis, pontos e tempos.
- **Por turma:** desempenho médio, total de respostas e tempo médio.
- **Por aula:** ranking final de cada aula, com data e hora.
- **Por conteúdo:** desempenho por tipo de atividade.

---

### RF14 — Sincronização em Tempo Real

O sistema deve sincronizar:

- Ranking
- Notificação de término de aula
- Status da aula
- Início de novo ranking
- Sala de espera (alunos conectados)
- Contagem regressiva de início
- Barra de combo (em tempo real)

Tudo via **WebSocket**, sem necessidade de recarregar a página.

---

### RF15 — Painel Administrativo

O sistema deve oferecer um **painel administrativo** com:

- Cadastro de **anos** (2º e 3º).
- Cadastro de **conteúdos** por ano.
- Cadastro de **turmas** (número + ano).
- Cadastro de **horários** por dia, hora, turma e conteúdo.
- Visualização de **rankings salvos** por aula.
- Configuração do **horário da aula** (50 minutos de atividade e 5 minutos finais para encerramento).
- Configuração do **tempo de notificação** (padrão: 5 minutos).
- **Controle da aula** em tempo real (estilo Kahoot).

> Detalhamento completo na [seção 13](#13-painel-administrativo-detalhado).

---

### RF16 — Sala de Espera e Início Controlado

O sistema deve oferecer uma **sala de espera** antes do início da atividade, com controle do professor.

**Comportamento:**

- Ao entrar, o aluno digita apenas o **nome** e é direcionado para a **tela de espera**.
- A tela de espera mostra:
  - Nome do aluno.
  - Nome da turma (turma + horário + conteúdo).
  - Lista de **alunos já conectados** naquela turma (em tempo real).
  - Mensagem: **"Aguardando o professor iniciar a atividade..."**
  - Contador de alunos prontos (ex: "12 de 20 alunos conectados").
- O **professor/admin** vê a mesma lista em seu painel de controle.
- O professor pode:
  - **Iniciar a atividade** manualmente (botão "Iniciar").
  - **Aguardar todos** ou iniciar com os que já estão prontos.
  - **Cancelar** a atividade (se necessário).
- Ao clicar em **"Iniciar"**:
  - Todos os alunos conectados recebem um **comando de início** via WebSocket.
  - Uma **contagem regressiva** de 3 segundos é exibida em todas as telas.
  - Após a contagem, **todos começam no mesmo instante**.
  - O **cronômetro da aula** começa a contar a partir desse momento.

> **Importante:** o tempo de resposta de cada aluno é contado **a partir do início da atividade**, não do momento em que ele entrou na sala de espera. Isso garante **justiça total** no ranking.

---

### RF17 — Painel de Controle do Professor

O professor/admin deve ter um **painel de controle** com:

- **Lista de alunos conectados** na turma ativa (em tempo real).
- **Contador:** "X de Y alunos conectados".
- **Botão "Iniciar Atividade"** (habilitado quando houver pelo menos 1 aluno).
- **Botão "Encerrar Atividade"** (para casos de emergência).
- **Status da aula:** "Aguardando início" / "Em andamento" / "Encerrada".
- **Tempo restante** da aula.
- **Ranking em tempo real** (após o início).

---

### RF18 — Contagem Regressiva Sincronizada

Ao iniciar a atividade:

1. Todos os alunos recebem o comando via WebSocket.
2. Uma **contagem regressiva de 3 segundos** é exibida em todas as telas simultaneamente.
3. Após a contagem, o **cronômetro da aula** começa a contar.
4. O **tempo de resposta** de cada aluno é contado a partir desse instante.
5. O sistema registra o **horário exato de início** da atividade.

> **Benefício:** elimina a vantagem de quem entrou primeiro e garante que todos comecem em condições iguais.

---

### RF19 — Tratamento de Alunos que Chegam Atrasados

Se um aluno entrar **após o início da atividade**:

- Ele **entra direto no jogo**, sem passar pela sala de espera.
- O **tempo de resposta** dele começa a contar **a partir do momento em que ele entra**.
- Ele **não recebe pontos retroativos** pelo tempo em que não estava jogando.
- O sistema registra que ele entrou atrasado (para relatórios).

> **Justiça:** o aluno atrasado não é prejudicado nem beneficiado. Ele simplesmente começa quando entra.

---

## 6. Requisitos Não Funcionais

| Código | Requisito | Descrição |
|---|---|---|
| RNF01 | Usabilidade | Interface simples e colorida, adequada para crianças de 7 a 9 anos |
| RNF02 | Desempenho | Resposta do sistema em menos de 1 segundo |
| RNF03 | Concorrência | Suportar até 30 alunos simultâneos por turma |
| RNF04 | Disponibilidade | Funcionar em rede local, sem dependência de internet externa |
| RNF05 | Segurança | Dados restritos à rede escolar; sem exposição pública |
| RNF06 | Escalabilidade | Suportar adição de novas turmas, anos, conteúdos e atividades sem refatoração |
| RNF07 | Manutenibilidade | Código modular, separado por responsabilidades |
| RNF08 | Compatibilidade | Funcionar em navegadores modernos (Chrome, Firefox, Edge) |
| RNF09 | Persistência | Dados salvos em banco local (SQLite) |
| RNF10 | Autonomia | Professor não precisa reiniciar o sistema manualmente |
| RNF11 | Configurabilidade | Professor deve conseguir configurar horários e conteúdos em poucos minutos |
| RNF12 | Comercializável | Interface e fluxo pensados para serem vendidos a professores e escolas |
| RNF13 | Justiça | Início sincronizado garante igualdade de condições no ranking |
| RNF14 | Simplicidade | Sistema de combo percentual único, sem dois combos separados |

---

## 7. Arquitetura do Sistema

### 7.1 Visão em Camadas

```
┌─────────────────────────────────────────────┐
│                 FRONTEND                     │
│  (Interface do aluno e do professor)         │
│  - Tela de identificação (só o nome)         │
│  - Sala de espera                            │
│  - Tela de atividades                        │
│  - Tela do jogo                              │
│  - Tela de ranking                           │
│  - Tela administrativa                       │
│  - Painel de controle do professor           │
└──────────────────┬──────────────────────────┘
                   │ HTTP + WebSocket
                   ▼
┌─────────────────────────────────────────────┐
│                 BACKEND                      │
│  (Regras de negócio e processamento)         │
│  - API REST (identificação, respostas, ...)  │
│  - WebSocket (sincronização em tempo real)   │
│  - Motor de geração de perguntas             │
│  - Motor de adaptação por perfil             │
│  - Motor de pontuação base                   │
│  - Motor de combo percentual                 │
│  - Agendamento automático                    │
│  - Gerenciador de rankings (salvar/novo)     │
│  - Gerenciador de sala de espera             │
│  - Gerenciador de início controlado          │
└──────────────────┬──────────────────────────┘
                   │ SQL
                   ▼
┌─────────────────────────────────────────────┐
│                 BANCO                        │
│  (Persistência dos dados)                    │
│  - Anos                                      │
│  - Conteúdos                                 │
│  - Turmas                                    │
│  - Alunos                                    │
│  - Perfis                                    │
│  - Respostas                                 │
│  - Rankings (ativos e históricos)            │
│  - Premiações                                │
│  - Horários                                  │
│  - Aulas (histórico)                         │
│  - Sessões de Espera                         │
└─────────────────────────────────────────────┘
```

---

### 7.2 Componentes do Backend

| Componente | Responsabilidade |
|---|---|
| **Servidor principal** | Inicializa a aplicação, rotas e WebSocket |
| **Rotas de alunos** | Identificação por nome e consulta |
| **Rotas de turmas** | Cadastro e consulta de turmas |
| **Rotas de anos** | Cadastro e consulta de anos (2º, 3º) |
| **Rotas de conteúdos** | Cadastro e consulta de conteúdos por ano |
| **Rotas de horários** | Cadastro e consulta de horários |
| **Rotas de atividades** | Consulta de atividades disponíveis |
| **Rotas de respostas** | Registro de respostas e adaptação |
| **Rotas de ranking** | Consulta de ranking ativo e histórico |
| **Rotas de relatórios** | Geração de relatórios |
| **Rotas administrativas** | Configurações gerais |
| **Rotas de controle de aula** | Iniciar, encerrar e cancelar atividades |
| **Motor de geração** | Cria perguntas adaptadas ao nível |
| **Motor de adaptação** | Calcula novo nível |
| **Motor de dicas** | Controla dicas e respostas |
| **Motor de pontuação base** | Calcula pontos por erro/dica |
| **Motor de combo** | Calcula multiplicador percentual |
| **Agendamento** | Identifica turma ativa e notifica término |
| **Gerenciador de rankings** | Salva ranking ao fim da aula e cria novo |
| **Gerenciador de sala de espera** | Controla alunos conectados |
| **Gerenciador de início** | Dispara contagem regressiva e início sincronizado |

---

### 7.3 Componentes do Frontend

| Componente | Responsabilidade |
|---|---|
| **Tela de identificação** | Apenas o nome do aluno |
| **Sala de espera** | Lista de alunos conectados e mensagem de aguardo |
| **Tela de atividades** | Escolha do tipo de atividade |
| **Tela do jogo** | Pergunta, opções, dica, tempo, pontos e barra de combo |
| **Tela de ranking** | Ranking por turma e geral |
| **Tela administrativa** | Configuração de anos, conteúdos, turmas, horários e atividades |
| **Painel de controle** | Iniciar, encerrar e acompanhar a aula |
| **Barra de combo** | Indicador visual do progresso do combo |
| **Notificação de término** | Aviso nos últimos 5 minutos |

---

## 8. Modelo de Dados (Conceitual)

### 8.1 Entidades

#### Anos

- **ID** (identificador único)
- **Nome** (ex: "2º ano", "3º ano")
- **Ordem** (para ordenação)

#### Conteúdos

- **ID** (identificador único)
- **Ano** (referência à entidade Anos)
- **Nome** (ex: "Soma", "Subtração", "Multiplicação")
- **Ativo** (sim/não)

#### Turmas

- **ID** (identificador único)
- **Número** (ex: 7, 4, 5, 6, 8)
- **Ano** (referência à entidade Anos)
- **Data de criação**

> **Nota:** turma = sala. Cada turma tem um número e um ano.

#### Alunos

- **ID** (identificador único)
- **Nome**
- **Turma** (referência à entidade Turmas)
- **Data de criação**

> **Nota:** o aluno **não** informa idade, professor ou turma. A turma é inferida pelo horário.

#### Perfis

- **ID** (identificador único)
- **Aluno** (referência à entidade Alunos)
- **Nível de soma**
- **Nível de subtração**
- **Nível de multiplicação**
- **Nível de formas**
- **Nível de medidas**
- **Nível de par/ímpar**
- **Nível de maior/menor**
- **Tempo médio**
- **Total de acertos**
- **Total de erros**
- **Data de atualização**

#### Respostas

- **ID** (identificador único)
- **Aluno** (referência à entidade Alunos)
- **Aula** (referência à entidade Aulas)
- **Atividade**
- **Nível**
- **Pergunta**
- **Resposta dada**
- **Resposta correta**
- **Tentativas**
- **Usou dica** (sim/não)
- **Correta** (sim/não)
- **Acertou de primeira** (sim/não)
- **Pontos base**
- **Multiplicador de combo**
- **Pontos finais**
- **Combo no momento**
- **Tempo em segundos**
- **Data de criação**

#### Aulas

- **ID** (identificador único)
- **Turma** (referência à entidade Turmas)
- **Conteúdo** (referência à entidade Conteúdos)
- **Data**
- **Hora de início**
- **Hora de fim**
- **Horário exato de início da atividade** (após contagem regressiva)
- **Status** (aguardando / em andamento / encerrada)

#### Rankings

- **ID** (identificador único)
- **Aula** (referência à entidade Aulas)
- **Aluno** (referência à entidade Alunos)
- **Turma** (referência à entidade Turmas)
- **Pontos totais**
- **Total de acertos**
- **Total de erros**
- **Data de atualização**

> **Nota:** cada aula tem seu próprio conjunto de rankings. Rankings de aulas anteriores ficam preservados no histórico.

#### Premiações

- **ID** (identificador único)
- **Aluno** (referência à entidade Alunos)
- **Prêmio**
- **Data de conquista**

#### Horários

- **ID** (identificador único)
- **Dia da semana** (1 = segunda, 2 = terça, ..., 5 = sexta)
- **Hora de início** (ex: "13:30")
- **Hora de fim** (ex: "14:25", 55 minutos após o início)
- **Turma** (referência à entidade Turmas)
- **Conteúdo** (referência à entidade Conteúdos)
- **Ativo** (sim/não)

#### Sessões de Espera

- **ID** (identificador único)
- **Aula** (referência à entidade Aulas)
- **Aluno** (referência à entidade Alunos)
- **Status** (aguardando / pronto / iniciado)
- **Data de entrada**

---

### 8.2 Relacionamentos

- **Um ano** tem **muitos conteúdos**.
- **Uma turma** tem **muitos alunos**.
- **Uma turma** pertence a **um ano**.
- **Um aluno** tem **um perfil**.
- **Um aluno** tem **muitas respostas**.
- **Uma aula** tem **muitos rankings**.
- **Uma aula** tem **muitas respostas**.
- **Uma aula** tem **muitas sessões de espera**.
- **Uma turma** tem **muitos horários**.
- **Um horário** pertence a **uma turma** e a **um conteúdo**.
- **Um aluno** pode ter **muitas premiações**.

---

## 9. Regras de Negócio

### RN01 — Identificação Apenas pelo Nome

O aluno informa apenas o nome. A turma é inferida pelo horário ativo.

### RN02 — Adaptação de Nível

O nível de cada atividade é ajustado individualmente após cada resposta, com base em tempo e acerto.

### RN03 — Limites de Nível

O nível nunca é menor que 1 nem maior que 5.

### RN04 — Dica após 3 Erros

Após 3 erros na mesma pergunta, o sistema exibe uma dica.

### RN05 — Resposta após 5 Erros

Após 5 erros na mesma pergunta, o sistema exibe a resposta correta.

### RN06 — Pontuação Base por Erro/Dica

Toda pergunta começa valendo 100 pontos. Cada erro ou dica reduz 50% do valor restante. O mínimo é 10 pontos.

### RN07 — Combo Só Vale se Acertar de Primeira

O combo só sobe com acertos de primeira. Erro, dica ou resposta **zeram o combo**. A pergunta com erro **não ganha bônus**.

### RN08 — Combo Incide Apenas sobre a Pergunta Atual

O multiplicador de combo **nunca** é aplicado sobre o total acumulado. Sempre sobre a pergunta atual.

### RN09 — Tempo Não Interfere no Combo

O tempo de resposta **não afeta o combo**. Ele só afeta o **nível de adaptação**.

### RN10 — Ranking em Tempo Real

O ranking é atualizado automaticamente para todos os alunos conectados.

### RN11 — Agendamento Automático

O sistema identifica a turma ativa com base no dia e hora atuais.

### RN12 — Duração da Aula

Cada aula usa o horário de início e fim cadastrado para a sala. O padrão é de **55 minutos** (50 minutos de atividade mais 5 minutos finais; por exemplo, 13:30–14:25).

### RN13 — Notificação nos Últimos 5 Minutos

Nos **últimos 5 minutos** de aula, o sistema exibe uma notificação de término para os alunos.

### RN14 — Salvamento e Ranking por Turma

Ao final de cada aula:

1. O ranking **daquela turma** é **salvo** no histórico.
2. O sistema **não zera** o ranking — ele apenas **encerra a sessão daquela turma**.
3. No **próximo horário**, que é de **outra turma**, o sistema **gera/retoma o ranking daquela outra turma**.
4. Rankings anteriores **não são apagados**.

### RN15 — Turmas com Anos Diferentes

Cada turma tem um ano fixo (2º ou 3º) e um número.

### RN16 — Conteúdos por Ano

Cada ano tem seus próprios conteúdos configurados pelo professor no painel administrativo.

### RN17 — Início Controlado pelo Professor

A atividade só começa quando o professor clica em "Iniciar Atividade". Todos os alunos conectados começam no mesmo instante, após uma contagem regressiva de 3 segundos. O tempo de resposta de cada aluno é contado a partir desse instante.

### RN18 — Justiça no Tempo

O tempo de resposta de cada aluno é contado a partir do **início da atividade**, não do momento em que ele entrou na sala de espera. Alunos que chegam atrasados começam a contar o tempo a partir do momento em que entram.

### RN19 — Alunos Atrasados

Alunos que entram após o início da atividade:
- Entram direto no jogo.
- Começam a contar o tempo a partir do momento em que entram.
- Não recebem pontos retroativos.
- Têm a entrada atrasada registrada para relatórios.

---

## 10. Fluxos Principais

### 10.1 Fluxo do Aluno

1. Aluno acessa o sistema no navegador.
2. Sistema verifica se há aula ativa no momento.
3. Se houver, o sistema exibe a **tela de identificação** (apenas o nome).
4. Aluno digita o nome e confirma.
5. Sistema verifica se o nome já existe naquela turma:
   - Se sim, retoma o perfil existente.
   - Se não, cria um novo perfil.
6. Aluno é direcionado para a **sala de espera**.
7. Sistema mostra:
   - Lista de alunos conectados.
   - Mensagem: "Aguardando o professor iniciar a atividade..."
8. Professor **inicia a atividade** (via painel de controle).
9. Sistema exibe **contagem regressiva** (3, 2, 1, VAI!).
10. **Todos os alunos começam no mesmo instante.**
11. Aluno escolhe uma atividade disponível para o ano/conteúdo.
12. Sistema gera pergunta adaptada ao nível do aluno.
13. Aluno responde.
14. Sistema calcula pontos base, ajusta nível e atualiza ranking.
15. Se **acertou de primeira**, aplica o multiplicador de combo.
16. Se **errou**, zera o combo e não aplica bônus.
17. Sistema mostra feedback (acerto ou erro).
18. Se errar 3 vezes, mostra dica.
19. Se errar 5 vezes, mostra resposta.
20. Aluno continua até o final da aula.
21. Nos **últimos 5 minutos**, sistema exibe notificação de término.
22. Ao final, sistema salva o ranking daquela turma.

---

### 10.2 Fluxo do Professor

1. Professor configura anos, conteúdos, turmas e horários no painel administrativo.
2. Durante a aula, professor **acompanha a lista de alunos conectados**.
3. Quando estiver pronto, professor clica em **"Iniciar Atividade"**.
4. Professor acompanha o ranking em tempo real.
5. Ao final, professor consulta relatórios de desempenho.
6. Professor consulta rankings salvos de aulas anteriores.
7. Professor usa os dados para planejar próximas aulas.

---

### 10.3 Fluxo do Administrador

1. Administrador cadastra anos (2º, 3º).
2. Administrador cadastra conteúdos por ano.
3. Administrador cadastra turmas (número + ano).
4. Administrador cadastra horários (dia, hora, duração, turma, conteúdo).
5. Administrador configura atividades disponíveis.
6. Administrador monitora o sistema.

---

### 10.4 Fluxo de Agendamento Automático

1. Sistema verifica o dia e hora atuais a cada minuto.
2. Compara com a tabela de horários.
3. Identifica qual **turma** está ativa.
4. Informa ao frontend qual turma está em aula.
5. Nos **últimos 5 minutos**, dispara notificação de término.
6. Ao final da aula, **salva o ranking daquela turma** e **prepara o ranking da próxima turma** (que é outra turma).

---

### 10.5 Fluxo de Início Controlado

1. Alunos entram e digitam o nome.
2. Sistema coloca cada um na **sala de espera** da turma ativa.
3. Professor vê a lista de alunos conectados em tempo real.
4. Professor decide quando iniciar (pode aguardar todos ou iniciar com os prontos).
5. Professor clica em **"Iniciar Atividade"**.
6. Sistema envia comando via WebSocket para todos os alunos.
7. Todos veem **contagem regressiva de 3 segundos**.
8. Após a contagem, **todos começam simultaneamente**.
9. Cronômetro da aula começa a contar.
10. Tempo de resposta de cada aluno começa a contar a partir desse instante.

---

### 10.6 Fluxo de Combo

1. Aluno começa sem combo (+0%).
2. Aluno **acerta de primeira** → combo sobe (+1).
3. Aluno **acerta de primeira** novamente → combo sobe (+1).
4. Ao atingir marcos (2, 4, 6, 8, 10), o multiplicador aumenta (+10%, +20%, +30%, +40%, +50%).
5. O multiplicador é aplicado **apenas sobre a pergunta atual**, e **apenas se acertou de primeira**.
6. Aluno **erra** → combo **zera**.
7. Aluno **usa dica** → combo **zera**.
8. Aluno **vê resposta** → combo **zera**.
9. O tempo **não interfere** no combo.

---

## 11. Perfis de Usuário

### 11.1 Aluno

- **Acesso:** navegador no computador do laboratório
- **Permissões:** informar o nome, jogar, ver ranking
- **Restrições:** não pode alterar configurações

### 11.2 Professor

- **Acesso:** navegador no computador do professor
- **Permissões:** ver relatórios, acompanhar ranking, configurar horários e conteúdos
- **Restrições:** não pode alterar código ou banco

### 11.3 Administrador

- **Acesso:** navegador com credenciais
- **Permissões:** cadastrar anos, conteúdos, turmas, horários, atividades
- **Restrições:** nenhuma

---

## 12. Casos de Uso

| Código | Caso de Uso | Ator |
|---|---|---|
| UC01 | Identificar-se pelo nome | Aluno |
| UC02 | Entrar na sala de espera | Aluno |
| UC03 | Escolher atividade | Aluno |
| UC04 | Responder pergunta | Aluno |
| UC05 | Receber dica | Aluno |
| UC06 | Ver resposta correta | Aluno |
| UC07 | Ver ranking | Aluno |
| UC08 | Receber notificação de término | Aluno |
| UC09 | Ver barra de combo | Aluno |
| UC10 | Receber pergunta bônus | Aluno |
| UC11 | Acompanhar ranking em tempo real | Professor |
| UC12 | Ver lista de alunos conectados | Professor |
| UC13 | Iniciar atividade manualmente | Professor |
| UC14 | Cancelar atividade | Professor |
| UC15 | Consultar relatório de aluno | Professor |
| UC16 | Consultar relatório de turma | Professor |
| UC17 | Consultar ranking salvo de aula anterior | Professor |
| UC18 | Cadastrar ano | Administrador |
| UC19 | Cadastrar conteúdo | Administrador |
| UC20 | Cadastrar turma | Administrador |
| UC21 | Cadastrar horário | Administrador |
| UC22 | Configurar atividades | Administrador |
| UC23 | Salvar ranking ao fim da aula | Sistema |
| UC24 | Criar novo ranking para próxima turma | Sistema |
| UC25 | Sincronizar ranking em tempo real | Sistema |
| UC26 | Notificar término de aula | Sistema |
| UC27 | Disparar contagem regressiva | Sistema |
| UC28 | Aplicar combo percentual | Sistema |
| UC29 | Tratar aluno atrasado | Sistema |

---

## 13. Painel Administrativo (Detalhado)

O painel administrativo foi redesenhado para ser **extremamente simples e comercializável**. A lógica é:

> **Ano → Conteúdo → Turma → Horário**

### 13.1 Estrutura Visual do Painel

O painel tem **três abas principais**:

1. **Configuração** (Ano → Conteúdo → Turma → Horário)
2. **Controle da Aula** (estilo Kahoot)
3. **Rankings Salvos**

#### Aba 1 — Configuração

```
┌─────────────────────────────────────────────────────────┐
│  PAINEL ADMINISTRATIVO                                   │
│                                                          │
│  [Configuração]  [Controle da Aula]  [Rankings Salvos]   │
│                                                          │
│  ── CONFIGURAÇÃO ────────────────────────────────────    │
│                                                          │
│  [2º Ano]  [3º Ano]                                      │
│                                                          │
│  Conteúdos:                                              │
│    ☑ Soma                                                │
│    ☑ Subtração                                           │
│    ☑ Formas                                              │
│    ☐ Medidas                                             │
│    ☐ Multiplicação                                       │
│    ☐ Par ou Ímpar                                        │
│    ☐ Maior ou Menor                                      │
│                                                          │
│  Turmas:                                                 │
│    Turma 7 — 2º ano                                      │
│    Turma 4 — 2º ano                                      │
│    Turma 8 — 2º ano                                      │
│                                                          │
│  Horários:                                               │
│    Segunda 14:40–15:35 — Turma 7 — Soma (55 min)         │
│    Terça   14:40–15:35 — Turma 4 — Subtração (55 min)    │
│    Quinta  13:00–13:55 — Turma 8 — Formas (55 min)       │
│                                                          │
│  [+ Adicionar Horário]                                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### Aba 2 — Controle da Aula (estilo Kahoot)

```
┌─────────────────────────────────────────────────────────┐
│  PAINEL ADMINISTRATIVO                                   │
│                                                          │
│  [Configuração]  [Controle da Aula]  [Rankings Salvos]   │
│                                                          │
│  ── CONTROLE DA AULA ────────────────────────────────    │
│                                                          │
│  Turma ativa: Turma 7 — 3º Ano — Soma                    │
│  Horário: 13:30 — 14:25 (55 min)                         │
│  Status: AGUARDANDO INÍCIO                               │
│                                                          │
│  Alunos conectados: 12 de 20                             │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  João      ✅ pronto                             │    │
│  │  Maria     ✅ pronto                             │    │
│  │  Pedro     ✅ pronto                             │    │
│  │  Ana       ✅ pronto                             │    │
│  │  Lucas     ✅ pronto                             │    │
│  │  ...                                             │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  [🚀 INICIAR ATIVIDADE]   [❌ CANCELAR]                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Após o início:

```
┌─────────────────────────────────────────────────────────┐
│  ── CONTROLE DA AULA ────────────────────────────────    │
│                                                          │
│  Turma ativa: Turma 7 — 3º Ano — Soma                    │
│  Status: EM ANDAMENTO                                    │
│  Tempo restante: 32:15                                   │
│                                                          │
│  Ranking em tempo real:                                  │
│    1. João — 850 pontos                                  │
│    2. Maria — 720 pontos                                 │
│    3. Pedro — 690 pontos                                 │
│                                                          │
│  [⏹️ ENCERRAR ATIVIDADE]                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### Aba 3 — Rankings Salvos

```
┌─────────────────────────────────────────────────────────┐
│  [Configuração]  [Controle da Aula]  [Rankings Salvos]   │
│                                                          │
│  ── RANKINGS SALVOS ─────────────────────────────────    │
│                                                          │
│  [Turma 7 — 3º ano] [Turma 7 — 2º ano] [Turma 4] ...     │
│                                                          │
│  ── TURMA 7 — 3º ANO ───────────────────────────────     │
│                                                          │
│  Aula: 10/05/2026 — 13:30 — Soma                         │
│    1. João — 850 pontos                                  │
│    2. Maria — 720 pontos                                 │
│    3. Pedro — 690 pontos                                 │
│                                                          │
│  Aula: 03/05/2026 — 13:30 — Soma                         │
│    1. Maria — 900 pontos                                 │
│    2. João — 800 pontos                                  │
│    3. Pedro — 750 pontos                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 13.2 Fluxo de Configuração

1. **Selecionar o ano** (2º ou 3º).
2. **Marcar os conteúdos** que serão trabalhados naquele ano.
3. **Cadastrar as turmas** (número + ano).
4. **Adicionar horários** informando:
   - Dia da semana
   - Hora de início
   - Hora de fim
   - Turma
   - Conteúdo
5. Salvar.

> **Vantagem:** o professor configura tudo em **poucos minutos**, sem precisar mexer em código ou banco de dados.

### 13.3 Configurações Gerais

- **Duração padrão do horário:** 55 minutos (50 minutos de atividade e 5 minutos finais; ajustável definindo o horário de fim).
- **Tempo de notificação:** 5 minutos antes do fim (padrão).
- **Backup:** exportar/importar dados.

### 13.4 Por que isso é comercializável?

- **Configuração em minutos:** professor não precisa de suporte técnico.
- **Flexível:** funciona para qualquer escola, qualquer quantidade de turmas.
- **Histórico completo:** rankings salvos por aula, consultáveis a qualquer momento.
- **Sem login para aluno:** reduz atrito e tempo perdido em sala.
- **Multi-ano:** 2º e 3º ano com conteúdos separados.
- **Sala de espera estilo Kahoot:** diferencial competitivo.
- **Sistema de combo:** engajamento e diversão.
- **Escalável:** pode ser vendido como SaaS ou instalado localmente.

---

## 14. Estrutura de Pastas (Conceitual)

### 14.1 Backend

- **Servidor principal:** inicializa a aplicação
- **Banco de dados:** conexão e configuração
- **WebSocket:** sincronização em tempo real
- **Agendamento:** verificação de horários e notificações
- **Rotas:** endpoints da API
  - Alunos
  - Turmas
  - Anos
  - Conteúdos
  - Horários
  - Atividades
  - Respostas
  - Ranking
  - Administração
  - Controle de Aula
- **Motores:** lógica de negócio
  - Geração de perguntas
  - Adaptação por perfil
  - Dicas
  - Pontuação base
  - Combo percentual
  - Gerenciamento de rankings
  - Gerenciamento de sala de espera
  - Gerenciamento de início controlado

### 14.2 Frontend

- **Páginas HTML:** identificação, sala de espera, jogo, ranking, admin
- **Estilos CSS:** aparência visual
- **Scripts JS:** lógica de interação
- **Sons:** efeitos sonoros
- **Imagens:** ícones e formas geométricas
- **Componentes visuais:** barra de combo, contagem regressiva, notificação de término

### 14.3 Banco de Dados

- **Schema:** estrutura das tabelas

### 14.4 Documentação

- **README:** visão geral do projeto

---

## 15. Tecnologias Utilizadas

| Camada | Tecnologia | Motivo |
|---|---|---|
| Frontend | HTML, CSS, JavaScript | Simplicidade e compatibilidade |
| Backend | Node.js + Express | Leveza e rapidez |
| WebSocket | Socket.IO | Sincronização em tempo real |
| Banco | SQLite (dev) / PostgreSQL (produção) | Simplicidade e escalabilidade |
| Servidor | Node.js | Mesma linguagem do backend |

---

## 16. Roadmap de Implementação

### Fase 1 — Banco e Backend (Dia 1)

- Criar schema do banco
- Inserir turmas, anos, conteúdos e horários
- Criar rotas da API
- Criar motor de geração
- Criar motor de adaptação
- Criar motor de pontuação base
- Criar motor de combo
- Testar

### Fase 2 — Frontend (Dia 2)

- Criar tela de identificação
- Criar sala de espera
- Criar tela de atividades
- Criar tela do jogo
- Criar barra de combo
- Criar sistema de dica
- Criar sistema de resposta
- Testar

### Fase 3 — Ranking, Admin e Agendamento (Dia 3)

- Criar tela de ranking
- Criar tela administrativa
- Criar agendamento automático
- Criar início controlado
- Criar contagem regressiva
- Criar salvamento de ranking por turma
- Testar tudo
- Hospedar

---

## 17. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Internet cair | Alto | Funcionar em rede local |
| Muitos alunos simultâneos | Médio | Testar com 30 alunos |
| Aluno não entender | Médio | Interface simples e colorida |
| Professor não conseguir configurar | Médio | Tela administrativa intuitiva |
| Banco corromper | Alto | Backup periódico |
| WebSocket falhar | Médio | Fallback para polling |
| Aluno atrasado | Baixo | Entrada direta no jogo |
| Combo desbalancear | Médio | Teto de +50% e só acerto de primeira |
| Confusão no início | Médio | Sala de espera estilo Kahoot |

---

## 18. Visão de Produto (Comercial)

### 18.1 Diferenciais

- **Sem login para aluno** — só o nome.
- **Sala de espera estilo Kahoot** — início justo e controlado.
- **Sistema de combo** — engajamento e diversão.
- **Adaptação por perfil** — cada aluno no seu nível.
- **Ranking por turma** — histórico preservado.
- **Painel administrativo simples** — configuração em minutos.
- **Funciona em rede local** — sem depender de internet.
- **Multi-ano** — 2º e 3º ano com conteúdos separados.

### 18.2 Público Potencial

- Escolas públicas e privadas.
- Professores autônomos.
- Projetos de reforço escolar.
- Secretarias de educação.

### 18.3 Modelos de Venda

- **Licença única** por escola.
- **Assinatura mensal** por turma.
- **Pacote anual** com suporte.
- **Versão SaaS** hospedada.

### 18.4 Roadmap Comercial

1. **Versão 1.0** — MVP para uso interno.
2. **Versão 1.5** — refino de UI/UX.
3. **Versão 2.0** — multi-escola e relatórios avançados.
4. **Versão 2.5** — SaaS com autenticação de professor.
5. **Versão 3.0** — expansão para outras matérias.

---

## 19. Glossário

| Termo | Significado |
|---|---|
| **Adaptação** | Ajuste automático da dificuldade |
| **Nível** | Grau de dificuldade (1 a 5) |
| **Perfil** | Conjunto de dados de um aluno |
| **Ranking** | Classificação por pontos |
| **Ranking por turma** | Classificação dos alunos de uma turma específica |
| **Ranking salvo** | Ranking de uma turma arquivado ao final da aula |
| **Turma** | Grupo de alunos com um único horário semanal. É a mesma coisa que "sala" |
| **WebSocket** | Canal de comunicação em tempo real |
| **Agendamento** | Identificação automática da turma ativa |
| **Dica** | Ajuda após 3 erros |
| **Resposta** | Solução após 5 erros |
| **Sala de espera** | Tela onde os alunos aguardam o professor iniciar |
| **Início controlado** | Início da atividade disparado manualmente pelo professor |
| **Contagem regressiva** | Contagem de 3 segundos sincronizada antes do início |
| **Aluno atrasado** | Aluno que entra após o início da atividade |
| **Combo** | Sequência de acertos **de primeira** |
| **Acerto de primeira** | Acertou sem errar, sem dica, sem resposta |
| **Multiplicador percentual** | Percentual aplicado sobre os pontos da pergunta atual |
| **Pontos base** | 100, 50, 25, 12,5 ou 10 (conforme erros/dicas) |
| **Pontos da pergunta** | Pontos base × (1 + multiplicador), só se acertou de primeira |
| **Barra de combo** | Indicador visual do progresso do combo |
| **Pergunta bônus** | Pergunta especial em marcos de combo |

---

## Considerações Finais

Este documento descreve a **estrutura completa** do Sistema Adaptativo de Matemática, incluindo:

- Requisitos funcionais e não funcionais
- Arquitetura em camadas
- Modelo de dados conceitual
- Regras de negócio
- Fluxos principais
- Casos de uso
- Painel administrativo detalhado
- Roadmap de implementação
- Visão de produto comercial

Com base nesta documentação, a implementação pode ser feita de forma **organizada e incremental**, começando pelo banco e backend, depois frontend, e por fim ranking, admin e agendamento.

---

**Fim do documento.**

---

Se quiser, posso agora:

- **Detalhar mais alguma seção** (ex: aprofundar o motor de combo).
- **Criar um diagrama visual** da arquitetura.
- **Montar um cronograma** mais detalhado.
- **Escrever a documentação em inglês** também.
- **Criar um plano de testes** para validar o sistema.

É só pedir!
