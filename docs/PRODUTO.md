# Lume — visão e requisitos do produto

Versão documental: 1.0. Esta é a referência de produto para planejamento, design, implementação e contexto de futuras IAs. Consulte também [Gamificação](GAMIFICACAO.md) e [Continuidade](CONTINUIDADE.md).

## 1. O que o Lume se propõe a ser

**Lume é uma plataforma social de estudos que conecta continuidade de aprendizado, colaboração entre amigos e progressão de jogo baseada em estudo efetivo.**

A pessoa organiza o que quer aprender, sabe onde parou em cada material, retoma seus estudos, registra avanços significativos e acompanha suas conquistas. Com amigos ou grupos, compartilha aprendizados, conversa sobre dificuldades, trabalha em projetos e participa de placares de estudo.

A inspiração em plataformas como Steam está na biblioteca pessoal, no perfil, na progressão e na vitrine de conquistas. O Lume deve ter identidade própria e uma experiência adulta, clara e inclusiva.

### Resultado esperado

Ao abrir o Lume, a pessoa deve conseguir responder:

1. O que estou estudando e por quê?
2. Onde parei e como continuo?
3. O que realmente concluí ou desenvolvi?
4. Como esse avanço aparece na minha experiência, no meu nível e nas minhas conquistas?
5. Com quem posso aprender, compartilhar e colaborar?

## 2. Público e princípios

O Lume atende pessoas de diferentes áreas e níveis de familiaridade com estudos. Deve ser especialmente atento às necessidades de pessoas neurodivergentes, sem exigir diagnóstico e sem presumir que todas desejam as mesmas adaptações.

Princípios obrigatórios:

- **Avanço significativo:** recompensas por estudar e concluir entregas, não por manipular a interface.
- **Continuidade:** retomar materiais é uma função central, não apenas exibir uma lista de pendências.
- **Autonomia:** ritmo, apoio, metas, recursos sociais, placares e exibição de gamificação são configuráveis.
- **Sociabilidade com propósito:** conversar, compartilhar descobertas e colaborar em estudos reais.
- **Pausas sem punição:** descanso não retira XP nem destrói conquistas; não exigir sequências diárias.
- **Transparência:** diferenciar progresso informado pela pessoa de atividade observada por integração.
- **Conforto:** interface legível, teclado, movimentos reduzidos, temas e modo essencial.
- **Privacidade:** cada pessoa escolhe o que compartilhar; leitura de um material não deve torná-lo público automaticamente.

O Lume não promete liberação de dopamina, eficácia clínica, aprendizado garantido ou aferição de inteligência. Gamificação é uma estratégia de engajamento a validar com usuários.

## 3. Ciclo principal de uso

1. A pessoa cria uma conta e entra no produto completo. A prévia atual ainda não oferece contas reais.
2. Informa seu ritmo, áreas de interesse e apoios desejados.
3. Adiciona cursos, aulas, artigos, livros, exercícios ou projetos à biblioteca.
4. Retoma um material do ponto salvo ou inicia uma atividade de estudo.
5. Estuda; o sistema registra progresso conforme a capacidade da fonte ou por registro manual explícito.
6. Recebe XP por tempo efetivo e por conclusões elegíveis, conforme regras documentadas.
7. Conquista marcos personalizados e evolui de nível.
8. Compartilha um aprendizado ou conquista, conversa com amigos e, se desejar, participa de um grupo e de seu placar.

Preparar o ambiente e tornar uma atividade menor são apoios possíveis nesse ciclo. Essas ações não concedem XP por si só.

## 4. Entrada e personalização

**O Lume terá cadastro e login com e-mail e senha.** Esse acesso faz parte do produto, com recuperação de senha, saída da conta e dados associados à pessoa autenticada. O acesso demonstrativo da prévia é temporário e não substitui a implementação de contas. Login com Google pode complementar o acesso; não substitui o requisito de e-mail e senha.

O onboarding deve identificar:

| Dimensão | Exemplos | Consequência esperada |
| --- | --- | --- |
| Ritmo atual | Quero começar; estudo às vezes; estudo com frequência | Sugestões iniciais de sessões e carga de estudo, sempre editáveis |
| Áreas de estudo | Programação, Direito, idiomas, outras ou múltiplas | Tipos de materiais, linguagem e integrações pertinentes |
| Objetivos | Concluir um curso, estudar para uma prova, entregar um projeto | Organização de trilhas e marcos |
| Apoios desejados | Menos informação, ajuda para começar, dividir uma atividade, retomar após pausas | Apresentação e sugestões, sem aumentar artificialmente XP |
| Preferências sociais | Amigos, grupos, placares e privacidade | Participação opcional e compartilhamento controlado |

As perguntas podem ser puladas e revisitadas. A pessoa não recebe uma classificação de capacidade. Estudar com frequência não dá multiplicador de XP; precisar de mais apoio não diminui a pontuação pela mesma atividade.

