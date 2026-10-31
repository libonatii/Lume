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
| Roteiro por prioridade | Implementado no servidor; exibido no comando `plan` e na janela |
| Bandeja do sistema e janela imersiva (Electron 45) | Implementado no código; abrir com `npm run companion:app` |
| Instalador assinado | Pendente |

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

## 6. Janela e bandeja (implementadas)

O app Electron fica na bandeja e abre uma janela de 400×640 com:

| Área | O que mostra |
| --- | --- |
| Cabeçalho | Nome do dispositivo e estado (`observando`, `pausado`, `desconectado`) |
| Agora | Aplicativo detectado, categoria, relógio da sessão e aviso de que não gera XP |
| Roteiro | Aulas restantes, cursos ativos e as três próximas aulas com o motivo da prioridade |
| Ações | Pausar/retomar presença, atualizar roteiro, abrir o Lume, desconectar |
| Pareamento | Código, nome do computador e endereço da API (avançado) |

A bandeja tem ícones próprios para ativo, pausado e desconectado, menu com o
estado atual, a próxima aula e o atalho para sair. Fechar a janela não encerra o
programa: ele continua na bandeja até "Sair".

O que ainda falta nessa camada:

| Recurso | Descrição |
| --- | --- |
| HUD discreto | Sempre no topo, por escolha, com tempo e próxima aula |
| Notificações | Lembrete gentil de pausa; nunca cobrança |
| Sessão no programa | Iniciar, pausar e encerrar a sessão declarada do site |
| Retomada direta | Abrir a próxima aula no navegador pelo link da fonte |
| Biblioteca local | Lista de cursos sem abrir o site |
| Offline | Fila local de presença, sincronizada depois |
| Início com o Windows | Opcional, explícito e reversível |
| Instalador assinado | Empacotamento e assinatura para distribuição |

Regras para todos eles: presença e roteiro nunca geram XP; compartilhamento é
opt-in; pausa não é punida; nada de vigilância.

## 7. Arquitetura

```text
[Electron: bandeja + janela]  ─┐
[companion/agent.mjs (CLI)]   ─┴→ [companion/core.mjs]
                                      tasklist → allowlist → presença
                                      │  Bearer <token do dispositivo>
                                      ▼
                              [API: /api/companion/*]
                                      │
                                      ▼
                              [estado da conta]  cursos, aulas, progresso, sessões
```

- A janela não tem acesso a Node nem ao token: fala com o processo principal por
  IPC com `contextIsolation` e `sandbox` ligados.
- O token é criado no pareamento (código de 8 caracteres, uso único, 10 min).
- O token só pode relatar presença e **ler** o roteiro; não altera estado.
- O servidor guarda apenas o hash do token.
- Revogar no site invalida o token imediatamente.

## 8. Roadmap

| Fase | Entrega | Estado |
| --- | --- | --- |
| 1 | Agente CLI, pareamento, presença, painel no site | Feito |
| 2 | Roteiro e contagem de aulas no agente | Feito |
| 3 | App Electron: bandeja, janela e estado visual | Feito no código |
| 4 | Instalador Windows via GitHub Actions | Feito; assinatura é opcional |
| 5 | Início com o Windows e auto-update | Planejado |
| 6 | Sessão declarada dentro do programa + retomada | Planejado |
| 7 | Presença social entre amigos (opt-in) | Depende de amigos e grupos |

A publicação é feita por tag (`companion-v0.4.0`) e o workflow gera o instalador
NSIS, sem precisar de máquina Windows local. Detalhes, secrets de assinatura e
solução de problemas em [Publicação e CI](RELEASE.md).

### Como abrir agora

O caminho normal é pelo site: **Instalar aplicativo**, na barra lateral,
abaixo do menu e acima do perfil. O botão baixa o instalador da última release
(`Lume-Companion-setup.exe`) e mostra o aviso de que ele ainda não é assinado.
A mesma tela gera o código de conexão — o programa não pede mais que a pessoa
procure em Configurações.

Para instalar manualmente, use a página de Releases do repositório.

Dentro da pasta do projeto (desenvolvimento):

```sh
npm install --prefix companion   # instala o Electron (uma vez)
npm run companion:app            # abre a bandeja e a janela
```

De qualquer pasta, ou com dois cliques:

```text
D:\tabletop\lume-companion.cmd
```

O iniciador entra sozinho na pasta certa e confere se o Electron está instalado.
Use `D:\tabletop\lume-companion.cmd --debug` para abrir com o console visível e
ver mensagens de erro.

Quem baixa pelo GitHub usa o instalador publicado em **Releases** (gerado pelo
workflow `Companion release`); não precisa de Node nem do projeto.

> `npm run companion:app` só funciona dentro de `D:\tabletop`. Rodar em
> `C:\Users\Ana` produz `npm error ENOENT ... C:\Users\Ana\package.json` — não é
> falta de arquivo do projeto, é a pasta errada.

Ou, sem janela: `npm run companion` (agente de terminal).

## 9. Limitações atuais

- Windows apenas; sem suporte a Linux/macOS.
- A janela e a bandeja foram verificadas em Chromium (mesma engine do Electron) e
  por checagem de sintaxe, mas **não foi possível abrir o app Electron na sessão
  automatizada de desenvolvimento** (sem desktop interativo). A validação final
  do ícone da bandeja é manual: `npm run companion:app`.
- Sem instalador e sem assinatura de código: hoje o app roda pelo projeto.
- Sem leitura de progresso automático das plataformas: a conclusão continua
  manual e identificada.
- Sem integração com Discord: o Lume não lê a atividade de outros programas.
- Presença não vira tempo elegível de XP; a política exige validação no servidor.
- Amigos existem, mas grupos, feed e ranking continuam pendentes.
