# Lume — estado atual e continuidade de desenvolvimento

Atualizado em 05/11/2026. Este é o mapa do código existente. As lacunas ficam somente em
[Implementação](IMPLEMENTACAO.md), as propostas em [Evolução](EVOLUCAO.md), as regras em
[Produto](PRODUTO.md) e [Gamificação](GAMIFICACAO.md), e a execução arquitetural em
[Refatoração](REFATORACAO_01112026.md). O histórico das rodadas anteriores permanece no Git.

## 1. Resumo para outra IA

Lume é uma plataforma social de estudos: biblioteca, continuidade, amigos, mensagens diretas,
colaboração, conquistas e ranking. Comunidades, servidores, canais e grupos estão fora desta etapa.
Preparar, abrir, organizar ou conversar não gera XP. A sessão é declarada, não prova de estudo.
Leia `AGENTS.md` e os documentos de produto antes de alterar comportamento.

## 2. Arquitetura vigente

```text
Telas React → ações nomeadas → useLibraryPersistence → /api/library/actions
                                                        ↓
                                   revisão + biblioteca + progresso + XP
                                              no mesmo batch
                                                        ↓
                                          SQLite local / D1
```

- Astro gera `dist/`; `src/pages/index.astro` monta React. Hashes, abas e títulos vêm de
  `src/app/routes.jsx`. `App.jsx` compõe casca, rotas e modais registrados.
- `useLume` compõe `useAccountSession`, `useLibraryPersistence` e `useXp`. As telas recebem
  ações nomeadas por funcionalidade, aplicadas sobre o estado mais recente. Uma ação bloqueada
  devolve `null`, preservando o formulário.
- `api/app.js` reúne rotas e tratamento de erros. `server.js` e `worker.js` são adaptadores;
  ambos usam os mesmos módulos em `api/domain/` e as regras compartilhadas em `public/`.
- `GET /api/library` lê a biblioteca; `POST /api/library/actions` grava por entidade, com
  revisão otimista e idempotência. Falha permite repetir o mesmo id; conflito exige recarga.
  Requisições em andamento são serializadas somente em memória.
- `0012_library.sql` persiste materiais, unidades, progresso, tarefas, sessões e preferências.
  Não há migração de dados: documentos antigos permanecem no banco como arquivo (`user_state`) e a conta
  entra com uma biblioteca nova e vazia. Escritas legadas sobre bibliotecas novas recebem `client_outdated`. Não há IndexedDB, fila offline ou reconciliação
  de documentos no navegador. A prévia dura somente enquanto a página está aberta.
- `material-model.js` define materiais com `units` no domínio, transporte v3 e banco.
  `materialSteps`, `materialStructure` e `materialLesson` são visualizações derivadas:
  nenhum material mantém `steps`, `structure` ou `selection` em paralelo.
- `state.progress` é o registro único de conclusões/preparações, com origem e `revertedAt`.
  `library-actions.js` e `library-time.js` gravam progresso, XP e conquistas atomicamente.
  `xp_events` é a autoridade do ranking; valores e limites vêm de `xp-policy.js`.
- Amigos, Mensagens, Ranking, Colaboração e Desktop usam `src/lib/resources.js`, com cache,
  revalidação ao montar, intervalo compartilhado e isolamento entre contas.
- CSS das funcionalidades fica junto delas; tokens, base, diálogos, responsividade e tema
  ficam em `src/styles/`. `lume.css` é o manifesto explícito da cascata, empacotado com hash.
  Espaçamento, campos em linha e mensagens de erro usam `--space-*`, `.form-grid` e `.form-error`.

## 3. O que existe