## 5. Biblioteca e continuidade

Cada material precisa ter título, tipo, área, origem, estado e progresso. Deve poder pertencer a uma trilha, curso, objetivo ou projeto.

Estados principais: para começar, em andamento, pausado e concluído. Pausar preserva o ponto de retomada.

| Tipo | Progresso desejado | Retomada desejada |
| --- | --- | --- |
| Curso | Aulas e módulos concluídos | Próxima aula ou aula em andamento |
| Videoaula | Posição atual, trechos percorridos e tempo efetivo | Mesmo vídeo no instante salvo, se a fonte permitir |
| Artigo/PDF | Página, seção ou marcador; conclusão declarada | Página ou seção marcada, quando houver suporte |
| Livro | Capítulo/página e progresso informado | Marcador de leitura |
| Exercícios | Lista, exercícios resolvidos e revisões | Próximo exercício ou tentativa em andamento |
| Projeto | Entregas, etapas substanciais e situação | Próxima entrega definida |

### Exemplo: Direito

A pessoa cadastra o artigo **Introdução a Processo Penal**, registra que parou na seção 3 e o mantém em andamento. Depois retoma a leitura, termina o artigo e registra a conclusão. A vitrine recebe **“Terminei de ler o artigo Introdução a Processo Penal”**. Uma videoaula de Direito segue o mesmo modelo de continuidade de qualquer outra área.

### Exemplo: Programação

A pessoa informa que estuda programação e pode conectar o GitHub. Escolhe quais repositórios ou entregas deseja acompanhar e define o que significa terminar cada projeto. O Lume mostra entregas pendentes e facilita colaboração. Conectar o GitHub, criar um repositório vazio ou fazer qualquer commit isolado não gera XP automaticamente.

Uma entrega como **“Implementar e validar a autenticação do projeto”** pode ser um marco elegível. O simples número de commits ou linhas de código não representa aprendizado.

## 6. Integrações: objetivo e limites

O objetivo é reduzir registros repetitivos e facilitar a retomada. As integrações ainda precisam ser implementadas e verificadas individualmente.

Para cada fonte, registrar as capacidades disponíveis: ler posição, salvar posição, retomar posição, consultar progresso, observar conclusão e sincronizar entregas. Nunca tratar essas capacidades como universais.

### Vídeos

- Quando houver player integrado ou API compatível, registrar posição em pausas e periodicamente durante a reprodução, com persistência entre sessões.
- Distinguir posição de reprodução, cobertura do conteúdo e tempo efetivo. Arrastar o cursor até o fim não equivale a assistir à aula.
- Quando o vídeo abrir em outro site sem integração compatível, oferecer posição manual ou um link com marca de tempo quando suportado. Informar que a atualização é manual.
- Não afirmar que qualquer URL permite acompanhar o vídeo em outra aba. Não contornar proteções, autenticação, restrições da plataforma ou direitos de acesso.
- Uma interrupção de conexão deve preservar o progresso já confirmado e tratar a sincronização de modo recuperável.

### Artigos e PDFs

- Um leitor próprio ou uma integração compatível pode permitir marcadores de página e seção.
- Em páginas externas sem integração, permitir marcador e conclusão manuais.
- Rolar a página inteira, abrir o PDF ou manter a aba aberta não prova leitura nem concede recompensa de conclusão.
- Não copiar ou redistribuir materiais restritos apenas porque a pessoa adicionou um link.

### GitHub

- Conexão opcional, com escopo mínimo e seleção explícita do que acompanhar.
- Definir entregas e critérios de conclusão; não inferir que todo repositório foi abandonado ou que precisa ser terminado.
- Vincular tarefas e evidências quando a integração permitir; revisão e conclusão precisam de critérios visíveis.
- Repositórios privados, descrições de issues e código não devem aparecer em grupos sem escolha explícita de compartilhamento.
- Integração não é autorização para comentar, abrir issues, alterar código ou enviar mensagens em nome da pessoa.

## 7. Amigos, grupos e colaboração

Recursos esperados do produto:

- Convidar e aceitar amigos; remover contatos, bloquear e denunciar abuso.
- Criar grupos privados ou por convite para uma turma, curso, assunto ou projeto.
- Conversar em espaços de estudo e compartilhar notas, links, dúvidas, resumos e conquistas.
- Comentar aprendizados e organizar entregas colaborativas.
- Ver, mediante permissão, em que os amigos estão trabalhando e o que concluíram.
- Formar metas coletivas opcionais, com contribuição individual identificável.

Conversar, publicar mensagens, reagir e convidar amigos não gera XP automaticamente. Uma colaboração só é elegível quando representa uma entrega de estudo definida; receber curtidas não comprova valor educacional.

