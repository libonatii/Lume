# Lume ✳

**Seu ritmo, seu caminho.** Um espaço de estudos com pequenas missões, biblioteca pessoal e conquistas — pensado para ajudar a começar e retomar sem punições por pausas.

O Lume nasceu da vontade de tornar a organização dos estudos mais acolhedora para pessoas neurodivergentes. A proposta é transformar objetivos grandes em próximas ações possíveis, com uma experiência visual inspirada em bibliotecas de jogos e autonomia para escolher o que ajuda.

## Estado do projeto

Protótipo navegável em português, feito em HTML, CSS e JavaScript, sem dependências externas. **Ainda não há cadastro, login real, banco de dados ou sincronização.** O progresso é guardado no `localStorage` do navegador. Os cursos iniciais são exemplos ilustrativos, sem aulas hospedadas.

## O que já funciona

- Tela de entrada com o visual do Stitch e acesso à prévia sem fornecer e-mail ou senha.
- Personalização após entrar: três ritmos de estudo e quatro apoios opcionais, com opção de pular e revisar depois.
- Ritmo ajusta a sugestão semanal (2, 3 ou 5 passos); apoios permitem sugerir a preparação do material e ativar o modo essencial.
- Transições suaves entre telas e animações discretas em cartões e diálogos, respeitando a preferência de movimento reduzido do aplicativo e do sistema.
- Página Hoje com uma próxima ação concreta e modo essencial.
- Biblioteca com busca, filtros, cursos próprios, links e etapas personalizadas.
- Missões por etapa e opção **Tornar menor**, para registrar a preparação sem concluir a aula.
- XP, níveis, conquistas e histórico; pausas não retiram progresso.
- Pausa e retomada de cursos e plano semanal ajustável.
- Temas claro e escuro, texto ampliado, movimento reduzido e opção de ocultar gamificação.
- Navegação por teclado, rótulos de formulário, diálogos e avisos acessíveis.
- Exportação de dados em JSON (a importação ainda não foi implementada).

## Experimentar no computador

### Pelo VS Code

Abra a pasta `D:\tabletop` e use **Open with Live Server** no arquivo `index.html` da raiz. Esse é o aplicativo funcional, com as telas Entrada, Ritmo de Estudo, Hoje e Biblioteca integradas ao design do Stitch. Os arquivos dentro de `designs/stitch` são as exportações originais de referência.

Se já estiver com uma prévia aberta, recarregue com `Ctrl+Shift+R`.

### Pelo terminal

Instale o Node.js 22 ou superior. Abra um terminal na pasta do projeto e execute:

```sh
npm start
```

Abra **http://localhost:4173** no navegador. Para encerrar, use `Ctrl+C` no terminal. Não é necessário executar `npm install`.

Para verificar as regras de progresso:

```sh
npm test
```

## Um primeiro caminho

1. Use **Entrar na prévia**. O login com conta e Google ainda não está disponível; os campos de credenciais ficam desativados.
2. Escolha como os estudos fazem parte da sua rotina e marque os apoios desejados. Confirme para aplicar as sugestões ao seu espaço.
3. Na página Hoje, comece uma missão de exemplo ou prepare o material. Uma preparação não conclui a aula original.
4. Registre a conclusão e acompanhe seu histórico e suas conquistas.
5. Na Biblioteca, adicione seu curso com uma etapa por linha.
6. Nas Configurações, ajuste o ambiente ao seu conforto. Na entrada, **Conforto visual** também permite alterar o tema e reduzir movimentos.

**Sair da prévia** retorna à entrada sem apagar cursos, preferências ou XP. A navegação da prévia usa uma marca de sessão na aba, sem autenticar identidade nem separar dados entre pessoas. Ao entrar novamente, você pode confirmar outro ritmo ou manter suas preferências salvas. Revisar o mesmo ritmo preserva uma meta semanal já ajustada manualmente.

## Princípios

- Descansar não apaga conquistas; não há penalidade por dias sem estudo.
- XP registra ações, não inteligência nem aprendizado comprovado.
- A gamificação é opcional e não exige diagnóstico.
- As preferências são editáveis; as perguntas iniciais não classificam a pessoa.
- A proposta precisa ser validada com quem vai utilizá-la. O Lume não promete benefícios clínicos nem substitui acompanhamento profissional.

## Dados e limitações

Os dados permanecem no navegador e na origem em que o site foi aberto. Limpar os dados do site ou trocar de navegador pode remover ou separar o progresso. A exportação permite guardar uma cópia, mas ainda não há restauração pela interface. Não cadastre senhas ou dados sensíveis como conteúdo de estudo. O servidor incluído serve arquivos locais e não oferece contas ou APIs de dados.

## Estrutura

| Arquivo | Função |
| --- | --- |
| `index.html` | Estrutura e entrada da aplicação |
| `styles.css` | Identidade visual, temas e adaptação para telas menores |
| `neurofocus.css` | Visual NeuroFocus integrado, com telas Hoje e Biblioteca e temas acessíveis |
| `entry.css` | Telas de entrada e personalização do ritmo de estudo |
| `motion.css` | Transições de navegação, animações e respeito ao movimento reduzido |
| `assets/stitch/` | Imagens do Stitch armazenadas localmente para o aplicativo |
| `app.js` | Telas, navegação e interações |
| `domain.js` | Cursos, missões, XP, conquistas e restauração dos dados |
| `domain.test.js` | Testes das regras do protótipo |
| `server.js` | Servidor local sem dependências |

## Próximos passos

- Validar a experiência com usuários e fazer uma revisão de acessibilidade.
- Permitir edição de cursos e importação de cópias exportadas.
- Implementar contas, recuperação de acesso e dados privados no servidor.
- Ampliar as sugestões por ritmo e apoio, além do plano semanal, preparação do material e modo essencial já disponíveis.
- Avaliar uma versão instalável (PWA) e a hospedagem pública do aplicativo.

O repositório apresenta o código do protótipo; um repositório público não significa que o aplicativo já está hospedado.
