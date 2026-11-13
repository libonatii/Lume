# Lume — Regras de Negócio Consolidadas

Este documento é a **fonte única de verdade das regras de negócio e de produto em vigor** no Lume (atualizado em 12/11/2026). Substitui os documentos históricos da v1/v2 e orienta qualquer pessoa ou IA que assuma a manutenção ou evolução do projeto, eliminando ambiguidades entre o protótipo inicial (v1), o documento intermediário (v2) e a arquitetura atual (**persistência direta da biblioteca v3 + política de XP v2 validada no servidor**).

Consulte também:
- [Instruções técnicas e arquitetura (`AGENTS.md`)](../AGENTS.md)
- [Estado atual e pendências de implementação (`docs/IMPLEMENTACAO.md`)](IMPLEMENTACAO.md)
- [Publicação e CI (`docs/RELEASE.md`)](RELEASE.md)
- [Aplicativo de desktop (`companion/README.md`)](../companion/README.md)
- [Extensão do navegador (`extension/LEIAME.md`)](../extension/LEIAME.md)

---

## 1. Diretrizes Gerais e Identidade do Produto

1. **O que é o Lume:** plataforma social de estudos voltada à continuidade de materiais, organização do ritmo pessoal, estudo focado, amigos, mensagens diretas, colaboração em projetos, conquistas e placares de estudo.
2. **Inclusão e conforto sensorial:** o produto atende pessoas neurodivergentes e qualquer estudante que precise retomar estudos sem sobrecarga. Oferece personalização visual e sonora, divisão em pequenos passos e pausas sem punição, convivendo com gamificação substancial e recursos sociais opcionais.
3. **Sem viés de sustentabilidade/ecologia:** o look and feel, os ícones e os textos da aplicação **não** usam metáforas ecológicas, botânicas ou de "sustentabilidade" (nada de termos como *"sustentável"*, *"cultivar"*, nem ícones de broto/folha/árvore `sprout`, `leaf`, `tree`). Use vocabulário direto de estudo e constância: **ritmo constante**, **ritmo equilibrado**, **construir o hábito**, **continuidade** e **foco sem sobrecarga**.
4. **Limites éticos e clínicos:** nenhum registro de tempo, conclusão ou XP pode ser descrito como prova de aprendizado, compreensão, atenção, inteligência ou benefício clínico.
5. **Escopo social:** o social restringe-se a **amigos** (amizade mútua por convite), **mensagens diretas** entre amizades aceitas, **colaboração em projetos** e **ranking entre amigos**. Comunidades, servidores, canais e grupos públicos estão fora do escopo.

---

## 2. Mapa de Versões (O que está em vigor vs. O que foi aposentado)

| Eixo | Versão atual em vigor | Onde vive no código | O que foi aposentado (NÃO reintroduzir) |
| --- | --- | --- | --- |
| **Estado e Biblioteca** | **Estado v3** (`version: 3`, persistência por entidade em tabelas relacionais) | `public/domain.js`, `public/material-model.js`, `api/domain/library-store.js`, `api/domain/library-actions.js` | Estado v1 (`completedLessons`, `xpLog`, `studyLog`) e sincronização por documento inteiro/IndexedDB/outbox no navegador (`outbox.js`, `useProgressSync.js`). |
| **Política de XP e Níveis** | **Política de XP v2** (`XP_POLICY_VERSION = 2`, validada no servidor via livro `xp_events`) | `public/xp-policy.js`, `api/domain/xp.js`, `api/domain/rewards.js`, `api/domain/library-time.js`, `api/domain/library-subtasks.js` | Política v1 (5 XP por preparar a mesa, 10 XP fixo por etapa ou tarefa de prova, nível linear a cada 100/500 XP, cálculo de XP confiando no navegador). |
| **Sessão de Foco e Som** | **Redesign Sereno (`FocusSession.jsx`)** com paisagens sonoras `'off'`, `'rain'`, `'pink'`, `'white'` | `src/features/progress/FocusSession.jsx`, `src/features/progress/soundscape.js`, `public/session-domain.js` | Barra antiga `StudySession.jsx` / `session.css` e ids legados de som `'noise'` / `'library'` (normalizados automaticamente para `'white'` e `'pink'`). |
| **Onboarding** | **Onboarding v2** (`Onboarding.jsx`, retomável até 8 passos) | `src/features/account/Onboarding.jsx`, `public/domain.js` (`normalizeOnboarding`, `completeJourney`) | `OnboardingFields.jsx` e constantes órfãs `SESSION_MINUTES`, `CONTINUITY_OBSTACLES` e `TRACKING_PREFERENCES`. |

