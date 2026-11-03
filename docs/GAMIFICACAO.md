# Lume — especificação de gamificação e conquistas

Versão da política: **v1 em execução para contas**. O propósito e as proibições abaixo expressam a direção do produto. Os valores numéricos continuam sujeitos a balanceamento e a ajustes versionados; o histórico já concedido não muda silenciosamente.

Referência de contexto: [Produto](PRODUTO.md). Divergências e migração: [Continuidade](CONTINUIDADE.md).

A política v1 foi implementada no servidor: `api/domain/xp.js` mantém o livro `xp_events` com chave de idempotência, origem, versão, material e data; `xp_settings` guarda o marco `eligible_since`, fuso e opt-in do ranking; `xp_time_sessions` registra o tempo declarado; `user_achievements` guarda as conquistas personalizadas. Desde 01/11/2026 as conclusões chegam ao servidor como comandos (`POST /api/progress`, `api/domain/commands.js`): cada evento do registro de progresso é gravado em `progress_events` com o relógio do servidor, e o horário informado pelo navegador só pode atrasar a conclusão (vale o menor entre os dois), nunca adiantá-la. As regras de `api/domain/rewards.js` (aula/leitura/exercício/entrega, bônus de material e apresentação) respondem na mesma requisição e gravam em `xp_events` com a chave idempotente de sempre. Uma conta que só usou clientes antigos fica no modo "documento" (o registro do documento é copiado com a confiança anterior) até o primeiro comando; depois disso, escrever uma conclusão no documento não concede XP. O saldo legado do protótipo continua separado e fora do nível novo e do ranking.

