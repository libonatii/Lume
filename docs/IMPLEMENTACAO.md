# Lume — o que falta implementar

> Atualizado em 11/11/2026 (PDFs e disciplinas, B7) sobre a revisão de 03/11 (rotas da API nos dois backends, tabelas das migrações, telas
> e textos da interface, testes, configuração publicada e documentos). Desde então: Agenda mesclada na `main`
> (PR #3), binding R2 e Resend configurados em `wrangler.jsonc`, release 0.6.0 do aplicativo de desktop.
> Configuração versionada não prova o ambiente publicado: segredos e bucket não foram consultados. Este é o registro
> único de **lacunas**: o que não existe, o que está parcial e o que funciona só em parte dos ambientes.
> O que já funciona está em [Continuidade](CONTINUIDADE.md); a direção do produto, em [Produto](PRODUTO.md);
> as regras de pontuação, em [Gamificação](GAMIFICACAO.md); as propostas de evolução, em [Evolução](EVOLUCAO.md).

**Legenda.** **Implementado** — fluxo completo, com teste. **Parcial** — existe, mas falta parte do
requisito. **Não implementado** — não há código. **Só local** — funciona no servidor Node e nos testes, mas
não em produção ou sem verificação lá. **Em andamento** — código no diretório de trabalho, sem commit.
**Fora do escopo** — decisão tomada; não tratar como pendência.

Um item só sai daqui quando o fluxo completo existe, tem teste e não depende de simulação. Aparência de botão
ou tela não conta como conclusão.

---

## 1. Lacunas principais

Em ordem de impacto para quem usa o site publicado.

| # | Lacuna | Por que importa | Estado | Detalhe |
| --- | --- | --- | --- | --- |
| 1 | **Entrega real da recuperação de senha não verificada** | Requisito obrigatório do produto. Desde 10/11 o código envia pelo Resend (e-mail no visual do Lume) e `wrangler.jsonc` define provedor e remetente `nao-responda@lumeacademy.site`. O segredo `RESEND_API_KEY` existe no Worker (conferido em 10/11) e o pedido anônimo responde 200. Falta confirmar o domínio verificado no Resend e um e-mail real entregue (`SHOW_RESET_LINK=false`: sem entrega, o link só vai para o log) | Publicado, entrega não verificada | [C1](#c1--recuperação-de-acesso) |
| 2 | **Imagens em produção não verificadas** | O binding R2 `MEDIA` (bucket `lume-media`) foi habilitado em `wrangler.jsonc` em 08/11. O deploy de 10/11 listou `env.MEDIA (lume-media)` entre os bindings. Falta repetir o upload de avatar, capa e slide no site publicado | Publicado, upload não verificado | [C6](#c6--imagens-de-perfil-e-de-slides) |
| 3 | **Nenhum fluxo com conta foi verificado em produção** | XP, ranking, mensagens, colaboração, sincronização e Companion só foram exercitados no servidor local e nos e2e. Em produção, apenas `GET` anônimos confirmam que as rotas existem. O custo de bcrypt 6 no Worker também não foi medido | Só local | [O1](#o1--verificação-em-produção) |
| 4 | **Acompanhamento de aulas externas ainda não foi provado** | É o problema central declarado. A extensão do navegador lê a grade e as conclusões que a plataforma mostra, mas só foi testada com páginas de exemplo e um trecho salvo do Gran; nunca rodou num Chrome real nem numa conta real. Não há observação de reprodução nem retomada automática, e um curso grande do Gran ultrapassa o limite de 600 aulas | Protótipo | [I2](#i2--progresso-e-reprodução-de-aulas-externas), [I6](#i6--limite-de-tamanho-de-cursos-grandes) |
| 5 | **Escolha de conquistas no perfil** | Cargos já são títulos sem bloqueio; falta escolher quais conquistas exibir | Parcial | [G3](#g3--conquistas-no-perfil) |
| 7 | **Social sem segurança nem reconhecimento** | Não há denúncia de abuso (exigida em Produto §7), compartilhamento de aprendizados nem reconhecimento a conquistas de amigos. Colaboração não registra contribuição. Mensagens chegam por consulta periódica, sem notificação | Parcial | [S2](#s2--segurança-social-e-moderação)–[S5](#s5--colaboração-com-contribuição-identificável) |
| 8 | **Conta e dados pessoais incompletos** | Não é possível trocar senha ou e-mail estando logada, excluir a conta nem ver sessões ativas. Não há termos de uso nem política de privacidade, embora o site guarde e-mail e progresso | Parcial | [C2](#c2--gestão-da-conta), [C3](#c3--termos-privacidade-e-exclusão-de-dados) |
| 9 | **Organização ao estilo Notion** | Sem anotações ligadas ao material, quadro de projeto, trilhas como sequência de materiais ou modelos | Não implementado | [B3](#b3--anotações-trilhas-e-modelos) |
| 10 | **Visual novo só na Hoje** | O Redesign Moderno (Stitch) tem layout próprio apenas na Hoje; as demais telas herdaram cores e cartões, mas não foram desenhadas. Há CSS legado sobreposto | Parcial | [V1](#v1--redesign-nas-demais-telas), [D1](#d1--css-legado) |

---

## 2. Mapa do que existe

O mapa vigente está em [Continuidade](CONTINUIDADE.md#3-o-que-existe). A tabela abaixo é um índice
de evidências e limitações por ambiente, não uma segunda lista de pendências.

| Área | Estado | Onde está | Verificado |
| --- | --- | --- | --- |
| Conta: cadastro, login, saída, sessão | Implementado | `api/domain/auth.js`, rotas `/api/register`, `/api/login`, `/api/logout`, `/api/me` | e2e local; em produção só `GET /api/me` |
| Recuperação de senha | Publicado com Resend; entrega real não verificada | `/api/password/*`, `api/domain/email.js`, `public/assets/email-logo.png` | e2e local com link de teste; nenhum e-mail real conferido |
| Biblioteca direta com revisão e repetição idempotente | Só local (revisão de 03/11) | `api/domain/library-store.js`, `library-actions.js`, `src/features/library/useLibraryPersistence.js` | contrato Node/D1 e e2e; conflito exige recarga |
| Onboarding (três jornadas) | Implementado | `Onboarding.jsx`, `public/domain.js` | e2e local |
| Hoje: próxima ação, sessão, tarefas, evolução | Implementado | `Study.jsx`, `public/study-plan.js` | e2e local |
| Plano e Agenda: cronograma, roteiro, calendário e tarefas | Implementado localmente | `Plan.jsx`, `Tasks.jsx`, `Agenda.jsx`, `public/schedule-domain.js`, `public/tasks-domain.js`, `public/agenda-domain.js` | e2e local; detalhes em [Agenda](AGENDA.md) |
| Biblioteca: criar, editar, excluir, tipos, slides | Implementado (imagens em produção não verificadas) | `Study.jsx`, `CourseEditor.jsx`, `Slides.jsx` | e2e local |
| PDFs anexados, leitor embutido e disciplinas | Só local (11/11/2026) | `public/pdf-domain.js`, `public/subject-domain.js`, `api/domain/library-files.js`, `AttachPdf.jsx`, `PdfReader.jsx`, `Subjects.jsx` | unitário (`pdf.test.js`) e e2e (`pdf.spec.js`) locais; R2 publicado não verificado — ver [B7](#b7--pdfs-leitor-embutido-e-disciplinas) |
| Importação por link, texto e página copiada | Parcial | `api/domain/import-server.js`, `public/import-domain.js` | unitário com HTML sintético; e2e com análise simulada; Coursera e Alura conferidos em 31/10 |
| XP no servidor, níveis, tempo, correção | Implementado | `api/domain/xp.js`, `public/xp-policy.js` | unitário e e2e local |
| Conquistas por material | Parcial | `user_achievements` | unitário e e2e local |
| Ranking de amigos | Implementado | `/api/ranking`, `Ranking.jsx` | e2e local |
| Amigos por convite e perfil entre amigos | Implementado | `api/domain/friends.js`, `public/profile-domain.js` | e2e local |
| Mensagens diretas e bloqueio | Implementado | `api/domain/messages.js`, `Messages.jsx` | e2e local |
| Colaboração em entregas | Parcial (sem contribuição individual) | `api/domain/collaboration.js` | unitário e e2e local de envio, aceite e cancelamento |
| GitHub (leitura pública) | Parcial | `api/domain/github.js`, `GitHub.jsx` | unitário com resposta simulada |
| Aplicativo de desktop | Parcial | `companion/` | CI (sintaxe e contrato); janela e bandeja só manualmente |
| Extensão do navegador | Protótipo | `extension/`, `src/lib/extension.js`, `ImportCourse.jsx` | e2e com páginas de exemplo e trecho salvo do Gran; nunca carregada no Chrome |
| Aparência (Azul e Roxo, escuro e claro) | Implementado | `src/styles/` (tokens/tema), `src/features/*/*.css`, `Personal.jsx` | e2e local; comparação de estilos em 32 combinações |

Os dois ambientes (`server.js` e `worker.js`) servem o mesmo app de `api/`; `tests/unit/api-contract.test.js` confere as rotas `/api/*` nos dois. Tabelas
existentes: `users`, `sessions`, `password_resets`, `rate_limits`, `user_state`, `companion_*`, `friend*`,
`xp_settings`, `xp_events`, `xp_time_sessions`, `user_achievements`, `direct_messages`, `contact_blocks`,
`message_preferences`, `delivery_invites`, `materials`, `units`, `study_progress`, `study_tasks`,
`study_sessions`, `account_documents`, `library_operations`, `library_write_guards`, `user_titles`,
`agenda_entries`, `agenda_reminders`, `study_subjects`, `library_files`, `storage_plans`. Não existe tabela para desbloqueios, denúncias,
publicações, anotações nem observação de reprodução.

---

## 3. Conta, dados e privacidade

### C1 — Recuperação de acesso
**Publicado, entrega não verificada.** O fluxo existe (`/api/password/request` e `/api/password/reset`, token
de 30 minutos e uso único). `api/domain/email.js` envia pelo Resend quando há `LUME_EMAIL_PROVIDER=resend`,
`RESEND_API_KEY` e `LUME_EMAIL_FROM`; o modelo do e-mail usa as cores e o logo do Lume, e o motivo de uma recusa
do provedor vai para o log. Em 10/11 `wrangler.jsonc` passou a declarar o provedor e o remetente
`Lume <nao-responda@lumeacademy.site>`; a chave é segredo (`npx wrangler secret put RESEND_API_KEY`) e não está
no repositório. O texto de `Auth.jsx` já diz que o link foi enviado e vale 30 minutos. O logo do e-mail é
servido do próprio site (`/assets/email-logo.png`), então só aparece depois do deploy.
- Falta: confirmar o domínio `lumeacademy.site` verificado no Resend e a entrega real (o segredo já existe no Worker). Em
  ambiente sem configuração, o texto de `Auth.jsx` continua prometendo um envio que não ocorre.
- Pronto quando: um pedido feito no site publicado entrega o e-mail, o link redefine a senha e a resposta não
  revela se a conta existe.

### C2 — Gestão da conta
**Parcial.** Não há troca de senha nem de e-mail estando logada, lista de sessões ativas ou encerramento remoto
de sessões (só a redefinição encerra todas). Não há verificação de posse do e-mail, segundo fator nem login
com Google (este é opcional no produto).
- Pronto quando: trocar a senha exige a senha atual e encerra as outras sessões; trocar o e-mail confirma o novo
  endereço; a pessoa vê e encerra sessões.

### C3 — Termos, privacidade e exclusão de dados
**Não implementado.** O Lume guarda e-mail, progresso e mensagens, mas não tem termos de uso, política de
privacidade nem exclusão de conta. A exportação em JSON já existe em Configurações.
- Falta: textos de termos e privacidade revisados pela responsável; exclusão de conta que apague ou anonimize
  estado, mensagens, amizades e eventos, com confirmação; definição do que acontece com mensagens já enviadas.

### C4 — Migração da prévia para a conta
**Fora do escopo por decisão de 03/11/2026.** O cliente passa a acessar diretamente a API; dados de estudo do
navegador são descartados. A prévia é temporária em memória. Não há migração de dados: formatos antigos
permanecem no servidor, com erro explícito de incompatibilidade, sem conversão nem exclusão.

### C5 — Senhas e custo de hash
**Parcial.** bcrypt com custo 6 no Worker, abaixo do mínimo 10 da OWASP, por limite de CPU do plano gratuito.
Hashes PBKDF2 antigos só migram na redefinição. A medição de CPU em produção nunca foi feita.
- Falta: medir cadastro, login e redefinição no Worker publicado e decidir o custo com base nisso.

### C6 — Imagens de perfil e de slides
**Publicado, upload não verificado.** `api/domain/media.js` grava avatar, capa e imagens de slides em R2 (Worker) ou
`data/media/` (Node). O binding `MEDIA` (bucket `lume-media`) foi habilitado em `wrangler.jsonc` em 08/11; sem
ele as rotas respondem 503. O cenário de mídia do contrato continua ignorado no Worker local sem binding.
- Falta: repetir o upload de avatar, capa e slide no site
  publicado.

---

## 4. Estudo, biblioteca e plano

### B1 — Desfazer e corrigir progresso
**Parcial.** Aula importada pode ser desfeita; etapas de materiais criados à mão não. Não há edição de data,
origem ou motivo de um registro, nem revisão assistida de etapas genéricas antigas (a classificação de tipo
existe em Configurações).

### B2 — Favoritos e destaque
**Não implementado.** A Biblioteca tem busca, filtros, estados e retomada, mas não favoritos.

### B3 — Anotações, trilhas e modelos
**Não implementado.** Não há anotações, resumos ou dúvidas ligados ao material; nem trilha como sequência de
materiais com objetivo, quadro de projeto ou modelos de curso, prova e projeto. "Projeto" existe só como tipo
de material, com etapas.
- Requisito: reaproveitar biblioteca, tarefas e entregas, sem um editor genérico de páginas.

### B4 — Plano
**Implementado o núcleo** (disponibilidade, prazo, prioridade, conflito, adiamento, subtarefas, vínculo de
tarefa com aula). Falta:
- considerar o prazo das tarefas no cronograma (hoje só as aulas entram);
- lembretes de sugestões ainda não agendadas; a Agenda oferece lembretes de compromissos explícitos (B6);

A unificação do critério foi concluída em 03/11: Biblioteca e diálogo usam `nextAction`, derivado
do roteiro; `nextMission` foi removido.

### B5 — Sessão de estudo
**Implementado como declaração.** O tempo é declarado pela pessoa e vira XP em blocos validados no servidor.
Não é observação de atividade, e isso está dito na interface.

### B6 — Agenda com calendário e tarefas
**Implementado e verificado localmente.** Agenda centraliza as tarefas e oferece
dia, semana e mês, atividades com checklist, recorrência finita, avisos de conflito e reagendamento manual.
Cronograma e Roteiro permanecem no Plano; sugestões só viram compromissos após revisão e gravação.
- Revisão visual de 05/11: FullCalendar Standard, criação diretamente na grade, arrasto/redimensionamento,
  painéis contextuais, Mais opções e checklist editável por item. Tarefas e sugestões ficam em Para agendar.
- Verificação da revisão: 265 testes de domínio/contrato passaram (1 ignorado), 126 e2e passaram
  (2 gestos de mouse exclusivos do computador ignorados no mobile), build e Electron minimizado passaram.
- Detalhes e evidências: [Agenda](AGENDA.md). Mesclada na `main` pelo PR #3 (calendário interativo e refinos de
  interface); a publicação no Worker não foi verificada, e a migração `0014_agenda.sql` precisa estar aplicada no D1.
- Verificação da primeira implementação: 262 testes de domínio/contrato passaram (1 ignorado), 120 e2e na suíte completa e
  14 cenários da Agenda revalidados após os ajustes finais; build e notificação nativa no Electron passaram.
- Limites: sem calendário externo, notificações no celular ou entrega garantida com o programa encerrado.
  A consulta requer rede; recupera avisos vencidos há até 15 minutos e os reivindica uma vez por conta.
- Disponibilidade continua em minutos por dia; não há sugestão automática de horários específicos.
- O prazo das tarefas ainda não participa do cronograma (B4). Regras de XP permanecem as mesmas.

### B7 — PDFs, leitor embutido e disciplinas
**Implementado e verificado localmente em 11/11/2026; não publicado.** Pedido da responsável: estudar por PDF sem
curso, com leitor no programa, identificação da matéria e categoria "disciplina". Decisões tomadas em 11/11/2026:
- **Armazenamento só no servidor.** O PDF vai para R2 (`env.MEDIA`, chave `pdfs/<conta>/<arquivo>.pdf`) ou
  `data/media/` no Node; o site e o aplicativo de desktop leem com conexão. "Estudo offline" foi entendido como
  material próprio, sem curso online; não há cópia no navegador, IndexedDB nem fila offline.
- **Limites:** plano gratuito 50 MB por arquivo e 1 GB por conta; o plano `plus` (100 MB e 2 GB) existe na regra
  (`PDF_PLANS`, tabela `storage_plans`), mas **não há assinatura, cobrança nem tela** para obtê-lo.
- **XP:** abrir, rolar e virar página não geram XP. O PDF tem uma etapa, "Ler o PDF até o fim"; concluí-la é
  leitura delimitada (100 XP e conquista, uma vez, no servidor). Material de uma etapa não recebe bônus de curso.
  Disciplina é organização: sem XP e sem o bônus de 200 XP da disciplina de curso importado.
- **Leitor inteligente:** determinístico no navegador (sumário, título da página, termos, palavras-chave da
  disciplina). "Identificar com IA" é opcional, sob clique, só com `LUME_AI_API_KEY`, e envia o texto da página
  aberta (até 4.000 caracteres) e os nomes das disciplinas para `POST /api/library/identify`.

Verificação local (11/11/2026): `tests/unit/pdf.test.js` e `tests/e2e/pdf.spec.js` (computador e celular)
passam; fluxo conferido no navegador (anexar, ler, recarregar, retomar na página, concluir com 100 XP uma vez).
Na suíte e2e completa, as falhas restantes vieram do limite de cadastros dos e2e (já elevado para 1000 em
`playwright.config.js`) e de mudanças de tarefas/subtarefas em andamento em outra frente, não dos PDFs.

Limites conhecidos:
- PDF digitalizado (só imagem) não tem texto extraível: sem OCR, o painel diz isso e não identifica assuntos.
- Imagens JPEG 2000 podem aparecer em branco: o WebAssembly do pdf.js fica desligado porque a CSP não libera wasm.
- O envio lê o arquivo inteiro na memória da requisição. No Worker (128 MB) isso cabe nos 50 MB do plano
  gratuito; os 100 MB do plano `plus` exigiriam envio em partes antes de serem oferecidos.
- O backup v3 leva os metadados do PDF, não o arquivo. Restaurar um PDF numa conta que não tem o arquivo é
  recusado ("O PDF não foi encontrado"); é preciso anexar de novo.
- Envio que não virou material (a pessoa desistiu ou a gravação falhou) é removido na hora pela interface ou,
  se ela fechar a página, no próximo envio depois de uma hora.
- Sem marcações, destaques ou anotações no PDF (ver [B3](#b3--anotações-trilhas-e-modelos)); sem sincronizar a
  página entre duas janelas abertas ao mesmo tempo (a última gravação vence, como no restante da biblioteca).
- Produção não verificada: migração `0015_subjects_pdf.sql` no D1, upload ao R2 e o tipo servido para
  `_astro/pdf.worker.*.mjs` pelos assets do Worker (o servidor Node passou a servir `.mjs` como JavaScript).

---

## 5. Importação e integrações

### I1 — Leitura da grade por plataforma
**Parcial.** Coursera e Alura (parcial) foram conferidas com páginas reais em 31/10; Udemy responde 403;
Rocketseat e DIO não publicam títulos de aula; Gran e Estratégia exigem login e dependem da página copiada.
Os testes da importação por link usam HTML sintético. O leitor da extensão foi testado contra páginas de exemplo e um trecho real do painel do Gran (`tests/fixtures/gran-painel.html`). A leitura do Gran pela API da página foi conferida com uma conta real em 01/11/2026 (31 disciplinas, 427 aulas), executando o trecho do leitor no console, ainda sem a extensão instalada; Udemy, Alura, Coursera e Rocketseat não foram testadas com páginas reais. O caso Gran/OAB por link nunca foi validado.

### I2 — Progresso e reprodução de aulas externas
**Protótipo.** Hoje existem dois caminhos, ambos acionados pela pessoa:
(a) a página copiada, cujas aulas marcadas como concluídas entram como histórico sem XP;
(b) a extensão do navegador (Chrome/Edge, Manifest V3; ver [Importação](IMPORTACAO.md#extensão-do-navegador-leitura-na-sessão-da-pessoa)),
que lê a página do curso aberta com a conta, sem cookie nem senha. Na primeira leitura, as conclusões visíveis viram
histórico sem XP; nas seguintes, aulas que passaram a aparecer concluídas são oferecidas para confirmação e, se a
pessoa confirmar, entram com origem `integration` e o servidor concede XP pela política vigente. Isso é uma
observação da plataforma confirmada pela pessoa, não prova de que a aula foi assistida.

Falta na extensão: carregá-la num Chrome real; conferir o DOM real das outras plataformas; no Gran, "Concluí
esta aula" só reconhece a página do primeiro vídeo de cada aula, e cursos de pós/graduação não foram vistos; teste automatizado da ponte e da entrega pelo service worker; enviar à Chrome Web Store (o pacote,
os ícones, as imagens, a ficha e a política de privacidade estão prontos; ver [extension/LOJA.md](../extension/LOJA.md));
configurar outro endereço do Lume.

Não existe:
- observação de reprodução de vídeo (tempo assistido, velocidade, saltos, cobertura);
- consulta de progresso por API (nenhuma das quatro plataformas oferece API pública individual; ver
  [Evolução §5](EVOLUCAO.md#5-integrações-com-cursos-externos));
- retomada da posição da aula.
- Pronto quando: os cinco critérios da prova técnica de [Evolução §5.5](EVOLUCAO.md#55-primeira-prova-técnica-recomendada)
  passam com uma aula real autorizada.

### I6 — Limite de tamanho de cursos grandes
**Parcial.** O importador ainda aceita até 600 aulas. A revisão local de 03/11/2026 retirou o documento global
de 320 KB do caminho novo: operações têm limite de corpo de 3 MB e a grade é gravada em lote nas tabelas.
O contrato verifica uma importação de 600 aulas no Node e no D1 local. Elevar o limite do importador e medir
CPU/volume em produção continuam pendentes; isso não demonstra suporte a milhares de aulas em produção.

### I3 — Edital e cobertura
**Parcial.** O registro de editais verificados (`EDITAL_SOURCES`) está vazio de propósito; a comparação de
cobertura nunca é calculada.

### I4 — Organização por IA
**Só local, desligada.** Funciona apenas com `LUME_AI_API_KEY`; não há chave em produção. O organizador
determinístico responde no lugar.

### I5 — GitHub
**Parcial.** Leitura pública de README, issues e milestones, sugestões de entrega e criação de projeto. Sem
OAuth, repositórios privados, escrita ou validação de entrega.

---

## 6. Gamificação

### G1 — Política de XP v1
**Implementado no servidor.** Livro `xp_events` com idempotência, bônus, teto diário de tempo e ajuste negativo
com motivo. Falta: teste de concorrência entre dispositivos no Worker publicado e edição de data/origem de um
evento.

### G2 — Cargos e desbloqueios
**Implementado localmente:** oito critérios de títulos aprovados em [Evolução §4.5](EVOLUCAO.md#45-cargos-e-requisitos-títulos-implementados-desbloqueios-rejeitados),
concessão idempotente em `user_titles`, perfil com critérios e reavaliação nas correções.
Bloqueios funcionais foram rejeitados: todas as funcionalidades disponíveis são acessíveis a todos.
Modelos, trilhas e desafios continuam recursos futuros independentes de cargo.

### G3 — Conquistas no perfil
**Parcial.** Conquistas por material existem; a pessoa não escolhe quais aparecem no perfil (todas aparecem
quando o XP está compartilhado).

### G4 — XP das tarefas de prova
**Implementado localmente:** tarefa vinculada conclui a aula e usa sua recompensa no servidor, uma vez.
Tarefa sem vínculo concede 0 XP. Reabrir tarefa não desfaz a aula. Não há migração de saldos antigos.

### G5 — Bônus de disciplina
**Implementado localmente:** 200 XP e conquista por disciplina, uma vez por identidade.
Exige grade completa, todas as aulas selecionadas e conclusões elegíveis. Sem concessão retroativa.

---

## 7. Social

### S1 — Amigos, perfil e mensagens
**Implementado.** Convite por link de 7 dias, perfil com seções escolhidas, mensagens diretas com histórico,
não lidas, referências e bloqueio.
- Limitação: mensagens e contador de não lidas são atualizados por consulta periódica (45 s no menu); não há
  tempo real nem notificação nativa.

### S2 — Segurança social e moderação
**Parcial.** Remover amizade e bloquear existem. Não há denúncia de abuso (exigida em Produto §7), silenciar por
período, regras de moderação nem quem as aplique.

### S3 — Compartilhamento de aprendizados
**Não implementado.** Não há publicação de resumo, nota ou descoberta para amigos. Hoje só é possível enviar a
referência de um material por mensagem.

### S4 — Reconhecimento entre amigos
**Não implementado.** Não há reação a conquistas de amigos (proposta no estilo do "kudos" do Strava, sem XP)
nem desafios entre amigos (proposta como desbloqueio).

### S5 — Colaboração com contribuição identificável
**Parcial.** Convite de uma amizade para uma entrega de projeto, com aceite, recusa e cancelamento. Não há
registro de quem fez o quê nem revisão da entrega; por isso a colaboração não gera reconhecimento nem XP, ao
contrário do que Produto §7 pede.

### S6 — Presença entre amigos
**Não implementado.** A presença do aplicativo de desktop é visível só para a própria pessoa.

---

## 8. Aplicativo de desktop

**Parcial.** Janela com o site completo, bandeja, presença local por allowlist, roteiro e atualização por
clique. O processo principal publica Rich Presence no Discord (curso e aula do roteiro, botão para o site,
ligado por padrão). O Application ID público do Lume vai no build (`DEFAULT_DISCORD_CLIENT_ID`);
`LUME_DISCORD_CLIENT_ID` e `discordClientId` o sobrepõem. Falta confirmar no Developer Portal que a arte
`lume_logo` foi enviada.
Falta também: instalador assinado; início com o Windows; notificações de pausa; abrir a próxima aula pelo painel;
funcionamento sem rede; suporte a Linux e macOS; janela e bandeja testadas no CI. A última release publicada é
`companion-v0.6.2` (10/11/2026, a mesma versão de `companion/package.json`), com o Discord e o endereço `lumeacademy.site`; a 0.6.2 migra o endereço antigo salvo em `%APPDATA%umempanion.json`. O endereço antigo (`lume.lume-prototype.workers.dev`) foi desligado por decisão da responsável: o site vive só em `lumeacademy.site`. A 0.6.0 ainda embute o endereço antigo e perde a conexão; a atualização pelo menu da bandeja (Verificar atualização) corrige isso. A extensão 0.2.1 (manifesto com o domínio novo) precisa ser recarregada no Chrome.

---

## 9. Interface

### V1 — Redesign nas demais telas
**Parcial.** As cores, os cartões e a navegação do Redesign Moderno valem em todas as telas, mas só a Hoje foi
reorganizada a partir do Stitch. Entrada, onboarding, Biblioteca, Plano, Amigos, Mensagens, Perfil e
Configurações não têm tela correspondente no Stitch. As telas exportadas em 01/11 ("Redesign Moderno" e
"Variante 2") não foram salvas em `designs/stitch/`.

### V2 — Estados de carregamento
**Implementado (10/11/2026).** `Skeleton` e `PageSkeleton` (`src/ui/ui.jsx`) mostram a forma do conteúdo:
Hoje, Biblioteca, Plano, Tarefas, Roteiro, Perfil, Conquistas, Meu caminho e Configurações enquanto a biblioteca
da conta recarrega (campo `loading` em `src/app/routes.jsx`); amigos, conversas, ranking, perfil de amizade,
dispositivos do desktop e XP enquanto o recurso chega. A primeira carga continua atrás de "Verificando sua sessão".

### V3 — Contraste do *hover* dos botões
**Decisão pendente.** As cores especificadas para o *hover* (`#3b82f6` no Azul e `#8b5cf6` no Roxo) dão 3,7:1 e
4,2:1 com texto branco, abaixo do AA (4,5:1). Os demais textos passam nos quatro temas.

### V4 — Textos desatualizados
- `Auth.jsx`: corrigido em 10/11 (diz que o link foi enviado). Em ambiente sem provedor, promete um envio que não ocorre (ver C1).
- `Friends.jsx`, `Companion.jsx`, `Personal.jsx` e `public/domain.js` (apoio `calm`): corrigidos em 10/11; as notas já não tratam colaboração e mensagens como pendentes nem citam o modo essencial. O cartão "Outros lembretes" remete à Agenda.
- `Onboarding.jsx`: informa que integrações por área não existem (correto), mas sem citar a página copiada.

---

## 10. Dívida técnica

A reestruturação que trata estes itens e as causas de arquitetura por trás de várias lacunas acima está em
[Plano de refatoração](REFATORACAO_01112026.md).

### D1 — CSS legado
Limpeza estrutural realizada em 03/11: estilos de 22 folhas foram colocados junto das funcionalidades
e da casca; declarações sobrescritas do mesmo seletor/contexto foram removidas. Tokens e tema continuam
globais, com ordem explícita em `src/styles/lume.css`. Isso não implementa o redesenho V1 das demais telas.
Revisão de 08/11: removidos seletores sem uso de `home.css`, `personal.css`, `shared-profile.css`,
`shell.css` e `41-responsivo.css`; tarefas e subtarefas consolidadas em `plan/tasks.css`; cores fixas de
overlay, medalhas e perigo substituídas por tokens. Ver
[Refatoração F7](REFATORACAO_01112026.md#f7--css-por-componente-sobre-tokens).

### D2 — Regras antigas ainda em uso
`nextMission` e `applyStudyRhythm` foram removidos. `HABITS` e `CHALLENGES` continuam validando campos
de documentos antigos em `restoreState`; `weekCount` tem consumidores reais e não conta preparações.
O saldo legado continua separado do livro do servidor. F2 usa `units` no domínio e contrato v3;
`steps`/`structure` são somente visualizações derivadas. Documentos antigos não são convertidos.

### D3 — Exportações sem consumidor
Resolvido em 01/11/2026: `importXp`, `selectedCount`, `providerSummary`, `emptySessionState`, `GITHUB_CAPABILITIES`,
`collectCompletionCandidates`, `completionTimestamp`, `courseIsComplete` e `applyStudyRhythm` foram removidos.

### D4 — Dependência sem uso
Resolvido em 01/11/2026: `@fontsource-variable/fraunces` saiu do `package.json`.

---

## 11. Operação e verificação

### O1 — Verificação em produção
Nenhum teste roda contra o site publicado. Falta um roteiro de fumaça autenticado (cadastro, login, conclusão
com XP, ranking, mensagem entre duas contas) executado após cada deploy, com contas de teste próprias.

### O2 — Backup do banco
Não há rotina documentada de backup ou exportação do D1 de produção.

### O3 — Comandos de verificação
```sh
npm test          # unitários e contrato HTTP Node/Worker
npm run build     # Astro + CSP
npm run test:e2e  # cenários desktop e celular; build prévio obrigatório
```
- Não rode dois Playwright ao mesmo tempo no mesmo diretório: compartilham `test-results/` e a porta 4187.
- A análise por link nos e2e é simulada; não prova extração real de plataformas.
- Mudanças em janela, bandeja ou IPC do aplicativo de desktop exigem `npm --prefix companion run smoke` numa
  sessão com área de trabalho.

---

## 12. Decisões pendentes da responsável

| Decisão | Bloqueia |
| --- | --- |
| Confirmar o domínio verificado no Resend e um e-mail real (segredo, provedor e remetente já existem) | C1 |
| Testar o upload de imagens no site publicado (bucket e binding já no ar) | C6 |
| Textos de termos de uso e política de privacidade; regra de exclusão de conta | C3 |
| Manter ou escurecer o *hover* dos botões | V3 |
| Elevar o limite de 600 aulas após medir o formato por entidade | I6 |
| Publicar a extensão na Chrome Web Store | I2 |
| Preço, cobrança e tela da assinatura que amplia PDFs para 100 MB por arquivo e 2 GB por conta | B7 |
| OCR para PDFs digitalizados (onde roda, custo e o que é enviado) | B7 |

## 13. Fora do escopo (decisões tomadas)

- Comunidades, servidores, canais e grupos; ranking público.
- Modo essencial e tratamento de movimento reduzido.
- Busca de amigos por e-mail (o convite por link é o caminho).
- Hospedar cursos ou observar qualquer site sem integração declarada; pedir senha ou cookie de plataformas.
- XP por presença, importação, onboarding, convite, mensagem, conexão de integração, planejamento ou commit isolado.
- Aceitar colaboração no Lume não concede acesso ao repositório no GitHub.

---

# Anexos históricos

Registros de rodadas anteriores. Os números de testes e o estado descritos aqui **não** são atuais; use as
seções acima.

## Anexo A — brief de 31/10/2026: plataforma social de estudos sem grupos

> Pedido histórico de 31/10, preservado como evidência. As seções atuais acima prevalecem quanto ao
> estado de implementação: mensagens, convites de colaboração e leitura pública do GitHub já existem.

Quero evoluir o Lume como uma plataforma social de estudos gamificada, inspirada na biblioteca e progressão da Steam, na comunicação direta do Discord e na organização do Notion.

O projeto é pequeno. **Não quero comunidades, servidores, canais ou grupos nesta etapa.** A experiência social deve se concentrar em amigos, mensagens diretas e colaboração em projetos vinculados ao GitHub.

Esta é uma mudança explícita de escopo: atualize a documentação que atualmente exige grupos ou comunidades para refletir essa decisão, preservando amigos, perfis e ranking.

Antes de implementar, leia `AGENTS.md`, `docs/PRODUTO.md`, `docs/GAMIFICACAO.md` e `docs/CONTINUIDADE.md`. Consulte `docs/IMPORTACAO.md` para importação e `docs/COMPANHEIRO.md` se alterar o aplicativo de desktop. Inspecione o código e aproveite os recursos existentes.

**1. Biblioteca e progressão inspiradas na Steam**

A biblioteca deve ser o centro da experiência, reunindo cursos, leituras e projetos.

- Destaque o material em andamento, o ponto de retomada e a próxima atividade.
- Organize conteúdos com capas, filtros, favoritos e estados de progresso.
- Apresente disciplinas, módulos e aulas dentro de cada curso.
- Evolua o perfil com áreas de interesse, projetos compartilhados e conquistas escolhidas pela pessoa.
- Vincule conquistas a realizações concretas, identificando o curso, leitura ou projeto concluído.

Preserve a importação por link de diferentes plataformas e suas limitações reais. Não exija cadastrar cada aula manualmente.

**2. Mensagens diretas inspiradas no Discord**

Implemente uma comunicação simples entre amigos, integrada aos perfis existentes.

Na primeira versão, quero:
- Lista de conversas individuais.
- Envio e recebimento de mensagens de texto.
- Histórico persistente e indicação de mensagens não lidas.
- Compartilhamento de referências a cursos, aulas e projetos.
- Controle de notificações e bloqueio de contato.

Comece com DMs apenas entre amizades aceitas, sem mensagens de desconhecidos. Não inclua conversas em grupo, canais, chamadas de voz ou vídeo nesta etapa.

Garanta que somente os participantes autorizados acessem a conversa. Defina o comportamento de bloqueio e remoção de amizade, incluindo a preservação do histórico e a interrupção de novas mensagens.

Compartilhar uma referência não deve conceder acesso automático a conteúdo privado ou restrito. Mensagens e notificações não concedem XP.

**3. Organização inspirada no Notion**

Quero ferramentas úteis sem exigir configuração extensa.

- Anotações, resumos e dúvidas vinculados ao material estudado.
- Listas de aulas e entregas com prioridades claras.
- Um quadro simples de andamento para projetos, quando útil.
- Modelos básicos para acompanhar um curso, preparar uma prova ou desenvolver um projeto.

As visualizações devem reutilizar os mesmos dados. Evite criar um editor genérico complexo ou uma estrutura de páginas que obrigue a pessoa a organizar tudo antes de estudar.

**4. Colaboração pelo GitHub**

A conexão com GitHub deve ser opcional e permitir selecionar explicitamente os repositórios acompanhados.

Use dados autorizados, como README, issues e milestones, para sugerir:
- O objetivo do projeto.
- Entregas previstas e pendências identificadas.
- Uma próxima ação possível.
- Oportunidades de colaboração.

Diferencie informações encontradas no repositório de sugestões da IA. Toda sugestão de entrega deve apresentar sua origem e permitir revisão. Inatividade, issues abertas ou ausência de documentação não bastam para afirmar que um projeto está incompleto.

A pessoa pode escolher continuar sozinha ou convidar um amigo pelo Lume para colaborar em uma entrega específica. O convite deve identificar o projeto e a ajuda desejada, com aceite ou recusa e acompanhamento da entrega.

Aceitar uma colaboração no Lume não concede acesso ao repositório no GitHub. Explique quando esse acesso precisa ser providenciado pelo proprietário.

Na primeira versão, priorize leitura de dados e coordenação da colaboração. Alterações no GitHub, como abrir issues, comentar, enviar código ou conceder permissões, exigem ações explícitas e uma integração própria; não execute essas ações automaticamente.

Mantenha credenciais no servidor e solicite permissões mínimas. Repositórios privados e seus conteúdos não devem aparecer em perfis, mensagens ou convites sem escolha explícita de compartilhamento e autorização adequada.

**5. Uma experiência integrada**

O fluxo principal deve ser:

**Adicionar material → estudar → registrar avanço → organizar aprendizados → conversar com um amigo ou colaborar em uma entrega → acompanhar conquistas.**

Exemplo: estou estudando programação, acompanho um repositório e reviso uma entrega sugerida. Posso executá-la sozinho ou convidar um amigo. Conversamos por DM e registramos a contribuição de cada participante.

Não crie uma área de comunidade para viabilizar esse fluxo. Use biblioteca, projetos, amigos e conversas individuais.

**6. Gamificação e ranking**

Siga as regras documentadas, distinguindo pontuação legada da política validada no servidor.

Preserve o ranking como recurso central, começando pelo recorte de amigos, com:
- Nível acumulado.
- Cursos distintos concluídos.
- Empenho no período.

Implemente a validação necessária no servidor antes de usar eventos em placares compartilhados. Não use a cópia do estado do navegador como autoridade.

Conectar GitHub, enviar mensagens, aceitar convites ou fazer commits isolados não gera XP. Entregas colaborativas exigem critérios de conclusão e contribuição individual identificável; não conceda automaticamente a mesma recompensa a todos.

Pausas preservam conquistas. Exposição no perfil e participação no ranking continuam configuráveis.

**7. Visual, implementação e entrega**

Preserve `public/lume.css`, os temas, a tipografia e os componentes existentes. A inspiração nos três aplicativos deve orientar a experiência, mantendo a identidade do Lume.

Implemente de forma incremental, com soluções proporcionais ao tamanho do projeto. Comece por um diagnóstico curto do que já existe e prossiga com fluxos funcionais, persistência, permissões e estados de erro.

Mantenha os contratos das APIs consistentes entre Node e Cloudflare. Preserve dados existentes e atualize os documentos afetados, especialmente o escopo social e a matriz de continuidade.

Verifique os fluxos de estudo, DMs e colaboração, incluindo acesso indevido a conversas, bloqueio de contato, privacidade de repositórios e repetição de convites ou eventos. Execute os testes previstos no projeto.

Entregue o que funciona, o que foi verificado e as dependências ainda pendentes. Não apresente simulações como integrações concluídas. Não faça publicação, migração remota ou release sem pedido explícito.

---

## Anexo B — brief histórico: onboarding (rodada anterior)

> Preservado como registro. Este texto descreve uma tarefa já executada e não é a lista vigente de
> pendências; consulte as seções acima. Onde este anexo mencionar grupos,
> vale o escopo atual sem grupos. A tabela "Situação da implementação" no fim do anexo é daquela rodada
> (28 testes de domínio e 10 cenários de navegador) e não representa o estado atual.

Implemente no Lume três jornadas de onboarding e primeiros passos, de acordo com a opção escolhida pelo usuário:

1. Quero começar.
2. Estudo de vez em quando.
3. Estudo com frequência.

CONTEXTO DO PROJETO

O repositório está em D:\tabletop.

Antes de implementar, leia:
- AGENTS.md
- docs/PRODUTO.md
- docs/GAMIFICACAO.md
- docs/CONTINUIDADE.md

O Lume é uma plataforma social de estudos com contas, biblioteca, continuidade de materiais, amigos, grupos, colaboração, conquistas personalizadas e rankings por nível, cursos concluídos e empenho.

A gamificação reconhece estudo efetivo e conclusões significativas. Não conceda XP por cadastro, onboarding, conexão de integrações, organização de tarefas, abertura de materiais ou preparação do ambiente.

Inspecione a implementação atual antes de editar. Preserve trabalhos existentes e não substitua funcionalidades já implementadas por simulações.

OBJETIVO

A escolha do ritmo deve alterar:
- As perguntas seguintes.
- A forma de configurar a biblioteca.
- A proposta de plano inicial.
- A primeira atividade de estudo.
- A organização inicial da página Hoje.

Não crie categorias de capacidade ou inteligência. As opções representam o momento da pessoa e podem ser alteradas depois.

FLUXO COMUM DE CONTA

Após o cadastro e a autenticação, iniciar o onboarding de uma conta nova.

Separar:
- Autenticação da conta.
- Personalização do perfil.
- Organização dos estudos.
- Participação social.

Não repetir todo o onboarding a cada login. Quem já concluiu deve voltar à página Hoje, com seus materiais e pontos de retomada.

Permitir pular perguntas opcionais e retomar a configuração depois. Salvar o progresso do onboarding para que uma interrupção não obrigue a recomeçar.

Não coletar diagnóstico. Preferências de conforto devem estar disponíveis em todas as jornadas.

JORNADA 1 — QUERO COMEÇAR

Objetivo: ajudar a pessoa a escolher algo concreto para aprender e realizar uma primeira atividade real, sem exigir que monte um sistema inteiro.

Perguntas:
- O que você gostaria de aprender?
- Você já tem um curso, uma aula ou um material?
- Qual resultado gostaria de alcançar?
- Quanto tempo gostaria de reservar para uma sessão? Permitir “ainda não sei”.

Oferecer dois caminhos:
A. Já tenho um material: cadastrar seu link e identificar seu tipo.
B. Ainda não escolhi: ajudar a definir um assunto e o próximo material a procurar, sem inventar cursos ou links.

Configuração inicial:
- Um objetivo principal.
- Um material escolhido pela pessoa.
- Uma primeira atividade concreta, como assistir a uma aula completa, ler uma seção delimitada ou resolver um exercício.
- Plano inicial leve e editável, baseado no material e na disponibilidade informada.

Página Hoje:
- Destacar uma atividade principal.
- Mostrar o material e o que significa concluir essa atividade.
- Exibir o progresso real e o acesso à biblioteca.
- Deixar recursos avançados acessíveis sem sobrecarregar a primeira tela.

Preparar o material pode ser uma orientação auxiliar, mas não deve ser a atividade recompensada nem gerar XP.

JORNADA 2 — ESTUDO DE VEZ EM QUANDO

Objetivo: organizar o que a pessoa já começou e facilitar a continuidade.

Perguntas:
- O que você já está estudando?
- Qual material gostaria de retomar primeiro?
- Onde você parou?
- O que costuma dificultar a continuidade? Exemplos: escolher entre materiais, esquecer onde parou, falta de tempo ou tarefas pouco claras.

Configuração inicial:
- Permitir cadastrar materiais em andamento.
- Registrar aulas já concluídas e o ponto atual de cada material.
- Escolher uma prioridade entre os materiais cadastrados.
- Propor sessões flexíveis com base na rotina informada, sem exigir presença diária.

Página Hoje:
- Destacar “Continuar de onde parei”.
- Mostrar aula, página, seção ou entrega pendente.
- Oferecer um plano semanal editável e outras trilhas em andamento.
- Manter pausas sem perda de progresso.

Importante:
Cadastrar progresso anterior não deve gerar uma sequência de recompensas novas nem inflar o ranking. Distinguir histórico importado de atividades realizadas após a entrada no Lume.

JORNADA 3 — ESTUDO COM FREQUÊNCIA

Objetivo: organizar uma rotina existente, aprofundar objetivos e facilitar acompanhamento e colaboração.

Perguntas:
- Quais áreas e trilhas você acompanha?
- Você já possui uma rotina ou meta?
- Quais cursos, projetos ou leituras estão em andamento?
- O que gostaria de acompanhar melhor: conclusões, tempo efetivo, entregas ou colaboração?

Configuração inicial:
- Permitir cadastrar várias trilhas, com organização progressiva.
- Manter a rotina existente em vez de impor um plano genérico.
- Definir prioridades e marcos substanciais.
- Oferecer integrações pertinentes à área, sempre opcionais.

Exemplos:
- Programação: oferecer GitHub e seleção dos projetos que a pessoa deseja acompanhar.
- Direito: organizar cursos, videoaulas, artigos, leituras e objetivos de prova.
- Outras áreas: disponibilizar os mesmos tipos básicos de materiais, sem limitar o produto a programação.

Página Hoje:
- Mostrar prioridades, pontos de retomada e entregas próximas.
- Oferecer visão das trilhas e progresso por objetivo.
- Facilitar acesso a grupos, colaboração, conquistas e rankings.
- Não ativar cobrança excessiva ou metas obrigatoriamente maiores.

PERSONALIZAÇÃO TRANSVERSAL

A área de estudo e o ritmo são dimensões independentes.

Uma pessoa iniciante em rotina pode estudar programação avançada. Uma pessoa que estuda diariamente pode estar começando em Direito.

Os apoios também são independentes:
- Menos informação na tela.
- Ajuda para escolher a próxima atividade.
- Divisão de atividades extensas.
- Lembretes opcionais.
- Facilidade para retomar após pausas.

Não ative o modo essencial apenas porque alguém escolheu “Quero começar”. Pergunte ou apresente uma sugestão que possa ser recusada.

CONEXÃO SOCIAL

Depois de configurar o primeiro material, oferecer:
- Convidar amigos.
- Entrar em um grupo por convite.
- Escolher participar dos rankings.

Essa etapa deve poder ser pulada.

O ranking é parte central do produto e precisa permanecer acessível em todas as jornadas. Não conceder vantagens de XP por escolher determinada jornada ou convidar pessoas.

PROGRESSO E INTEGRAÇÕES

Não prometer retomada automática para qualquer link.

Quando houver integração compatível, usar posição e progresso observados. Quando não houver, permitir marcador manual e informar isso claramente.

Não considerar rolagem, abertura de arquivo, quantidade de commits ou tempo de aba aberta como prova de estudo.

Não solicitar credenciais de serviços externos diretamente em formulários próprios do Lume.

PERSISTÊNCIA E ALTERAÇÃO DO RITMO

Salvar as escolhas na conta, respeitando a arquitetura existente.

Representar explicitamente:
- Situação e versão do onboarding.
- Jornada escolhida.
- Áreas e objetivos.
- Preferências de apoio.
- Plano aceito pelo usuário.
- Materiais e pontos de retomada.

Se a pessoa mudar de ritmo posteriormente:
- Preservar cursos, materiais, XP e conquistas.
- Não reiniciar a conta.
- Apresentar as mudanças sugeridas antes de substituir seu plano.
- Não sobrescrever metas ajustadas manualmente sem uma escolha explícita.

DESIGN E INTERAÇÃO

Manter a identidade visual atual do Lume e os três cartões de escolha.

Adaptar as telas seguintes à jornada selecionada. Não usar o mesmo formulário inteiro com apenas um título diferente.

Usar transições suaves, navegação por teclado, foco adequado e respeito ao movimento reduzido do sistema.

Todos os botões devem ter comportamento real ou indicar claramente uma funcionalidade ainda indisponível.

CRITÉRIOS DE ACEITE

1. Cada opção leva a uma sequência de configuração diferente.
2. Uma conta nova consegue chegar a uma atividade de estudo concreta.
3. Quem já possui materiais consegue registrar e retomar seu progresso.
4. Quem já possui rotina consegue preservá-la.
5. Recarregar ou interromper o onboarding não perde as escolhas já salvas.
6. Login posterior não repete onboarding concluído.
7. Alterar o ritmo não apaga progresso nem substitui silenciosamente metas.
8. Nenhuma ação de onboarding gera XP.
9. Progresso anterior não é usado para fabricar pontuação competitiva.
10. As três jornadas funcionam em celular e por teclado.
11. Recursos sociais e rankings são acessíveis a todas as jornadas.
12. Integrações indisponíveis não são apresentadas como funcionais.

Implemente os fluxos completos, atualize a documentação e execute os testes pertinentes. Ao terminar, informe o que funciona, o que foi verificado e quais dependências externas ainda impedem alguma funcionalidade.

## Situação da implementação

Implementado nas jornadas de onboarding, com estado versionado em `state.onboarding` e sincronizado com a conta.

| # | Critério | Situação |
| ---: | --- | --- |
| 1 | Cada opção leva a uma sequência diferente | Implementado: 4 perguntas próprias por jornada, revisão e etapa social |
| 2 | Conta nova chega a uma atividade concreta | Implementado na jornada 1: material com tipo e primeira atividade |
| 3 | Quem já tem materiais registra e retoma | Implementado na jornada 2: prioridade e `resumeAt` |
| 4 | Quem já tem rotina preserva a rotina | Implementado na jornada 3: a rotina informada é guardada, não substituída |
| 5 | Interromper não perde escolhas | Implementado: etapa e respostas salvas a cada passo |
| 6 | Login posterior não repete onboarding | Implementado: estado vem da conta e `onboarded` decide a rota |
| 7 | Mudar de ritmo não apaga nem sobrescreve meta | Implementado: `weeklyGoalSource` distingue meta manual de sugerida |
| 8 | Nenhuma ação de onboarding gera XP | Implementado e verificado: histórico permanece vazio |
| 9 | Progresso anterior não fabrica pontuação | Implementado: onboarding não cria evento; o ranking usa só XP confirmado pelo servidor |
| 10 | Três jornadas em celular e teclado | Verificado por testes e2e em desktop e mobile |
| 11 | Recursos sociais acessíveis a todas as jornadas | Amigos e ranking de amigos implementados; mensagens diretas planejadas. Grupos estão fora do escopo desta etapa |
| 12 | Integrações indisponíveis não parecem funcionais | Implementado: a tela declara acompanhamento manual e ausência de integração automática |

Pendências externas e de produto: mensagens diretas entre amizades, colaboração em projetos, integrações por área (GitHub e outras) e envio de e-mail da recuperação de senha. Grupos, comunidades, canais e servidores estão fora do escopo. Nenhuma dessas pendências bloqueia as jornadas; o que não existe aparece como indisponível.

Verificação executada nesta rodada: `npm run build`, `npm test` (149 testes Node) e `npm run test:e2e` (54 cenários, desktop e mobile).
