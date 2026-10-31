Implemente no Lume três jornadas de onboarding e primeiros passos, de acordo com a opção escolhida pelo usuário:

1. Quero começar.
2. Estudo de vez em quando.
3. Estudo com frequência.

CONTEXTO DO PROJETO

O repositório está em D:\tabletop.

Antes de implementar, leia:
- AGENTS.md
- docs/PRODUTO.md
- docs/GAMIFICACAO.md
- docs/CONTINUIDADE.md

O Lume é uma plataforma social de estudos com contas, biblioteca, continuidade de materiais, amigos, grupos, colaboração, conquistas personalizadas e rankings por nível, cursos concluídos e empenho.

A gamificação reconhece estudo efetivo e conclusões significativas. Não conceda XP por cadastro, onboarding, conexão de integrações, organização de tarefas, abertura de materiais ou preparação do ambiente.

Inspecione a implementação atual antes de editar. Preserve trabalhos existentes e não substitua funcionalidades já implementadas por simulações.

OBJETIVO

A escolha do ritmo deve alterar:
- As perguntas seguintes.
- A forma de configurar a biblioteca.
- A proposta de plano inicial.
- A primeira atividade de estudo.
- A organização inicial da página Hoje.

Não crie categorias de capacidade ou inteligência. As opções representam o momento da pessoa e podem ser alteradas depois.

FLUXO COMUM DE CONTA

Após o cadastro e a autenticação, iniciar o onboarding de uma conta nova.

Separar:
- Autenticação da conta.
- Personalização do perfil.
- Organização dos estudos.
- Participação social.

Não repetir todo o onboarding a cada login. Quem já concluiu deve voltar à página Hoje, com seus materiais e pontos de retomada.

Permitir pular perguntas opcionais e retomar a configuração depois. Salvar o progresso do onboarding para que uma interrupção não obrigue a recomeçar.

Não coletar diagnóstico. Preferências de conforto devem estar disponíveis em todas as jornadas.

JORNADA 1 — QUERO COMEÇAR

Objetivo: ajudar a pessoa a escolher algo concreto para aprender e realizar uma primeira atividade real, sem exigir que monte um sistema inteiro.

Perguntas:
- O que você gostaria de aprender?
- Você já tem um curso, uma aula ou um material?
- Qual resultado gostaria de alcançar?
- Quanto tempo gostaria de reservar para uma sessão? Permitir “ainda não sei”.

Oferecer dois caminhos:
A. Já tenho um material: cadastrar seu link e identificar seu tipo.
B. Ainda não escolhi: ajudar a definir um assunto e o próximo material a procurar, sem inventar cursos ou links.

Configuração inicial:
- Um objetivo principal.
- Um material escolhido pela pessoa.
- Uma primeira atividade concreta, como assistir a uma aula completa, ler uma seção delimitada ou resolver um exercício.
- Plano inicial leve e editável, baseado no material e na disponibilidade informada.

Página Hoje:
- Destacar uma atividade principal.
- Mostrar o material e o que significa concluir essa atividade.
- Exibir o progresso real e o acesso à biblioteca.
- Deixar recursos avançados acessíveis sem sobrecarregar a primeira tela.

Preparar o material pode ser uma orientação auxiliar, mas não deve ser a atividade recompensada nem gerar XP.

JORNADA 2 — ESTUDO DE VEZ EM QUANDO

Objetivo: organizar o que a pessoa já começou e facilitar a continuidade.

Perguntas:
- O que você já está estudando?
- Qual material gostaria de retomar primeiro?
- Onde você parou?
- O que costuma dificultar a continuidade? Exemplos: escolher entre materiais, esquecer onde parou, falta de tempo ou tarefas pouco claras.

Configuração inicial:
- Permitir cadastrar materiais em andamento.
- Registrar aulas já concluídas e o ponto atual de cada material.
- Escolher uma prioridade entre os materiais cadastrados.
- Propor sessões flexíveis com base na rotina informada, sem exigir presença diária.

Página Hoje:
- Destacar “Continuar de onde parei”.
- Mostrar aula, página, seção ou entrega pendente.
- Oferecer um plano semanal editável e outras trilhas em andamento.
- Manter pausas sem perda de progresso.

Importante:
Cadastrar progresso anterior não deve gerar uma sequência de recompensas novas nem inflar o ranking. Distinguir histórico importado de atividades realizadas após a entrada no Lume.

JORNADA 3 — ESTUDO COM FREQUÊNCIA

Objetivo: organizar uma rotina existente, aprofundar objetivos e facilitar acompanhamento e colaboração.

Perguntas:
- Quais áreas e trilhas você acompanha?
- Você já possui uma rotina ou meta?
- Quais cursos, projetos ou leituras estão em andamento?
- O que gostaria de acompanhar melhor: conclusões, tempo efetivo, entregas ou colaboração?

Configuração inicial:
- Permitir cadastrar várias trilhas, com organização progressiva.
- Manter a rotina existente em vez de impor um plano genérico.
- Definir prioridades e marcos substanciais.
- Oferecer integrações pertinentes à área, sempre opcionais.

Exemplos:
- Programação: oferecer GitHub e seleção dos projetos que a pessoa deseja acompanhar.
- Direito: organizar cursos, videoaulas, artigos, leituras e objetivos de prova.
- Outras áreas: disponibilizar os mesmos tipos básicos de materiais, sem limitar o produto a programação.

Página Hoje:
- Mostrar prioridades, pontos de retomada e entregas próximas.
- Oferecer visão das trilhas e progresso por objetivo.
- Facilitar acesso a grupos, colaboração, conquistas e rankings.
- Não ativar cobrança excessiva ou metas obrigatoriamente maiores.

