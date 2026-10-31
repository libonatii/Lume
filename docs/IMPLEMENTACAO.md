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
>
> O brief vigente desta rodada está na seção 13. O anexo ao fim é histórico.

## 1. Resumo por área

| Área | Estado | O que mais trava o restante |
| --- | --- | --- |
| Gamificação | Fundação implementada | XP validado no servidor, níveis de 500, blocos de tempo e teto diário; falta migração assistida de casos ambíguos e correções com explicação |
| Ranking | Implementado entre amigos | Três abas, opt-in, empates e período; grupos e ranking público estão fora desta etapa |
| Mensagens diretas e colaboração | Implementado o núcleo | DMs, bloqueio, não lidas, referências e convites de entrega; falta feed, OAuth GitHub e notificações nativas |
| Biblioteca | Implementado o essencial | Criação manual, edição, exclusão com confirmação, etapas editáveis, tipos e posição estruturada por tipo; slides com imagem dependem de R2 |
| Organização | Não implementado | Sem anotações, listas com prioridade, quadro de projeto ou modelos |
| GitHub | Parcial | Leitura pública de README/issues/milestones e criação de projeto; sem OAuth, repositórios privados ou escrita |
| Importação | Parcial | Lê grade pública e progresso marcado na página copiada; não contorna login nem consulta progresso por API |
| Slides | Implementado | Criação, edição, ordem, visualização interna, progresso, imagens via R2 e XP único |
| Contas | Parcial | Envio por Resend configurável, reconciliação por revisão e restauração de cópia; falta envio global testado e sessões ativas |
| Companion | Parcial | App pronto para uso local; presença social, notificações e assinatura pendentes |
| Consistência | Parcial | Documentação e textos ainda mencionam grupos; grupos estão fora do escopo |

## 1.1 Entregue antes deste brief (31/10/2026)

- **Detecção por link com adição direta:** colar um link inicia a análise; sem `https://` também funciona; o botão
  "Detectar e adicionar" usa todas as aulas encontradas sem abrir a revisão. A revisão continua disponível.
- **Biblioteca sem cursos de exemplo:** o estado inicial começa vazio; a Biblioteca pergunta a área de atuação
  e cria a primeira trilha com o primeiro passo digitado. Exemplos antigos sem progresso são removidos na
  restauração; exemplos com progresso são preservados.
