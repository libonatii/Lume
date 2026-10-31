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

Protótipo navegável em português, feito em HTML, CSS e JavaScript. **O Lume terá cadastro e login com e-mail e senha, recuperação de acesso e dados por conta. O fluxo completo de contas está em implementação.** A prévia de estudos ainda guarda o progresso no `localStorage` do navegador. Os cursos iniciais são exemplos ilustrativos, sem aulas hospedadas.

## O que já funciona

- Tela de entrada com o visual do Stitch e campos previstos para e-mail e senha; acesso à prévia enquanto a integração de contas é concluída.
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

1. Use **Entrar na prévia** para experimentar o estudo enquanto a integração de cadastro e login com e-mail e senha é concluída. Os campos da tela permanecem desativados até essa integração; isso não significa que o produto será sem contas.
2. Escolha como os estudos fazem parte da sua rotina e marque os apoios desejados. Confirme para aplicar as sugestões ao seu espaço.
3. Na página Hoje, comece uma missão de exemplo ou prepare o material. Uma preparação não conclui a aula original.
4. Registre a conclusão e acompanhe seu histórico e suas conquistas.
5. Na Biblioteca, adicione seu curso com uma etapa por linha.
6. Nas Configurações, ajuste o ambiente ao seu conforto. Na entrada, **Conforto visual** também permite alterar o tema. Movimentos seguem a preferência do sistema operacional.

**Sair da prévia** retorna à entrada sem apagar cursos, preferências ou XP. A navegação da prévia usa uma marca de sessão na aba, sem autenticar identidade nem separar dados entre pessoas. Ao entrar novamente, você pode confirmar outro ritmo ou manter suas preferências salvas. Revisar o mesmo ritmo preserva uma meta semanal já ajustada manualmente.

## Princípios

- Descansar não apaga conquistas; não há penalidade por dias sem estudo.
- Na visão do produto, XP reconhece estudo efetivo e conclusões, não inteligência nem aprendizado comprovado. A pontuação legada do protótipo ainda precisa ser migrada.
- A gamificação é opcional e não exige diagnóstico.
- As preferências são editáveis; as perguntas iniciais não classificam a pessoa.
- A proposta precisa ser validada com quem vai utilizá-la. O Lume não promete benefícios clínicos nem substitui acompanhamento profissional.

## Dados e limitações

O progresso da prévia permanece no navegador e na origem em que o site foi aberto. Limpar os dados do site ou trocar de navegador pode remover ou separar esse progresso. A exportação permite guardar uma cópia, mas ainda não há restauração pela interface. Não cadastre senhas ou dados sensíveis como conteúdo de estudo. O serviço de contas está em desenvolvimento, e a integração com a interface e a sincronização dos estudos devem ser verificadas antes de anunciar o fluxo completo como disponível.

## Estrutura

| Arquivo | Função |
| --- | --- |
| `index.html` | Estrutura e entrada da aplicação |
| `styles.css` | Identidade visual, temas e adaptação para telas menores |
| `neurofocus.css` | Visual NeuroFocus integrado, com telas Hoje e Biblioteca e temas acessíveis |
| `entry.css` | Telas de entrada e personalização do ritmo de estudo |
| `motion.css` | Transições de navegação e animações, seguindo a preferência de movimento do sistema |
| `assets/stitch/` | Imagens do Stitch armazenadas localmente para o aplicativo |
| `app.js` | Telas, navegação e interações |
| `domain.js` | Cursos, missões, XP, conquistas e restauração dos dados |
| `domain.test.js` | Testes das regras do protótipo |
| `server.js` | Servidor local sem dependências |

## Próximos passos

- Evoluir o modelo de materiais, XP e conquistas conforme [Gamificação](docs/GAMIFICACAO.md), com migração do legado.
- Acrescentar continuidade de vídeos e leituras, começando por registros manuais e fontes efetivamente compatíveis.
- Implementar amigos, grupos, compartilhamento, colaboração e placares opcionais após a base de contas e integridade de XP.
- Validar a experiência com usuários e fazer uma revisão de acessibilidade.
- Permitir edição de cursos e importação de cópias exportadas.
- Implementar contas, recuperação de acesso e dados privados no servidor.
- Ampliar as sugestões por ritmo e apoio, além do plano semanal, preparação do material e modo essencial já disponíveis.
- Avaliar uma versão instalável (PWA) e a hospedagem pública do aplicativo.

O repositório apresenta o código do protótipo; um repositório público não significa que o aplicativo já está hospedado.
