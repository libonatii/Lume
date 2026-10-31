# Lume ✳

**Seu ritmo, seu caminho.** Uma plataforma social de estudos para organizar e retomar aprendizados, colaborar com amigos, compartilhar descobertas, conquistar marcos personalizados e participar de placares de estudo.

O Lume nasceu da vontade de tornar os estudos mais acessíveis, especialmente para pessoas neurodivergentes. Sua gamificação deve reconhecer estudo efetivo e avanços significativos: aulas, leituras, cursos, exercícios e projetos concluídos. Preparar o material ou abrir uma janela não é um evento de recompensa na visão atual do produto.

## Documentação que orienta o projeto

Antes de desenvolver ou pedir alterações a uma IA, leia:

| Documento | Conteúdo |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Instruções de continuidade para IAs e colaboradores |
| [Visão do produto](docs/PRODUTO.md) | Propósito, público, biblioteca, retomada, amigos, grupos, colaboração, integrações e telas |
| [Gamificação](docs/GAMIFICACAO.md) | Critérios de XP, níveis, tempo de estudo, conquistas personalizadas, placares e migração |
| [Estado e continuidade](docs/CONTINUIDADE.md) | O que existe, divergências do protótipo e plano de evolução |

**A documentação de produto prevalece como direção de desenvolvimento sobre o comportamento antigo do protótipo.** Os valores de XP da especificação são uma proposta inicial de balanceamento, ainda a implementar. O código atual mantém a regra legada de 5 XP por preparação e 10 XP por etapa; ela precisa ser substituída com migração explícita, preservando o histórico. Amigos, grupos, placares e integrações ainda são recursos planejados.

## Estado do projeto

Protótipo navegável em português, feito em HTML, CSS e JavaScript. **O cadastro e o login com e-mail e senha, a saída da conta e a recuperação de acesso já funcionam no servidor local.** O progresso de estudo ainda guarda no `localStorage` do navegador e não está separado por conta. Os cursos iniciais são exemplos ilustrativos, sem aulas hospedadas.

## O que já funciona

- Tela de entrada com o sistema visual do Stitch: criar conta, entrar, sair e recuperar a senha por link, além da prévia sem conta.
- Personalização após entrar: três ritmos de estudo e quatro apoios opcionais, com opção de pular e revisar depois.
- Ritmo ajusta a sugestão semanal (2, 3 ou 5 passos); apoios permitem sugerir a preparação do material e ativar o modo essencial.
- Transições suaves entre telas e animações discretas em cartões e diálogos, respeitando a preferência de movimento reduzido do sistema.
- Página Hoje com uma próxima ação concreta e modo essencial.
- Biblioteca com busca, filtros, cursos próprios, links e etapas personalizadas.
- Missões por etapa e opção **Tornar menor**, para registrar a preparação sem concluir a aula.
- XP, níveis, conquistas genéricas e histórico no modelo legado do protótipo; pausas não retiram progresso.
- Pausa e retomada de cursos e plano semanal ajustável.
- Temas claro e escuro, texto ampliado, respeito ao movimento reduzido do sistema e opção de ocultar gamificação.
- Navegação por teclado, rótulos de formulário, diálogos e avisos acessíveis.
- Exportação de dados em JSON (a importação ainda não foi implementada).

## Experimentar no computador

### Pelo terminal (necessário para contas)

Instale o Node.js 22 ou superior. Abra um terminal na pasta do projeto e execute `npm start` (`node server.js`), depois acesse **http://localhost:4173**.

O cadastro, o login e a recuperação de senha dependem desse servidor: eles rodam em `/api/*` e gravam em `data/lume.db`. **O Live Server não serve para criar conta** — ele entrega apenas arquivos estáticos e responde 405 nas rotas de API.

### Pelo VS Code

Use **Open with Live Server** apenas para conferir o layout sem conta, pela prévia. Para entrar com e-mail e senha, abra `http://localhost:4173` com o `npm start` rodando. Os arquivos dentro de `designs/stitch` são as exportações originais de referência.

Se já estiver com uma prévia aberta, recarregue com `Ctrl+Shift+R`.

Abra **http://localhost:4173** no navegador. Para encerrar, use `Ctrl+C` no terminal. Não é necessário executar `npm install`.

Para verificar as regras de progresso e a autenticação:

```sh
npm test
```

## Um primeiro caminho

1. Crie sua conta com nome, e-mail e senha, ou entre se já tiver uma. Também há **Explorar a prévia** para conhecer o layout sem conta.
2. Escolha como os estudos fazem parte da sua rotina e marque os apoios desejados. Confirme para aplicar as sugestões ao seu espaço.
3. Na página Hoje, comece uma missão de exemplo ou prepare o material. Uma preparação não conclui a aula original.
4. Registre a conclusão e acompanhe seu histórico e suas conquistas.
5. Na Biblioteca, adicione seu curso com uma etapa por linha.
6. Nas Configurações, ajuste o ambiente ao seu conforto. Na entrada, **Conforto visual** também permite alterar o tema. Movimentos seguem a preferência do sistema operacional.