> **Rotas HTTP de compatibilidade:** `/api/state`, `/api/progress` e `/api/xp/complete|bonus|slides|time` permanecem no servidor **exclusivamente** para contas antigas ainda não convertidas e para a suíte de testes de contrato/migração. Contas já migradas para a biblioteca v3 recebem erro `409 client_outdated` se tentarem gravar por essas rotas antigas. Todo fluxo novo do cliente React usa `GET /api/library` e `POST /api/library/actions`.

---

## 3. Contas, Autenticação e Prévia Local

1. **Cadastro e Login (`api/domain/auth.js`):**
   - E-mail é normalizado com `trim().toLowerCase()`.
   - Senha exige entre **8 e 72 bytes UTF-8** (limite exato do bcrypt, sem truncamento silencioso).
   - Senhas novas usam `bcryptjs` (custo configurável por `BCRYPT_ROUNDS`, padrão 6 para caber no orçamento de CPU do Cloudflare Workers Free). Hashes PBKDF2 legados continuam aceitos no login e migram na redefinição de senha.
   - Sessão usa cookie `HttpOnly`, `SameSite=Strict` (`Secure` em produção), armazenando apenas o hash SHA-256 do token no banco (`sessions`).
2. **Recuperação de senha:**
   - Gera token de uso único (validade de 30 minutos); ao redefinir a senha, todas as sessões anteriores da conta são revogadas.
   - Com `RESEND_API_KEY` e `EMAIL_FROM`, envia e-mail transacional (`api/domain/email.js`). Sem provedor configurado, nunca expõe o link na resposta HTTP de produção (`SHOW_RESET_LINK="false"`).
3. **Prévia sem conta (`useAccountSession.js`):**
   - Permite experimentar a interface apenas na memória da aba aberta.
   - Não persiste estudo em `localStorage` nem `IndexedDB`. Ao criar conta ou entrar, a conta inicia com biblioteca própria no servidor.

---

## 4. Biblioteca, Materiais, Unidades e Disciplinas (Estado v3)

1. **Estrutura de um Material (`public/material-model.js`, `public/domain.js`):**
   - Tipos suportados (`COURSE_TYPES`): `'course'` (Curso / videoaulas), `'book'` (Livro / leitura), `'pdf'` (PDF anexado), `'slides'` (Apresentação de slides), `'exam'` (Prova / edital) e `'project'` (Projeto prático).
   - No domínio v3 e no banco (`materials` + `units`), um material possui **apenas `units`** (lista plana ordenada de unidades com `id`, `kind`, `title`, `disciplineTitle`, `moduleTitle`, `durationSeconds`, `durationMinutes`, `externalId`, `sourceUrl`, `included`, `origin`).
   - **Proibido gravar `steps`, `structure` ou `selection` dentro do objeto de material.** As visões de etapas (`materialSteps`), árvore (`materialStructure`) e aula ativa (`materialLesson`) são **sempre derivadas** em memória por `public/material-model.js`.
2. **Disciplinas (`public/subject-domain.js`, tabela `study_subjects`):**
   - Coleção `state.subjects` (`id`, `title`, `color`, `order`), operada via ações `subject.put`, `subject.delete` e `subject.order`.
   - Um material pode apontar para `subjectId`. Excluir uma disciplina remove o vínculo (`subjectId: null`) dos materiais, sem apagar os materiais.
