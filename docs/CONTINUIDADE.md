# Lume — estado atual e continuidade de desenvolvimento

Atualizado em 11/11/2026. Este é o mapa do código existente. As lacunas ficam somente em
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
- `0015_subjects_pdf.sql` acrescenta `study_subjects` (disciplinas, entidade `subject.put/delete/order`
  no mesmo batch), `library_files` (tamanho de cada PDF para a cota) e `storage_plans` (sem linha =
  plano gratuito). O arquivo do PDF fica em R2 (`env.MEDIA`) ou `data/media/pdfs/`, nunca no navegador.
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
| Conta | Cadastro, login, saída, cookie HttpOnly, recuperação por token e e-mail pelo Resend (configurado em `wrangler.jsonc`; sem a chave, o link vai só para o log) |
| Onboarding | Três jornadas, escolha de meta diária e ambiente sonoro, primeira matéria (caderno vinculado à disciplina ou PDF) e convite de amigos sem XP; quatro passos visíveis |
| Sessão de foco | `#foco`: ciclos sobre a sessão declarada, intenção ou tarefa em foco como nome da sessão, bloco de Anotações rápidas (modo Zen), Escudo de foco absoluto (silencia avisos não essenciais) e som de fundo gerado no aparelho; ciclos não geram XP |
| Agendar sessão | `#agendar`: cria compromisso de Estudo na Agenda com lembrete e tarefa vinculada opcional |
| Biblioteca | Busca, filtros por situação e tipo, "Continuar agora", seções de disciplinas, cursos e PDFs, criação, edição, exclusão confirmada, pausa e posição manual |
| Cursos | Importação por link/texto/arquivo/página copiada/extensão, revisão e reimportação que preserva ids e progresso |
| Próxima ação | Hoje, Biblioteca, diálogo, roteiro, perfil e Desktop usam o critério de `study-plan.js`; `nextMission` foi removido. Registrar a aula oferece "Concluir e abrir a próxima" (importada) e "Concluir e seguir para a próxima" (etapa manual); o curso importado aceita registrar em lote as aulas em aberto até uma escolhida, cada uma como registro manual |
| Carregamento | Esqueletos com a forma da tela (`Skeleton`, `PageSkeleton`) ao recarregar a biblioteca da conta e enquanto amigos, conversas, ranking, perfis, dispositivos e XP chegam |
| Plano | Disponibilidade, prazos, prioridades, cronograma derivado, conflitos explicados e adiamento |
| Agenda | FullCalendar Standard: semana no computador, dia no celular e mês; criação na grade, arrasto/redimensionamento (no mês, arrastar move o dia e remove o horário), editor contextual com checklist por item, painel Para agendar, recorrência finita e sugestões revisáveis; persistência por conta em `agenda_entries` |
| Tarefas | Prazo, prioridade, vínculo com aula e subtarefas (renomear no lugar; reordenar arrastando pela alça ou com as setas); concluir tarefa vinculada conclui a aula, sem XP próprio; sem vínculo, 0 XP. Subtarefa concluída vale 10 XP uma vez, até 50 XP por dia, validados no servidor (`library-subtasks.js`). Na Hoje, o botão à esquerda da tarefa a coloca em foco: ela ocupa o cartão principal, dá nome à sessão de estudo e fica salva na conta (`focusTaskId`) até ser concluída, removida ou tirada do foco; concluir fica no botão à direita |
| Lembretes da Agenda | Consulta autenticada com reivindicação única por conta (`agenda_reminders`); avisos internos e canal Notification do computador; requer site/app executando e rede |
| Sessão | Início, pausa, retomada, batimentos e encerramento; sobras de tempo, sobreposição e teto tratados no servidor |
| Slides | Editor, ordem, imagens, navegação por teclado e conclusão confirmada com cobertura do deck |
| PDFs | "Anexar PDF" na Biblioteca (inclusive na biblioteca vazia): o navegador lê páginas, título e sumário, o arquivo vai para `PUT /api/library/files/:id` (privado, 50 MB por arquivo e 1 GB por conta no plano gratuito) e vira material `type: 'pdf'` com uma etapa "Ler o PDF até o fim". Leitor embutido (pdf.js) no site e no aplicativo de desktop, com sumário, zoom, texto selecionável e retomada por página (`reading`), gravada depois de uma pausa curta. Hoje/roteiro sugerem "Continuar o PDF na página N". Concluir o PDF = leitura concluída (100 XP, uma vez); páginas não geram XP. Excluir o material libera o arquivo e a cota |
| Disciplinas | Aba Disciplinas na Biblioteca (`#disciplinas`, `#disciplinas?id=`): criar, renomear, palavras-chave, excluir (só desfaz vínculos), vincular PDFs e outros materiais, progresso, páginas abertas, seções do sumário percorridas e "Continuar" no material tocado por último; filtro por disciplina na estante. Sem XP nem bônus próprio |
| Leitor inteligente | Determinístico no navegador (`pdf-domain.js`): seção pelo sumário ou título da página, termos frequentes, disciplina pelo vínculo ou pelo texto e aviso quando a página cita mais outra disciplina; sugestão de disciplina ao anexar. "Identificar com IA" só aparece com `LUME_AI_API_KEY` e envia ao servidor apenas o texto da página aberta (até 4.000 caracteres) e os nomes das disciplinas |
| XP | Livro idempotente, bônus, tempo, extrato e correção por ajuste negativo; saldo legado separado |
| Conquistas | Marcos personalizados por material e disciplina; disciplina completa recebe 200 XP uma vez |
| Cargos | Títulos por nível e marcos, calculados no servidor e exibidos no perfil; sem bloqueios funcionais |
| Amigos | Convites de sete dias, aceite, lista, remoção e perfil com escolhas de compartilhamento |
| Mensagens | Conversas entre amizades, referências, histórico, não lidas, bloqueio e preferência de notificação |
| Ranking | Nível, cursos e empenho semanal/mensal; opt-in, empates, período/fuso e legado fora |
| GitHub | Leitura pública de README, issues e milestones; sugestões revisáveis de entregas |
| Colaboração | Convite por entrega, aceite/recusa e cancelamento; sem copiar projeto ou conceder XP |
| Backup | Exportação e restauração explícita do formato v3 com prévia; versões antigas recusadas, sem conversão |
| Aparência | Azul/Roxo, claro/escuro, tamanho do texto e menos estímulo no popover `Conforto visual` do cabeçalho e em `#configuracoes`; logo preservado |
| Desktop | Lume completo em Electron, bandeja, pareamento, presença opcional, atualização e Discord |

