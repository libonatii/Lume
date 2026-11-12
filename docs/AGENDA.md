# Lume — plano da Agenda

> **Estado: implementado e verificado localmente.** Decisões levantadas com a responsável
> em 05/11/2026. Branch de trabalho: `feature/calendar-agenda`, no diretório existente, sem worktree.
> Sem publicação. As escolhas operacionais adotadas na implementação estão na seção 4.

Referências: [Produto](PRODUTO.md), [Gamificação](GAMIFICACAO.md),
[Continuidade](CONTINUIDADE.md), [Implementação](IMPLEMENTACAO.md) e
[Refatoração](REFATORACAO_01112026.md).

## 1. Objetivo

Organizar estudos e compromissos pessoais em um calendário integrado às tarefas e à biblioteca do Lume.
A Agenda é o lugar principal das tarefas, com entrada própria no menu.

Exemplos ilustrativos:

- Agendar uma tarefa isolada: “Resolver questões”, na terça, sem horário definido.
- Reservar uma atividade: “Estudar Constitucional”, das 19h às 20h, com tarefas de assistir à aula,
  revisar anotações e resolver questões.
- Repetir “Revisão semanal”, com um checklist novo em cada ocorrência.
- Visualizar provas, entregas e compromissos pessoais junto dos estudos.

## 2. Decisões confirmadas

| Tema | Decisão |
| --- | --- |
| Atividades e tarefas | Permitir atividades com checklist e tarefas agendadas individualmente |
| Tipos de compromisso | Estudos da biblioteca, estudos livres, provas, entregas e compromissos pessoais |
| Agendamento | Por dia, sem horário, ou com início e fim |
| Recorrência | Repetição de atividades com checklist novo, desmarcado, em cada ocorrência; preservar o histórico |
| Planejamento | Combinar compromissos definidos pela pessoa com sugestões de estudo do Lume |
| Conflitos | Avisar sobre sobreposições, sem bloquear o agendamento; sugestões também podem apresentar conflitos |
| Pendências | Manter a atividade incompleta na data original; a pessoa decide quando reagendar |
| Visualizações | Agenda do dia, semana com horários e mês completo |
| Navegação | Área própria no menu, chamada Agenda |
| Tarefas existentes | Unificar na Agenda, substituindo a aba atual de tarefas do Plano |
| Lembretes | Avisos dentro do Lume e notificações no computador, inclusive com a janela minimizada |
| Calendários externos | Somente o Lume nesta versão, sem integração com calendários externos |

A revisão de experiência de 05/11 adota semana no computador e dia no celular como visualização inicial.
Os prazos já existentes nas tarefas são preservados e exibidos
como prazo, separadamente do dia escolhido para executar a atividade.

## 3. Integração com o que já existe

### Tarefas, biblioteca e progresso

- A mudança de lugar das tarefas na interface deve reaproveitar os registros existentes, preservando
  identidade, conclusão, prioridade, prazo, subtarefas e vínculos com materiais e aulas.
- Não criar cópias independentes da mesma tarefa para cada visualização do calendário.
- Referenciar materiais e unidades da biblioteca, sem duplicar cursos ou aulas para agendá-los.
- Preservar a política vigente: concluir uma tarefa vinculada a uma aula conclui essa aula e concede
  sua recompensa uma única vez; tarefas sem vínculo não concedem XP.
- Um checklist novo de uma atividade recorrente não reinicia o progresso da aula nem sua elegibilidade
  para recompensa. Reabrir uma tarefa continua sem desfazer a aula.
- Agendar, reagendar, receber lembretes ou encerrar um horário reservado não comprova estudo e não
  gera XP. Tempo planejado não deve ser convertido em tempo de sessão declarada.

### Plano, Hoje e navegação

Desde 12/11/2026, Plano de Estudos reúne Agenda (cronograma da semana), Calendário e Tarefas; o Roteiro saiu. O cronograma distribui aulas por
minutos disponíveis em cada dia; essas sugestões são revisadas antes de virarem compromissos.

