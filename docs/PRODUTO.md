# Lume — visão e requisitos do produto

Versão documental: 1.0. Esta é a referência de produto para planejamento, design, implementação e contexto de futuras IAs. Consulte também [Gamificação](GAMIFICACAO.md) e [Continuidade](CONTINUIDADE.md).

Este documento descreve o destino do produto e diferencia o que está implementado do que continua planejado. Biblioteca com materiais tipados e retomada, política de XP validada no servidor, conquistas personalizadas, amigos, mensagens diretas, colaboração em entregas e ranking de amigos já existem; integrações de progresso e observação de reprodução continuam pendentes. O diagnóstico e o plano de evolução estão em [Evolução](EVOLUCAO.md). **Comunidades, servidores, canais e grupos estão fora do escopo desta etapa.** O estado detalhado está em [Continuidade](CONTINUIDADE.md).

## 1. O que o Lume se propõe a ser

**Lume é uma plataforma social de estudos que conecta continuidade de aprendizado, colaboração entre amigos e progressão de jogo baseada em estudo efetivo.**

A pessoa organiza o que quer aprender, sabe onde parou em cada material, retoma seus estudos, registra avanços significativos e acompanha suas conquistas. Com amigos, compartilha aprendizados, conversa por mensagem direta, trabalha em projetos e participa de placares de estudo.

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
- **Conforto:** interface legível, teclado, temas e tamanho de texto ajustável. Por decisão explícita da responsável nesta revisão, a interface não oferece modo essencial nem tratamento de movimento reduzido.
- **Privacidade:** cada pessoa escolhe o que compartilhar; leitura de um material não deve torná-lo público automaticamente.

O Lume não promete liberação de dopamina, eficácia clínica, aprendizado garantido ou aferição de inteligência. Gamificação é uma estratégia de engajamento a validar com usuários.

## 3. Ciclo principal de uso

1. A pessoa cria uma conta e entra no produto completo. Cadastro e login usam e-mail e senha. A biblioteca é lida e gravada diretamente na API, com revisão otimista: alterações concorrentes pedem recarga e repetição explícita, sem mescla automática de documentos no navegador.
2. Informa seu ritmo, áreas de interesse e apoios desejados.
3. Adiciona cursos, aulas, artigos, livros, exercícios ou projetos à biblioteca.
4. Retoma um material do ponto salvo ou inicia uma atividade de estudo.
5. Estuda; o sistema registra progresso conforme a capacidade da fonte ou por registro manual explícito.
6. Recebe XP por tempo efetivo e por conclusões elegíveis, conforme regras documentadas.
7. Conquista marcos personalizados e evolui de nível.
8. Compartilha um aprendizado ou conquista, conversa com amigos por mensagem direta e, se desejar, participa do placar de amigos.

Preparar o ambiente e tornar uma atividade menor são apoios possíveis nesse ciclo. Essas ações não concedem XP por si só.

## 4. Entrada e personalização

**O cadastro e o login com e-mail e senha já funcionam.** Esse acesso faz parte do produto, com recuperação de senha, saída da conta e biblioteca associada à pessoa autenticada no servidor. O XP elegível é validado no servidor, em um livro de eventos. A prévia demonstrativa dura somente enquanto a página está aberta, sem persistência de estudo no navegador; não substitui a conta. Login com Google pode complementar o acesso; não substitui o requisito de e-mail e senha.

O onboarding deve identificar:

| Dimensão | Exemplos | Consequência esperada |
| --- | --- | --- |
| Ritmo atual | Quero começar; estudo às vezes; estudo com frequência | Sugestões iniciais de sessões e carga de estudo, sempre editáveis |
| Áreas de estudo | Programação, Direito, idiomas, outras ou múltiplas | Tipos de materiais, linguagem e integrações pertinentes |
| Objetivos | Concluir um curso, estudar para uma prova, entregar um projeto | Organização de trilhas e marcos |
| Apoios desejados | Ajuda para começar, dividir uma atividade, retomar após pausas | Apresentação e sugestões, sem aumentar artificialmente XP |
| Preferências sociais | Amigos, mensagens diretas, placares e privacidade | Participação opcional e compartilhamento controlado |

As perguntas podem ser puladas e revisitadas. A pessoa não recebe uma classificação de capacidade. Estudar com frequência não dá multiplicador de XP; precisar de mais apoio não diminui a pontuação pela mesma atividade.