Permissões, prevenção de spam e moderação fazem parte do recurso social. Exibir atividade de terceiros requer respeitar suas escolhas de privacidade.

## 8. Minhas conquistas, perfil e placares

### Minhas conquistas

A vitrine reúne marcos permanentes, vinculados ao material real, com título, data, origem e critério. Exemplos:

- **Terminei o curso Introdução à Engenharia de Software.**
- **Terminei de ler o artigo Introdução a Processo Penal.**
- **Concluí o projeto API de Biblioteca.**
- **Concluí a lista de exercícios de Estruturas de Dados.**

Cada conquista possui uma página ou detalhe que explica o que foi concluído. A pessoa escolhe quais exibir no perfil e compartilhar. Textos personalizados não exigem geração por IA: modelos com o título do material são suficientes.

### Placares

**O ranking é um recurso central previsto para o Lume.** Deve permitir comparar quem tem mais nível, quem concluiu mais cursos e quem está mais ativo e empenhado nos estudos. A existência desse recurso faz parte do escopo; a participação e a exposição de cada pessoa continuam configuráveis.

| Classificação | Critério principal | O que comunica |
| --- | --- | --- |
| Nível | Nível acumulado, com XP acumulado como desempate | Progressão geral de estudo |
| Cursos concluídos | Quantidade de cursos distintos e elegíveis concluídos | Volume de formações terminadas |
| Empenho no período | XP elegível obtido estudando e concluindo atividades no período escolhido | Atividade recente, com minutos efetivos e conclusões apresentados como contexto |

O ranking geral abre por nível; a pessoa pode alternar para cursos concluídos ou empenho. Empenho começa com uma classificação semanal e pode oferecer outros períodos, como mês. Nível e total de cursos também devem ter visão acumulada, para que o produto não seja apenas uma disputa semanal de XP.

Começar pelos recortes de amigos e grupos. A virada de um período não apaga XP acumulado, cursos concluídos ou conquistas permanentes. Não esconder critérios em uma pontuação composta sem explicação.

O placar não mede inteligência ou mérito pessoal. Deve mostrar período e regras, permitir ocultar a própria participação e lidar com registros manuais de modo transparente. Ranking público global é uma evolução posterior, dependente de regras de integridade e moderação.

As regras detalhadas estão em [Gamificação](GAMIFICACAO.md).

## 9. Estrutura de telas pretendida

| Tela | Papel |
| --- | --- |
| Entrada e conta | Cadastro, autenticação, recuperação e saída reais quando implementados |
| Meu ritmo e interesses | Preferências e sugestões iniciais |
| Hoje | Materiais em andamento, ponto de retomada e atividade de estudo |
| Biblioteca | Cursos, aulas, leituras, exercícios e projetos |
| Trilhas e projetos | Objetivos e entregas substanciais |
| Amigos e grupos | Comunicação, compartilhamento e colaboração |
| Placares | Comparação opcional dentro de períodos e regras definidos |
| Minhas conquistas | Vitrine personalizada de conclusões |
| Meu caminho | Histórico de estudo e explicação do XP |
| Integrações | GitHub e fontes compatíveis; permissões e estado de conexão |
| Configurações e conforto | Acessibilidade, ritmo, privacidade e notificações |

## 10. Escopo que não deve ser confundido com a proposta

- Não é um sistema de XP por cliques, abertura de janelas ou simples preparação.
- Não é apenas um Pomodoro ou checklist de microtarefas.
- Não precisa hospedar cursos ou substituir todas as plataformas de conteúdo.
- Não oferece observação universal do que acontece em sites externos.
- Não depende de programação: Direito e outras áreas têm igual importância no modelo.
- Não deve eliminar o componente social ou os placares para parecer inclusivo; deve torná-los configuráveis e claros.

## 11. Critérios de aceite do produto

1. Preparar o material não altera XP, nível ou placar.
2. Concluir uma aula elegível gera recompensa uma única vez e preserva a próxima ação da trilha.
3. Um curso concluído gera uma conquista com seu nome e o bônus de curso definido na política.
4. Um artigo incompleto permanece em andamento com marcador de retomada; sua conclusão gera uma conquista própria.
5. A aula pode ser retomada automaticamente apenas nas fontes com essa capacidade; nas demais, a interface informa o registro manual.
6. Tempo de estudo elegível pode gerar XP antes de concluir o material, sem premiar abas ociosas nem sessões sobrepostas.
7. Pessoas podem compartilhar aprendizados e colaborar com amigos sem tornar toda a biblioteca pública.
8. O ranking permite alternar entre nível, cursos concluídos e empenho no período, com regras visíveis e dados autorizados. A visão acumulada não desaparece na virada da semana.
9. Mudar o ritmo ou precisar de uma pausa não retira conquistas.
10. A experiência funciona com teclado, movimento reduzido e recursos sociais ocultos quando a pessoa assim escolher.
