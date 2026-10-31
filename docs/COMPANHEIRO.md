# Lume Companion — programa de desktop

Status: **em desenvolvimento**. O agente local, o pareamento, a presença e o
roteiro de estudo já funcionam em linha de comando no Windows. A bandeja, a
janela imersiva e o instalador ainda não estão implementados (ver seção 8).

Este documento descreve o Companion como o **produto principal** de uso diário:
o site continua sendo a conta, a biblioteca e o lugar de organizar; o programa
é o que fica aberto com você enquanto estuda.

## 1. Por que um programa

O Discord consegue mostrar "jogando X há 40 minutos" porque é um aplicativo
nativo, com permissão para ler processos do sistema. Um site não tem essa
permissão. O Companion existe para ocupar esse espaço com uma regra diferente:
**ler apenas o que a pessoa autorizou**, sem capturar tela, teclado ou títulos
de janela.

O programa não substitui o site: ele mostra o que está acontecendo agora e
retoma o que já está na conta.

## 2. O que já existe

| Capacidade | Situação |
| --- | --- |
| Agente de linha de comando (Windows, sem dependências) | Implementado |
| Leitura de processos via `tasklist` | Implementado |
| Allowlist por aplicativo, com nome e categoria | Implementado |
| Pareamento por código de uso único (10 min) | Implementado |
| Token por dispositivo, guardado como hash no servidor | Implementado |
| Presença com expiração (90 s sem batimento) | Implementado |
| Painel no site: conectar, ver presença, desconectar | Implementado |
| Quantas aulas faltam e em quais cursos | Implementado (`/api/companion/study`) |
| Roteiro por prioridade | Implementado no servidor; exibido no comando `plan` |
| Bandeja do sistema, janela, instalador | Pendente |

O roteiro completo também aparece no site (Missões e Biblioteca), com o mesmo
critério. O Companion não inventa uma prioridade diferente.

## 3. Presença rica (rich presence)

O que o Lume mostra: **aplicativo**, **categoria**, **desde quando** e **em qual
computador**. Nada além disso.

Exemplo de presença:

```text
Anki · Estudo · há 42 min · PC da Ana
```

Regras:

- A presença expira sozinha; fechar o programa ou desconectar limpa na hora.
- Soa como "aberto", nunca como "estudando de verdade".
- Não entra no histórico, não conclui aula e não gera XP.
- A lista de aplicativos é sua; nada fora dela é enviado.
- Não há leitura de títulos de janela — um PDF aberto não revela o nome do
  arquivo, e um navegador não revela o site.

Categorias: `study`, `project`, `reading`, `break`, `game`, `other`. A categoria
`game` existe para presença social honesta ("estou jogando"), nunca para XP.

## 4. Quantas aulas faltam

O Companion consulta a cópia do estado da conta, somente leitura:

```text
Faltam 37 aulas em 3 cursos ativos · 1 pausado · 2 concluídos
```

Por curso:

| Campo | Significado |
| --- | --- |
| `remaining` | Aulas selecionadas ainda não concluídas |
| `total` | Aulas selecionadas na importação |
| `percent` | Progresso dentro da seleção |
| `partial` | A grade importada é parcial — não representa o curso inteiro |
| `next` | Próxima aula |

Grade parcial é rotulada como parcial. O programa nunca diz que um curso
acabou quando só as áreas escolhidas terminaram.

## 5. Roteiro por prioridade

Critério explícito, na ordem:

1. **Continuidade** — material com estudo registrado nos últimos 7 dias.
2. **Primeiro passo** — material sem nenhum progresso.
3. **Perto do fim** — menos aulas restantes.
4. **Ordem da biblioteca** — desempate final.

Pausados e concluídos ficam fora. Cursos de exemplo não entram. Cada passo
mostra o motivo (`Continuidade`, `Primeiro passo`, `Perto do fim`, `Em
andamento`), para a pessoa entender por que aquilo veio primeiro.

Saída do comando `plan`:

```text
Faltam 12 aulas em 2 cursos ativos · 0 pausados · 0 concluídos.
Critério: Prioridade por continuidade recente, primeiro passo, proximidade do fim e ordem da biblioteca.
  1. Aula 2 — Direitos fundamentais — OAB — Gran Cursos · Direito Constitucional (Continuidade)
  2. Instalação do ambiente — Trilha Full-Stack (Primeiro passo)
```

## 6. Funcionalidades planejadas para a janela

O objetivo é que o programa pareça um aplicativo de verdade, não um painel de
diagnóstico. Nada abaixo está implementado; é o destino do produto.

| Recurso | Descrição |
| --- | --- |
| Bandeja | Ícone com estado (estudando/pausado/desconectado), menu rápido |
| Janela imersiva | Cartão de presença, relógio de sessão, próxima aula e roteiro |
| HUD discreto | Sempre no topo, por escolha, com tempo e próxima aula |
| Sessão no programa | Iniciar, pausar e encerrar a mesma sessão declarada do site |
| Retomada | Abrir a próxima aula direto no navegador, no link da fonte |
| Notificações | Lembrete gentil de pausa; nunca cobrança, nunca sequência obrigatória |
| Biblioteca local | Lista de cursos e aulas restantes sem abrir o site |
| Amigos | Ver quem está estudando agora, quando a pessoa escolher compartilhar |
| Offline | Fila local de presença; sincroniza quando a conexão volta |
| Início com o Windows | Opcional, explícito, reversível |

Regras para todos eles: presença e roteiro nunca geram XP; compartilhamento é
opt-in; pausa não é punida; nada de vigilância.

## 7. Arquitetura

```text
[companion/agent.mjs]  tasklist → allowlist → presença
        │  Bearer <token do dispositivo>
        ▼
[API: /api/companion/*]  par, presença, estudo
        │
        ▼
[estado da conta]  cursos, aulas, progresso, sessões
```

- O token é criado no pareamento (código de 8 caracteres, uso único, 10 min).
- O token só pode relatar presença e **ler** o roteiro; não altera estado.
- O servidor guarda apenas o hash do token.
- Revogar no site invalida o token imediatamente.
- O agente não fala com o banco nem com outras pessoas; só com a API.

## 8. Roadmap

| Fase | Entrega | Estado |
| --- | --- | --- |
| 1 | Agente CLI, pareamento, presença, painel no site | Feito |
| 2 | Roteiro e contagem de aulas no agente | Feito |
| 3 | Empacotamento Electron: bandeja, janela, instalador | Próximo |
| 4 | Sessão declarada dentro do programa + retomada | Planejado |
| 5 | Presença social entre amigos (opt-in) | Depende de amigos e grupos |

A fase 3 exige instalar o Electron (dependência de desenvolvimento) e assinar o
executável para distribuir. Nada foi publicado nem ativado como serviço pago.

## 9. Limitações atuais

- Windows apenas; sem suporte a Linux/macOS.
- Sem bandeja e sem instalador: hoje é um comando no terminal.
- Sem assinatura de código.
- Sem leitura de progresso automático das plataformas: a conclusão continua
  manual e identificada.
- Sem integração com Discord: o Lume não lê a atividade de outros programas.
- Presença não vira tempo elegível de XP; a política exige validação no servidor.
- Amigos existem, mas grupos, feed e ranking continuam pendentes.