- `#tarefas` continua válido e agora pertence à Agenda; tarefas podem ser agendadas pelo botão Agendar.
- O cronograma permanece no Plano; o Roteiro saiu em 12/11/2026. Hoje conserva seu resumo de tarefas; não ganhou outro calendário.
- A navegação tem seis destinos com rótulos inteiros no computador e no celular.
- Recalcular o Plano não modifica compromissos. Uma sugestão só vira compromisso ao salvar a revisão.

### Lembretes

Avisos internos e notificações do sistema usam consultas autenticadas a cada 15 segundos enquanto o
site ou aplicativo executa. O servidor reivindica o lembrete uma única vez por conta, entre abas e
dispositivos, e revalida a revisão junto da reivindicação. A permissão do sistema é solicitada por botão.
Sem permissão, o aviso interno continua disponível. O Electron mantém a consulta com a janela minimizada.
Programa encerrado, sistema suspenso e falta de rede não têm garantia de entrega; não há push externo.

## 4. Escolhas operacionais adotadas

Estas decisões completam os detalhes abertos no plano original, sem mudar a política de XP:

1. **Conclusão explícita:** Encerrar atividade não marca tarefas nem concede XP. O checklist mostra
   progresso parcial. Mover só tarefas pendentes cria outra atividade e mantém as concluídas na original.
2. **Recorrência finita:** diária, semanal ou mensal, até 52 ocorrências. No mês mais curto, usa o
   último dia e retoma o dia original nos seguintes. Novos checklists recebem ids próprios e conservam
   vínculos com aulas, mas não conclusão, prazo antigo ou subtarefas marcadas. A primeira ocorrência
   preserva as tarefas existentes que a pessoa selecionou.
3. **Edição e cancelamento:** esta ocorrência ou esta e as futuras pendentes; operações em série
   não alteram passadas, concluídas ou canceladas. Cancelar preserva o registro e as tarefas. Não existe
   alteração em massa retroativa de toda a série. Alterar checklists é uma operação por ocorrência.
4. **Fuso fixo:** inicia com o fuso IANA do dispositivo, identificado no editor e editável em Mais opções.
   Data de término permite atravessar a meia-noite. Horários inexistentes são recusados; em horários
   ambíguos, usa a primeira ocorrência. Dias sem horário não são convertidos em instantes UTC na tela.
5. **Sugestões por dia:** reaproveitam prioridade, disponibilidade em minutos e duração conhecida ou
   estimada do Plano. A pessoa escolhe o horário na revisão. Não há configuração nova de janelas de
   disponibilidade nem alocação automática de horários. Aulas já agendadas ficam fora das sugestões.
6. **Avisos distintos:** sobreposição é informativa na Agenda; insuficiência de carga até o prazo
   continua explicada no Plano. Nenhuma das duas move compromissos automaticamente.
7. **Lembretes:** sem aviso ou 0/5/15/30/60 minutos antes. Sem horário, a referência é 09h no fuso do
   compromisso. Recupera atrasos de até 15 minutos; avisos mais antigos não são disparados. Edição de
   horário muda a identidade do aviso; cancelamento ou conclusão impede nova entrega. A reivindicação
   é no máximo uma vez: uma falha depois dela pode impedir entrega, sem gerar repetição em outro dispositivo.
8. **Privacidade e prazos:** a Agenda não entra no perfil de amigos. Tarefas mantêm prazo e vínculo
   separados do agendamento; concluir uma aula continua alimentando o progresso compartilhado autorizado.
9. **Limites:** até 1.000 compromissos, 50 tarefas por atividade e 200 tarefas no total. Séries que
   excedem limites são recusadas inteiras, sem remover tarefas antigas.

## 5. Etapas de implementação

As etapas A1–A6 estão implementadas e verificadas localmente. A seção 8 registra os resultados.

### A1 — Fechar comportamento e desenho

- [x] Resolver as decisões abertas que afetam o modelo, a navegação e os lembretes.
- [x] Definir os fluxos de criação, edição, conclusão, reagendamento e recorrência.
- [x] Desenhar as três visualizações e a navegação no computador e no celular.

### A2 — Modelo e persistência