3. **PDFs anexados (`public/pdf-domain.js`, `api/domain/library-files.js`):**
   - Material `type: 'pdf'` tem uma única unidade de leitura (`kind: 'reading'`), metadados em `course.pdf` (`fileId`, `name`, `size`, `pages`, `outline`, `uploadedAt`), ponto de retomada em `course.reading` (`page`, `maxPage`, `section`, `updatedAt`) e marcações em `course.highlights`.
   - **Retomada (12/11/2026):** o leitor abre sozinho logo depois de anexar, então ficar na p. 1 sem avançar não cria `reading`; o PDF continua "não iniciado" e com 0%. Registros antigos parados na p. 1 (`maxPage` 1) são descartados por `normalizeReading`. O percentual exibido é `maxPage / pages` (página mais adiante aberta), marcador de retomada e não prova de leitura.
   - **Marca-texto (12/11/2026):** no leitor, a pessoa liga o marca-texto, escolhe uma cor (`HIGHLIGHT_COLORS`: amarelo, verde, azul, rosa, laranja) e seleciona o texto da página; clicar numa marcação troca a cor, e a borracha a apaga. Cada marcação guarda `page`, `color`, `rects` em fração da página (acompanham o zoom) e o trecho de texto. Máximo de 500 marcações por PDF, normalizadas também no servidor (`library-actions.js`). Marcar texto não gera XP.
   - O binário do PDF vai via `PUT /api/library/files/:id` para o R2 / `data/media`, respeitando a cota do plano (`storage_plans` / `library_files`, 50 MB por arquivo e 1 GB por conta no plano gratuito). **Nunca guarde binário de PDF no estado JSON ou no navegador.**
   - `library-actions.js` recusa criar material PDF cujo `fileId` não exista na conta e remove o arquivo de mídia quando o material é excluído.
   - Chegar à última página não conclui o PDF: a conclusão é declarada em "Concluí a leitura do PDF" e vale a recompensa de leitura uma única vez, validada no servidor.
4. **Apresentações de Slides (`public/slides-domain.js`):**
   - Materiais `type: 'slides'` rastreiam slides visitados (`visitedSlides`), slide atual (`currentSlide`) e total (`slideCount`).
   - Para elegibilidade de XP de apresentação concluída, exige cobertura mínima de **80% dos slides** (`SLIDES_MIN_COVERAGE = 0.8`) **e** passagem pelo último slide.
5. **Persistência e Revisão Otimista (`api/domain/library-store.js`, `api/domain/library-actions.js`):**
   - Cada envio para `POST /api/library/actions` informa `baseRevision`, `clientOpId` (idempotência) e a lista de `operations`.
   - Se `baseRevision` divergir da revisão atual do banco, a API aborta o lote inteiro com `409 revision_conflict` e devolve o snapshot atualizado. Não há mesclagem implícita em conflito de revisão.
   - Repetir o mesmo `clientOpId` devolve o resultado já gravado sem duplicar efeitos nem XP.

---

## 5. Progresso de Estudo (`public/progress-domain.js`)

1. **Fonte única de progresso:**
   - Todo progresso de unidades vive exclusivamente em `state.progress` (tabela `study_progress`), como eventos `{ id, materialId, unitId, type: 'completion', origin, completedAt, revertedAt }`.
   - **Nunca** consulte ou recrie listas paralelas (`completedLessons`, `studyLog`, `xpLog`). Para saber se uma unidade está concluída, use sempre `isCompleted(state, materialId, unitId)` ou `completedUnitIds(state, materialId)`.
2. **Origens de conclusão (`COMPLETION_ORIGINS`):**
   - `'manual'`: marcada diretamente pela pessoa na interface (ou ao concluir tarefa vinculada / leitura de PDF).
   - `'integration'`: observada em reimportação de curso conectado ou leitura posterior da extensão, após confirmação na revisão.
   - `'imported'`: marcada já na **primeira** importação do curso. Conta como histórico de conclusão para a barra de progresso do material, mas **não concede XP** e **não pode ser desfeita como evento de XP**.
3. **Desfazer conclusão (`uncompleteStep`):**
   - Marca `revertedAt` no registro de progresso ativo.
   - No servidor (`api/domain/xp.js`), reverter uma conclusão que gerou XP grava um evento de ajuste negativo (`reversalOfEventId`) e revoga conquistas que dependiam exclusivamente daquela conclusão.

---

## 6. Política de XP v2, Níveis, Cargos e Conquistas (`public/xp-policy.js`, `api/domain/xp.js`)

1. **Autoridade do Servidor:**
   - O cálculo oficial de XP, nível e posição no ranking ocorre no servidor sobre o livro contábil `xp_events`.
   - O cliente nunca envia "quantos pontos quer ganhar"; envia operações de domínio (`/api/library/actions`), e o servidor avalia as regras elegíveis no mesmo batch transacional.
