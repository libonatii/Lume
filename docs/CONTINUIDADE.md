# Lume — estado atual e continuidade de desenvolvimento

Este documento separa o protótipo existente da visão em [Produto](PRODUTO.md) e das regras futuras em [Gamificação](GAMIFICACAO.md). Deve ser atualizado quando uma funcionalidade for realmente implementada.

## 1. Resumo para outra IA

> Estamos construindo o Lume, uma plataforma social de estudos com amigos, grupos, compartilhamento de aprendizados, colaboração, conquistas personalizadas e placares. A pessoa deve organizar e retomar cursos, videoaulas, artigos, exercícios e projetos. A gamificação reconhece estudo efetivo e conclusões substanciais. Abrir uma janela, preparar materiais ou clicar em botões não gera XP. O código atual ainda contém recompensas antigas de microtarefas; isso é uma divergência a corrigir com migração explícita. Leia AGENTS.md, docs/PRODUTO.md e docs/GAMIFICACAO.md antes de alterar o projeto. Não confunda telas de demonstração com contas reais ou integrações funcionais.

## 2. O que existe no código

A aplicação usa Astro, React e Motion. O Astro gera arquivos estáticos em `dist/`; React controla as telas e o estado. `server.js` atende o build e as APIs localmente; o Worker existente mantém as APIs em Cloudflare com D1. `npm run dev` inicia Astro e servidor local. O Live Server não compila a nova aplicação. A migração está no código local, sem publicação nesta rodada.

| Capacidade | Situação |
| --- | --- |
| Entrada | Cadastro, login e saída com e-mail e senha; prévia local mantida como caminho alternativo, sem conta |
| Ritmo de estudo | Três jornadas de onboarding com sequências próprias (Quero começar, Estudo de vez em quando, Estudo com frequência), apoios opcionais, etapa social dispensável e retomada de onde parou. O estado fica em `onboarding` no documento da conta |
| Biblioteca | Cursos/assuntos com etapas, busca, filtros, pausa e links |
| Progresso | Registro local de conclusão de etapas e preparação; o documento de estudo é sincronizado por conta no D1 |
| Gamificação | Modelo legado: 5 XP por preparação, 10 XP por etapa, nível a cada 100 XP |
| Conquistas | Selos genéricos do protótipo, incluindo ações que não serão elegíveis na nova política |
| Histórico | Dados no navegador e exportação JSON |
| Visual | React + Motion com o sistema visual do Stitch, seleção animada de ritmo/menu/filtros, cartões, progresso, diálogos e avisos. Por decisão explícita da responsável, não há modo essencial nem tratamento de movimento reduzido |
| Contas e sincronização | Cadastro, login, saída e recuperação de senha implementados em `auth.js`, com sessão em cookie `HttpOnly` e limite de tentativas no banco. Há sincronização básica de uma cópia do progresso por `/api/state`, com persistência local e em D1; conflitos entre dispositivos e validação de XP no servidor permanecem pendentes |
| Hospedagem | Ambiente público de referência em `lume.lume-prototype.workers.dev`, com Cloudflare Workers e D1. A migração React + Astro e o ajuste para 100.000 iterações estão no código local; sua publicação e medição em produção continuam pendentes. Hashes antigos mantêm seu custo original. Não há domínio próprio registrado |
| Envio de e-mail | Não implementado. No servidor local, o link de recuperação pode voltar na resposta e aparece no console; no Worker configurado com `SHOW_RESET_LINK=false`, não volta na resposta e fica no log do servidor |
| Amigos, grupos e comunicação | Não implementados |
| Placares compartilhados | Não implementados |
| Ranking | Não implementado |
| GitHub e outras integrações | Não implementadas |
| Captura de posição de vídeo/leitura | Não implementada |
| Conquistas personalizadas por material | Não implementadas como sistema da nova política |

O nome “curso” no protótipo pode representar um assunto com tarefas arbitrárias. Isso ainda não é o modelo de curso com aulas e critérios de conclusão definido para o produto.

### Execução local e retomada