Na interface atual, a personalização oferece três jornadas com sequências próprias: **Quero começar** (assunto, resultado, material, tempo de sessão), **Estudo de vez em quando** (materiais em andamento, prioridade, ponto de retomada, dificuldades) e **Estudo com frequência** (áreas, rotina, em andamento, o que acompanhar). Cada jornada cria um primeiro material concreto, guarda as respostas na conta e pode ser retomada se for interrompida. Os três apoios disponíveis são ajuda para começar, retomar sem culpa e passos ainda menores. A etapa social é opcional e apresenta o ranking de amigos; mensagens diretas existem fora do onboarding. O apoio antigo `calm` e a preferência `essential` permanecem apenas no formato legado dos dados, sem ativar um modo visual.

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

### Importação por link (implementada)

A pessoa cola o link do curso, o Lume identifica a plataforma e apresenta as áreas encontradas para seleção. O fluxo é descrito em [Importação](IMPORTACAO.md). Regras de produto que valem desde já:

- O conteúdo importado é o que a fonte realmente publica; grade parcial aparece marcada e nunca é apresentada como o curso inteiro.
- Curso que só aparece depois do login pode ser importado a partir da página que a própria pessoa copia e cola. O Lume não pede senha nem cookie, não contorna a autenticação e trata o conteúdo copiado como dado.
- Aulas mantêm referência da fonte e a identidade do curso evita duplicação ao reimportar.
- Importar, selecionar disciplinas, atualizar a grade e conectar integrações não geram XP.
- Conclusão de aula importada é registro manual identificado enquanto não houver integração compatível; ela não reutiliza as recompensas legadas.
- O edital da prova é uma referência separada, com fonte e data. Sem edição e fase identificadas, o Lume pede apenas essas informações e não calcula cobertura.
- Sugestões de IA são organização do texto fornecido, não conteúdo oficial, e aparecem identificadas.

### Tarefas de prova (implementadas)