- **Tarefas de prova:** lista com prazo e vínculo opcional a curso; concluir vale 10 XP de legado uma vez,
  criar/organizar não gera XP. Ver a regra transitória em [Gamificação](GAMIFICACAO.md#tarefas-de-prova--regra-em-execução-no-protótipo).

## 1.2 Entregue nesta rodada (31/10/2026)

- **XP validado no servidor:** livro de eventos com chave de idempotência, política v1 (100 por aula/leitura/exercício,
  150 por entrega, 500 por curso/projeto e 100 por apresentação), nível a cada 500 XP e extrato em Meu caminho.
- **Tempo elegível:** sessão declarada encerrada vira bloco de 30 minutos no servidor, com sobra acumulada,
  desconto de sobreposição e teto diário de 200 XP de tempo.
- **Saldo legado separado:** registros antigos continuam preservados e visíveis como legado; novas conclusões
  registram `xp: 0` no histórico do navegador. Preparação nunca concede XP.
- **Ranking de amigos:** três abas (nível, cursos concluídos e empenho), semana/mês, fuso visível, empates
  compartilhados, opt-in reversível e exclusão explícita do legado. Grupos e ranking público ficam fora.
- **Conquistas personalizadas:** curso, projeto, leitura, lista de exercícios e apresentação geram conquista
  com o nome do material, critério, origem e data; selos do protótipo ficam em seção de legado.
- **Biblioteca editável:** criação manual, edição de título/tipo/retomada, adicionar/renomear/reordenar/remover
  etapas, exclusão com confirmação e tipos videoaula, artigo, livro, exercício, projeto e curso.
- **Slides internos:** criação, edição, ordem, visualizador com teclado, progresso por slide e conclusão única
  quando 80% do deck foi visto, o último slide foi aberto e a pessoa confirma.
- **Importação com progresso observado:** a página copiada da conta pode marcar aulas concluídas; elas entram
  como histórico `import`, não geram XP e não podem ser convertidas em conclusão manual.
- **Restauração de cópia:** prévia do que será mesclado, preservação do estado anterior e mesclagem que não
  substitui preferências, privacidade ou onboarding atuais.
- **Consistência:** textos de Amigos, Companion e Entrada deixam de tratar grupos como pendência; mensagens
  diretas são o próximo passo social.
- **Mensagens diretas:** conversas entre amizades, histórico, não lidas, referência de material, bloqueio/desbloqueio,
  preferência de notificação e contador no menu. Sem desconhecidos, grupos ou canais.
- **Reconciliação:** `/api/state` usa revisão otimista; em conflito, o cliente mescla cursos, conclusões, histórico,
  tarefas, sessões e slides e preserva preferências desta sessão.
- **GitHub:** leitura pública de README, issues e milestones, com sugestões de entrega e criação de projeto. Sem OAuth,
  repositórios privados, escrita ou XP por analisar.
- **Colaboração:** convite de uma amizade para uma entrega específica de projeto, com aceite/recusa e cancelamento;
  aceitar não copia o projeto, não dá acesso ao GitHub e não gera XP.
- **Posição por tipo:** vídeo (tempo), artigo (página/seção), livro (capítulo), exercícios (questão/tentativas) e
  projeto (próxima entrega), com rótulo legível.
- **Imagens de slides:** upload para R2/local, validação de formato, substituição e remoção. Em produção, depende de
  R2 habilitado na conta.
- **Correção de XP:** ajuste negativo com motivo no extrato, revogação da conquista vinculada e chave idempotente;
  classificação de materiais antigos sem recriar XP.
- **E-mail:** recuperação por Resend quando configurado; sem provider, mantém o fallback local/produção documentado.


## 2. Gamificação e conquistas

**G1 — Política de XP da versão com contas.** **Implementada no servidor.**
- `xp.js` mantém o livro de eventos (`xp_events`) com chave de idempotência, origem, tipo, material, versão da
  política, data e dia local. O navegador apenas pede a concessão; o servidor revalida o estado sincronizado.
- Valores em execução: 100 XP por aula/leitura/lista de exercícios, 150 por entrega de projeto, 100 por
  apresentação, 500 de bônus por curso/projeto e 25 por bloco de 30 minutos, com teto diário de 200 XP de tempo.
- `completeMission` grava novas conclusões com `xp: 0` no histórico do navegador; o XP elegível aparece apenas
  no extrato do servidor. Preparação não concede XP.
- Correção assistida: um evento positivo pode receber um ajuste negativo com motivo, vinculado ao original, e a
  conquista correspondente é revogada. Repetir a correção não duplica o ajuste.
- Ainda falta: edição de data/origem, migração assistida de conclusões genéricas antigas e teste de concorrência
  entre dispositivos no Worker publicado.

**G2 — Migração e separação do saldo legado.** **Implementada como separação; sem conversão automática.**
- O saldo antigo continua no histórico local e é exibido em uma seção “Saldo legado”, fora do nível novo e do
  ranking. Nenhum registro antigo é apagado ou convertido em aula/leitura concluída.
- O servidor só considera eventos posteriores a `xp_settings.eligible_since`; progresso importado marcado como
  `historical`/`import` também fica fora.
- A classificação de materiais antigos existe em Configurações: a pessoa pode ajustar o tipo e marcar planejamento,
  sem recriar XP antigo. A migração assistida de etapas genéricas ambíguas continua pendente; a regra atual é conservadora.

**G3 — Conquistas personalizadas por material.** **Parcial.**
- Curso, projeto, leitura, lista de exercícios e apresentação geram conquista com título do material, critério,
  origem, data e visibilidade `friends` no livro `user_achievements`.
- A vitrine separa conquistas validadas dos seis selos genéricos do protótipo, que ficam em seção de legado.
- Falta permitir escolher individualmente quais conquistas aparecem no perfil e revisar a visibilidade por grupo
  (grupos estão fora desta etapa).

**G4 — Ranking.** **Implementado entre amigos.**
- `GET /api/ranking?tab=level|courses|effort&period=week|month` calcula nível, cursos distintos e empenho a partir
  de `xp_events`, com período e fuso visíveis, empates compartilhados e opt-in reversível.
- A tela `#ranking` oferece as três abas, semana/mês, regras e botão para entrar/sair. O legado e tarefas de prova
  ficam fora.
- Grupos e ranking público continuam fora do escopo; a participação é opcional.

**G5 — Tempo elegível e blocos de estudo.** **Implementado.**
- A sessão declarada encerrada é enviada ao servidor com início, fim e duração; o servidor desconta sobreposição
  entre sessões, acumula sobras, fecha blocos de 30 minutos e aplica o teto diário de 200 XP.
- O fuso do perfil define o dia; eventos já concedidos não são reprocessados por mudança de fuso.
- Limitação: o tempo é declarado, não observado; a interface diz isso e não usa presença do Companion como estudo.

**G6 — Nível pela nova fórmula.** **Implementado.**
- `levelProgress` usa 500 XP por nível, nível 1 inicial e saldo legado separado. O Shell mostra o XP elegível
  quando há conta; a prévia local mostra o saldo local e não vale para ranking.

## 3. Biblioteca, materiais e continuidade

**B1 — Criação manual e edição de cursos (botões de adicionar cursos).** **Implementado o essencial.**
- O estado vazio da Biblioteca pergunta **qual área de atuação a pessoa quer estudar** e cria a primeira
  trilha com o primeiro passo informado (`addMaterial(..., 'manual')`). O botão **Criar manualmente** abre um
  formulário com título, tipo, link e etapas, mesmo quando a biblioteca já tem materiais.
- **Adicionar curso** continua abrindo a importação por link. No detalhe do material, **Editar material** permite
  mudar título, tipo, link e ponto de retomada, adicionar, renomear, reordenar e remover etapas. **Excluir**
  pede confirmação e remove o progresso dependente; o XP já confirmado permanece no extrato.
- Cursos importados têm as etapas vindas da fonte e usam **Atualizar grade**; título, tipo e retomada continuam
  editáveis.
- Coberto por `library-slides.spec.js` em desktop e celular.

**B2 — Materiais tipados e progresso por tipo.** **Implementado o modelo declarado.**
- `STUDY_TYPES` inclui aula, videoaula, artigo/leitura, livro, lista de exercícios, projeto e curso. O onboarding
  e a criação manual gravam o tipo; a Biblioteca mostra o rótulo e o editor guarda posição estruturada: tempo de
  vídeo, página/seção, capítulo, questão/tentativas ou próxima entrega.
- O ponto salvo continua sendo **declarado**; não há player, leitura de PDF ou retomada automática de site externo.
- `resumeAt` permanece como rótulo legível e dados antigos continuam válidos.

**B3 — Progresso automático e integrações de estudo.** **Parcial.**
- A página copiada da conta pode trazer aulas marcadas como concluídas; elas entram como histórico `import`,
  não geram XP e não são convertidas em conclusão manual. Isso não é uma integração: é leitura do conteúdo
  que a pessoa copiou.
- GitHub não tem conexão: existem apenas `GITHUB_CAPABILITIES` e `deliveryCandidates`, sem OAuth, leitura de
  repositórios, entregas ou validação. Player com posição/cobertura/tempo elegível não existe.

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

**B7 — Slides de estudo (adicionar slide, visualizar e XP perto do fim).** **Implementado.**
- Cada material pode ter até 60 slides com título e texto. O editor permite adicionar, editar, reordenar e
  excluir; o visualizador abre dentro do Lume, salva o slide atual e navega por teclado (setas, Home, End).
- Decisão de “perto do fim”: a conclusão fica disponível quando a pessoa viu pelo menos **80% dos slides**, abriu
  o **último slide** e clicou em **Concluir apresentação**. O XP é único, de 100, e só o servidor o concede.
- O progresso fica em `course.slideProgress` (slides vistos, último slide e data de conclusão); reabrir não
  repete o evento. O evento usa a chave `slide|courseId`, tem origem manual e versão da política.
- Limitação: imagens são armazenadas no R2/bucket local e dependem de `MEDIA` habilitado; apresentações importadas
  de arquivos e vídeos dentro do slide ainda não são suportadas. Em produção, o binding R2 está desativado nesta conta.
- Coberto por `library-slides.spec.js` e `xp.test.js`.

**B8 — Favoritos e destaque de retomada.** **Parcial.**
- A Biblioteca já tem capas, busca, filtros, estados e próxima aula; Hoje já destaca o material em andamento.
- Não existe favoritar/desfavoritar, filtrar por favoritos nem uma escolha explícita de destaque no estilo
  "continuar" da biblioteca.
- Pronto quando: favoritar e desfavoritar cursos, filtrar por favoritos e refletir a escolha no destaque,
  sem gerar XP.

**B9 — Anotações, listas e quadro de andamento.** **Não implementado.**
- Não há anotações, resumos ou dúvidas vinculados ao material; nem listas de aulas e entregas com prioridade,
  quadro simples de projeto ou modelos básicos de curso, prova e projeto.
- Requisito: reutilizar os mesmos dados da biblioteca, das tarefas e das entregas; não criar um editor
  genérico de páginas nem exigir organização prévia para começar a estudar.
- Pronto quando: anotar a partir do material, listar pendências com prioridade, alternar lista/quadro e
  aplicar modelos, com persistência e testes de domínio e navegador.

## 4. Importação, IA, edital e GitHub

**I1 — Extração por plataforma.** **Parcial.**
- A leitura depende do HTML público: Coursera e Alura funcionam parcialmente; Udemy devolve 403;
  Rocketseat e DIO não publicam títulos de aula; Gran/Estratégia normalmente exigem login.
- Não há contorno de login, paywall ou proteção antibot, por decisão de produto.
- Os testes automatizados usam HTML sintético; nenhum teste faz requisição real às plataformas. A
  verificação real de 31/10/2026 está em [Importação](IMPORTACAO.md#4-o-que-foi-realmente-verificado-nesta-rodada).
- Falta ampliar adaptadores e manter fixtures por provedor para evitar regressão.

**I2 — Progresso já existente na plataforma.** **Parcial — progresso observado na página copiada.**
- A importação por link continua lendo a grade, não o progresso da conta. Quando a pessoa copia a página já
  aberta na própria conta, aulas com marcadores de conclusão (classe, `aria-checked`, `data-completed` ou texto
  “Concluído”) são identificadas e entram como histórico `import`/`historical`.
- Esse progresso não concede XP e não pode ser desfeito como conclusão manual; reimportar preserva o que já existe.
- Não há consulta autenticada por API nem contorno de login. O Lume não recebe senha, cookie ou sessão.

**I3 — Edital e cobertura OAB.** **Parcial.**
- `EDITAL_SOURCES` está vazio de propósito (`public/import-domain.js`), então a comparação de cobertura
  nunca é calculada; a tela só pede edição e fase.
- Falta cadastrar um edital com fonte e data conferidas e validar o fluxo com o link real do Gran/OAB.

**I4 — Organizador por IA em produção.** **Parcial.**
- `organizeWithAI` só roda com `LUME_AI_API_KEY` (ou `OPENAI_API_KEY`); sem chave, o organizador
  determinístico responde.
- Não há chave declarada no `wrangler.jsonc`; se existir um secret no Worker, ele não está documentado nem
  tem teste com provedor real, custo ou latência medidos.

**I5 — Conexão com GitHub.** **Parcial — leitura pública e colaboração.**
- `github.js` lê repositórios públicos (README, issues abertas e milestones), gera sugestões revisáveis e permite
  criar um projeto com as entregas escolhidas. Analisar ou criar não concede XP.
- Não há OAuth: nenhuma conta GitHub é conectada, nenhum token do usuário é pedido no formulário e repositórios
  privados não são acessados. Escrita, comentários e alteração de código estão fora.
- Colaboração: convite de uma amizade para uma entrega específica de projeto, com aceite/recusa e cancelamento.
  Aceitar no Lume não concede acesso ao repositório e não copia o material.
- Toda sugestão é marcada como sugestão; issues/milestones não são tratados como conclusão ou prova de estudo.

## 5. Contas, privacidade e dados

**C1 — Envio de e-mail da recuperação.** **Implementado quando configurado.**
- `email.js` envia a recuperação pelo Resend com `LUME_EMAIL_PROVIDER=resend`, `RESEND_API_KEY` e
  `LUME_EMAIL_FROM`; o link não aparece na resposta com provider ativo.
- Sem configuração, mantém o fallback: link no log e, apenas no modo local/teste, na resposta. Falta medir entrega,
  bounce e reputação em produção, além de decidir se o provedor será mantido.

**C2 — Verificação de e-mail, login social e segundo fator.** **Não implementado.**
- Só existe cadastro/login com e-mail e senha. Google é citado como complemento opcional no produto, mas
  não está implementado; não há verificação de posse do e-mail nem 2FA.

**C3 — Gestão da conta autenticada.** **Parcial.**
- Cadastro, login, saída e recuperação por link funcionam. Não há troca de senha estando logada, exclusão
  de conta, lista de sessões ativas nem encerramento remoto de sessões (a redefinição encerra todas).

**C4 — Reconciliação entre dispositivos.** **Implementado no documento de estado.**
- `/api/state` grava com `revision`; uma escrita baseada em revisão antiga recebe 409 com a cópia atual. O cliente
  mescla cursos, conclusões, histórico, tarefas, sessões e slides e tenta de novo, preservando as preferências
  desta sessão.
- A UI avisa quando a cópia de outro dispositivo foi mesclada. Conflitos de preferências simultâneas ainda são
  resolvidos a favor da sessão local, sem escolha detalhada por campo.

**C5 — Restaurar backup.** **Implementado.**
- Configurações exporta JSON e permite escolher uma cópia para restaurar. O arquivo é validado (formato, versão,
  tamanho de 2 MB), a prévia mostra materiais novos, conclusões e tarefas, e o estado atual é guardado em
  `lume.prototype.v1.before-import` antes de aplicar.
- A mesclagem preserva preferências, privacidade e onboarding atuais e não duplica cursos, etapas, histórico ou
  tarefas. O XP validado não viaja no arquivo: ele permanece no livro de eventos do servidor.

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

**C8 — XP e progresso validados no perfil.** **Parcial — XP validado, progresso declarado.**
- O perfil entre amigos consulta o livro de eventos do servidor e mostra XP, nível e conquistas validados quando
  a pessoa escolhe compartilhar XP. O saldo legado não entra.
- Percentuais de progresso e conclusões de materiais continuam vindo da cópia sincronizada e são declarados; a
  interface não os apresenta como validados. Grupos não existem nesta etapa.

## 6. Amigos, mensagens diretas e presença social

**S1 — Grupos, comunidades, servidores e canais.** **Intencional — fora do escopo; interface corrigida.**
- Decisão explícita de 31/10/2026: não há comunidades, servidores, canais ou grupos nesta etapa. O social se
  concentra em amigos, mensagens diretas entre amizades aceitas e colaboração em projetos.
- O cartão "Entrar em um grupo" foi removido do onboarding e os textos que prometiam grupos foram corrigidos;
  mensagens diretas aparecem como o próximo passo social. Ver U4.
- Metas coletivas por grupo também saem do escopo. Uma entrega colaborativa pode ter contribuição individual
  identificável sem criar um grupo.

**S2 — Compartilhamento de aprendizados e feed.** **Não implementado.**
- Não há publicações, notas, resumos, links, curtidas, comentários nem vitrine social de descobertas.
- Compartilhar uma conquista ou um aprendizado com amigos também não existe; o perfil só mostra o que a
  pessoa marcou nas seções de privacidade.
- O fluxo desta etapa compartilha referências por mensagem direta e mostra no perfil o que a pessoa escolheu;
  um feed social não é pré-requisito das DMs nem do ranking.

**S3 — Mensagens diretas.** **Implementado.**
- Conversas individuais entre amizades, histórico, não lidas, referência de material, bloqueio/desbloqueio e
  preferência de notificação. O menu mostra o contador de não lidas; abrir a conversa marca como lida.
- DMs apenas entre amizades aceitas; sem desconhecidos, grupos, canais ou chamadas. Remover a amizade bloqueia
  o acesso à conversa; bloquear interrompe novas mensagens e preserva o histórico.
- Referências mostram apenas tipo, título e id; nenhum conteúdo privado é copiado. Mensagens e notificações não
  geram XP.
- Coberto por `messages.test.js` e `tests/e2e/messages.spec.js`.

**S4 — Segurança social.** **Parcial.**
- Amigos podem ser removidos e contatos bloqueados/desbloqueados; não há denúncia, silenciamento por período,
  prevenção de spam além do limite de envio ou regras de moderação.
- Denúncia e moderação continuam pendentes.

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

**U1 — `Companion.jsx` afirma que amigos e grupos não existem.** **Corrigido.**
- A frase agora diz que amigos já podem ser convidados e que mensagens diretas e presença social ainda não existem;
  grupos não são citados como pendência.

**U2 — `Auth.jsx` lista "Amigos, grupos e ranking" como planejados.** **Corrigido.**
- A lista agora separa amigos e ranking de amigos (implementados) de mensagens diretas (próximo passo), sem
  mencionar grupos.

**U3 — Preferências sem notificações.** **Parcial, explícita.**
- Configurações agora tem uma seção “Notificações e lembretes” que informa que o recurso ainda não existe. Não há
  botão ou switch que finja um envio que não acontece.

**U4 — Textos de "planejado" dependem do estado real.** **Corrigido.**
- Ranking agora tem link real em `#ranking`; “Mensagens” aparece como planejado. O cartão de grupo foi substituído
  por mensagens diretas, porque grupos estão fora do escopo desta etapa.

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
  (28/10) como estado atual. O brief vigente está na seção 13; a referência de verificação é a seção 11.

## 10. Ordem sugerida

1. **Consistência e publicação:** commitar a rodada, conferir o bucket R2 `lume-media`, publicar e medir o Worker.
2. **Correção assistida de XP:** ajuste de evento com explicação no extrato e revisão de conclusões genéricas
   antigas; a base de XP, nível, tempo e ranking de amigos já está implementada.
3. **Biblioteca e progressão:** posição estruturada por tipo (vídeo, PDF, livro, exercícios), favoritos e
   trilhas/projetos. A criação, edição, exclusão, tipos básicos e slides já funcionam.
4. **Organização estilo Notion:** B9, reutilizando os dados de biblioteca, tarefas e entregas.
5. **Mensagens diretas e colaboração:** S3, S4, B5 e I5. Grupos, comunidades, canais e servidores estão fora
   do escopo; S1 permanece como decisão registrada, não como entrega.
6. **Presença social:** S5, depois das DMs e do perfil.
7. **Companion:** P2–P11, depois da fundação de XP e da decisão de release.

Dependências explícitas: G4 usa G1/G2; S5 depende de S3/perfil; C8 usa G1 para XP e mantém progresso declarado;
P5 depende de B3/B4; B3 depende de adaptadores com capacidades declaradas; colaboração em entrega depende de
B5 e I5. S2 (feed) não é pré-requisito do fluxo desta etapa; se for retomado, vem depois de DMs, colaboração
e ranking.

## 11. Verificação antes de dizer "pronto"

```sh
npm test          # 149 testes Node de domínio/autenticação/importação/Companion/sessão/amigos/perfil/tarefas/XP/biblioteca/backup/reconciliação/mensagens/e-mail/GitHub/colaboração
npm run build     # Astro + CSP
npm run test:e2e  # 54 cenários, desktop e celular
```

- O e2e de importação por link **simula** a análise por interceptação de rota; o teste de progresso copiado usa
  HTML real no domínio e não prova extração de uma plataforma específica.
- O e2e usa `data/e2e-*` e `LUME_ATTEMPT_LIMIT=200`; não rode cenários em paralelo.
- Os cenários novos cobrem editar/excluir material, criar manualmente, slides com teclado, restauração de cópia,
  XP idempotente, bônus, tempo, extrato e opt-in do ranking.
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
- Comunidades, servidores, canais e grupos estão fora do escopo desta etapa; o social se limita a amigos,
  mensagens diretas e colaboração em projetos.
- Conectar GitHub, enviar mensagens, aceitar convites ou fazer commits isolados não gera XP.
- Aceitar uma colaboração no Lume não concede acesso ao repositório no GitHub.

## 13. Brief vigente — plataforma social de estudos sem grupos (31/10/2026)

> Pedido vigente registrado nesta rodada. A base social sem grupos, a biblioteca editável, os slides, o XP
> validado e o ranking de amigos já foram implementados; mensagens diretas, colaboração e GitHub continuam
> pendentes. A mudança de escopo social já foi refletida nos documentos de produto. Onde este brief contrariar
> seções anteriores, prevalece o brief. O anexo ao fim é histórico.

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

# Anexo — brief histórico: onboarding (rodada anterior)

> Preservado como registro. Este texto descreve uma tarefa já executada e não é a lista vigente de
> pendências; consulte as seções acima. O brief vigente está na seção 13. Onde este anexo mencionar grupos,
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