A presença não é atividade validada. Importação e conclusão observada pela plataforma dependem das
capacidades declaradas por provedor; não há rastreamento universal. O Gran tem leitor próprio;
os testes das demais fontes usam exemplos. Consulte [Importação](IMPORTACAO.md).

A navegação tem seis destinos, no cabeçalho (barra inferior no celular): Hoje, Biblioteca, Plano, Agenda, Amigos e Perfil. `#tarefas` pertence
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
Worker é ignorado quando não há binding. O binding R2 `MEDIA` e o Resend estão declarados em
`wrangler.jsonc`, mas a entrega real de e-mail e o upload de imagens no site publicado não foram verificados
(segredo `RESEND_API_KEY`, bucket e deploy a confirmar).

PDFs e disciplinas (11/11/2026) foram verificados localmente (Node + `data/media`); a migração
remota `0015`, o envio de PDF ao R2 publicado e o tipo servido para `pdf.worker.*.mjs` pelos assets do
Worker não foram verificados.

Site de referência: <https://lumeacademy.site>. A Agenda foi mesclada na `main` (PR #3) e o
aplicativo de desktop tem a release `companion-v0.6.2`; o deploy do Worker, a migração remota `0014` e a
situação em produção não foram verificados. Publicação exige pedido explícito; instruções em [Release](RELEASE.md).

## 6. Manutenção do contexto

- Atualize esta página somente quando a capacidade existir no código.
- Registre lacunas e decisões pendentes em [Implementação](IMPLEMENTACAO.md), sem duplicar sua lista aqui.
- Mudanças de recompensa exigem atualizar [Gamificação](GAMIFICACAO.md) e testes.
- Propostas não são aprovação; código antigo e screenshots não substituem a especificação.
