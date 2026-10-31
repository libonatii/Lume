**🌐 Site publicado: <https://lume.lume-prototype.workers.dev>**

# Lume ✳

**Seu ritmo, seu caminho.** Uma plataforma social de estudos para organizar e retomar aprendizados, colaborar com amigos, compartilhar descobertas, conquistar marcos personalizados e participar de placares de estudo.

## Referências do produto

Leia nesta ordem: [Produto](docs/PRODUTO.md), [Gamificação](docs/GAMIFICACAO.md) e [Continuidade](docs/CONTINUIDADE.md). As [instruções para colaboradores](AGENTS.md) descrevem os cuidados com dados, integrações e verificação.

A gamificação desejada reconhece estudo efetivo e conclusões. O código ainda preserva o **modelo legado de 5 XP por preparação e 10 XP por etapa**, sem migrar nem reinterpretar os registros antigos. Esses valores não são uma implementação da nova política nem podem alimentar um ranking compartilhado.

O onboarding tem três jornadas com sequências próprias: **Quero começar** (assunto, resultado, material e tempo de sessão), **Estudo de vez em quando** (materiais em andamento, prioridade e ponto de retomada) e **Estudo com frequência** (áreas, rotina, o que está em andamento e o que acompanhar). Cada uma cria um primeiro material concreto e um plano sugerido. Concluir o onboarding não concede XP.

## Stack e interações

- **Astro** gera HTML e bundles estáticos em `dist/`.
- **React** controla todas as telas, formulários, busca, filtros e diálogos com componentes e estado; o controlador antigo de strings HTML foi removido.
- **Motion** anima seleção de ritmo, destaque do menu e dos filtros, reorganização dos cartões, progresso, diálogos, avisos e respostas dos botões.
- **Motion** anima seleção de ritmo, destaque do menu e dos filtros, reorganização dos cartões, contadores com mola (`AnimatedNumber`), progresso, diálogos, avisos e respostas dos botões.
- **Paper Shaders (`@paper-design/shaders-react`)**, listada na [FGLibs](https://fglibs.com/), projeta campos de luz ambiente em WebGL2 (`MeshGradient`) no painel de entrada, na ação focal do estudo, no resumo do plano e nas celebrações, com fallback estático em CSS.
- **Atropos (`atropos`)**, listada na [FGLibs](https://fglibs.com/), adiciona profundidade e inclinação tátil suave à capa da trilha em foco na Biblioteca e aos selos conquistados na vitrine.
- O sistema visual unificado (`public/lume.css`) aplica a direção editorial **"Luz Quente sobre Ardósia"** (temas escuro *Noite Acolhedora* e claro *Papel Quente*) em todas as 9 rotas, combinando títulos na serifada variável **Fraunces** (`@fontsource-variable/fraunces`) com interface em **Plus Jakarta Sans** local.
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

Os testes de navegador usam Chrome instalado, em modo headless, com desktop e viewport móvel. Uma base SQLite separada em `data/e2e-*` impede alterações nas contas locais existentes. Os cenários verificam dados legados, prévia, teclado, busca, filtros, criação de curso, progresso, preferências, cadastro, entrada, saída, sincronização e recuperação de senha. Os rastros de falhas ficam em `test-results/`, ignorado no Git.

Na migração, passaram o build, os **23 testes de domínio/autenticação** e os **seis cenários de navegador**. A revisão posterior de README e Continuidade foi apenas documental, com conferência de coerência, caminhos e links.

## Dados e limites atuais

O formato e a chave `lume.prototype.v1` são preservados, assim como cursos, histórico, XP e conquistas legadas. As contas usam cookies HttpOnly e a sincronização básica envia uma cópia do progresso por `/api/state`. Há cópia local, exportação JSON e cópias anteriores ao carregamento da conta/saída. **Não existe reconciliação de conflitos entre dispositivos nem validação de XP no servidor.** O armazenamento do protótipo continua inadequado como autoridade de placares.

Cadastro, login, saída e recuperação por link funcionam na API local. O envio de e-mail ainda não está implementado. No ambiente público, o link de recuperação não é mostrado na resposta quando `SHOW_RESET_LINK` é `false`; o transporte precisa evoluir. A prévia continua disponível sem conta. Os cursos iniciais são exemplos, sem aulas hospedadas. A importação de dados pela interface ainda não existe.

Amigos, grupos, colaboração, ranking com suas três classificações, integrações, retomada automática e conquistas personalizadas continuam planejados. A migração da stack não implementa esses recursos nem altera a política de pontuação em execução.

## Hospedagem

O endereço de referência é [lume.lume-prototype.workers.dev](https://lume.lume-prototype.workers.dev), que responde com o build React/Astro e mantém o backend e os vínculos com D1. A configuração de Wrangler gera o build antes de publicar e envia `dist/`. Alterações feitas depois de uma publicação só aparecem no site público com um novo `npx wrangler deploy`. Nenhum plano pago foi ativado.

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
| `public/*.css` | Estilos, sistema visual do Stitch e interações |
| `public/assets/` | Fontes e imagens locais |
| `auth.js` | Validação, derivação de senha, tokens e cookies |
| `server.js` | API local e entrega do build estático |
| `worker.js` / `wrangler.jsonc` | API Cloudflare, D1 e configuração de build |
| `migrations/` | Esquema do banco existente |
| `scripts/` | Desenvolvimento e geração de cabeçalhos CSP |
| `tests/e2e/` | Verificação dos fluxos no navegador |