PERSONALIZAÇÃO TRANSVERSAL

A área de estudo e o ritmo são dimensões independentes.

Uma pessoa iniciante em rotina pode estudar programação avançada. Uma pessoa que estuda diariamente pode estar começando em Direito.

Os apoios também são independentes:
- Menos informação na tela.
- Ajuda para escolher a próxima atividade.
- Divisão de atividades extensas.
- Lembretes opcionais.
- Facilidade para retomar após pausas.

Não ative o modo essencial apenas porque alguém escolheu “Quero começar”. Pergunte ou apresente uma sugestão que possa ser recusada.

CONEXÃO SOCIAL

Depois de configurar o primeiro material, oferecer:
- Convidar amigos.
- Entrar em um grupo por convite.
- Escolher participar dos rankings.

Essa etapa deve poder ser pulada.

O ranking é parte central do produto e precisa permanecer acessível em todas as jornadas. Não conceder vantagens de XP por escolher determinada jornada ou convidar pessoas.

PROGRESSO E INTEGRAÇÕES

Não prometer retomada automática para qualquer link.

Quando houver integração compatível, usar posição e progresso observados. Quando não houver, permitir marcador manual e informar isso claramente.

Não considerar rolagem, abertura de arquivo, quantidade de commits ou tempo de aba aberta como prova de estudo.

Não solicitar credenciais de serviços externos diretamente em formulários próprios do Lume.

PERSISTÊNCIA E ALTERAÇÃO DO RITMO

Salvar as escolhas na conta, respeitando a arquitetura existente.

Representar explicitamente:
- Situação e versão do onboarding.
- Jornada escolhida.
- Áreas e objetivos.
- Preferências de apoio.
- Plano aceito pelo usuário.
- Materiais e pontos de retomada.

Se a pessoa mudar de ritmo posteriormente:
- Preservar cursos, materiais, XP e conquistas.
- Não reiniciar a conta.
- Apresentar as mudanças sugeridas antes de substituir seu plano.
- Não sobrescrever metas ajustadas manualmente sem uma escolha explícita.

DESIGN E INTERAÇÃO

Manter a identidade visual atual do Lume e os três cartões de escolha.

Adaptar as telas seguintes à jornada selecionada. Não usar o mesmo formulário inteiro com apenas um título diferente.

Usar transições suaves, navegação por teclado, foco adequado e respeito ao movimento reduzido do sistema.

Todos os botões devem ter comportamento real ou indicar claramente uma funcionalidade ainda indisponível.

CRITÉRIOS DE ACEITE

1. Cada opção leva a uma sequência de configuração diferente.
2. Uma conta nova consegue chegar a uma atividade de estudo concreta.
3. Quem já possui materiais consegue registrar e retomar seu progresso.
4. Quem já possui rotina consegue preservá-la.
5. Recarregar ou interromper o onboarding não perde as escolhas já salvas.
6. Login posterior não repete onboarding concluído.
7. Alterar o ritmo não apaga progresso nem substitui silenciosamente metas.
8. Nenhuma ação de onboarding gera XP.
9. Progresso anterior não é usado para fabricar pontuação competitiva.
10. As três jornadas funcionam em celular e por teclado.
11. Recursos sociais e rankings são acessíveis a todas as jornadas.
12. Integrações indisponíveis não são apresentadas como funcionais.

Implemente os fluxos completos, atualize a documentação e execute os testes pertinentes. Ao terminar, informe o que funciona, o que foi verificado e quais dependências externas ainda impedem alguma funcionalidade.

## Situação da implementação

Implementado nas jornadas de onboarding, com estado versionado em `state.onboarding` e sincronizado com a conta.

| # | Critério | Situação |
| ---: | --- | --- |
| 1 | Cada opção leva a uma sequência diferente | Implementado: 4 perguntas próprias por jornada, revisão e etapa social |
| 2 | Conta nova chega a uma atividade concreta | Implementado na jornada 1: material com tipo e primeira atividade |
| 3 | Quem já tem materiais registra e retoma | Implementado na jornada 2: prioridade e `resumeAt` |
| 4 | Quem já tem rotina preserva a rotina | Implementado na jornada 3: a rotina informada é guardada, não substituída |
| 5 | Interromper não perde escolhas | Implementado: etapa e respostas salvas a cada passo |
| 6 | Login posterior não repete onboarding | Implementado: estado vem da conta e `onboarded` decide a rota |
| 7 | Mudar de ritmo não apaga nem sobrescreve meta | Implementado: `weeklyGoalSource` distingue meta manual de sugerida |
| 8 | Nenhuma ação de onboarding gera XP | Implementado e verificado: histórico permanece vazio |
| 9 | Progresso anterior não fabrica pontuação | Implementado: não há ranking nem evento de XP no onboarding |
| 10 | Três jornadas em celular e teclado | Verificado por testes e2e em desktop e mobile |
| 11 | Recursos sociais acessíveis a todas as jornadas | Parcial: a etapa social aparece em todas e informa o que não existe. Amigos, grupos e ranking não estão implementados |
| 12 | Integrações indisponíveis não parecem funcionais | Implementado: a tela declara acompanhamento manual e ausência de integração automática |

Pendências externas e de produto: convites de amigos, grupos por convite, ranking por nível/cursos/empenho, integrações por área (GitHub e outras) e envio de e-mail da recuperação de senha. Nenhuma delas bloqueia as jornadas; todas aparecem na interface como indisponíveis.

Verificação executada: `npm run build`, `npm test` (28 testes de domínio) e `npm run test:e2e` (10 cenários, desktop e mobile).