- [x] Definir atividades, agendamentos, séries e ocorrências, reaproveitando tarefas e vínculos existentes.
- [x] Implementar regras compartilhadas em `public/` e validação no servidor, conforme a arquitetura vigente.
- [x] Persistir pela API com revisão otimista e idempotência; garantir isolamento entre contas.
- [x] Preservar os registros existentes sem migração de dados ou conversão automática. Caso sejam necessárias
  alterações de esquema, usar uma nova migração SQL, sem editar migrações aplicadas.
- [x] Definir e verificar exportação/restauração dos novos dados no backup, sem perda silenciosa de campos.

Não reintroduzir IndexedDB, fila offline, sincronização por cursor ou reconciliação de documentos no navegador.
A prévia continua temporária; falhas de gravação devem preservar o formulário e permitir repetição explícita.

### A3 — Agenda e centralização das tarefas

- [x] Registrar a área na tabela de navegação `src/app/routes.jsx`.
- [x] Implementar dia, semana e mês como visualizações dos mesmos dados.
- [x] Permitir atividades com checklist e tarefas isoladas, por dia ou com horário.
- [x] Centralizar as tarefas atuais na Agenda, preservando suas ações e seus dados.
- [x] Tratar estados vazios, carregamento, erro e conflito, com uso por teclado e no celular.
- [x] Organizar estilos por funcionalidade, com tokens e imports no manifesto `src/styles/lume.css`.

### A4 — Recorrência e planejamento

- [x] Criar ocorrências com checklist independente e histórico preservado.
- [x] Avisar sobre sobreposições sem impedir o agendamento.
- [x] Oferecer sugestões de estudo distinguíveis dos compromissos já marcados.
- [x] Manter pendências na data original e permitir reagendamento manual.
- [x] Integrar o cronograma conforme as decisões de A1, sem mover compromissos automaticamente.

### A5 — Lembretes

- [x] Implementar avisos internos e notificações no computador pelos canais definidos em A1.
- [x] Atualizar ou cancelar lembretes quando a atividade mudar, terminar ou for removida.
- [x] Testar janela minimizada, permissões negadas e prevenção de notificações duplicadas.
- [x] Informar os limites reais de entrega de cada canal.

### A6 — Verificação e documentação

- [x] Verificar regras de datas, recorrência, conflitos, tarefas vinculadas e idempotência.
- [x] Verificar persistência, isolamento de contas, revisão concorrente e preservação de tarefas existentes.
- [x] Exercitar os fluxos nas três visualizações, no computador e no celular, além dos lembretes reais.
- [x] Rodar `npm.cmd test`, `npm.cmd run build` e `npm.cmd run test:e2e` conforme as áreas alteradas.
  Incluir novos testes unitários na lista explícita do `package.json`.
- [x] Atualizar Produto, Continuidade e Implementação quando os fluxos existirem; atualizar as instruções
  de navegação e os documentos de desktop conforme as mudanças realizadas.

## 6. Critérios de aceite

1. Uma atividade criada em qualquer visualização aparece corretamente nas outras e persiste na conta.
2. Tarefas existentes continuam acessíveis na Agenda, com os mesmos vínculos, prazos e conclusões.
3. É possível agendar uma tarefa isolada ou uma atividade com checklist, sem horário ou com início e fim.
4. Uma sobreposição é informada e não impede salvar o compromisso.
5. Uma atividade incompleta não muda de data sozinha; a pessoa consegue reagendá-la.
6. Cada ocorrência recorrente começa com checklist novo, sem alterar as ocorrências anteriores.
7. Concluir novamente uma tarefa ligada à mesma aula não duplica XP ou progresso da aula.
8. Sugestões e compromissos já agendados são distinguíveis; recalcular sugestões não move compromissos.
9. Lembretes internos e do computador funcionam nos canais declarados, inclusive com a janela minimizada;
   edição e cancelamento não deixam avisos indevidos.
10. Os fluxos são utilizáveis por teclado e no celular, sem expor compromissos pessoais nas projeções sociais.

## 7. Arquivos e limites da entrega

- Domínio: `public/agenda-domain.js`; tarefas existentes continuam em `public/tasks-domain.js`.
- Persistência: `agenda_entries` e `agenda_reminders`, esquema novo `migrations/0014_agenda.sql`.
  Operações `appointment.put/delete/order` usam o batch e a revisão de `/api/library/actions`.