- A pessoa mantém uma lista de tarefas necessárias para estudar para uma prova, com vínculo opcional a um curso, prazo opcional e prioridade explícita. Tarefas atrasadas aparecem primeiro, também na página Hoje.
- Definir ou mudar a prioridade é organização e não gera XP.
- Criar, editar, organizar ou remover tarefas é preparação e não gera XP.
- Concluir uma tarefa de estudo definida concede XP uma vez; reabrir retira o XP até concluir de novo, sem acumular. A regra em execução é transitória e está detalhada em [Gamificação](GAMIFICACAO.md#tarefas-de-prova--regra-em-execução-no-protótipo).
- O XP da tarefa é declarado no navegador no protótipo e não vale para ranking até existir validação no servidor. A migração proposta (tarefa vinculada a aula conclui a aula; tarefa sem vínculo é organizacional) está em [Evolução §4.6](EVOLUCAO.md#46-transição-sem-apagar-histórico) e depende de aprovação.
- Tarefas não concluem curso, não criam conquista por material e não substituem a sessão de estudo declarada.

### Sessão declarada e aplicativo de desktop (implementados)

- A pessoa inicia, pausa e encerra uma sessão de estudo vinculada ao material. O tempo é declarado, sobrevive ao recarregamento e não é observação de atividade.
- O aplicativo de desktop do Lume (nome técnico: Companion) é o próprio Lume em uma janela própria, opcional, com bandeja do sistema. Além do site completo, ele pode informar qual aplicativo autorizado está aberto, mostra quantas aulas faltam e apresenta um roteiro por prioridade de continuidade. A presença é um recurso dele, não a sua razão de existir.
- Presença no programa não é estudo comprovado: não concede XP, não conclui aula e não entra no histórico de progresso.
- O programa recebe um acesso próprio por dispositivo, revogável, que só relata presença e lê o roteiro.
- Bandeja, janela com o site, painel de presença e instalador do programa Windows já existem. Assinatura de código, início com o Windows e recursos sociais dentro do programa continuam pendentes.

## 6. Integrações: objetivo e limites

O objetivo é reduzir registros repetitivos e facilitar a retomada. As integrações ainda precisam ser implementadas e verificadas individualmente. A importação de grade por link é a primeira entrega dessa linha: ela declara, por plataforma, o que consegue ler e nunca promete progresso automático; ver [Importação](IMPORTACAO.md).

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
- Na primeira versão, priorizar leitura de README, issues e milestones e a coordenação da colaboração. Abrir issues, comentar, enviar código ou conceder permissões exige ação explícita e integração própria.
- Definir entregas e critérios de conclusão; não inferir que todo repositório foi abandonado ou que precisa ser terminado. Inatividade, issues abertas ou ausência de documentação não bastam para afirmar que o projeto está incompleto.
- Diferencie o que foi encontrado no repositório do que é sugestão da IA; toda sugestão de entrega mostra a origem e pode ser revisada.
- Vincular tarefas e evidências quando a integração permitir; revisão e conclusão precisam de critérios visíveis.
- Convidar um amigo para uma entrega não concede acesso ao repositório no GitHub; esse acesso, quando necessário, é providenciado pelo proprietário.
- Repositórios privados, descrições de issues e código não devem aparecer em perfis, mensagens ou convites sem escolha explícita de compartilhamento e autorização adequada.
- Integração não é autorização para comentar, abrir issues, alterar código ou enviar mensagens em nome da pessoa. Credenciais ficam no servidor e as permissões são mínimas.

## 7. Amigos, mensagens diretas e colaboração

**Nesta etapa não há comunidades, servidores, canais ou grupos.** O social se concentra em amigos, mensagens diretas e colaboração em projetos.

Recursos esperados do produto:

- Convidar e aceitar amigos; remover contatos, bloquear e denunciar abuso.
- Conversar por mensagem direta apenas entre amizades aceitas, com histórico persistente e indicação de não lidas.
- Compartilhar referências a cursos, aulas e projetos, sem conceder acesso automático a conteúdo privado ou restrito.
- Controlar notificações e bloquear contatos; o bloqueio interrompe novas mensagens e preserva o histórico.
- Organizar entregas colaborativas e convidar um amigo para uma entrega específica, com aceite ou recusa.
- Ver, mediante permissão, em que os amigos estão trabalhando e o que concluíram.
- Não há conversas em grupo, canais, chamadas de voz ou vídeo nesta etapa.

Mensagens, notificações, convites e reações não geram XP. Uma colaboração só é elegível quando representa uma entrega de estudo definida e tem contribuição individual identificável; não conceder automaticamente a mesma recompensa a todos. Aceitar uma colaboração no Lume não concede acesso ao repositório no GitHub.

Permissões, prevenção de spam e moderação fazem parte do recurso social. Exibir atividade de terceiros requer respeitar suas escolhas de privacidade.

## 8. Minhas conquistas, perfil e placares

### Minhas conquistas

A vitrine reúne marcos permanentes, vinculados ao material real, com título, data, origem e critério. Exemplos:

- **Terminei o curso Introdução à Engenharia de Software.**
- **Terminei de ler o artigo Introdução a Processo Penal.**
- **Concluí o projeto API de Biblioteca.**
- **Concluí a lista de exercícios de Estruturas de Dados.**

Cada conquista possui uma página ou detalhe que explica o que foi concluído. A pessoa escolhe quais exibir no perfil e compartilhar. Textos personalizados não exigem geração por IA: modelos com o título do material são suficientes.

### Perfil entre amigos (implementado)

- O perfil reúne o que a pessoa está estudando, o roteiro que aparece em Hoje, os projetos que ela marcou como públicos, os materiais concluídos e os números de progresso e XP.
- Abrir o perfil exige amizade. Não existe perfil público por link, busca por e-mail nem página anônima.
- Cada seção pode ser desligada em Configurações › O que amigos veem, e cada projeto nasce privado até ser marcado. Projeto privado não aparece em lugar nenhum, nem nas contagens.
- XP, nível e conquistas de contas vêm do livro de eventos do servidor e são validados; percentuais de progresso vêm da biblioteca no servidor e continuam declarados. O saldo legado não entra no perfil como XP validado.
- A escolha individual de conquistas para o perfil e o compartilhamento de aprendizados continuam pendentes. Mensagens diretas entre amizades estão implementadas.

### Placares

**O ranking é um recurso central do Lume e está implementado no recorte de amigos.** Permite comparar quem tem mais nível, quem concluiu mais cursos e quem está mais ativo e empenhado nos estudos. Participação e exposição continuam configuráveis; grupos e ranking público estão fora desta etapa.

| Classificação | Critério principal | O que comunica |
| --- | --- | --- |
| Nível | Nível acumulado, com XP acumulado como desempate | Progressão geral de estudo |
| Cursos concluídos | Quantidade de cursos distintos e elegíveis concluídos | Volume de formações terminadas |
| Empenho no período | XP elegível obtido estudando e concluindo atividades no período escolhido | Atividade recente, com minutos efetivos e conclusões apresentados como contexto |

O ranking geral abre por nível; a pessoa pode alternar para cursos concluídos ou empenho. Empenho começa com uma classificação semanal e pode oferecer outros períodos, como mês. Nível e total de cursos também devem ter visão acumulada, para que o produto não seja apenas uma disputa semanal de XP.

Começar pelo recorte de amigos. A virada de um período não apaga XP acumulado, cursos concluídos ou conquistas permanentes. Não esconder critérios em uma pontuação composta sem explicação.

O placar não mede inteligência ou mérito pessoal. Deve mostrar período e regras, permitir ocultar a própria participação e lidar com registros manuais de modo transparente. Ranking público global é uma evolução posterior, dependente de regras de integridade e moderação.

As regras detalhadas estão em [Gamificação](GAMIFICACAO.md).

## 9. Estrutura de telas pretendida

| Tela | Papel |
| --- | --- |
| Entrada e conta | Cadastro, autenticação, recuperação por link e saída já disponíveis na API local; envio de e-mail ainda pendente |
| Meu ritmo e interesses | Preferências e sugestões iniciais |
| Hoje | Próxima ação única (mesmo critério do roteiro do Companion), com motivo, tempo a reservar — duração conhecida ou estimada —, link do material e o que falta; sessão; tarefas relevantes com atraso; evolução com a última recompensa |
| Plano | Cronograma pela disponibilidade semanal, prazos e prioridades, com duração conhecida ou estimada, conflito de prazo explicado com ajustes e adiamento; abas Tarefas e Roteiro (próxima aula de cada curso) |
| Tarefas | Lista de estudo para uma prova, com prioridade (alta, média, baixa ou sem prioridade), prazo, atraso, vínculo opcional a curso e aula, subtarefas e conclusão com XP único |
| Biblioteca | Cursos, aulas, leituras, exercícios e projetos, com capas, filtros, favoritos e retomada |
| Trilhas e projetos | Objetivos e entregas substanciais |
| Organização | Anotações, listas de aulas e entregas, quadro de projetos e modelos básicos |
| Amigos e mensagens | Comunicação, compartilhamento e colaboração. Convites, lista de amigos, mensagens diretas, bloqueio, colaboração em entregas e ranking de amigos já existem |
| Perfil entre amigos | Projeção da biblioteca, da fila, do progresso e do XP que cada pessoa escolheu compartilhar; exige amizade |
| Instalar aplicativo | Página do aplicativo de desktop: baixa o instalador da última release e gera o código de conexão |
| Placares | Comparação opcional dentro de períodos e regras definidos |
| Minhas conquistas | Vitrine personalizada de conclusões |
| Meu caminho | Histórico de estudo e explicação do XP |
| Integrações | GitHub e fontes compatíveis; permissões e estado de conexão |
| Aplicativo de desktop (Companion) | O Lume completo numa janela própria, com bandeja e painel de presença: presença local opcional, aulas restantes e roteiro por prioridade, sem XP |
| Extensão do navegador | Protótipo: lê, na página aberta pela pessoa com a conta dela, as aulas e o que aparece concluído, e envia ao Lume para revisão. Não gera XP por si; detalhes em [Importação](IMPORTACAO.md) |
| Configurações e conforto | Acessibilidade, ritmo, privacidade e notificações |

## 10. Escopo que não deve ser confundido com a proposta

- Não é um sistema de XP por cliques, abertura de janelas ou simples preparação.
- Não é apenas um Pomodoro ou checklist de microtarefas.
- Não precisa hospedar cursos ou substituir todas as plataformas de conteúdo.
- Não oferece observação universal do que acontece em sites externos.
- Não depende de programação: Direito e outras áreas têm igual importância no modelo.
- Não é uma rede de comunidades, servidores ou canais: nesta etapa, o social se limita a amigos, mensagens diretas e colaboração em projetos.
- Não deve eliminar o componente social ou os placares para parecer inclusivo; deve torná-los configuráveis e claros.

## 11. Critérios de aceite do produto

1. Preparar o material não altera XP, nível ou placar.
2. Concluir uma aula elegível gera recompensa uma única vez e preserva a próxima ação da trilha.
3. Concluir uma tarefa de prova definida gera XP uma única vez; criar ou organizar a lista não gera nada.
4. Um curso concluído gera uma conquista com seu nome e o bônus de curso definido na política.
5. Um artigo incompleto permanece em andamento com marcador de retomada; sua conclusão gera uma conquista própria.
6. A aula pode ser retomada automaticamente apenas nas fontes com essa capacidade; nas demais, a interface informa o registro manual.
7. Tempo de estudo elegível pode gerar XP antes de concluir o material, sem premiar abas ociosas nem sessões sobrepostas.
8. Pessoas podem compartilhar aprendizados e colaborar com amigos sem tornar toda a biblioteca pública.
9. O ranking permite alternar entre nível, cursos concluídos e empenho no período, com regras visíveis e dados autorizados. A visão acumulada não desaparece na virada da semana.
10. Mudar o ritmo ou precisar de uma pausa não retira conquistas.
11. A experiência funciona com teclado, temas e texto ajustável; os recursos sociais podem ser ocultos quando a pessoa assim escolher. Modo essencial e tratamento de movimento reduzido foram retirados do escopo por decisão explícita da responsável.