A proposta de cargos, desbloqueios e do bônus de disciplina (v2) está em [Evolução §4](EVOLUCAO.md#4-gamificação-concreta). Nada dela está implementado.

**Revisão arquitetural de 03/11/2026 (local, sem publicação):** o cliente passa a usar `/api/library/actions`.
`library-actions.js` aplica as mesmas regras declarativas e grava progresso, XP e conquistas no mesmo batch;
`library-time.js` prepara as sessões e blocos de tempo para essa transação, acumulando sobras e descontando
intervalos sobrepostos. O navegador não mantém fila ou marcações de entrega. Após conversão da conta, as rotas
antigas de gravação de progresso/XP respondem `client_outdated`; leitura, correção e ranking permanecem.

## 1. O que XP representa

XP representa atividade de estudo elegível e conclusões significativas. Não mede inteligência, qualidade da pessoa, domínio garantido ou tempo de tela genérico.

Existem três mecanismos distintos:

1. **XP:** recompensa de estudo efetivo e de conclusões.
2. **Nível:** evolução acumulada a partir de XP.
3. **Conquista:** registro permanente e personalizado de um marco, exibível na vitrine.

Uma animação ou mensagem positiva pode reconhecer esforço sem conceder XP. Deixar a experiência acolhedora não exige premiar uma ação administrativa.

## 2. Eventos que nunca geram XP

- Entrar, sair, voltar ao aplicativo ou completar onboarding.
- Abrir uma janela, aula, link, artigo ou repositório.
- Preparar o material, organizar a mesa ou clicar em “começar”.
- Adicionar, dividir, editar ou reorganizar tarefas e materiais.
- Conectar uma integração, cadastrar um curso ou convidar amigos.
- Importar, colar ou organizar a grade de um curso, escolher disciplinas e atualizar a importação.
- Iniciar, pausar ou encerrar a sessão declarada e exibir presença local pelo Companion.
- Definir disponibilidade, prazos e prioridades, adiar aulas ou recalcular o cronograma.
- Convidar amigos, aceitar convites, listar amizades ou remover contatos.
- Pausar, descansar, mudar de tela ou retornar de uma pausa.
- Enviar mensagens, comentar, receber curtidas ou simplesmente estar em uma sala.
- Deixar um player, cronômetro ou página aberto sem estudo elegível.
- Marcar genericamente uma microtarefa sem uma entrega de aprendizado definida. A lista de tarefas de prova tem a regra própria da seção 3 e não transforma qualquer item em recompensa.

Esses eventos podem aparecer no histórico organizacional, mas não no livro de XP nem no placar.

## 3. Tabela inicial de recompensas

| Evento elegível | XP inicial | Critério |
| --- | ---: | --- |
| 30 minutos de estudo efetivo | 25 | Bloco acumulado e ainda não recompensado; máximo de 200 XP de tempo por dia |
| Aula concluída | 100 | Aula identificada, com conclusão observada em fonte compatível ou declarada explicitamente |
| Artigo ou leitura delimitada concluída | 100 | Material completo identificado; marcador intermediário não é conclusão |
| Lista de exercícios concluída | 100 | Conjunto de trabalho delimitado e critérios registrados antes da conclusão |
| Entrega substancial de projeto | 150 | Resultado definido e concluído, como implementar e validar uma funcionalidade |
| Curso completo | 500 de bônus | Todas as unidades obrigatórias do curso concluídas; uma vez por curso |
| Projeto completo | 500 de bônus | Todas as entregas obrigatórias concluídas; uma vez por projeto |

### Decisões de balanceamento

- Uma aula não ganha mais XP por a pessoa ter escolhido um ritmo avançado.
- Um artigo de Direito não vale menos por não ser programação.
- Um projeto e um curso são contêineres diferentes: o mesmo conjunto de atividades não deve ganhar os dois bônus finais apenas por ter sido cadastrado com dois nomes.
- O bônus do contêiner é adicional às recompensas de suas unidades, quando ambas são elegíveis. Isso é intencional e precisa aparecer no extrato.
- Conquistar um selo não concede outro bônus de XP, salvo regra futura explicitamente versionada. A vitrine não deve duplicar recompensas em cascata.
- Não atribuir XP por commit, linha de código, página rolada ou quantidade de mensagens.
- O tamanho arbitrário de uma tarefa não determina recompensa. Dividir uma aula em dez microtarefas não cria dez aulas elegíveis.
- Os tipos e valores podem evoluir, mas nunca de forma silenciosa no histórico já concedido.

### Tarefas de prova — regra em execução no protótipo

A lista de tarefas de prova foi pedida explicitamente e hoje usa uma regra transitória:

- Criar, editar, organizar ou remover uma tarefa não gera XP.
- Concluir uma tarefa com título concreto (por exemplo, "Resolver 20 questões de constitucional") concede **10 XP uma vez**.
- Reabrir a tarefa retira o XP até ela ser concluída de novo; reabrir e concluir não acumula uma segunda recompensa.
- O XP da tarefa é calculado no navegador, a partir de `state.tasks` (`public/tasks-domain.js`), e não entra no ranking. A conclusão de tarefa ainda não virou evento do livro do servidor; é a exceção transitória preservada.
- A tarefa não conclui curso nem cria conquista por material; essas regras dependem dos eventos de conclusão do servidor.
- Prioridade (alta, média, baixa ou sem prioridade) e atraso só ordenam a lista e a página Hoje. Definir, mudar ou ordenar não gera XP.
- Vincular a tarefa a uma aula e marcar subtarefas também não geram XP e não concluem a aula.

A proposta de migração desta regra está em [Evolução §4.6](EVOLUCAO.md#46-transição-sem-apagar-histórico) e só deve ser aplicada com aprovação explícita. Essa exceção não deve ser copiada para tarefas genéricas de organização. Quando a conclusão de tarefa for migrada para o livro de eventos, ela precisará de chave de idempotência, origem, versão da política e revisão do valor.

### Exemplos de cálculo

| Situação | Resultado |
| --- | --- |
| Abri a aula e separei meu caderno | 0 XP |
| Estudei 20 minutos e parei | Progresso e 20 minutos elegíveis salvos; ainda sem bloco de XP de tempo |
| Depois estudei mais 10 minutos elegíveis | +25 XP pelo primeiro bloco de 30 minutos |
| Assisti uma aula inteira durante esses 30 minutos | +100 XP de conclusão; total de 125 XP com o bloco de tempo |
| Estudei 60 minutos elegíveis, sem terminar a aula | +50 XP de tempo; aula continua em andamento |
| Concluí um curso de seis aulas, com três horas de estudo elegível | 600 XP das aulas + 150 XP de tempo + 500 XP de bônus = 1.250 XP, se todos os eventos forem novos e dentro do limite diário de tempo |
| Concluí o artigo Introdução a Processo Penal em 45 minutos | 100 XP de leitura + 25 XP de tempo; 15 minutos restantes continuam no acumulador |

Tempo e conclusão são recompensas complementares. A pessoa não deve perder os blocos de tempo por ainda não ter terminado um material longo.

## 4. Níveis

Proposta inicial **em execução**: **500 XP por nível**, com início no nível 1.

```text
nível = 1 + piso(XP acumulado elegível / 500)
progresso no nível = XP acumulado elegível módulo 500
```

Assim, concluir um curso elegível e receber seu bônus de 500 XP garante pelo menos um nível de avanço, além do XP obtido estudando suas aulas. Um curso não concede um nível por fora dessa fórmula; isso evitará duas contagens independentes.

Exemplo: com 450 XP, a pessoa está no nível 1. Um bônus de curso de 500 XP a leva a 950 XP e ao nível 2, com 450/500 XP para o próximo nível.

Nível é permanente e não reinicia toda semana. Pausas não diminuem nível. Uma correção de evento duplicado ou fraudulento é um ajuste de integridade com explicação no extrato, não uma punição por ausência. A implementação registra um evento `adjustment` negativo vinculado ao original, com motivo, e revoga a conquista correspondente; repetir a correção não duplica o ajuste.

## 5. Tempo efetivo e blocos de estudo

### Acumulação

- Acumular segundos elegíveis por pessoa, com identificação da sessão e do material.
- Conceder 25 XP a cada 1.800 segundos novos. Uma hora corresponde a dois blocos, não a uma recompensa de hora adicional.
- Sobras inferiores a 30 minutos permanecem entre sessões e entre materiais. Parar não zera o acumulador.
- Não contar o mesmo intervalo de relógio duas vezes ao abrir várias abas, sessões ou dispositivos.
- O teto de 200 XP por tempo vale para a pessoa inteira por dia, não por material. Equivale a oito blocos recompensados.
- Ao atingir o teto, o estudo e seu progresso continuam registrados. O excedente daquele dia não vira crédito de XP para os dias seguintes. A sobra de bloco ainda não recompensado, anterior ao teto, permanece elegível.
- Usar o fuso do perfil para o dia e a semana. Mudanças de fuso não podem reprocessar blocos já premiados.

### Vídeo

Em uma fonte compatível, contar o tempo de relógio em reprodução elegível, excluindo pausa, buffering e saltos de posição. A velocidade de reprodução não multiplica o XP de tempo: um vídeo de uma hora visto a 2× contém aproximadamente 30 minutos de reprodução, não 60 minutos de tempo efetivo.

Posição salva e tempo elegível são campos diferentes. A posição deve poder ser salva mesmo quando a sessão ainda não gerou XP.

### Leitura, exercícios e projetos

Oferecer sessões de estudo com início e pausa e registros manuais para atividades externas ou offline. Marcar a origem desses registros. Um cronômetro sozinho não demonstra estudo: o produto precisa explicar seu uso e distinguir declaração de atividade observada.

A sessão declarada existe como marcador de continuidade: ela conta o tempo que a pessoa escolheu, sobrevive ao recarregamento e aparece em Meu caminho. Ao encerrar, ela é enviada ao servidor como **registro manual identificado**: o servidor desconta sobreposição com outras sessões, acumula sobras, fecha blocos de 30 minutos e aplica o teto diário. O tempo não é observação de atividade e não vira XP sem esse evento validado. A presença do Lume Companion continua fora: ela informa um aplicativo aberto, não estudo observado.

Não exigir movimento de mouse contínuo para reconhecer leitura e não usar vigilância por câmera ou captura de tela como requisito. Pessoas usando leitor de tela ou estudando fora da aba também precisam de um caminho de registro adequado.

## 6. Critérios de conclusão

### Aulas

- Com player compatível: a proposta de critério automático é cobertura de pelo menos 95% dos trechos únicos do vídeo e reprodução do trecho final. Apenas atingir a posição final por salto não basta. O critério operacional e sua margem devem ser visíveis; não significa comprovação de compreensão.
- Sem observação compatível: a pessoa declara que concluiu a aula; o evento é identificado como manual.
- Dividir uma aula para ajudar a começar não multiplica o bônus de 100 XP. A preparação e os trechos intermediários não têm recompensa própria de conclusão.
- Uma nova revisão pode contabilizar tempo elegível, mas não repetir o bônus da mesma aula.

### Leituras

- A conclusão de um artigo é uma declaração explícita de leitura completa, mesmo que o leitor também possua marcadores de progresso.
- Página final e rolagem não bastam para concluir automaticamente.
- Pode haver nota ou resumo associado, mas não exigir texto artificial apenas para liberar XP.
- Para livros ou leituras extensas, definir previamente unidades como capítulos; não transformar cada página em uma leitura completa recompensada. Um capítulo e o livro inteiro não devem ser cadastrados como múltiplos artigos duplicados.

### Cursos e projetos

- Registrar unidades ou entregas obrigatórias, fonte e critério de conclusão.
- O bônus final exige conclusão do conjunto obrigatório e gera uma conquista personalizada.
- Cursos reais devem preservar a identidade e a estrutura da fonte. Um conjunto de microtarefas não vira vários cursos apenas para produzir bônus.
- Concluir uma aula importada é elegível como aula concluída: o registro é manual e identificado, e o servidor concede 100 XP uma vez pelo livro de eventos. O bônus de curso segue a mesma validação. Aulas marcadas como concluídas na página copiada da plataforma entram como histórico, sem XP.
- Uma grade parcial (apenas algumas disciplinas escolhidas ou conteúdo não publicado pela fonte) não conclui o curso inteiro e não libera o bônus de curso. Progresso e bônus só consideram unidades obrigatórias efetivamente registradas.
- Reimportar ou atualizar a grade não repete bônus nem apaga conclusões; conteúdo removido da fonte permanece no histórico.
- Uma entrega de projeto precisa de resultado substancial descrito. “Abrir o editor” e “fazer um commit” não são entregas elegíveis por si só.
- Um novo escopo, edição ou versão de conteúdo requer decisão explícita sobre elegibilidade; não reiniciar automaticamente os bônus antigos ao editar um título.

## 7. Minhas conquistas

Conquistas são memórias concretas de conclusões. Cada registro deve guardar:

| Campo | Finalidade |
| --- | --- |
| Identificador e pessoa | Pertencimento e prevenção de duplicação |
| Tipo do marco | Curso, leitura, projeto ou lista de exercícios |
| Material e título no momento da conclusão | Referência e preservação da memória |
| Critério e versão da política | Explicar como foi obtida |
| Data de obtenção | Histórico |
| Origem do progresso | Manual, player compatível, integração ou revisão de entrega colaborativa |
| Visibilidade | Privada ou amigos |

Modelos de título:

- **Terminei o curso {nome do curso}.**
- **Terminei de ler o artigo {nome do artigo}.**
- **Concluí o projeto {nome do projeto}.**
- **Concluí a lista de exercícios {nome da lista}.**

Exemplos: **Terminei o curso Introdução à Engenharia de Software** e **Terminei de ler o artigo Introdução a Processo Penal**.

Renomear um material não cria uma conquista adicional. Reabrir o material não destrói a conquista anterior; deve distinguir revisão de uma correção de conclusão indevida. Arquivar um curso não apaga o marco já obtido.

Selos gerais, como concluir vários cursos, podem existir depois, mas a vitrine deve priorizar o que foi estudado de fato. Não conceder conquistas de aprendizado por cadastrar um curso vazio.

**Implementação atual:** curso, projeto, leitura, lista de exercícios e apresentação geram conquista em `user_achievements`, com título do material, critério, origem, data e visibilidade `friends`. A vitrine pessoal separa essas conquistas dos seis selos genéricos do protótipo, que ficam em uma seção de legado. A escolha individual de quais conquistas aparecem no perfil ainda não existe.

## 8. Placares de amigos

O ranking é parte obrigatória do escopo do produto e está implementado no recorte **de amigos**. Não há recorte de grupos, comunidades ou ranking público nesta etapa.

| Aba | Ordenação | Período |
| --- | --- | --- |
| Nível — classificação geral padrão | Maior nível; em seguida, maior XP acumulado elegível | Acumulado |
| Cursos concluídos | Maior quantidade de cursos distintos e elegíveis concluídos | Acumulado; filtro por período como evolução |
| Empenho | Maior XP elegível obtido no período selecionado | Semana como padrão; mês disponível |

Empenho significa atividade de estudo registrada, não um julgamento sobre dedicação pessoal. Exibir, como contexto da posição, minutos efetivos e quantidades de aulas, leituras e entregas concluídas no período. Não confundir tempo com a aba aberta com tempo de estudo. Não criar um índice opaco misturando nível, cursos, mensagens e presença.

Um mesmo curso conta uma vez na classificação de cursos, independentemente de quantas vezes a pessoa o revisitou. Repetições, cópias do cadastro e microtarefas reclassificadas como cursos não aumentam esse total. Cursos autodeclarados seguem a política de origem e revisão visível do placar.

Regras comuns:

- Participação voluntária em placares de amigos.
- Na aba Empenho, o período semanal vai de segunda-feira às 00h até a segunda seguinte, no fuso exibido na tela (o fuso do perfil de quem consulta). O período e o fuso aparecem na tela.
- A pontuação de empenho soma os eventos de XP elegíveis do período. A aba Nível usa o acumulado elegível, e a aba Cursos usa as conclusões elegíveis. Eventos de demonstração e legado ficam fora de todas as classificações.
- Após os critérios explícitos de cada aba, empates compartilham posição. Não usar quantidade de cliques, mensagens ou check-ins como desempate.
- A virada semanal abre outro período de empenho e preserva o histórico; não reinicia a classificação acumulada por nível ou cursos.
- O placar informa a política de registros manuais. A proposta inicial permite autodeclaração identificada; uma modalidade com revisão de conclusões pode existir como evolução. Não misturar modos sob o rótulo “verificado”.
- A pessoa pode estudar sem aparecer no placar e escolher o que compartilhar. Ocultar-se não apaga seu histórico privado.
- Regras e correções precisam ser transparentes para participantes; detalhes privados do material não precisam ser expostos para mostrar a pontuação autorizada.

Um evento observado por um player ou integração ainda não comprova compreensão. “Verificado” só pode significar o critério técnico efetivamente observado e documentado.

**Implementação atual:** a rota `GET /api/ranking` calcula as três abas a partir de `xp_events`, com opt-in em `xp_settings.ranking_opt_in`, empates compartilhados e período/fuso visíveis. A tela `#ranking` permite entrar e sair; quem não participa continua estudando e mantém o histórico privado. O legado e as tarefas de prova ficam fora. Faltam ranking público e qualquer recorte de grupo, ambos fora do escopo desta etapa.

## 9. Integridade, repetição e segurança

Na implementação da nova política para contas, o servidor é a autoridade de concessão de XP e pontuação compartilhada. `xp_events` guarda a chave única, o tipo, o valor, o material, a origem, a versão da política e o dia local. Na revisão local de 03/11, a biblioteca e a retomada usam `/api/library`; `/api/state` é compatibilidade de contas ainda não convertidas.

O perfil entre amigos exibe XP, nível e conquistas a partir do livro de eventos do servidor. Percentuais de progresso vêm da biblioteca no servidor; continuam declarados e não alimentam o placar diretamente.

Cada evento de XP deve ter uma chave única, por exemplo:

```text
conclusão: pessoa + material canônico + tipo de conclusão + edição elegível
tempo: pessoa + identificador do bloco consolidado
```

Repetir uma requisição, reconectar após falha ou sincronizar o mesmo estudo em dois dispositivos não pode gerar uma segunda recompensa. Conceder o evento e atualizar a posição/nível de modo consistente.

Normalizar identidade de materiais e manter vínculos entre duplicatas. Somente comparar o texto da URL é insuficiente como estratégia definitiva de deduplicação.

Manter um livro de eventos com: origem, material, sessão, valor, momento, versão da política, chave de idempotência e eventuais ajustes vinculados. Conclusão do curso, bônus e conquista devem ser processados uma única vez, inclusive em novas tentativas após falhas.

Autodeclaração é uma escolha de produto, não prova antifraude. Ranking público exigirá validação e moderação adicionais; a primeira experiência social deve começar entre amigos, com regras visíveis.

## 10. Migração do protótipo

O protótipo atual concede 5 XP por preparação e 10 XP por etapas genéricas. Essas regras são **legadas e incompatíveis com a direção atual**.

Ao implementar a nova política:

1. Fazer cópia recuperável dos dados e identificar a versão antiga.
2. Preservar o histórico original, marcado como legado.
3. Não converter preparação em aula ou leitura concluída.
4. Não presumir que cada etapa genérica é um material elegível. Classificar ou pedir revisão quando necessário.
5. Separar o saldo legado do novo XP elegível; mostrar a mudança e seu critério de forma compreensível.
6. Não incluir recompensas antigas em placares da nova política.
7. Não apagar conquistas históricas silenciosamente. Distinguir marcos de demonstração/legado da nova vitrine de conclusões reais.

A separação do saldo legado foi implementada: `xp_settings.eligible_since` marca o início da política, eventos antigos não são copiados para `xp_events`, o histórico local continua visível como legado e a interface mostra o XP elegível separado. Não houve conversão automática de preparação, etapa genérica ou progresso importado. A revisão assistida de etapas genéricas antigas e a correção de eventos com explicação continuam pendentes; nada foi apagado.

## 11. Casos obrigatórios de verificação

- Abrir material, preparar ambiente e cadastrar curso: 0 XP.
- Tempo dividido entre sessões soma blocos sem descartar sobras.
- Pausa e buffering não contam; salto não cria minutos assistidos.
- Sessões simultâneas não dobram o tempo.
- Limite diário de tempo não impede registrar conclusões elegíveis.
- Conclusão repetida de uma mesma aula ou curso não repete bônus.
- Repetir o envio por falha de rede não duplica XP nem conquista.
- Curso concluído gera título personalizado e pelo menos um nível pelo bônus proposto.
- Material manual é identificado como tal; integração indisponível não é apresentada como automática.
- Sessão declarada não cria XP de conclusão; ao encerrar, pode criar bloco de tempo validado pelo servidor. Presença do Companion, convite e amizade não criam XP nem histórico de recompensa.
- Criar ou organizar tarefa de prova: 0 XP; concluir a mesma tarefa duas vezes: um único evento de 10 XP.
- Descansar ou sair do placar não retira XP acumulado.
- Mudança de política ou migração preserva o histórico e evita pontuação de legado no novo placar.

Verificação atual: `tests/unit/xp.test.js` cobre idempotência, bônus, apresentação, teto diário, sobreposição e ranking; `tests/unit/library.test.js` cobre edição, exclusão e conclusão de slides; `tests/e2e/xp-ranking.spec.js` cobre o fluxo da API, extrato e opt-in. A medição de concorrência em produção e a correção assistida de eventos ainda não foram executadas.
