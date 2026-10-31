# Lume ✳

**Seu ritmo, seu caminho.** Um espaço de estudos com pequenas missões, biblioteca pessoal e conquistas — pensado para ajudar a começar e retomar sem punições por pausas.

O Lume nasceu da vontade de tornar a organização dos estudos mais acolhedora para pessoas neurodivergentes. A proposta é transformar objetivos grandes em próximas ações possíveis, com uma experiência visual inspirada em bibliotecas de jogos e autonomia para escolher o que ajuda.

## Estado do projeto

Protótipo navegável em português, feito em HTML, CSS e JavaScript, sem dependências externas. **Ainda não há cadastro, login real, banco de dados ou sincronização.** O progresso é guardado no `localStorage` do navegador. Os cursos iniciais são exemplos ilustrativos, sem aulas hospedadas.

## O que já funciona

- Duas perguntas iniciais sobre rotina e dificuldades, com opção de pular e revisar depois.
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

Abra a pasta `D:\tabletop` e use **Open with Live Server** no arquivo `index.html` da raiz. Esse é o aplicativo funcional, agora com o design NeuroFocus do Stitch integrado às telas Hoje e Biblioteca. Os arquivos dentro de `designs/stitch` são as exportações originais de referência.

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

1. Escolha como os estudos fazem parte da sua rotina e onde deseja ajuda.
2. Na página Hoje, comece uma missão de exemplo ou use **Tornar menor**.
3. Registre a conclusão e acompanhe seu histórico e suas conquistas.
4. Na Biblioteca, adicione seu curso com uma etapa por linha.
5. Nas Configurações, ajuste o ambiente ao seu conforto.

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
| `assets/stitch/` | Imagens do Stitch armazenadas localmente para o aplicativo |
| `app.js` | Telas, navegação e interações |
| `domain.js` | Cursos, missões, XP, conquistas e restauração dos dados |
| `domain.test.js` | Testes das regras do protótipo |
| `server.js` | Servidor local sem dependências |

## Próximos passos

- Validar a experiência com usuários e fazer uma revisão de acessibilidade.
- Permitir edição de cursos e importação de cópias exportadas.
- Implementar contas, recuperação de acesso e dados privados no servidor.
- Evoluir as sugestões com base nas preferências iniciais; nesta versão a primeira missão ainda é comum a todos.
- Avaliar uma versão instalável (PWA) e a hospedagem pública do aplicativo.

O repositório apresenta o código do protótipo; um repositório público não significa que o aplicativo já está hospedado.