2. **Tabela de Recompensas (`XP_VALUES`):**
   - **Preparar a mesa (`preparation`):** `0 XP` (nunca premia cliques ou preparação).
   - **Aula concluída (`lesson`):** `100 XP` (1 vez por unidade elegível).
   - **Capítulo/leitura concluída (`reading`):** `100 XP` (1 vez por unidade elegível, incluindo PDF concluído).
   - **Etapa de prova/exercício (`exam_step`):** `120 XP` (1 vez por unidade elegível).
   - **Entrega de projeto (`project_step`):** `150 XP` (1 vez por unidade elegível).
   - **Apresentação de slides concluída (`slides_complete`):** `80 XP` (1 vez por apresentação, exigindo >= 80% de cobertura + último slide).
   - **Subtarefa concluída (`subtask_complete`):** `10 XP` (1 vez por `subtaskId` na vida da conta, respeitando o teto diário de **50 XP/dia** em `SUBTASK_DAILY_CAP_XP`).
   - **Bloco de tempo de foco (`study_time_block`):** `30 XP` a cada **25 minutos elegíveis** (`TIME_BLOCK_MINUTES = 25`), até o limite de **4 blocos por dia UTC (`120 XP/dia`)** (`TIME_DAILY_MAX_BLOCKS = 4`). Sobras de minutos acumulam entre sessões do mesmo dia, sem duplicar intervalos sobrepostos.
   - **Bônus de curso concluído (`course_complete_bonus`):** `300 XP` (1 vez por curso com **pelo menos 2 unidades**, quando todas as unidades incluídas foram concluídas por estudo elegível — `manual` ou `integration`).
   - **Bônus de disciplina concluída (`subject_complete_bonus`):** `200 XP` (1 vez por disciplina quando todas as unidades daquela disciplina são concluídas).
3. **Curva de Níveis (`LEVEL_XP`):**
   - Nível 1: `0 XP` · Nível 2: `100 XP` · Nível 3: `250 XP` · Nível 4: `450 XP` · Nível 5: `700 XP` · Nível 6: `1.000 XP` · Nível 7: `1.350 XP` · Nível 8: `1.750 XP` · Nível 9: `2.200 XP` · Nível 10: `2.700 XP`.
   - Acima do nível 10: incremento de `+600 XP` por nível (`AFTER_TEN_STEP = 600`).
   - O XP legado (`legacyXP`, anterior à política v2) é preservado separadamente no histórico da conta, mas **não soma no nível novo nem no ranking**.
4. **Cargos de Estudo (`public/domain.js` — `STUDY_TITLES`):**
   - Trilha geral (combina nível + marcos reais): **Iniciante** (nível 1), **Estudante Constante** (nível 2 + 3 sessões ou etapas), **Organizador de Rotina** (nível 4 + 10 etapas), **Construtor de Base** (nível 6 + 1 material completo), **Especialista em Progresso** (nível 8 + 2 materiais completos e 25 etapas), **Mestre da Continuidade** (nível 10 + 3 materiais completos e 5 dias ativos) e **Referência de Estudo** (nível 12 + 5 materiais completos e 50 etapas).
   - Trilhas paralelas por eixo: **Construção Prática** (*Explorador Prático* -> *Autor de Projetos* -> *Arquiteto de Soluções*) e **Domínio de Conteúdo** (*Leitor Atento* -> *Analista de Conteúdo* -> *Especialista de Domínio*).
   - **Regra inviolável:** cargos são **apenas títulos de reconhecimento**; nenhuma funcionalidade do Lume é bloqueada por cargo ou nível.

---

## 7. Roteiro, Plano de Estudos, Cronograma e Tarefas

1. **Roteiro e Próxima Ação (`public/study-plan.js`):**
   - `studyPlan(state)` e `nextAction(state)` determinam a fila de estudo priorizando:
     1. Tarefa colocada manualmente em foco (`state.focusTaskId`) se ainda estiver pendente;
     2. Materiais reais (nunca cursos de exemplo `sample: true`), priorizando primeiro passo de material recém-preparado e continuidade recente;
     3. Materiais pausados (`status: 'paused'`) ou concluídos saem da fila ativa, mas permanecem contabilizados na biblioteca.
   - **"Continuar agora" da Biblioteca (`resumeMaterial`, 12/11/2026):** segue a disciplina do material selecionado. Concluído o material, passa ao próximo pendente da mesma disciplina na ordem da biblioteca; só troca de disciplina quando a pessoa escolhe outro material (concluir um passo, "Continuar" ou avançar páginas de um PDF o seleciona). Disciplina toda concluída mostra "Disciplina concluída", sem pular para outra. Material sem disciplina segue o roteiro geral.
   - Se uma unidade não tiver duração conhecida da fonte, usa a estimativa da conta (`onboarding.answers.sessionMinutes` ou `DEFAULT_SESSION_MINUTES = 25`).
