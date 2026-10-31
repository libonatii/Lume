# Lume — funcionalidades pendentes e incompletas

> Atualizado em 31/10/2026. Este é o registro de lacunas do projeto: o que ainda não existe, o que está
> parcial e o que está em andamento. Ele complementa [Continuidade](CONTINUIDADE.md) (o que já funciona);
> a direção do produto continua em [Produto](PRODUTO.md) e as regras de pontuação em
> [Gamificação](GAMIFICACAO.md).
>
> **Legenda:** **Não implementado** · **Parcial** · **Em andamento** (working tree, sem commit/publicação) ·
> **Intencional** (decisão tomada, não tratar como pendência).
>
> Um item só sai desta lista quando o fluxo completo existe, tem teste correspondente e não depende de
> simulação. Aparência de botão ou tela não conta como conclusão.

## 1. Resumo por área

| Área | Estado | O que mais trava o restante |
| --- | --- | --- |
| Gamificação | Legado | Nova política de XP, livro de eventos e validação no servidor não existem |
| Ranking e social | Não implementado | Depende da gamificação validada e de grupos |
| Biblioteca | Parcial | Importa e cria a primeira trilha por área, mas não edita/exclui nem modela tipos de material |
| Importação | Parcial | Lê grade pública, mas não lê progresso nem contorna login |
| Slides | Não implementado | Não há criação, visualização interna nem progresso por slide |
| Contas | Parcial | Sem envio de e-mail, reconciliação ou restauração de backup |
| Companion | Parcial | App pronto para uso local; presença social, notificações e assinatura pendentes |
| Consistência | Parcial | Textos desatualizados e código legado ainda referenciado por testes |

## 1.1 Entregue nesta rodada (31/10/2026)

- **Detecção por link com adição direta:** colar um link inicia a análise; sem `https://` também funciona; o botão
  "Detectar e adicionar" usa todas as aulas encontradas sem abrir a revisão. A revisão continua disponível.
- **Biblioteca sem cursos de exemplo:** o estado inicial começa vazio; a Biblioteca pergunta a área de atuação
  e cria a primeira trilha com o primeiro passo digitado. Exemplos antigos sem progresso são removidos na
  restauração; exemplos com progresso são preservados.
