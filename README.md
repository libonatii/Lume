**🌐 Site publicado: <https://lume.lume-prototype.workers.dev>**

[![CI](https://github.com/libonatii/Lume/actions/workflows/ci.yml/badge.svg)](https://github.com/libonatii/Lume/actions/workflows/ci.yml)
[![Companion](https://github.com/libonatii/Lume/actions/workflows/companion-release.yml/badge.svg)](https://github.com/libonatii/Lume/releases)

# Lume ✳

**Seu ritmo, seu caminho.** Uma plataforma social de estudos para organizar e retomar aprendizados, colaborar com amigos, compartilhar descobertas, conquistar marcos personalizados e participar de placares de estudo.

## Referências do produto

Leia nesta ordem: [Produto](docs/PRODUTO.md), [Gamificação](docs/GAMIFICACAO.md) e [Continuidade](docs/CONTINUIDADE.md). A [importação de cursos](docs/IMPORTACAO.md) descreve o fluxo por link, as fontes verificadas e suas limitações; o [Lume Companion](docs/COMPANHEIRO.md) descreve o programa de desktop, a presença local e o roteiro por prioridade; [Publicação e CI](docs/RELEASE.md) explica como gerar o instalador pelo GitHub Actions. As [instruções para colaboradores](AGENTS.md) descrevem os cuidados com dados, integrações e verificação.

A gamificação desejada reconhece estudo efetivo e conclusões. O código ainda preserva o **modelo legado de 5 XP por preparação e 10 XP por etapa**, sem migrar nem reinterpretar os registros antigos. Esses valores não são uma implementação da nova política nem podem alimentar um ranking compartilhado.

O onboarding tem três jornadas com sequências próprias: **Quero começar** (assunto, resultado, material e tempo de sessão), **Estudo de vez em quando** (materiais em andamento, prioridade e ponto de retomada) e **Estudo com frequência** (áreas, rotina, o que está em andamento e o que acompanhar). Cada uma cria um primeiro material concreto e um plano sugerido. Concluir o onboarding não concede XP.

A biblioteca aceita **importação por link** em uma entrada única: o servidor lê a página pública, identifica disciplinas, módulos e aulas e a pessoa escolhe as áreas antes de adicionar. Quando a fonte exige login, publica só contagens ou bloqueia acesso automatizado, o caminho é colar a grade ou enviar um arquivo — nunca digitar aula por aula. Importar e atualizar a grade não gera XP; a conclusão das aulas importadas é registro manual identificado. Detalhes e limitações por plataforma em [Importação](docs/IMPORTACAO.md).

A página Hoje tem uma **sessão de estudo declarada**: a pessoa inicia, pausa e encerra um relógio vinculado ao material, com histórico em Meu caminho. Não é observação de atividade e não gera XP. **Amigos** funcionam por convite de uso único, sem busca por e-mail e sem compartilhar biblioteca ou progresso. O **Lume Companion** é um programa de desktop opcional (bandeja + janela Electron, ou agente de terminal) que informa qual aplicativo autorizado está aberto, quantas aulas faltam e o próximo passo por prioridade — também sem XP. Ver [Companion](docs/COMPANHEIRO.md).

```sh
cd D:\tabletop                    # a pasta deste projeto
npm install --prefix companion    # Electron, uma vez
npm run companion:app             # bandeja + janela
npm run companion                 # agente de terminal, se preferir
```

Fora da pasta do projeto, use o iniciador (funciona de qualquer lugar) ou dê dois cliques nele: `D:\tabletop\lume-companion.cmd`.

## Stack e interações

- **Astro** gera HTML e bundles estáticos em `dist/`.
- **React** controla todas as telas, formulários, busca, filtros e diálogos com componentes e estado; o controlador antigo de strings HTML foi removido.
- **Motion** anima seleção de ritmo, destaque do menu e dos filtros, reorganização dos cartões, progresso, diálogos, avisos e respostas dos botões.
- **Motion** anima seleção de ritmo, destaque do menu e dos filtros, reorganização dos cartões, contadores com mola (`AnimatedNumber`), progresso, diálogos, avisos e respostas dos botões.
- **Paper Shaders (`@paper-design/shaders-react`)**, listada na [FGLibs](https://fglibs.com/), projeta campos de luz ambiente em WebGL2 (`MeshGradient`) no painel de entrada, na ação focal do estudo, no resumo do plano e nas celebrações, com fallback estático em CSS.
- **Atropos (`atropos`)**, listada na [FGLibs](https://fglibs.com/), adiciona profundidade e inclinação tátil suave à capa da trilha em foco na Biblioteca e aos selos conquistados na vitrine.
- O sistema visual unificado (`public/lume.css`) aplica a paleta em tons de azul-safira e índigo profundo no tema escuro (`#080d17`, superfícies `#111c30`, acentos em azul luminoso `#5ea8ff` e menta `#4de0b8`) e gelo azulado no tema claro (`#f1f6fd`, acento `#2563eb`) em todas as 9 rotas, combinando títulos na serifada variável **Fraunces** (`@fontsource-variable/fraunces`) com interface em **Plus Jakarta Sans** local.
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

Os testes de navegador usam Chrome instalado, em modo headless, com desktop e viewport móvel. Uma base SQLite separada em `data/e2e-*` impede alterações nas contas locais existentes. Os cenários verificam dados legados, prévia, teclado, busca, filtros, importação por texto, análise de link simulada por interceptação de rota, seleção parcial, reimportação, progresso manual, sessão declarada, importação de conta isolada, convite entre duas contas, Companion (pareamento, presença e revogação), preferências, cadastro, entrada, saída, sincronização e recuperação de senha. Os rastros de falhas ficam em `test-results/`, ignorado no Git. O servidor de teste sobe com `LUME_ATTEMPT_LIMIT=200` para não esbarrar no limite de tentativas compartilhado pelo endereço local; o padrão continua 10.

Nesta rodada passaram o build, os **75 testes de domínio/autenticação/importação/Companion/sessão/amigos** e os **26 cenários de navegador** (13 por projeto, desktop e celular). A extração real de páginas foi conferida com acessos à Coursera, Alura, Rocketseat, DIO e Udemy; o resultado está documentado em [Importação](docs/IMPORTACAO.md#4-o-que-foi-realmente-verificado-nesta-rodada).

## Dados e limites atuais

O formato e a chave `lume.prototype.v1` são preservados, assim como cursos, histórico, XP e conquistas legadas. As contas usam cookies HttpOnly e a sincronização básica envia uma cópia do progresso por `/api/state`. Há cópia local, exportação JSON e cópias anteriores ao carregamento da conta/saída. **Não existe reconciliação de conflitos entre dispositivos nem validação de XP no servidor.** O armazenamento do protótipo continua inadequado como autoridade de placares. Cursos importados acrescentam `structure`, `source`, `studyLog` e `imports` ao mesmo documento, sem alterar a versão; sessões declaradas usam `activeSession` e `studySessions`. Dados antigos sem esses campos continuam válidos.

O banco ganhou `companion_devices`, `companion_pair_codes`, `companion_presence`, `friendships` e `friend_invites`. Tokens de dispositivo, códigos de convite e códigos de pareamento são guardados apenas como hash. Presença expira em 90 segundos sem batimento e amizade não compartilha biblioteca nem progresso.

Cadastro, login, saída e recuperação por link funcionam na API local. O envio de e-mail ainda não está implementado. No ambiente público, o link de recuperação não é mostrado na resposta quando `SHOW_RESET_LINK` é `false`; o transporte precisa evoluir. A prévia continua disponível sem conta. Os cursos iniciais são exemplos, sem aulas hospedadas. A importação de cursos por link existe e é documentada em [Importação](docs/IMPORTACAO.md); a análise depende do que cada plataforma publica e não contorna login.

Amigos, grupos, colaboração, ranking com suas três classificações, progresso automático das plataformas, retomada de posição e conquistas personalizadas continuam planejados. A conexão com o GitHub também não existe: há apenas o formato de sugestões de entrega que exige validação. A migração da stack não implementa esses recursos nem altera a política de pontuação em execução.

## Hospedagem

O endereço de referência é [lume.lume-prototype.workers.dev](https://lume.lume-prototype.workers.dev), que responde com o build React/Astro e mantém o backend e os vínculos com D1. A configuração de Wrangler gera o build antes de publicar e envia `dist/`. A publicação atual inclui o sistema visual novo de `public/lume.css`; alterações feitas depois dela só aparecem no site público com um novo `npx wrangler deploy`. Nenhum plano pago foi ativado.

O build gera hashes CSP dos scripts e estilos inline exatos do Astro e grava `dist/_headers`, utilizado também pelo servidor Node. Não libera execução genérica de scripts inline.

Novas senhas e redefinições usam **bcrypt (`bcryptjs`), com custo 6** no Node e no Worker. `BCRYPT_ROUNDS` aceita inteiros de 4 a 12; o padrão está em `auth.js` e o Worker configura explicitamente 6. Valores inválidos geram erro, sem redução silenciosa. `PBKDF2_ITERATIONS` deixou de configurar a criação de senhas.

O custo 6 é um compromisso com o [limite de 10 ms de CPU por requisição do Workers Free](https://developers.cloudflare.com/workers/platform/limits/) e fica abaixo do [mínimo 10 recomendado pela OWASP para bcrypt](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#bcrypt), oferecendo menor resistência a ataques offline. Medição local inicial com `bcryptjs` encontrou aproximadamente 5 ms por hash aquecido com custo 6 e 77 ms com custo 10. A primeira execução local com custo 6 levou cerca de 13 ms. Isso **não comprova** o orçamento de CPU no Worker publicado. Antes de considerar a configuração validada para o Free, medir cadastro, login e redefinição completos, incluindo partidas frias, e conferir erros `exceededCpu`. A API mantém o limite de tentativas antes do trabalho criptográfico; esse limite não protege um banco vazado. A API assíncrona do bcrypt não amplia o orçamento de CPU.

Para repetir a medição local com dados sintéticos: `node scripts/benchmark-auth.mjs 6` (ou `10`). Ela informa tempo de parede, incluindo a primeira execução, e não acessa contas nem a rede.

O [bcrypt aceita até 72 bytes em UTF-8](https://github.com/dcodeIO/bcrypt.js#security-considerations). Cadastro e redefinição recusam senhas acima desse limite, inclusive com acentos e emojis, sem truncamento. O login preserva o limite legado de 200 caracteres para contas PBKDF2. Hashes PBKDF2 existentes continuam usando seu custo e encadeamento originais, sem modificar contas ou progresso; passam para bcrypt quando a senha é redefinida. Não há rehash automático no login, evitando somar PBKDF2 e bcrypt na mesma requisição do Free. O custo de verificação de hashes antigos também continua sujeito ao orçamento do Worker.

Verificação desta troca: testes de autenticação/domínio, build estático, bundle do Worker em `wrangler deploy --dry-run` e fluxos da API no runtime local da Cloudflare. A publicação e a medição de CPU em produção continuam pendentes.

## Estrutura

| Caminho | Função |
| --- | --- |
| `src/pages/index.astro` | Documento HTML e entrada da ilha React |
| `src/components/` | Telas, navegação, formulários, cartões, progresso e diálogos |
| `src/hooks/useLume.js` | Estado persistente, sessão e sincronização básica |
| `src/lib/api.js` | Cliente das APIs existentes |
| `public/domain.js` | Domínio legado e restauração dos dados, preservados |
| `public/import-domain.js` | Regras de importação: provedores, normalização, mesclagem, progresso de aulas |
| `public/session-domain.js` | Sessão declarada: início, pausa, expiração e histórico |
| `public/study-plan.js` | Roteiro por prioridade e contagem de aulas restantes |
| `public/companion-domain.js` | Regras do Companion: allowlist, presença e categorias |
| `import-server.js` | Análise de fontes no servidor: validação de URL, limites, extração e organizador por IA |
| `companion.js` / `companion/` | Pareamento, presença e roteiro; núcleo, agente local e app Electron (bandeja e janela) |
| `companion/electron-builder.yml` | Empacotamento do instalador Windows (NSIS) |
| `lume-companion.cmd` | Iniciador do app de bandeja; funciona de qualquer pasta |
| `.github/workflows/` | CI do site e publicação do instalador do Companion |
| `friends.js` | Convites, amizades e remoção |
| `public/*.css` | Estilos, sistema visual do Stitch e interações |
| `public/assets/` | Fontes e imagens locais |
| `auth.js` | Validação, derivação de senha, tokens e cookies |
| `server.js` | API local e entrega do build estático |
| `worker.js` / `wrangler.jsonc` | API Cloudflare, D1 e configuração de build |
| `migrations/` | Esquema do banco existente |
| `scripts/` | Desenvolvimento e geração de cabeçalhos CSP |
| `tests/e2e/` | Verificação dos fluxos no navegador |
| `docs/` | Produto, gamificação, continuidade e importação |
