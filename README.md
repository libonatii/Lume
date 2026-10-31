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
- O visual reutiliza o sistema do Stitch, as imagens e a fonte Plus Jakarta Sans locais.
- Por decisão explícita da responsável, **não há modo essencial nem tratamento de movimento reduzido**. Preferências antigas permanecem nos dados apenas para compatibilidade.
- A API existente continua no **Cloudflare Worker com D1**, ou no servidor Node local. O frontend não exige renderização no servidor.

A [FGLibs](https://fglibs.com/) foi consultada pelo site, pois seu MCP não estava disponível. As interações são implementações próprias em React e Motion, inspiradas nos [princípios da Arc Library](https://uiarc.dev/docs/motion), listada no catálogo; o pacote Arc não foi instalado.

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

O endereço de referência é [lume.lume-prototype.workers.dev](https://lume.lume-prototype.workers.dev). A configuração de Wrangler agora gera o build antes de publicar e envia `dist/`; o backend e os vínculos com D1 são mantidos. Esta migração ainda precisa ser publicada para aparecer no site público. Nenhum plano pago foi ativado.

O build gera hashes CSP dos scripts e estilos inline exatos do Astro e grava `dist/_headers`, utilizado também pelo servidor Node. Não libera execução genérica de scripts inline.

Novas senhas usam **100.000 iterações**, ajustáveis por `PBKDF2_ITERATIONS`. É uma escolha de menor custo, abaixo das [600.000 iterações recomendadas pela OWASP para PBKDF2-HMAC-SHA256](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2). O Workers Free tem [limite de 10 ms de CPU por requisição](https://developers.cloudflare.com/workers/platform/limits/); a execução precisa ser medida após publicação. Hashes antigos continuam usando o custo e o encadeamento originais.

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