2. **Cronograma Semanal (`public/schedule-domain.js`):**
   - Derivado de `state.plan` (`availability` por dia da semana `0..6`, `goals` com `deadline` e `priority` por material, e mapa `postponed`).
   - Sem disponibilidade declarada, o cronograma **não inventa datas**.
   - **Tela (12/11/2026):** o painel "Disponibilidade e prazos" saiu do Plano de Estudos por decisão da responsável. Sem disponibilidade, o Plano oferece só o atalho de segunda a sexta (`useSuggestedAvailability`); prazos e prioridades já gravados continuam valendo, e o alerta de conflito segue com suas opções.
   - Se o volume de aulas até o prazo exceder os minutos disponíveis, gera um alerta de conflito com os números exatos e opções aplicáveis (estender prazo ou ajustar minutos diários), sem alterar nada sozinho.
   - Adiar uma aula move a aula para depois da janela atual e desloca as aulas seguintes do mesmo curso na sequência.
3. **Tarefas e Subtarefas (`public/tasks-domain.js`):**
   - Tarefas têm `id`, `title`, `courseId` (opcional), `lessonId` (opcional), `dueDate` (opcional), `priority` (`'none' | 'low' | 'medium' | 'high'`), `done` e `subtasks` (`id`, `title`, `done`).
   - Criar, focar, editar, priorizar ou excluir tarefa **não gera XP**.
   - Concluir uma tarefa **sem** `lessonId` vinculado concede **0 XP**.
   - Concluir uma tarefa **com** `lessonId` vinculado conclui a unidade correspondente (se ainda não concluída) e aciona a recompensa padrão daquela unidade uma única vez no servidor. Reabrir tarefa não desfaz a aula concluída.

---

## 8. Agenda, Calendário e Lembretes (`public/agenda-domain.js`)

1. **Compromissos (`state.appointments`, tabela `agenda_entries`):**
   - Compromissos guardam `id`, `title`, `courseId`, `date` (data civil `YYYY-MM-DD`), `startTime` / `endTime` (opcionais, `HH:MM`), `timezone`, `recurrence` (`none`, `daily`, `weekly`, `monthly`), `taskIds` (referências a tarefas existentes), `checklist` por ocorrência e `remindBeforeMinutes`.
   - Agendar uma tarefa referencia o `taskId` existente sem duplicar nem alterar o prazo, vínculo ou subtarefas da tarefa original.
   - Recorrência gera até **52 ocorrências**; editar ou cancelar ocorrências futuras preserva o histórico das passadas e concluídas.
   - Sobreposição de horários exibe aviso informativo sem impedir o salvamento.
2. **Regras de XP e Privacidade da Agenda:**
   - Encerrar um bloco da Agenda **não conclui tarefas automaticamente** e **não concede XP**.
   - Recorrências vinculadas à mesma aula concluem a aula apenas uma vez.
   - A Agenda é estritamente privada e **nunca entra no perfil social entre amigos**.
3. **Lembretes (`POST /api/agenda/reminders`, tabela `agenda_reminders`):**
   - Cada lembrete é reivindicado de forma transacional uma única vez por conta/ocorrência para evitar notificações duplicadas entre abas ou entre navegador e aplicativo de desktop. Compromisso sem horário usa `09:00` no fuso do compromisso como referência.

---

## 9. Sessões de Foco e Conforto Sensorial (`public/session-domain.js`, `public/settings-domain.js`)

1. **Sessão de Estudo (`state.activeSession` e `state.studySessions`):**
   - Começar, pausar, retomar ou encerrar uma sessão declara tempo dedicado; começar outra sessão encerra e salva a anterior automaticamente.
   - Sessões esquecidas abertas são pausadas ao carregar e limitadas ao teto de **12 horas** (`MAX_SESSION_SECONDS = 43200`) para não inflar o relógio.
   - `minutesByDay` e `weeklyRhythm` somam os minutos declarados por dia local (incluindo a sessão ativa). Sem dados na semana anterior, a comparação percentual fica nula (não inventa porcentagem).