- Lembretes: `api/domain/agenda.js`, `POST /api/agenda/reminders`, `src/features/agenda/Reminders.jsx`.
- Interface: `src/features/agenda/Agenda.jsx`, `actions.js`, `agenda.css` e tabela de rotas.
- Verificação: `tests/unit/agenda.test.js`, contrato Node/D1, `tests/e2e/agenda.spec.js` e
  `scripts/test-agenda-desktop.mjs` para o canal nativo no Electron.

Integrações com calendários externos, notificações no celular e entrega com o programa encerrado não
fazem parte desta versão. Não há migração de dados nem nova política de XP. Deploy, migração remota e
release dependem de pedido explícito.

## 8. Verificações

- Rodada final de `npm.cmd test`: 262 passaram, 1 cenário de mídia do Worker ignorado,
  0 falhas. Inclui persistência e lembretes no contrato Node e D1 local.
- `npm.cmd run test:e2e`: 120 cenários passaram (10,4 minutos), antes dos ajustes finais do formulário
  e do menu móvel.
- `npm.cmd run build`: passou novamente após os ajustes finais.
- `npx.cmd playwright test tests/e2e/agenda.spec.js`: 14 cenários passaram (47,6 segundos) no build
  final, no computador e no celular. Inclui as três visões, tarefas preservadas, falha temporária sem
  duplicação, conflito com recarga e repetição explícita, série editada a partir de ocorrência encerrada,
  teclado, permissão negada e rótulos do menu sem corte em 320 px. O canal nativo é substituído nesse
  e2e; a API, a persistência e a reivindicação dos lembretes são reais.
- `node scripts/test-agenda-desktop.mjs`: Electron real, janela minimizada, permissão concedida,
  uma notificação nativa criada e exibida, zero erros, aviso interno presente e sem segunda reivindicação.
  O teste usa banco, conta e configuração isolados. `npm.cmd --prefix companion run smoke` também passou.
- `node --check companion/electron/main.mjs`: passou. Links locais dos sete documentos conferidos.
- Capturas de dia e mês foram geradas nos testes e revisadas no computador e no celular, com contexto
  de navegador novo. `git diff --check` passou. Não houve publicação nem aplicação remota do esquema.

## 9. Revisão da experiência — calendário interativo

A responsável aprovou substituir a grade de cartões por um calendário interativo e reduzir o cadastro.
O motor visual é **FullCalendar Standard 7.1.4 (MIT)**, integrado ao React e aos tokens do Lume. CSS é
importado pelo manifesto global, sem injetar estilos em tempo de execução. Não usa backend do fornecedor.

- **Calendário:** semana inicial no computador, dia no celular; mês disponível nos dois. Blocos têm posição
  e altura proporcionais ao horário e à duração, sobreposições lado a lado, linha de agora e faixa sem horário.
- **Criação:** clicar/tocar em um horário preenche data, início e 30 minutos de duração. Arrastar seleciona
  um intervalo; clicar num dia do mês cria sem horário. O título é a única informação ainda necessária.
- **Editor contextual:** painel lateral no computador e inferior no celular, com foco contido, Escape e
  devolução do foco. Mantém o calendário no lugar. Categoria, recorrência, lembrete, data final diferente e
  edição do fuso ficam em Mais opções. O rodapé de gravação acompanha a rolagem.
- **Checklist:** itens adicionados individualmente, cada um com material/aula próprios. É possível criar
  e editar itens depois de salvar o compromisso. Retirar um vínculo não apaga a tarefa; tarefas concluídas
  preservam seu vínculo e conclusão. Edição do checklist e compromisso forma uma única operação de biblioteca.
- **Para agendar:** painel recolhível com tarefas ainda não agendadas, sugestões do Plano e pendências
  anteriores. Arrastar uma tarefa para a grade abre revisão com título, vínculo e horário preenchidos;
  o botão Agendar oferece o mesmo caminho sem arrasto. Sugestões só são gravadas após salvar.
- **Reagendamento:** arrasto e redimensionamento usam as ações nomeadas e aguardam confirmação. Falhas
  abrem o editor com os valores pretendidos; repetir conserva a operação, e conflito exige recarga e
  reenvio explícito. Séries abrem revisão de escopo antes da gravação. Cancelar a revisão preserva a série.