**Sair** encerra a sessão e retorna à entrada sem apagar cursos, preferências ou XP. **Esqueci minha senha** gera um link de uso único, válido por 30 minutos; enquanto não há envio de e-mail, o link aparece na própria tela e no console do servidor. A prévia usa uma marca de sessão na aba, sem autenticar identidade nem separar dados entre pessoas.

## Princípios

- Descansar não apaga conquistas; não há penalidade por dias sem estudo.
- Na visão do produto, XP reconhece estudo efetivo e conclusões, não inteligência nem aprendizado comprovado. A pontuação legada do protótipo ainda precisa ser migrada.
- A gamificação é opcional e não exige diagnóstico.
- As preferências são editáveis; as perguntas iniciais não classificam a pessoa.
- A proposta precisa ser validada com quem vai utilizá-la. O Lume não promete benefícios clínicos nem substitui acompanhamento profissional.

## Dados e limitações

O progresso de estudo permanece no navegador e na origem em que o site foi aberto, inclusive para quem entrou com conta: cursos e XP ainda não são gravados no servidor nem separados por pessoa no mesmo navegador. Limpar os dados do site ou trocar de navegador pode remover ou separar esse progresso. A exportação permite guardar uma cópia, mas ainda não há restauração pela interface. Não cadastre senhas ou dados sensíveis como conteúdo de estudo. As contas, a sessão e a recuperação de senha funcionam; o envio do link por e-mail e a sincronização dos estudos ainda não estão implementados.

## Estrutura

| Arquivo | Função |
| --- | --- |
| `public/index.html` | Estrutura e entrada da aplicação |
| `public/styles.css` | Identidade visual, temas e adaptação para telas menores |
| `public/neurofocus.css` | Visual NeuroFocus integrado, com telas Hoje e Biblioteca e temas acessíveis |
| `public/entry.css` | Telas de entrada e personalização do ritmo de estudo |
| `public/stitch.css` | Sistema visual do Stitch preservado: cores, tipografia, espaçamentos e utilitários das telas exportadas |
| `public/motion.css` | Transições de navegação e animações, seguindo a preferência de movimento do sistema |
| `public/assets/stitch/` | Imagens do Stitch armazenadas localmente para o aplicativo |
| `public/assets/fonts/` | Plus Jakarta Sans servida localmente, sem CDN |
| `public/app.js` | Telas, navegação e interações |
| `public/domain.js` | Cursos, missões, XP, conquistas e restauração dos dados |
| `domain.test.js` | Testes das regras do protótipo |
| `auth.js` | Validação, derivação de senha com PBKDF2 e sessão, usado pelo servidor local e pelo Worker |
| `auth.test.js` | Testes de validação, senha, token e cookie |
| `server.js` | Servidor local sem dependências, com a API de contas |
| `worker.js` | Backend para Cloudflare Workers com D1 |
| `wrangler.jsonc` | Configuração do Worker, do banco D1 e das observações |
| `migrations/` | Esquema do banco, aplicado ao D1 |

## Hospedagem

O backend está publicado em **https://lume.lume-prototype.workers.dev** (Cloudflare Workers + D1). O endereço `workers.dev` é funcional, mas não é domínio próprio: nenhum domínio está registrado na conta.

Novas senhas usam **100.000 iterações** em `auth.js`, com ajuste opcional por `PBKDF2_ITERATIONS`. Essa escolha reduz o custo para priorizar o plano gratuito, mas fica abaixo das [600.000 iterações recomendadas pela OWASP para PBKDF2-HMAC-SHA256](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2). O Workers Free tem [limite de 10 ms de CPU por requisição](https://developers.cloudflare.com/workers/platform/limits/): o novo padrão precisa ser medido após publicação, sem garantia de enquadramento só pelo número de iterações. Hashes antigos preservam o custo original, inclusive os de 600.000; a verificação mantém o encadeamento em blocos de até 100.000 e não exige recadastro. A redução vale para cadastros e redefinições de senha futuros, sem migrar o banco.

## Próximos passos

- Evoluir o modelo de materiais, XP e conquistas conforme [Gamificação](docs/GAMIFICACAO.md), com migração do legado.
- Acrescentar continuidade de vídeos e leituras, começando por registros manuais e fontes efetivamente compatíveis.
- Implementar amigos, grupos, compartilhamento, colaboração, ranking e placares opcionais após a integridade de XP no servidor.
- Validar a experiência com usuários e fazer uma revisão de acessibilidade.
- Permitir edição de cursos e importação de cópias exportadas.
- Associar o progresso de estudo à conta e mover a atribuição de XP para o servidor.
- Implementar o envio de e-mail do link de recuperação.
- Converter para o visual do Stitch as telas que ainda não têm exportação: Missões, Conquistas, Meu Caminho, Configurações e as de recuperação de senha.
- Ampliar as sugestões por ritmo e apoio, além do plano semanal, preparação do material e modo essencial já disponíveis.
- Avaliar uma versão instalável (PWA) e a hospedagem pública do aplicativo.

O repositório apresenta o código do protótipo; um repositório público não significa que o aplicativo já está hospedado.
