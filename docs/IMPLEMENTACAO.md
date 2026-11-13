# Lume — Estado Atual e Pendências de Implementação

Atualizado em 12/11/2026. Este documento consolida **o que já existe e foi verificado** no código e **o que ainda falta implementar ou validar em produção**. Para as regras de domínio e de produto, consulte [Regras de Negócio Consolidadas](REGRAS_DE_NEGOCIO.md).

---

## 1. O que já está implementado e verificado localmente

| Área | Situação atual | Principais módulos |
| --- | --- | --- |
| **Contas e sessão** | Cadastro, login, saída, cookie `HttpOnly` (`SameSite=Strict`), limite de tentativas e recuperação de senha via Resend (`api/domain/email.js`) | `api/domain/auth.js`, `src/features/account/Auth.jsx` |
| **Onboarding v2** | Três jornadas retomáveis, escolha de meta diária, ambiente sonoro (`off`, `rain`, `pink`, `white`), primeiro material ou PDF e convite de amigos | `src/features/account/Onboarding.jsx`, `public/domain.js` |
| **Persistência da Biblioteca v3** | Leitura em `GET /api/library` e gravação transacional por entidade em `POST /api/library/actions` com revisão otimista e idempotência (`0012_library.sql`) | `api/domain/library-store.js`, `api/domain/library-actions.js`, `src/features/library/useLibraryPersistence.js` |
| **Materiais, PDFs, Slides e Disciplinas** | Cursos, livros, provas, projetos, slides com cobertura mínima de 80%, disciplinas (`study_subjects`) e PDFs com upload para R2/`data/media` e leitor `pdf.js` embutido (`0015_subjects_pdf.sql`) | `public/material-model.js`, `public/pdf-domain.js`, `public/subject-domain.js`, `public/slides-domain.js` |
| **Importação e Extensão MV3** | Importação por link público, texto, página copiada ou captura da extensão (`extension/`); reimportação preserva IDs (`adoptExistingIds`); leitor dedicado do Gran | `public/import-domain.js`, `public/providers/`, `api/domain/import-server.js`, `extension/` |
| **Início (`#hoje`) e Próxima Ação** | Próxima ação unificada (`nextAction`/`studyPlan`), tarefa em foco (`focusTaskId`), ritmo da semana e atalhos para estudo e sessão de foco | `src/features/library/Study.jsx`, `public/study-plan.js` |
| **Sessão de Foco (`#foco`)** | Cronômetro declarado com pausa/retomada, ciclos, modo Zen de anotações rápidas, escudo de foco e gerador de som ambiente Web Audio | `src/features/progress/FocusSession.jsx`, `src/features/progress/soundscape.js`, `public/session-domain.js` |
| **Plano de Estudos, Agenda e Tarefas** | Cronograma derivado (`schedule-domain.js`), calendário interativo FullCalendar 7 (`Agenda.jsx`), recorrência até 52 ocorrências, lembretes únicos (`agenda_reminders`) e tarefas com subtarefas | `src/features/plan/`, `src/features/agenda/`, `public/schedule-domain.js`, `public/agenda-domain.js`, `public/tasks-domain.js` |
| **XP v2, Níveis, Conquistas e Cargos** | Livro `xp_events` validado no servidor, bônus de curso (300 XP) e disciplina (200 XP), blocos de tempo (30 XP / 25 min, teto 120/dia), subtarefas (10 XP, teto 50/dia) e cargos como títulos | `public/xp-policy.js`, `api/domain/xp.js`, `api/domain/rewards.js`, `api/domain/library-time.js`, `api/domain/library-subtasks.js` |
| **Social: Amigos, Mensagens, Colaboração e Ranking** | Convites de 7 dias, perfil com privacidade configurável, mensagens diretas com referências sanitizadas, bloqueio, colaboração em projetos e ranking em 3 abas | `api/domain/friends.js`, `api/domain/messages.js`, `api/domain/collaboration.js`, `src/features/social/` |
| **Conforto Visual e Aparência** | Paletas Azul (`moderno`) e Roxo (`variante2`), temas escuro/claro/suave, tamanho de texto (`normal`/`large`), densidade e som ambiente | `src/styles/00-tokens.css`, `src/app/Shell.jsx`, `src/app/modals.jsx`, `public/settings-domain.js` |
| **Backup e Mesclagem v3** | Exportação JSON v3 e restauração/mesclagem explícita com prévia | `public/backup-domain.js`, `public/merge-domain.js` |
| **Aplicativo de Desktop (`companion/`)** | Janela Electron completa, bandeja, lembretes minimizados, pareamento por código, presença opcional por allowlist, Rich Presence no Discord e atualizador | `companion/` |

---

## 2. O que falta verificar em produção (`lumeacademy.site`)

1. **Migrações remotas D1 e armazenamento R2 (`0012` a `0015`):**
   - Confirmar a aplicação de todas as migrações recentes no D1 remoto (`npx wrangler d1 migrations apply lume --remote`) e validar o upload real de avatares, capas, imagens de slides e arquivos PDF no bucket R2 `lume-media` (`env.MEDIA`), bem como o `Content-Type` JavaScript para o worker `pdf.worker.*.mjs`.
2. **Entrega real de e-mail transacional (Resend):**
   - Confirmar a verificação do domínio `lumeacademy.site` no painel do Resend e testar o recebimento real do e-mail de recuperação de senha em produção.
3. **Orçamento de CPU do Cloudflare Workers Free (`BCRYPT_ROUNDS=6`):**
   - Medir cadastro, login e redefinição de senha no Worker publicado (incluindo partidas frias) para confirmar ausência de erros `exceededCpu`.

---

## 3. O que falta implementar (Backlog de Produto)

1. **Gestão completa da conta e privacidade (LGPD):**
   - Alteração de senha e de e-mail com a sessão aberta (encerrando outras sessões ativas).
   - Listagem e revogação remota de sessões ativas.
   - Página de Termos de Uso, Política de Privacidade geral e botão de exclusão definitiva da conta (apagando ou anonimizando dados, mensagens, amizades e arquivos R2).
2. **Extensão do navegador em plataformas adicionais e cursos grandes:**
   - Testar a extensão MV3 carregada no Chrome real com contas reais além do Gran (Estratégia, Alura, Udemy, Coursera, Rocketseat, DIO, Hotmart) e criar leitores dedicados conforme necessário.
   - Ampliar ou paginar o limite atual de 600 unidades por operação na importação para suportar cursos preparatórios extensos.
3. **Escolha de conquistas em destaque no perfil:**
   - Permitir selecionar quais conquistas aparecem em destaque na vitrine do perfil social.
4. **Segurança social e reconhecimento entre amigos:**
   - Mecanismo de denúncia de abuso em mensagens diretas.
   - Reações/reconhecimento em conquistas de amigos e registro de contribuição individual em projetos colaborativos.
5. **Assinatura de código do instalador Windows (`companion/`):**
   - Configurar certificado (`CSC_LINK` e `CSC_KEY_PASSWORD`) no GitHub Actions para evitar o aviso do Windows SmartScreen no `Lume-setup.exe`.