2. **Preferências e Conforto Visual (`state.preferences`):**
   - `palette`: `'moderno'` (exibida como **Azul**) ou `'variante2'` (exibida como **Roxo**). Aplicada em `html[data-palette]`. O logo do Lume preserva suas cores originais em qualquer paleta.
   - `theme`: `'dark'` (Escuro), `'light'` (Claro) ou `'Soft'` (Suave). Aplicado em `html[data-theme]`.
   - `density`: `'minimal'` (Essencial) ou `'balanced'` (Equilibrada).
   - `textSize`: `'normal'` (Padrão) ou `'large'` (Maior).
   - `motion`: `'normal'` ou `'reduced'` (Reduzir animações).
   - `soundscape`: `'off'` (Silêncio), `'rain'` (Chuva suave), `'pink'` (Ruído rosa) ou `'white'` (Ruído branco). Valores legados `'library'` e `'noise'` são convertidos automaticamente para `'pink'` e `'white'`.

---

## 10. Social: Amigos, Perfil, Mensagens, Colaboração e Ranking

**Tela Social e feed entre amigos (12/11/2026):**
   - Social substitui o nome Amigos na navegação, preservando `#amigos` e seus links de convite. Reúne feed, lista de amigos, convites e acesso a Mensagens e Ranking, com o CSS e os botões compartilhados do Lume. Referência visual: projeto Stitch `5451832634560597098`, tela `c6ca3f9cb11c4bc7a2afc1dd447a81f9` (cópia em `designs/stitch/lume-social/`).
   - Publicações são explícitas e persistidas em `social_posts`; texto até 2.000 caracteres, comentários até 1.000 em `social_comments` e uma reação por pessoa/publicação em `social_reactions`. IDs de envio impedem duplicar publicações e comentários ao repetir uma requisição. O feed é cronológico e paginado; não publica atividades automaticamente nem inventa presença ou pessoas de exemplo.
   - Uma publicação aceita um PDF de até 10 MB, uma imagem PNG/JPG/WebP/GIF de até 2 MB ou uma conquista própria validada pelo servidor. Arquivos são cópias enviadas explicitamente para R2/`data/media`, com cota social de 100 MB por conta, separada da biblioteca. Nunca publica o arquivo privado da biblioteca por referência. Excluir a publicação remove o objeto e libera a cota. Conquista corrigida deixa de ser exibida como válida.
   - A API revalida amizade mútua e bloqueios ao listar, comentar, reagir e abrir/baixar cada anexo. Remoção de amizade ou bloqueio encerra o acesso. Não há feed público, grupos ou compartilhamento por URL pública. O autor exclui sua publicação e pode remover comentários nela; cada pessoa também pode remover seus próprios comentários.
   - Fotos de perfil: Feed, Amigos, Mensagens (lista e conversa) e Ranking devolvem `avatar` lido de `account_documents` (`$.profile.avatar`) e saneado por `sanitizeProfileImage`; sem foto válida, o cliente mostra as iniciais (`PersonAvatar` em `src/ui/ui.jsx`).
   - Publicações, downloads, comentários e reações não concedem XP. As escolhas de visibilidade do perfil continuam independentes: escrever no feed é uma escolha explícita de compartilhar aquele conteúdo com amigos.

1. **Amizades (`api/domain/friends.js`):**
   - Amizade exige convite e aceitação mútua (por código/link de convite de 7 dias). Bloqueio ou remoção encerra a amizade e revoga convites pendentes.
2. **Privacidade do Perfil (`public/profile-domain.js`):**
   - O perfil controla visibilidade por chave (`showLibrary`, `showQueue`, `showProgress`, `showXP`, `showRanking`, `showActivity`).
   - E-mail, hashes de senha, sessões, compromissos da Agenda, tarefas pessoais e URLs privadas **nunca** saem no payload de perfil para amigos.
3. **Mensagens Diretas (`api/domain/messages.js`):**
   - Permitidas exclusivamente entre contas com amizade aceita (`status = 'accepted'`).
   - Referências anexadas (`course`, `lesson`, `project`, `achievement`) passam por sanitização que remove URLs externas ou privadas.
   - **Aviso de mensagem nova (13/11/2026):** quando o contador de não lidas sobe, um aviso flutuante no canto inferior direito mostra foto (ou iniciais), nome e o começo do texto da conversa mais recente (`messageAlert` em `public/social-domain.js`, `src/features/social/MessageAlert.jsx`). Clicar abre `#mensagens?com=<id>`; fecha pelo botão ou sozinho em 8 s (espera enquanto o ponteiro está em cima). Não aparece com a conversa daquela pessoa aberta, com as notificações de mensagens desligadas, durante sessão de foco com Escudo de foco, nem para mensagens que já estavam não lidas ao abrir o Lume. Cada mensagem avisa uma vez. Voltar à janela confere o contador na hora.