- Comando padrão: `npm run dev`, com Astro em [http://localhost:4321](http://localhost:4321) e API em 4173. O proxy mantém as chamadas `/api` na mesma origem do frontend.
- Na execução em segundo plano iniciada nesta etapa, a porta 4173 estava ocupada; foi usada a variável `LUME_API_PORT=4192`, mantendo o frontend em 4321. A página e `/api/me` foram verificados com HTTP 200. Essa é a configuração da sessão, não uma alteração da porta padrão.
- Para repetir a configuração no PowerShell: definir `$env:LUME_API_PORT = '4192'` e executar `npm run dev`. As contas usam o banco existente em `data/lume.db`; os bancos separados `data/e2e-*` são exclusivos dos testes.
- Para o build estático local: `npm start` gera `dist/` e inicia `server.js`; `npm run preview` serve o build já gerado. A porta desse servidor é 4173 por padrão, ajustável por `PORT`.
- Ainda falta publicar a nova base para atualizar o endereço público. Executar localmente não publica o site.

## 3. Mudança de direção documentada

### Efeitos visuais — referência FGLibs

Os efeitos usam como referência a [Arc Library, listada na FGLibs](https://fglibs.com/), e seus [princípios de movimento](https://uiarc.dev/docs/motion). A implementação foi migrada para componentes React, CSS e Motion; o pacote Arc não foi instalado. O MCP da FGLibs não estava disponível na sessão; foi consultado o site como alternativa.

Entradas finitas orientam as telas. Seleção de ritmo, menu e filtros recebem destaques animados; os cartões se reorganizam e as barras de progresso acompanham os valores. A busca usa estado React e mantém o foco. Diálogos usam a modalidade nativa, Escape e restauração de foco; avisos podem ser fechados. A pedido explícito da responsável, modo essencial e tratamento de movimento reduzido foram retirados. Os campos antigos são mantidos como dados legados, sem efeito visual.

A migração preserva formato, chave de armazenamento, contas e APIs. Não reinterpreta o histórico e não implementa a nova política de XP nem os recursos sociais. O servidor local recebeu a constante de limite de tamanho do progresso, antes referenciada sem definição. Build, testes de domínio/autenticação e testes de navegador verificam a nova base.

### Sistema visual do Stitch

O CSS do Stitch não foi reescrito à mão: `public/stitch.css` é gerado a partir do `tailwind.config` das exportações em `designs/stitch/`, mantendo os 47 nomes de cor, os 11 estilos tipográficos, os espaçamentos e os raios originais. A fonte Plus Jakarta Sans é servida localmente em `public/assets/fonts/`, sem CDN. Os componentes React reutilizam esses utilitários e adicionam estilos de interação em `public/motion.css`.

As telas de Entrada, Ritmo de Estudo, Hoje e Biblioteca usam essa marcação dentro do escopo `[data-stitch]`, para que os utilitários não colidam com o CSS anterior das telas ainda não convertidas. Modo essencial e tratamento de movimento reduzido foram removidos por solicitação explícita da responsável.

Ainda sem exportação no Stitch, e por isso ainda no visual anterior: Missões, Conquistas, Meu Caminho, Configurações, Esqueci Minha Senha e Acesso Validado.

### Jornadas de onboarding

A escolha do ritmo não é só um título: cada jornada tem perguntas, configuração e plano próprios.

- **Quero começar:** assunto, resultado esperado, se já existe material e quanto tempo reservar. Cria um material com uma primeira atividade concreta.
- **Estudo de vez em quando:** materiais em andamento, prioridade, ponto de retomada e o que dificulta a continuidade. Cria o material já com o ponto de retomada.
- **Estudo com frequência:** áreas, rotina existente, o que está em andamento e o que acompanhar. Preserva a rotina informada em vez de impor um plano.

O estado do onboarding é versionado em `onboarding` (status, jornada, etapa, respostas, datas) e salvo no documento da conta, então interromper não obriga a recomeçar. Concluir não concede XP, e o histórico continua vazio. A meta semanal só é sugerida quando nunca foi ajustada à mão (`preferences.weeklyGoalSource`). A etapa social é opcional e não altera XP, plano ou ranking.

Ainda não implementados: convites de amigos, grupos por convite e ranking. A tela informa isso em vez de simular números. As integrações por área também não existem; o acompanhamento é por registro manual.

### Contas e recuperação de acesso`auth.js` concentra validação, derivação de senha com PBKDF2-SHA256 e sessão, usado tanto pelo `server.js` quanto pelo `worker.js`. O banco guarda apenas o resumo SHA-256 do token de sessão. Trocar a senha encerra todas as sessões daquela conta. Cadastro, entrada e recuperação não concedem XP.

Por decisão da responsável, o padrão foi reduzido de 600.000 para 100.000 iterações para priorizar o plano gratuito, mantendo a opção `PBKDF2_ITERATIONS`. É uma redução da resistência a tentativas offline, abaixo da recomendação OWASP para PBKDF2-HMAC-SHA256. O custo de CPU precisa ser validado no Worker publicado. A verificação mantém o custo e o encadeamento originais dos hashes existentes; a mudança não migra contas nem redefine senhas antigas.

O link de recuperação vale 30 minutos e é de uso único. Com o link oculto na configuração pública, a resposta não revela se a conta existe. O modo de teste local pode devolver `resetUrl` para contas existentes e, portanto, não oferece a mesma garantia de resposta indistinguível. O transporte por e-mail não foi implementado.

O progresso mantém uma cópia em `localStorage` e usa `/api/state` para carregar e salvar uma cópia vinculada à conta. Antes de carregar uma conta e ao sair, cópias locais são preservadas com sufixos de backup. A escrita remota é agrupada e serializada nesta sessão; não há reconciliação de conflitos entre dispositivos. A atribuição de XP no servidor segue pendente.

O protótipo inicial enfatizou passos de preparação e pequenas recompensas. A direção atual exige progresso real de estudo e um componente social central.

Continuam válidos: conforto, ajuda para começar, tarefas divisíveis, pausas sem penalidade, preferências editáveis e preservação de dados.

Precisam evoluir: unidade de progresso, origem do registro, continuidade de materiais, cálculo de XP, níveis, conquistas, contas e funcionalidades sociais.

O código e os testes antigos descrevem o comportamento do protótipo; não anulam a nova especificação. Ao substituir uma regra, substituir também suas expectativas de teste de forma consciente.

## 4. Modelo de dados conceitual para a evolução

| Entidade | Responsabilidade |
| --- | --- |
| Pessoa e perfil | Conta, áreas, ritmo, conforto e privacidade |
| Material | Aula, leitura, exercício ou outro conteúdo com origem e identidade |
| Curso/trilha | Conjunto de materiais e requisitos de conclusão |
| Projeto e entrega | Objetivo e resultados substanciais definidos |
| Progresso do material | Estado, posição, cobertura quando disponível, marcador e origem |
| Sessão de estudo | Intervalos de atividade e tempo elegível, com reconciliação |
| Evento de XP | Registro único de recompensa, política e origem |
| Conquista obtida | Marco personalizado e seu critério |
| Amizade e grupo | Relações aceitas, membros e permissões |
| Publicação/mensagem | Aprendizado compartilhado ou comunicação, com escopo e moderação |
| Participação no placar | Consentimento, período e política do grupo |
| Conexão de integração | Provedor, permissões, capacidades e estado de sincronização |

Separar o material de seu progresso por pessoa. Um material compartilhado não significa que todos os integrantes o concluíram. Da mesma forma, uma entrega coletiva não deve conceder automaticamente a mesma recompensa a todos os membros.

Não é uma decisão de banco de dados ou fornecedor. O objetivo deste modelo é evitar continuar representando todos os recursos como uma única lista de tarefas concluídas.

## 5. Ordem recomendada de evolução

### Etapa A — progresso significativo no protótipo

- Introduzir materiais tipados e critérios de conclusão.
- Separar apoio de preparação de atividade recompensada.
- Implementar a política de XP, níveis e conquistas personalizadas com regras versionadas.
- Planejar e testar a migração do histórico legado antes de aplicá-la.
- Acrescentar marcadores manuais de leitura/vídeo e sessões de estudo claramente declaradas.

### Etapa B — contas e dados persistentes

- Autenticação real, recuperação de acesso, autorização e isolamento por pessoa.
- Persistência no servidor e sincronização recuperável.
- Livro de eventos e atribuição de XP no servidor.
- Migração voluntária e segura dos dados locais para a conta.

Situação: autenticação, recuperação de acesso, sessão e persistência básica de cópia do progresso implementadas. Reconciliação entre dispositivos, revisão da migração voluntária dos dados locais e XP validado no servidor continuam pendentes.

### Etapa C — primeira experiência social

- Amigos, grupos privados, compartilhamento e comunicação.
- Permissões, bloqueio, moderação e controle de notificações.
- Ranking com abas por nível acumulado, cursos concluídos e empenho no período; participação configurável e regras de registros manuais visíveis.
- Colaboração em entregas com contribuição individual explícita.

### Etapa D — integrações e retomada automática

- Implementar um adaptador de fonte por vez, verificando suas capacidades.
- Player compatível com posição, retomada, cobertura e tempo elegível.
- GitHub opcional com repositórios escolhidos e entregas definidas.
- Expandir para fontes de leitura e outras plataformas conforme suporte real.

A visão social deve orientar o modelo desde a Etapa A; não é um extra a ser esquecido. A ordem acima é uma proposta para reduzir dependências e evitar placares baseados em pontuação arbitrária de navegador.

## 6. Parâmetros iniciais e decisões futuras

Já definidos como direção do produto: amigos e grupos, compartilhamento, colaboração, ranking como recurso central com classificações por nível, cursos concluídos e empenho, participação configurável, conquistas por conteúdo e ausência de XP por preparação. Empenho é atividade de estudo registrada no período; não é uma avaliação de valor pessoal.

Propostos nesta documentação para balanceamento inicial: valores de XP, 500 XP por nível, blocos de 30 minutos e limite diário da recompensa por tempo.

Ainda precisam de decisão de implementação: primeira fonte de vídeo suportada, regras detalhadas de revisão de entregas coletivas, tratamento visual do saldo legado e política para materiais muito curtos ou muito extensos. Essas escolhas não devem ser resolvidas com promessas genéricas de integração automática. Fornecedor de autenticação e hospedagem passou a ser Cloudflare Workers com D1; o serviço de envio de e-mail de recuperação continua sem decisão.

## 7. Como manter o contexto

### Escolha de stack

A responsável solicitou explicitamente a migração para **React + Astro**, agora implementada no código local. `src/pages/index.astro` monta a aplicação React; `src/components/` contém as telas, e `src/hooks/useLume.js` mantém estado, conta e sincronização. O antigo `public/app.js` e a entrada HTML manual foram substituídos. `public/domain.js` permanece como fonte das regras legadas e restauração, preservando os dados.

O Astro gera o frontend estático em `dist/`, e a API continua no Worker/D1 sem introduzir SSR. O build gera hashes CSP dos scripts/estilos inline exatos do Astro. A configuração de publicação usa `dist/` e executa o build. Nenhum serviço pago foi ativado e nenhuma publicação foi realizada nesta migração.

Verificação da migração: build estático aprovado; 23 testes de domínio/autenticação e seis cenários de navegador (desktop e celular) aprovados. Foram verificados dados legados, prévia, teclado, busca/filtros, inclusão de curso, registro de etapa, preferências, personalização, pausa/retomada, cadastro, login, saída, sincronização e recuperação de senha. Capturas locais revisadas para entrada, biblioteca e preferências; o comando de desenvolvimento e seu proxy de API também foram conferidos. O banco dos testes é separado em `data/e2e-*`.

A atualização posterior de README e deste documento consolida a execução local, as portas, o estado da migração e as limitações de recuperação e sincronização. Essa revisão é apenas documental: não altera código, banco, pontuação ou publicação; os testes de código inalterado não precisam ser repetidos.

- Atualize esta matriz de estado quando implementar recursos.
- Registre novas decisões e alterações de balanceamento com versão e motivo em `GAMIFICACAO.md`.
- Mantenha o README como porta de entrada, apontando para estes documentos.
- Envie `AGENTS.md` e os três documentos da pasta `docs` para uma IA que não tenha acesso ao repositório.
- Não use apenas screenshots ou o README antigo como especificação de produto.
- Esta rodada migrou a interface para React + Astro, atualizou interações e verificação e retirou os modos solicitados; não publicou o Worker, não migrou o histórico e não alterou a pontuação em execução.