- **Tarefas de prova:** lista com prazo e vínculo opcional a curso; concluir vale 10 XP de legado uma vez,
  criar/organizar não gera XP. Ver a regra transitória em [Gamificação](GAMIFICACAO.md#tarefas-de-prova--regra-em-execução-no-protótipo).


## 2. Gamificação e conquistas

**G1 — Política de XP da versão com contas.** **Não implementado.**
- Hoje o XP é calculado no navegador pelo modelo legado: 5 XP por preparação, 10 XP por etapa, 10 XP por
  tarefa de prova e nível a cada 100 XP (`completeMission`, `levelInfo` e `public/tasks-domain.js`).
- A política de `docs/GAMIFICACAO.md` (blocos de 30 min, 100 por aula/leitura, 150 por entrega, 500 de
  bônus, teto diário, nível a cada 500 XP) não tem implementação nem tela.
- Falta o livro de eventos com chave de idempotência, origem, versão da política e correções; sem ele,
  recarregar ou repetir uma requisição pode duplicar recompensa.
- O servidor recebe apenas a cópia do estado por `/api/state`; não valida nem atribui XP.
- Pronto quando: o servidor concede eventos únicos por material/conclusão, o extrato explica cada valor e
  repetir o envio não duplica nada.

**G2 — Migração e separação do saldo legado.** **Não implementado.**
- `restoreState` preserva o histórico, mas não identifica nem separa o saldo antigo do novo XP elegível.
- Não há classificação de etapas genéricas como material, nem conversão de preparação em conclusão — e não
  deve haver conversão automática.
- A interface rotula "+XP de legado", o que não substitui a migração descrita em `GAMIFICACAO.md`.

**G3 — Conquistas personalizadas por material.** **Parcial.**
- `achievements()` em `public/domain.js` devolve seis selos genéricos por contagem (primeira missão, três
  missões, um curso, cinco dias etc.). Não existe conquista com o nome do curso, da leitura ou do projeto.
- O perfil entre amigos já exibe os selos e a última desbloqueada, mas não permite escolher quais
  conquistas aparecem.
- Falta registrar critério, origem, data e visibilidade por conquista.

**G4 — Ranking.** **Não implementado.**
- Existe apenas o item "Ranking" marcado como planejado no menu (`Shell.jsx`) e textos que dizem que os
  placares não estão disponíveis.
- Falta API, tela e as três classificações obrigatórias: nível acumulado, cursos distintos concluídos e
  empenho no período, com período visível, empates, opt-out e exclusão explícita do legado.
- Depende de G1/G2: um placar compartilhado não pode usar XP calculado pelo navegador.

**G5 — Tempo elegível e blocos de estudo.** **Não implementado.**
- A sessão declarada conta tempo e aparece em Meu caminho, mas não gera XP nem bloco elegível.
- Falta acumulador de 30 minutos, teto diário de 200 XP, tratamento de abas simultâneas e fuso.

**G6 — Nível pela nova fórmula.** **Não implementado.**
- `levelInfo` usa 100 XP por nível; a proposta é 500 XP, com nível 1 inicial e saldo legado separado.

## 3. Biblioteca, materiais e continuidade

**B1 — Criação manual e edição de cursos (botões de adicionar cursos).** **Parcial.**
- O estado vazio da Biblioteca pergunta **qual área de atuação a pessoa quer estudar** e cria a primeira
  trilha com o primeiro passo informado (`addMaterial(..., 'manual')`). Isso é coberto pelo e2e.
- **Adicionar curso** e **Adicionar um novo interesse** abrem a importação por link; o botão
  **Detectar e adicionar** importa todas as aulas encontradas sem abrir a revisão.
- Ainda não existe formulário para criar um curso vazio, adicionar uma etapa depois, renomear, excluir,
  reordenar ou marcar um curso como exemplo. Não há confirmação de exclusão nem desfazer para curso.
- Pronto quando: editar título, adicionar/remover etapas e excluir com confirmação, com teste de navegador
  para cada ação.

**B2 — Materiais tipados e progresso por tipo.** **Parcial.**
- `STUDY_TYPES` existe e o onboarding grava `type` (`lesson`, `article`, `exercise`, `project`, `course`),
  mas todas as telas tratam o material como uma lista plana de etapas.
- Não existe posição de vídeo, página/seção de PDF, capítulo de livro, lista de exercícios com tentativas
  nem entregas de projeto. "Projeto" é apenas um rótulo com a flag `shared`.
- Não há retomada automática: o ponto salvo é texto livre (`resumeAt`) ou a próxima etapa.

**B3 — Progresso automático e integrações de estudo.** **Não implementado.**
- Nenhuma fonte importada informa aulas assistidas; a conclusão é manual e identificada.
- GitHub não tem conexão: existem apenas `GITHUB_CAPABILITIES` e `deliveryCandidates` (sugestões a partir
  de issues), sem OAuth, leitura de repositórios, entregas ou validação.
- Player com posição/cobertura/tempo elegível não existe.

**B4 — Desfazer e corrigir progresso.** **Parcial.**
- Aula importada tem "desfazer" para registro manual (`revertLessonCompletion`); etapas de cursos legados
  não têm desfazer, e o histórico não permite correção com explicação.
- Não há edição de data, origem ou motivo de um registro.

**B5 — Trilhas, objetivos e entregas.** **Não implementado.**
- Não há tela de trilhas/projetos, critérios de conclusão por projeto, entregas obrigatórias nem colaboração
  em entregas. "Trilhas" na interface significa apenas a lista de cursos.

**B6 — Cursos de exemplo.** **Resolvido nesta rodada.**
- `createInitialState` não cria mais Design, Python e Inglês de demonstração.
- Exemplos antigos sem nenhum progresso são removidos ao restaurar; exemplos com histórico ou aula
  concluída permanecem para não apagar dados. `selectedCourseId` cai para a primeira trilha real ou `null`.

**B7 — Slides de estudo (adicionar slide, visualizar e XP perto do fim).** **Não implementado.**
- Não existe modelo de slide, editor, visualizador interno nem progresso por slide. A Biblioteca só conhece
  cursos com etapas e aulas importadas.
- O pedido é permitir **adicionar slides** a um material/curso, abrir e navegar pelo slide **dentro do
  programa** (sem depender de site externo) e conceder XP quando a pessoa estiver **perto de terminar** o
  slide/deck.
- Decisões pendentes antes de implementar: o que é "perto do fim" (percentual de slides vistos, último
  slide, confirmação explícita?), se o XP é parcial ou só na conclusão, como impedir farm ao reabrir, e
  onde os slides ficam armazenados (estado da conta ou objeto binário).
- Restrições já conhecidas: XP de slide precisa de evento idempotente validado no servidor; visualização
  com teclado e leitor de tela; nada de conceder XP por abrir, rolar ou clicar sem registrar avanço real;
  o modo essencial/movimento reduzido continua fora do escopo por decisão da responsável.
- Pronto quando: criar/editar/reordenar slides, abrir no programa, salvar posição, registrar conclusão
  uma única vez e cobrir o fluxo com testes de domínio e de navegador.

## 4. Importação, IA, edital e GitHub

**I1 — Extração por plataforma.** **Parcial.**
- A leitura depende do HTML público: Coursera e Alura funcionam parcialmente; Udemy devolve 403;
  Rocketseat e DIO não publicam títulos de aula; Gran/Estratégia normalmente exigem login.
- Não há contorno de login, paywall ou proteção antibot, por decisão de produto.
- Os testes automatizados usam HTML sintético; nenhum teste faz requisição real às plataformas. A
  verificação real de 31/10/2026 está em [Importação](IMPORTACAO.md#4-o-que-foi-realmente-verificado-nesta-rodada).
- Falta ampliar adaptadores e manter fixtures por provedor para evitar regressão.

**I2 — Progresso já existente na plataforma.** **Não implementado.**
- A importação lê a grade, não as aulas já concluídas. Reimportar preserva o progresso local, mas não
  importa o progresso da conta na fonte.

**I3 — Edital e cobertura OAB.** **Parcial.**
- `EDITAL_SOURCES` está vazio de propósito (`public/import-domain.js`), então a comparação de cobertura
  nunca é calculada; a tela só pede edição e fase.
- Falta cadastrar um edital com fonte e data conferidas e validar o fluxo com o link real do Gran/OAB.

**I4 — Organizador por IA em produção.** **Parcial.**
- `organizeWithAI` só roda com `LUME_AI_API_KEY` (ou `OPENAI_API_KEY`); sem chave, o organizador
  determinístico responde.
- Não há chave declarada no `wrangler.jsonc`; se existir um secret no Worker, ele não está documentado nem
  tem teste com provedor real, custo ou latência medidos.

**I5 — Conexão com GitHub.** **Não implementado.**
- Ver B3. As capacidades declaradas em `GITHUB_CAPABILITIES` não estão ligadas a nenhuma tela ou API.

## 5. Contas, privacidade e dados

**C1 — Envio de e-mail da recuperação.** **Não implementado.**
- O pedido gera token de 30 minutos e link; no servidor local o link pode voltar na resposta, e no Worker
  com `SHOW_RESET_LINK=false` ele fica só no log. Não há transporte de e-mail.
- Falta escolher provedor, template, tratamento de bounce e teste de entrega.

**C2 — Verificação de e-mail, login social e segundo fator.** **Não implementado.**
- Só existe cadastro/login com e-mail e senha. Google é citado como complemento opcional no produto, mas
  não está implementado; não há verificação de posse do e-mail nem 2FA.

**C3 — Gestão da conta autenticada.** **Parcial.**
- Cadastro, login, saída e recuperação por link funcionam. Não há troca de senha estando logada, exclusão
  de conta, lista de sessões ativas nem encerramento remoto de sessões (a redefinição encerra todas).

**C4 — Reconciliação entre dispositivos.** **Não implementado.**
- `/api/state` grava a cópia inteira; a última escrita vence. Não há versão, merge, detecção de conflito
  nem resolução visível. Duas abas/dispositivos podem sobrescrever progresso um do outro.

**C5 — Restaurar backup.** **Parcial.**
- Exportar JSON existe em Configurações. Importar a cópia não existe: a própria interface avisa
  "A importação ainda não foi implementada".
- Falta validar o arquivo, mostrar o que será mesclado e preservar o estado atual antes de aplicar.

**C6 — Migração dos dados locais para a conta.** **Parcial.**
- Ao entrar, a cópia local é preservada como `before-account`, mas o estado remoto substitui o local; não
  há escolha explícita de mesclar ou substituir.
- Ao sair, o estado é copiado para `account-backup` e o navegador volta ao estado inicial.

**C7 — Fotos de perfil e atividade recente.** **Em andamento (working tree).**
- `media.js`, as rotas `/api/profile/media/:slot`, o binding R2 `MEDIA`/`lume-media` e o diretório local
  `data/media/` implementam avatar e capa; `public/profile-domain.js` ganhou atividade recente e
  estatísticas de 14 dias, e o perfil mostra os selos.
- Ainda não há commit nem publicação. Antes do deploy é preciso garantir o bucket R2 `lume-media` na conta
  Cloudflare, conferir o binding no Worker e repetir o e2e de upload.

**C8 — XP e progresso validados no perfil.** **Parcial.**
- O perfil entre amigos exibe o que a pessoa compartilhou, mas XP, nível e progresso vêm da cópia
  sincronizada e são declarados, não validados. Isso é correto enquanto G1 não existir; não usar esses
  números em ranking.

## 6. Amigos, grupos e presença social

**S1 — Grupos e metas coletivas.** **Não implementado.**
- Não há criação de grupo, convite de grupo, papéis, privacidade nem painel. O onboarding mostra o cartão
  "Entrar em um grupo" com botão desabilitado.
- Também não há metas coletivas opcionais com contribuição individual identificável.

**S2 — Compartilhamento de aprendizados e feed.** **Não implementado.**
- Não há publicações, notas, resumos, links, curtidas, comentários nem vitrine social de descobertas.
- Compartilhar uma conquista ou um aprendizado com amigos também não existe; o perfil só mostra o que a
  pessoa marcou nas seções de privacidade.

**S3 — Mensagens e comunicação.** **Não implementado.**
- Não há chat, sala de estudo, notificações sociais ou moderação de conversa.

**S4 — Segurança social.** **Não implementado.**
- Amigos podem ser removidos, mas não há bloqueio, denúncia, silenciamento, prevenção de spam ou regras de
  moderação.

**S5 — Presença social / rich presence.** **Não implementado.**
- A presença local existe e mostra aplicativo, categoria, desde quando e computador — mas **só para a
  própria pessoa** (`Companion.jsx`, `companion/domain.mjs`).
- Não há exibição da presença para amigos, integração com Discord Rich Presence, HUD no desktop nem
  histórico de presença. Presença continua sem XP por decisão.

**S6 — Escolha de conquistas no perfil.** **Parcial.**
- O perfil exibe todos os selos disponíveis (quando XP está compartilhado); falta escolher individualmente
  quais aparecem, como já acontece com projetos.

## 7. Companion (app de desktop)

**P1 — Presença social.** Ver S5. A presença atual é local e privada.

**P2 — Notificações e lembretes de pausa.** **Não implementado.**
- Não há notificações nativas nem configuração de lembretes no app ou no site.

**P3 — HUD discreto.** **Não implementado.**
- O painel de presença é uma janela separada; não há HUD sempre visível com tempo e próxima aula.

**P4 — Biblioteca local e roteiro offline.** **Não implementado.**
- O painel mostra o roteiro vindo da API; sem rede, não há lista local de cursos nem fila de presença para
  sincronizar depois.

**P5 — Retomada direta pelo painel.** **Não implementado.**
- O painel mostra a próxima aula e o motivo, mas não abre a aula no navegador pelo link da fonte.

**P6 — Início com o Windows.** **Não implementado.**
- Não há `setLoginItemSettings` nem opção explícita/reversível de iniciar com o sistema.

**P7 — Instalador assinado.** **Não implementado.**
- O NSIS é publicado pelo GitHub Actions sem assinatura; o Windows pode avisar na primeira execução.

**P8 — Atualização automática.** **Parcial.**
- A janela consulta a última release `companion-v*`, baixa o `Lume-setup.exe` com progresso e abre o
  instalador, mas só por clique; não há atualização em segundo plano.

**P9 — Publicação da versão atual.** **Pendente de ação.**
- `companion/package.json` está em 0.5.1; a última release publicada é `companion-v0.5.0`. É preciso
  decidir se a 0.5.1 vira tag ou se as mudanças locais entram em outra versão.

**P10 — Validação do Electron no CI.** **Parcial.**
- O CI verifica sintaxe e um contrato de presença; existe `npm --prefix companion run smoke`, mas ele não
  roda no workflow. A janela, a bandeja e o IPC não são exercitados automaticamente.

**P11 — Outras plataformas.** **Não implementado.**
- Só Windows x64; não há suporte a Linux/macOS.

## 8. Interface e textos desatualizados

**U1 — `Companion.jsx` afirma que amigos e grupos não existem.** **Corrigir.**
- Amigos já existem. A frase deve dizer que grupos e presença social ainda não existem, sem negar o que já
  foi entregue.

**U2 — `Auth.jsx` lista "Amigos, grupos e ranking" como planejados.** **Corrigir.**
- Amigos estão implementados; separar "amigos" de "grupos" e "ranking" na lista de recursos.

**U3 — Preferências sem notificações.** **Parcial.**
- A tabela de telas do produto prevê notificações; Configurações não tem nenhum controle de lembrete,
  frequência ou silêncio.

**U4 — Textos de "planejado" dependem do estado real.** **Manter.**
- Ranking no menu e grupo no onboarding estão marcados como planejados e sem ação; isso é correto e deve
  continuar até os recursos existirem.

**U5 — Campo `essential` e apoios legados.** **Intencional, com ressalva.**
- Modo essencial e movimento reduzido foram retirados por decisão da responsável; `preferences.essential`
  e `supports` permanecem apenas para compatibilidade dos dados.
- `STUDY_SUPPORTS` ainda descreve `calm` como "Ativar o modo essencial na página Hoje", o que não acontece
  mais. Se a constante continuar existindo, o texto precisa deixar claro que é legado.

## 9. Código legado, duplicado ou sem uso

> Limpeza não deve apagar dados de contas. Campos antigos continuam aceitos por `restoreState`.

**D1 — CSS não referenciado.** **Candidato a remoção.**
- `index.astro` carrega apenas `/lume.css`. `public/entry.css`, `public/neurofocus.css`,
  `public/styles.css`, `public/stitch.css` e `public/motion.css` não são importados por nenhuma tela.
- `stitch.css` é citado em `designs/stitch/README.md` e em `CONTINUIDADE.md` como origem do sistema visual;
  se for mantido como referência de design, deve sair de `public/` ou ser documentado como não carregado.
- Confirmar com uma busca por classes antes de remover; capas em `public/assets/stitch/` continuam em uso.

**D2 — Onboarding antigo ainda testado.** **Candidato a remoção.**
- `applyStudyRhythm` só é usado por `domain.test.js`; o fluxo atual usa `startJourney`,
  `saveOnboardingAnswer` e `completeJourney`.
- `HABITS` e `CHALLENGES` duplicam conceitos da nova jornada (`STUDY_RHYTHMS`) e sobrevivem apenas para
  restaurar dados antigos. Separar o que é compatibilidade do que é código morto.

**D3 — Exportações sem uso.** **Candidato a remoção.**
- `importXp()` e `selectedCount()` em `public/import-domain.js` não são chamados por nenhuma tela ou teste.
- `providerSummary()` em `import-server.js`, `emptySessionState()` em `public/session-domain.js` e
  `GITHUB_CAPABILITIES` (só documentado) também não têm consumidor.
- Antes de remover, decidir se `GITHUB_CAPABILITIES` será a base da futura tela de integração.

**D4 — Constantes exportadas sem uso externo.** **Baixo risco.**
- `MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_BYTES`, `INVITE_TTL_MS`, `MAX_DOCUMENT_BYTES`, `PLAN_LIMIT` e
  semelhantes são usadas dentro do próprio módulo; exportar não é bug, mas não induzir a crer que há
  configuração externa.

**D5 — Documentação duplicada por rodada.** **Corrigido nesta atualização.**
- O brief antigo de onboarding foi preservado no anexo deste arquivo; não use os números de teste dele
  (28/10) como estado atual. A referência vigente é a seção de verificação abaixo.

## 10. Ordem sugerida

1. **Consistência primeiro:** corrigir U1/U2, decidir D1–D3, commitar e publicar C7 com o bucket R2.
2. **Fundação de XP:** G1, G2, G5 e C4. Sem isso, ranking e perfil validado não podem existir.
3. **Ranking:** G4, com opt-out, três abas e regras de empate.
4. **Social:** S1, S2, S3, S4 e S5 (presença social/rich presence).
5. **Biblioteca e integrações:** B1–B5, B7, I1–I5.
6. **Companion:** P2–P11, depois da fundação de XP e da decisão de release.

Dependências explícitas: G4 depende de G1/G2; S5 depende de S1/S2; C8 depende de G1; P5 depende de B3/B4;
B3 depende de adaptadores com capacidades declaradas.

## 11. Verificação antes de dizer "pronto"

```sh
npm test          # 105 testes Node de domínio/autenticação/importação/Companion/sessão/amigos/perfil/tarefas
npm run build     # Astro + CSP
npm run test:e2e  # 32 cenários, desktop e celular
```

- O e2e de importação **simula** a análise por interceptação de rota; ele não prova extração real.
- O e2e usa `data/e2e-*` e `LUME_ATTEMPT_LIMIT=200`; não rode cenários em paralelo.
- Teste de upload de imagem e atividade recente faz parte do working tree; repetir depois do commit.
- O e2e de tarefas cobre criar, concluir, reabrir e recarregar; o de detecção cobre link sem `https` e adição
  sem revisão.
- Para o Companion, além dos testes, rodar `npm --prefix companion run smoke` em uma sessão com desktop
  interativo quando a mudança afetar janela, bandeja ou IPC.

## 12. Não são lacunas (decisões tomadas)

- Modo essencial e tratamento de movimento reduzido foram retirados por decisão da responsável.
- Não há busca de amigos por e-mail: o convite por link é o caminho definido.
- O Lume não hospeda cursos nem observa qualquer site externo.
- A prévia sem conta é temporária; login com e-mail e senha é requisito do produto.
- Presença, importação, onboarding, convite e mensagens não geram XP.

---

# Anexo — brief histórico: onboarding (rodada anterior)

> Preservado como registro. Este texto descreve uma tarefa já executada e não é a lista vigente de
> pendências; consulte as seções acima. A tabela "Situação da implementação" no fim do anexo é daquela
> rodada (28 testes de domínio e 10 cenários de navegador) e não representa o estado atual.

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
| 9 | Progresso anterior não fabrica pontuação | Implementado: não há ranking nem evento de XP no onboarding |
| 10 | Três jornadas em celular e teclado | Verificado por testes e2e em desktop e mobile |
| 11 | Recursos sociais acessíveis a todas as jornadas | Parcial: a etapa social aparece em todas e informa o que não existe. Amigos, grupos e ranking não estão implementados |
| 12 | Integrações indisponíveis não parecem funcionais | Implementado: a tela declara acompanhamento manual e ausência de integração automática |

Pendências externas e de produto: convites de amigos, grupos por convite, ranking por nível/cursos/empenho, integrações por área (GitHub e outras) e envio de e-mail da recuperação de senha. Nenhuma delas bloqueia as jornadas; todas aparecem na interface como indisponíveis.

Verificação executada: `npm run build`, `npm test` (28 testes de domínio) e `npm run test:e2e` (10 cenários, desktop e mobile).