4. **Colaboração em Projetos (`api/domain/collaboration.js`):**
   - Permite convidar um amigo para colaborar em um material do tipo `'project'`.
   - Aceitar um convite de colaboração **não copia** o projeto para a biblioteca privada da outra pessoa; mantém o acesso vinculado ao projeto compartilhado enquanto a colaboração estiver ativa.
5. **Ranking entre Amigos (`api/domain/xp.js`):**
   - Possui três classificações obrigatórias:
     1. **Nível acumulado (`level`):** ordenado por XP válido da política v2;
     2. **Cursos concluídos (`courses`):** quantidade de cursos distintos elegíveis concluídos;
     3. **Empenho no período (`period`):** XP conquistado nos últimos 7 ou 30 dias.
   - Respeita empates compartilhados (mesma posição para valores iguais) e a preferência `showRanking` (quem desativa não aparece no placar compartilhado).
6. **Sino de notificações (13/11/2026, `api/domain/notifications.js`, `public/notifications-domain.js`):**
   - O sino do cabeçalho abre um painel (não navega mais para Mensagens) com: amizade nova, convite de colaboração pendente, comentário e curtida de outra pessoa nas suas publicações e novidades do Lume (`LUME_NEWS`, editadas no código). Mensagens diretas continuam no contador do menu Social e no aviso flutuante.
   - Janela de 30 dias, até 30 itens, mais recentes primeiro. Contatos bloqueados não notificam. Não há tabela de eventos: os avisos são lidos das tabelas existentes, e só o marco `notification_reads.seen_at` é gravado (`GET /api/notifications`, `POST /api/notifications/seen`).
   - Abrir o painel marca tudo como visto; o marco só avança. Sem marco, conta como novo apenas o que chegou depois da criação da conta. Notificação não gera XP.

---

## 11. Importação de Cursos, Extensão MV3 e Aplicativo de Desktop

1. **Provedores e Importação (`public/import-domain.js`, `public/providers/registry.js`):**
   - `public/providers/registry.js` é a única lista de domínios reconhecidos (`grancursos`, `estrategia`, `alura`, `rockeatseat`, `udemy`, `coursera`, `dio`, `hotmart`, `generic`).
   - Cada provedor declara suas capacidades reais (`syllabus`, `progress`, `resume`, `requiresLogin`). Fontes genéricas/desconhecidas **não** leem marcas de aula concluída.
   - O Lume nunca pede senha ou cookie de plataformas externas. Para cursos que exigem login, a pessoa usa a **extensão do navegador** (`extension/`) ou cola a página copiada da sua sessão.
   - Toda importação ou captura da extensão passa pela tela de revisão antes de gravar na biblioteca.
   - Na reimportação de um mesmo curso (`adoptExistingIds`), unidades já existentes preservam seus IDs internos (casando por `externalId` ou título normalizado), concluindo como `origin: 'integration'` apenas as novas conclusões observadas e confirmadas na revisão (`observedCompletionIds`).
2. **Backup e Mesclagem (`public/backup-domain.js`, `public/merge-domain.js`):**
   - Exportação e restauração trabalham exclusivamente com arquivos JSON no formato **v3** (`schema: 'lume-backup'`, `version: 3`). Backups v1/v2 são recusados com mensagem clara, sem migração automática.
   - A mesclagem (`mergeStates`) é explícita e idempotente, preservando materiais, progresso, tarefas e compromissos sem duplicar registros.
3. **Aplicativo de Desktop (`companion/`):**
   - É o Lume completo em janela Electron, com bandeja do sistema, lembretes em segundo plano (`backgroundThrottling: false`), atualização via GitHub Releases (somente HTTPS) e presença opcional por allowlist de processos e no Discord (`discord-presence.mjs`, ligada por padrão nas configurações do app, com rate-limit mínimo de 15s e limpeza ao pausar ou sair). Presença nunca conta como estudo nem concede XP.