| Área | Implementado no código |
| --- | --- |
| Conta | Cadastro, login, saída, cookie HttpOnly, recuperação por token e Resend opcional |
| Onboarding | Três jornadas, perguntas próprias, retomada, primeira atividade e preferências sem XP |
| Biblioteca | Busca, filtros, tipos, criação, edição, exclusão confirmada, pausa e posição manual |
| Cursos | Importação por link/texto/arquivo/página copiada/extensão, revisão e reimportação que preserva ids e progresso |
| Próxima ação | Hoje, Biblioteca, diálogo, roteiro, perfil e Desktop usam o critério de `study-plan.js`; `nextMission` foi removido |
| Plano | Disponibilidade, prazos, prioridades, cronograma derivado, conflitos explicados e adiamento |
| Agenda | FullCalendar Standard: semana no computador, dia no celular e mês; criação na grade, arrasto/redimensionamento (no mês, arrastar move o dia e remove o horário), editor contextual com checklist por item, painel Para agendar, recorrência finita e sugestões revisáveis; persistência por conta em `agenda_entries` |
| Tarefas | Prazo, prioridade, vínculo com aula e subtarefas; concluir tarefa vinculada conclui a aula, sem XP próprio; sem vínculo, 0 XP |
| Lembretes da Agenda | Consulta autenticada com reivindicação única por conta (`agenda_reminders`); avisos internos e canal Notification do computador; requer site/app executando e rede |
| Sessão | Início, pausa, retomada, batimentos e encerramento; sobras de tempo, sobreposição e teto tratados no servidor |
| Slides | Editor, ordem, imagens, navegação por teclado e conclusão confirmada com cobertura do deck |
| XP | Livro idempotente, bônus, tempo, extrato e correção por ajuste negativo; saldo legado separado |
| Conquistas | Marcos personalizados por material e disciplina; disciplina completa recebe 200 XP uma vez |
| Cargos | Títulos por nível e marcos, calculados no servidor e exibidos no perfil; sem bloqueios funcionais |
| Amigos | Convites de sete dias, aceite, lista, remoção e perfil com escolhas de compartilhamento |
| Mensagens | Conversas entre amizades, referências, histórico, não lidas, bloqueio e preferência de notificação |
| Ranking | Nível, cursos e empenho semanal/mensal; opt-in, empates, período/fuso e legado fora |
| GitHub | Leitura pública de README, issues e milestones; sugestões revisáveis de entregas |
| Colaboração | Convite por entrega, aceite/recusa e cancelamento; sem copiar projeto ou conceder XP |
| Backup | Exportação e restauração explícita do formato v3 com prévia; versões antigas recusadas, sem conversão |
| Aparência | Azul/Roxo, claro/escuro, tamanho do texto e cores por função; logo preservado |
| Desktop | Lume completo em Electron, bandeja, pareamento, presença opcional, atualização e Discord |

A presença não é atividade validada. Importação e conclusão observada pela plataforma dependem das
capacidades declaradas por provedor; não há rastreamento universal. O Gran tem leitor próprio;
os testes das demais fontes usam exemplos. Consulte [Importação](IMPORTACAO.md).

A navegação tem seis destinos: Hoje, Biblioteca, Plano, Agenda, Amigos e Perfil. `#tarefas` pertence
à Agenda e preserva os registros; Plano mantém Cronograma e Roteiro. A Agenda é privada e não altera
as projeções de perfil. Escopo, decisões operacionais e evidências da rodada em [Agenda](AGENDA.md).

## 4. Execução local

- Windows: use `npm.cmd`/`npx.cmd` quando a política bloquear scripts PowerShell.
- `npm run dev`: Astro em 4321 e API em 4173; `LUME_API_PORT` muda API e proxy juntos.
- `npm start`: build e servidor de `dist/`; `npm run preview`: serve o build existente.
- `PORT` altera a porta do servidor estático. Reinicie-o após reconstruir: estáticos e CSP são lidos no boot.
- Contas locais ficam em `data/lume.db`; e2e usa bancos separados em `data/e2e-*`. Não apague `data/`.
- `npm test`: domínio, contratos Node/D1 local e testes do aplicativo. `npm run build`: Astro e CSP.
- `npm run test:e2e`: desktop e celular, um worker, build prévio. Não executar duas suítes em paralelo.
- Para aparência, limpe o service worker; assets antigos podem aparecer uma vez antes da atualização.

## 5. Verificação e publicação

A revisão arquitetural de 03/11 é local. Os commits iniciais são `9d51520` (persistência direta)
e `7236b08` (ações e hooks). Resultados finais desta rodada ficam no
[registro de execução](REFATORACAO_01112026.md#registro-de-execução), evitando contagens divergentes.

O contrato cobre Node e Worker local, incluindo 600 aulas e concorrência. Importação simulada não
comprova plataformas reais; D1 local não comprova CPU do Worker publicado. O cenário de mídia no
Worker é ignorado quando não há binding. E-mail real e R2 dependem da configuração de produção.

Site de referência: <https://lume.lume-prototype.workers.dev>. Não houve push, deploy, migração
remota ou release nesta revisão. Publicação exige pedido explícito; instruções em [Release](RELEASE.md).

## 6. Manutenção do contexto

- Atualize esta página somente quando a capacidade existir no código.
- Registre lacunas e decisões pendentes em [Implementação](IMPLEMENTACAO.md), sem duplicar sua lista aqui.
- Mudanças de recompensa exigem atualizar [Gamificação](GAMIFICACAO.md) e testes.
- Propostas não são aprovação; código antigo e screenshots não substituem a especificação.