- **Fusos:** a grade mostra os instantes no fuso do dispositivo; o editor mantém o fuso original de cada
  compromisso. Arrastar converte o instante escolhido de volta ao fuso original. Itens sem horário mantêm
  a data civil. A resolução de horários sazonais continua no domínio compartilhado.
- **Persistência:** mesmas tabelas e contrato v3, sem migração de dados. XP, privacidade e limites permanecem
  os da seção 4. Recorrência continua sendo ocorrências explícitas, não eventos gerados pelo motor visual.

Referências da pesquisa: [Notion Calendar](https://www.notion.com/help/manage-your-calendars-and-events),
[Todoist — time blocking](https://www.todoist.com/help/todoist/get-started/time-blocking-in-todoist-d6Pf1uTpc),
[FullCalendar React](https://fullcalendar.io/docs/react), [interações](https://fullcalendar.io/docs/event-dragging-resizing)
e [licença](https://fullcalendar.io/license). O Schedule-X foi comparado, mas não adotado.

Arquivos da revisão: `Agenda.jsx` compõe calendário e planejamento; `AppointmentEditor.jsx`,
`AppointmentDetails.jsx` e `AgendaPanel.jsx` cuidam dos painéis; `calendar-model.js` adapta datas e eventos;
`saveAppointment` em `public/agenda-domain.js` prepara a gravação atômica do checklist.

### Verificação da revisão

- `npm.cmd test`: **265 passaram, 1 ignorado, 0 falhas**; inclui contratos Node e D1 local.
- `npm.cmd run build`: passou. Depois do build exercitado pela suíte, a única alteração de código
  foi remover um import sem uso; o build final foi repetido.
- `npm.cmd run test:e2e`: **126 passaram, 2 ignorados, 0 falhas**, em 8,1 minutos. Os dois ignorados
  são gestos de mouse exclusivos do computador; criação por toque, editor, checklist e recuperação
  de falhas foram exercitados também no celular. Inclui seleção na grade, duração proporcional,
  sobreposição, arrasto, redimensionamento, escopo de série e tarefa arrastada sem duplicação.
- `node scripts/test-agenda-desktop.mjs`: Electron minimizado, uma notificação criada e exibida,
  zero erros e nenhuma reivindicação duplicada.
- Revisão visual local em Azul/Roxo × claro/escuro: três eventos em cada combinação, sem estouro
  horizontal ou erros JavaScript. Capturas do calendário e do editor foram revisadas; os testes
  usam contextos novos e a revisão local bloqueou o service worker.
- 51 links locais da documentação conferidos, sem arquivos ausentes. Mudanças locais, sem publicação.

## 10. Revisão de UI/UX — 06/11/2026

Revisão aprovada pela responsável em 06/11/2026, sem mudar XP, privacidade, limites ou esquema.

- **Leitura da grade:** faixas de 30 minutos mais altas (`slotMinHeight`), título em até duas linhas e horário
  só em eventos longos; o horário completo fica no `title`. A rolagem inicial vai para perto da hora atual,
  sem esconder o início de um compromisso de hoje.
- **Tipos distinguíveis:** Estudo, Prova, Entrega e Pessoal têm cor própria (`--cat-*` em `agenda.css`, derivadas
  de `--lume`, `--danger`, `--reward` e `--success`) e ícone. Os filtros servem de legenda; canceladas ficam
  ocultas por padrão, com filtro próprio. Filtros valem só para a página aberta.
- **Cabeçalho compacto:** título, Para agendar, sino de Lembretes (menu suspenso) e Novo compromisso numa linha;
  navegação ‹ Hoje › agrupada; com a navegação inferior (≤ 820 px), Novo compromisso vira botão flutuante.
  O texto de ajuda fixo saiu: a orientação aparece só com a Agenda vazia, flutuando sobre a grade.
- **Visões:** Dia, 3 dias, Semana, Mês e Lista (plugin `list` do mesmo pacote). Toque longo de 400 ms para
  arrastar no celular.
- **Criação rápida:** no computador, selecionar um horário ou soltar uma tarefa abre um popover não modal junto
  ao ponto escolhido (título, horário e Salvar). Uma nova seleção substitui o rascunho; Mais opções abre o
  painel completo com os dados preenchidos. No celular continua o painel inferior.
- **Horários em 24 h:** início e fim são listas de 15 minutos, independentes do idioma do navegador; o fim
  mostra a duração, e mudar o início preserva a duração. O fuso é escolhido numa lista IANA.
- **Repetição:** semanal por dias da semana e término por número de ocorrências ou por data final
  (`occurrenceDates`), ainda limitada a 52 ocorrências e só na criação. Os dias escolhidos não são gravados:
  a série continua sendo ocorrências explícitas.
- **Excluir e desfazer:** `deleteAppointment` remove o horário (esta ocorrência ou esta e as futuras pendentes),
  sem apagar as tarefas do checklist, que voltam a Para agendar. Mover por arrasto e excluir mostram aviso
  com Desfazer por 8 s (`restoreAppointments`, mesma revisão otimista e gravação em batch).
- **Detalhes:** Editar e Excluir à vista; Encerrar, Cancelar e Mover pendências ficam em Mais ações, cada um
  com a explicação do efeito.
- **Movimento:** tokens `--ease-out`, `--ease-spring`, `--dur-fast` e `--dur-base`. Painéis entram deslizando
  (`@starting-style`), o popover cresce a partir do horário, o bloco salvo ou movido assenta uma vez (Web
  Animations, sem redesenhar eventos), o período desliza alguns pixels na direção da navegação, o seletor de
  visão desliza (`motion`), o check do checklist é desenhado e a barra de progresso avança, com brilho único
  ao completar. Nada repete em ciclo; encerrar atividade não tem celebração, porque não é conclusão de estudo.
- **Cuidados técnicos:** o FullCalendar guarda a posição da grade; nada acima dela pode mudar de altura depois
  de montada (o aviso de Agenda vazia e os Lembretes flutuam), senão arrastos usam coordenadas antigas.
  O aviso em saída não intercepta cliques.

Pendente: horário habitual de estudo destacado na grade (`businessHours`) depende de uma configuração de
janelas de disponibilidade, que a decisão 5 da seção 4 deixou fora desta versão. Um compromisso sem
horário continua contando como sobreposição com tudo do mesmo dia (regra do domínio, não alterada).

## 11. Revisão de UI/UX — 08/11/2026

Revisão de diagramação e consistência, sem mudar XP, privacidade, limites ou esquema.

- **Arrasto no mês:** um bloco com horário pode ser arrastado entre dias do mês; como a célula mostra
  apenas o dia, a gravação remove início e fim (`calendarPatch(..., { month: true })`). O evento passa a
  ocupar o dia inteiro, e o Desfazer continua disponível. O mês usa altura própria, menor que a semana,
  para não abrir células vazias muito altas.
- **Tarefas:** a prioridade é editada no próprio seletor, sem repetir o texto no metadado; ações ficam
  agrupadas (Agendar/Remover) e as subtarefas usam remoção por ícone com rótulo acessível, em vez de um
  "Remover" solto no fim da linha. Em telas estreitas, seletor e ações ocupam uma linha própria.
- **Formulários:** campos em linha usam `.form-grid`, com colunas de largura mínima igual e uma coluna no
  celular. O formulário do GitHub deixou de herdar a coluna do `.card-surface` e ficou compacto.
- **Mensagens e estado:** erros usam `.form-error`; falhas de gravação usam `.form-error-block` com a ação
  de repetir. O ícone do estado vazio acompanha o contexto (podium, users, mail, trophy, history etc.).
- **Consistência visual:** filtros ativos usam `--action` com texto `--action-ink`, inclusive no Ranking;
  no celular os filtros da Biblioteca rolam em uma linha. Configurações foram redistribuídas em duas
  colunas equilibradas. Espaçamento e alvos de toque usam os tokens `--space-*` e `--actions-gap`.
- **CSS legado:** foram removidos seletores mortos de `home.css`, `personal.css`, `shared-profile.css`,
  `shell.css` e `41-responsivo.css`, além de regras duplicadas de tarefas/subtarefas. Cores fixas de
  overlay, medalhas e perigo passaram a tokens (`--media-ink`, `--media-scrim`, `--medal-*`, `--danger-ink`).
