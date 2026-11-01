**🌐 Site publicado: <https://lume.lume-prototype.workers.dev>**

[![CI](https://github.com/libonatii/Lume/actions/workflows/ci.yml/badge.svg)](https://github.com/libonatii/Lume/actions/workflows/ci.yml)
[![Aplicativo de desktop](https://github.com/libonatii/Lume/actions/workflows/companion-release.yml/badge.svg)](https://github.com/libonatii/Lume/releases)

# Lume ✳

**Seu ritmo, seu caminho.** Uma plataforma social de estudos para organizar e retomar aprendizados, colaborar com amigos, compartilhar descobertas, conquistar marcos personalizados e participar de placares de estudo.

## Referências do produto

Leia nesta ordem: [Produto](docs/PRODUTO.md), [Gamificação](docs/GAMIFICACAO.md) e [Continuidade](docs/CONTINUIDADE.md). A [importação de cursos](docs/IMPORTACAO.md) descreve o fluxo por link, as fontes verificadas e suas limitações; o [aplicativo de desktop](docs/COMPANHEIRO.md) (o Lume completo numa janela própria, com bandeja, presença e atualização) e a [extensão do navegador](extension/LEIAME.md) estão descritos à parte; [Publicação e CI](docs/RELEASE.md) explica como gerar o instalador pelo GitHub Actions; as [o que falta implementar](docs/IMPLEMENTACAO.md) reúne as lacunas principais, o mapa do que existe e as decisões pendentes; o [diagnóstico e plano de evolução](docs/EVOLUCAO.md) organiza as próximas etapas. As [instruções para colaboradores](AGENTS.md) descrevem os cuidados com dados, integrações e verificação.

A gamificação de contas é validada no servidor: **100 XP por aula/leitura/exercício, 150 por entrega, 100 por apresentação, 500 de bônus por curso/projeto, 25 por bloco de 30 minutos e nível a cada 500 XP**. O livro `xp_events` usa chave de idempotência; repetir uma requisição não duplica recompensa. O saldo antigo do protótipo (5 XP por preparação, 10 XP por etapa e 10 XP por tarefa de prova) continua preservado e separado, fora do nível novo e do ranking.

O onboarding tem três jornadas com sequências próprias: **Quero começar** (assunto, resultado, material e tempo de sessão), **Estudo de vez em quando** (materiais em andamento, prioridade e ponto de retomada) e **Estudo com frequência** (áreas, rotina, o que está em andamento e o que acompanhar). Cada uma cria um primeiro material concreto e um plano sugerido. Concluir o onboarding não concede XP.

A biblioteca aceita **importação por link** em uma entrada única: o servidor lê a página pública, identifica disciplinas, módulos e aulas e a pessoa escolhe as áreas antes de adicionar. Quando a fonte exige login, a **extensão do navegador** (`extension/`, protótipo) lê a página já aberta pela pessoa, com a conta dela, quando ela clica no ícone: disciplinas, aulas, durações e o que aparece concluído, abrindo e fechando as seções para ler; a pessoa revisa antes de adicionar. Colar a página copiada continua como alternativa. Em nenhum caminho o Lume recebe senha, cookie ou sessão; conclusões já visíveis na primeira leitura entram como histórico identificado (sem XP), e só conclusões novas de uma leitura posterior, confirmadas por você, viram registro elegível. A leitura foi testada com páginas de exemplo e um trecho real do painel do Gran, não com contas reais das demais plataformas. Importar e atualizar a grade não gera XP. Detalhes e limitações por plataforma em [Importação](docs/IMPORTACAO.md).

A biblioteca agora também permite **criar material manualmente**, editar título/tipo/retomada, adicionar, renomear, reordenar e remover etapas, excluir com confirmação (pelo menu “…” no canto superior direito do cartão do curso, em **Excluir curso**) e anexar **slides internos**. O visualizador de slides funciona por teclado, salva o progresso e concede XP uma única vez quando 80% do deck foi visto, o último slide foi aberto e a pessoa confirma.

A página **Hoje** abre pela **próxima ação**: a aula indicada pelo mesmo roteiro do aplicativo de desktop, o motivo da prioridade, o tempo a reservar (duração da fonte ou estimativa, sempre rotulada), o link do material e o que falta no curso; abaixo ficam as tarefas relevantes e a evolução recente. Ela também tem uma **sessão de estudo declarada**: a pessoa inicia, pausa e encerra um relógio vinculado ao material. Ao encerrar, o servidor confirma blocos de 30 minutos, com sobra acumulada, desconto de sobreposição e teto diário de 200 XP de tempo; pausas não contam e a sessão não comprova estudo. **Amigos** funcionam por convite reaproveitável de 7 dias, sem busca por e-mail; o **perfil entre amigos** mostra só o que cada pessoa escolhe compartilhar e usa XP validado no servidor. **Mensagens diretas** existem apenas entre amizades aceitas, com histórico, não lidas, compartilhamento de referência, bloqueio e controle de notificações. O **ranking de amigos** tem três abas (nível, cursos concluídos e empenho semanal/mensal), empates compartilhados e opt-in reversível; grupos e ranking público estão fora desta etapa. O **Plano** monta o cronograma a partir da disponibilidade semanal, dos prazos e das prioridades por curso, usando a duração das aulas quando a fonte a publica e uma estimativa rotulada quando não; explica quando um prazo não cabe e oferece três ajustes, e recalcula a partir de hoje a cada conclusão, adiamento ou pausa. Planejar não gera XP. A aba **Tarefas** guarda a lista de estudo para uma prova, com prioridade, aviso de atraso, vínculo opcional a uma aula e subtarefas: criar, priorizar e organizar não gera XP, mas concluir uma tarefa vale 10 XP de legado uma vez. O **aplicativo de desktop do Lume** é o próprio Lume numa janela própria, não só uma presença: conta, biblioteca, plano, amigos, mensagens, ranking e perfil são os mesmos do site (mesma API, sem banco local). Além do site, ele mantém a bandeja com aulas restantes e roteiro, uma presença opcional do aplicativo autorizado em uso e atualização pelo próprio app — nada disso gera XP. Tecnicamente o pacote se chama Companion (`companion/`, tags `companion-v*`). Ver [aplicativo de desktop](docs/COMPANHEIRO.md).

```sh
cd D:\tabletop                    # a pasta deste projeto
npm install --prefix companion    # Electron, uma vez
npm run companion:app             # bandeja + janela
npm run companion                 # agente de terminal, se preferir
```

Fora da pasta do projeto, use o iniciador (funciona de qualquer lugar) ou dê dois cliques nele: `D:\tabletop\lume.cmd`.

## Stack e interações

- **Astro** gera HTML e bundles estáticos em `dist/`.
- **React** controla todas as telas, formulários, busca, filtros e diálogos com componentes e estado; o controlador antigo de strings HTML foi removido.
- **Motion** anima seleção de ritmo, destaque do menu e dos filtros, reorganização dos cartões, contadores com mola (`AnimatedNumber`), progresso, diálogos, avisos e respostas dos botões.
- **Paper Shaders (`@paper-design/shaders-react`)**, listada na [FGLibs](https://fglibs.com/), projeta campos de luz ambiente em WebGL2 (`MeshGradient`) no painel de entrada, na ação focal do estudo, no resumo do plano e nas celebrações, com fallback estático em CSS.
- **Atropos (`atropos`)**, listada na [FGLibs](https://fglibs.com/), adiciona profundidade e inclinação tátil suave à capa da trilha em foco na Biblioteca e aos selos conquistados na vitrine.
- O sistema visual (`src/styles/`) segue o **Redesign Moderno** do Stitch (Projeto Lume): sidebar com o item ativo em destaque luminoso, cartões Bento com cantos de 24 px e linha de destaque no topo, brilho ambiente no fundo e tipografia única em **Plus Jakarta Sans** local. Em Configurações › **Aparência**, a pessoa escolhe a paleta **Azul** (padrão: azul-noite `#090d1f`, ação `#2563eb`) ou **Roxo** (`#0b0b18`, ação `#7c3aed`), além de tema escuro ou claro e tamanho do texto. Nas duas, o âmbar (`#f59e0b`) marca sessão, XP e nível, e a barra de XP vai da cor da paleta ao âmbar. Os textos principais têm contraste AA (≥ 4,5:1) nos quatro temas; as cores de *hover* dos botões seguem a especificação do Stitch e ficam abaixo disso com texto branco. A navegação tem cinco destinos — Hoje, Biblioteca, Plano, Amigos e Perfil — com abas dentro de cada seção. O logo não foi alterado.
- Por decisão explícita da responsável, **não há modo essencial nem tratamento de movimento reduzido**. Preferências antigas permanecem nos dados apenas para compatibilidade.
- A API existente continua no **Cloudflare Worker com D1**, ou no servidor Node local. O frontend não exige renderização no servidor.

As bibliotecas e padrões de interação foram escolhidos a partir do catálogo da [FGLibs](https://fglibs.com/): **Paper Shaders**, **Atropos**, **Motion**, transições finitas inspiradas na [Arc Library](https://uiarc.dev/docs/motion) e contadores com mola inspirados na [Motion-Primitives](https://motion-primitives.com/).

## Executar localmente
Use Node **22.23.4 ou superior** (testado com Node 24). Na primeira execução:

```sh
npm install
npm run dev
```

O Astro abre em [http://localhost:4321](http://localhost:4321), encaminhando `/api` para o servidor local na porta 4173. As contas ficam em `data/lume.db`.

Se a porta 4173 estiver ocupada, escolha outra para a API com `LUME_API_PORT`. No PowerShell:

```powershell
$env:LUME_API_PORT = '4192'
npm run dev
```

O proxy do Astro acompanha essa configuração: continue acessando [http://localhost:4321](http://localhost:4321). Na execução em segundo plano iniciada nesta etapa, a API usa **4192**, pois **4173** já estava ocupada. Página e `/api/me` responderam com HTTP 200. A porta alternativa é uma configuração dessa execução, não uma mudança do padrão do projeto.

Para gerar e servir o build de produção:

```sh
npm start
```

Esse comando gera `dist/` e serve a aplicação em **http://localhost:4173**. Se o build já existe, `npm run preview` inicia apenas o servidor. Para encerrar, use `Ctrl+C`. O Live Server não compila componentes React ou páginas Astro e não atende as APIs.

## Verificação

```sh
npm test
npm run build
npm run test:e2e
```

Os testes de navegador usam Chrome instalado, em modo headless, com desktop e viewport móvel. Uma base SQLite separada em `data/e2e-*` impede alterações nas contas locais existentes. Os cenários verificam dados legados, prévia, teclado, busca, filtros, importação por texto, análise de link simulada por interceptação de rota, seleção parcial, reimportação, progresso manual, sessão declarada, importação de conta isolada, convite entre duas contas, Companion (pareamento, presença e revogação), preferências, cadastro, entrada, saída, sincronização, recuperação de senha, edição/exclusão de material, criação manual, slides, restauração de cópia, XP idempotente e ranking de amigos. Os rastros de falhas ficam em `test-results/`, ignorado no Git. O servidor de teste sobe com `LUME_ATTEMPT_LIMIT=200` para não esbarrar no limite de tentativas compartilhado pelo endereço local; o padrão continua 10.

A verificação atual passou o build, os **165 testes Node de domínio/autenticação/importação/Companion/sessão/amigos/perfil/tarefas/XP/biblioteca/backup/reconciliação/mensagens/e-mail/GitHub/colaboração** e os **54 cenários de navegador** da rodada anterior (27 por projeto, desktop e celular), que não foram reexecutados por inteiro depois da extensão; foram rodados os **16 novos da extensão** (8 por projeto, com páginas de exemplo e um trecho do painel do Gran) e os 6 de importação no desktop. A extração real de páginas foi conferida com acessos à Coursera, Alura, Rocketseat, DIO e Udemy; o resultado está documentado em [Importação](docs/IMPORTACAO.md#4-o-que-foi-realmente-verificado-nesta-rodada).

## Dados e limites atuais

O formato e a chave `lume.prototype.v1` são preservados, assim como cursos, histórico, XP e conquistas legadas. As contas usam cookies HttpOnly e a sincronização básica envia uma cópia do progresso por `/api/state`. Há cópia local, exportação JSON e restauração com prévia e mesclagem; o estado anterior à restauração fica em `lume.prototype.v1.before-import`. **A reconciliação de conflitos entre dispositivos ainda não existe.** O XP elegível não vem dessa cópia: ele é atribuído no livro `xp_events` do servidor. Desde a versão 2 do documento, todo progresso (etapas, aulas importadas, preparações e saldo legado) fica no registro único `progress`; documentos da versão 1 são convertidos na leitura e uma aba antiga não consegue gravar o formato velho por cima (`client_outdated`). Cursos importados acrescentam `structure`, `source` e `imports`; slides usam `slides`/`slideProgress`, sessões declaradas usam `activeSession`/`studySessions`, e tarefas de prova usam `tasks` com XP de legado calculado no navegador. Dados antigos sem esses campos continuam válidos.

O banco ganhou `xp_settings`, `xp_events`, `xp_time_sessions`, `user_achievements`, `direct_messages`, `contact_blocks`, `message_preferences`, `delivery_invites`, `companion_devices`, `companion_pair_codes`, `companion_presence`, `friendships` e `friend_invites`. Tokens de dispositivo, códigos de convite e códigos de pareamento são guardados apenas como hash. Presença expira em 90 segundos sem batimento e amizade não compartilha biblioteca nem progresso.

Cadastro, login, saída e recuperação por link funcionam. O envio de e-mail usa **Resend** quando `LUME_EMAIL_PROVIDER=resend`, `RESEND_API_KEY` e `LUME_EMAIL_FROM` estão configurados; sem isso, o modo local mostra o link no log e o Worker com `SHOW_RESET_LINK=false` não o devolve na resposta. A prévia continua disponível sem conta. A biblioteca começa vazia; a primeira trilha pode ser criada pela área de atuação informada ou importada por link. A importação de cursos por link existe e é documentada em [Importação](docs/IMPORTACAO.md); a análise depende do que cada plataforma publica e não contorna login.

Mensagens diretas entre amizades, bloqueio, não lidas, notificações, compartilhamento de referência e convites de colaboração em entregas já existem. A leitura do GitHub é **pública**: lê README, issues e milestones e cria sugestões; não conecta a conta, não acessa repositórios privados e não altera nada no GitHub. Compartilhamento de aprendizados em feed, OAuth do GitHub e progresso automático por API continuam pendentes. Comunidades, servidores, canais e grupos estão fora do escopo desta etapa.

## Hospedagem

O endereço de referência é [lume.lume-prototype.workers.dev](https://lume.lume-prototype.workers.dev), que responde com o build React/Astro e mantém o backend e os vínculos com D1. A configuração de Wrangler gera o build antes de publicar e envia `dist/`. A publicação atual inclui a base React/Astro, o sistema visual de `src/styles/`, o service worker, a API de importação, XP/ranking, mensagens e colaboração. **O R2 não está habilitado nesta conta**, então o binding `MEDIA` está comentado: avatares, capas e imagens de slides respondem 503 até o R2 ser ativado e o binding ser restaurado. Nenhum plano pago foi ativado.

O build gera hashes CSP dos scripts e estilos inline exatos do Astro e grava `dist/_headers`, utilizado também pelo servidor Node. Não libera execução genérica de scripts inline.

Novas senhas e redefinições usam **bcrypt (`bcryptjs`), com custo 6** no Node e no Worker. `BCRYPT_ROUNDS` aceita inteiros de 4 a 12; o padrão está em `auth.js` e o Worker configura explicitamente 6. Valores inválidos geram erro, sem redução silenciosa. `PBKDF2_ITERATIONS` deixou de configurar a criação de senhas.

O custo 6 é um compromisso com o [limite de 10 ms de CPU por requisição do Workers Free](https://developers.cloudflare.com/workers/platform/limits/) e fica abaixo do [mínimo 10 recomendado pela OWASP para bcrypt](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#bcrypt), oferecendo menor resistência a ataques offline. Medição local inicial com `bcryptjs` encontrou aproximadamente 5 ms por hash aquecido com custo 6 e 77 ms com custo 10. A primeira execução local com custo 6 levou cerca de 13 ms. Isso **não comprova** o orçamento de CPU no Worker publicado. Antes de considerar a configuração validada para o Free, medir cadastro, login e redefinição completos, incluindo partidas frias, e conferir erros `exceededCpu`. A API mantém o limite de tentativas antes do trabalho criptográfico; esse limite não protege um banco vazado. A API assíncrona do bcrypt não amplia o orçamento de CPU.

Para repetir a medição local com dados sintéticos: `node scripts/benchmark-auth.mjs 6` (ou `10`). Ela informa tempo de parede, incluindo a primeira execução, e não acessa contas nem a rede.

O [bcrypt aceita até 72 bytes em UTF-8](https://github.com/dcodeIO/bcrypt.js#security-considerations). Cadastro e redefinição recusam senhas acima desse limite, inclusive com acentos e emojis, sem truncamento. O login preserva o limite legado de 200 caracteres para contas PBKDF2. Hashes PBKDF2 existentes continuam usando seu custo e encadeamento originais, sem modificar contas ou progresso; passam para bcrypt quando a senha é redefinida. Não há rehash automático no login, evitando somar PBKDF2 e bcrypt na mesma requisição do Free. O custo de verificação de hashes antigos também continua sujeito ao orçamento do Worker.

Verificação desta troca: testes de autenticação/domínio, build estático, bundle do Worker em `wrangler deploy --dry-run` e fluxos da API no runtime local da Cloudflare. A medição de CPU no Worker publicado continua pendente.

## Estrutura

| Caminho | Função |
| --- | --- |
| `src/pages/index.astro` | Documento HTML e entrada da ilha React |
| `src/app/` | Casca: `App.jsx`, tabela de rotas (`routes.jsx`), diálogos (`modals.jsx`), menu e `useLume.js` (estado, conta, sincronização e `act`) |
| `src/features/<área>/` | Telas por funcionalidade: `account`, `library`, `progress`, `plan`, `social`, `settings`, `desktop` |
| `src/ui/` | Componentes visuais compartilhados e ícones |
| `src/lib/api.js` | Cliente das APIs existentes |
| `public/domain.js` | Domínio legado e restauração dos dados, preservados |
| `public/import-domain.js` | Regras de importação: provedores, normalização, mesclagem, progresso de aulas |
| `public/session-domain.js` | Sessão declarada: início, pausa, expiração e histórico |
| `public/tasks-domain.js` | Tarefas de prova: criação, conclusão, XP e normalização |
| `public/slides-domain.js` | Slides: criação, edição, ordem, progresso e conclusão do deck |
| `public/xp-policy.js` | Política de XP v1, níveis, blocos, fuso e candidatos de conclusão |
| `public/backup-domain.js` | Leitura, prévia e mesclagem de cópias JSON |
| `xp.js` | Livro de eventos, conquistas, tempo elegível e ranking no servidor |
| `public/study-plan.js` | Roteiro por prioridade e contagem de aulas restantes |
| `public/companion-domain.js` | Regras do aplicativo de desktop: allowlist, presença e categorias |
| `extension/` | Extensão do navegador (Manifest V3, sem build): leitor de curso acionado pela pessoa, ponte para o Lume e popup; ver `extension/LEIAME.md` |
| `src/lib/extension.js` | Recebe a leitura da extensão por `postMessage` e abre a revisão da importação |
| `public/profile-domain.js` | Projeção do perfil entre amigos, com as escolhas de compartilhamento |
| `import-server.js` | Análise de fontes no servidor: validação de URL, limites, extração e organizador por IA |
| `companion.js` / `companion/` | Aplicativo de desktop (nome técnico Companion): janela com o Lume completo, bandeja, pareamento, presença, roteiro e atualização; núcleo, agente local e app Electron |
| `companion/electron-builder.yml` | Empacotamento do instalador Windows (NSIS) |
| `lume.cmd` | Iniciador do app de bandeja; funciona de qualquer pasta |
| `.github/workflows/` | CI do site e da extensão, e publicação do instalador do aplicativo de desktop |
| `friends.js` | Convites, amizades e remoção |
| `public/*.css` | Estilos, sistema visual unificado e interações |
| `public/assets/` | Fontes e imagens locais |
| `auth.js` | Validação, derivação de senha, tokens e cookies |
| `api/` | App HTTP único: rotas, sessão, limites, erros e adaptadores de banco e imagens |
| `server.js` | Adaptador Node: SQLite local, imagens em `data/media/` e entrega do build estático |
| `worker.js` / `wrangler.jsonc` | Adaptador Cloudflare (D1, R2, estáticos) e configuração de build |
| `migrations/` | Esquema do banco existente |
| `scripts/` | Desenvolvimento e geração de cabeçalhos CSP |
| `tests/e2e/` | Verificação dos fluxos no navegador |
| `docs/` | Produto, gamificação, continuidade e importação |
