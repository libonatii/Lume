# Lume — especificação de gamificação e conquistas

Versão da política: **proposta inicial v1**. O propósito e as proibições abaixo expressam a direção do produto. Os valores numéricos são um primeiro balanceamento de design, desenvolvido para orientar a implementação e ser ajustado com testes de uso. **Esta documentação não significa que essas regras já estejam implementadas.**

Referência de contexto: [Produto](PRODUTO.md). Divergências e migração: [Continuidade](CONTINUIDADE.md).

A migração da interface para React + Astro não implementou esta política. Contas e sincronização básica de uma cópia do progresso já existem, mas o XP continua calculado no navegador pelo domínio legado, com 5 XP por preparação, 10 XP por etapa e nível a cada 100 XP. A cópia armazenada no servidor não torna esses registros elegíveis nem os valida para um placar compartilhado. Os valores e critérios das seções seguintes continuam sendo a proposta da nova política.

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
- Convidar amigos, aceitar convites, listar amizades ou remover contatos.
- Pausar, descansar, mudar de tela ou retornar de uma pausa.
- Enviar mensagens, comentar, receber curtidas ou simplesmente estar em uma sala.
- Deixar um player, cronômetro ou página aberto sem estudo elegível.
- Marcar genericamente uma microtarefa sem uma entrega de aprendizado definida.

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

Proposta inicial: **500 XP por nível**, com início no nível 1.

```text
nível = 1 + piso(XP acumulado elegível / 500)
progresso no nível = XP acumulado elegível módulo 500
```

Assim, concluir um curso elegível e receber seu bônus de 500 XP garante pelo menos um nível de avanço, além do XP obtido estudando suas aulas. Um curso não concede um nível por fora dessa fórmula; isso evitará duas contagens independentes.

Exemplo: com 450 XP, a pessoa está no nível 1. Um bônus de curso de 500 XP a leva a 950 XP e ao nível 2, com 450/500 XP para o próximo nível.

Nível é permanente e não reinicia toda semana. Pausas não diminuem nível. Uma correção de evento duplicado ou fraudulento é um ajuste de integridade com explicação no extrato, não uma punição por ausência.

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

A sessão declarada existe como marcador de continuidade: ela conta o tempo que a pessoa escolheu, sobrevive ao recarregamento e aparece em Meu caminho. Esse tempo **não é** automaticamente um bloco elegível de XP. A presença do Lume Companion também não é: ela informa um aplicativo aberto, não estudo observado. Blocos de 30 minutos continuam exigindo evento identificável, validação no servidor e proteção contra repetição.

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
- Concluir uma aula importada é, em princípio, elegível como aula concluída. Enquanto a atribuição no servidor não existir, o registro é manual, identificado e **não concede XP**: o navegador não é autoridade de pontuação. O mesmo vale para o bônus de curso.
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
| Origem do progresso | Manual, player compatível, integração ou revisão do grupo |
| Visibilidade | Privada, amigos ou grupo autorizado |

Modelos de título:

- **Terminei o curso {nome do curso}.**
- **Terminei de ler o artigo {nome do artigo}.**
- **Concluí o projeto {nome do projeto}.**
- **Concluí a lista de exercícios {nome da lista}.**

Exemplos: **Terminei o curso Introdução à Engenharia de Software** e **Terminei de ler o artigo Introdução a Processo Penal**.

Renomear um material não cria uma conquista adicional. Reabrir o material não destrói a conquista anterior; deve distinguir revisão de uma correção de conclusão indevida. Arquivar um curso não apaga o marco já obtido.

Selos gerais, como concluir vários cursos, podem existir depois, mas a vitrine deve priorizar o que foi estudado de fato. Não conceder conquistas de aprendizado por cadastrar um curso vazio.

## 8. Placares de amigos e grupos

O ranking é parte obrigatória do escopo do produto. Deve ter três classificações explícitas, começando pelos recortes de amigos e grupos:

| Aba | Ordenação | Período |
| --- | --- | --- |
| Nível — classificação geral padrão | Maior nível; em seguida, maior XP acumulado elegível | Acumulado |
| Cursos concluídos | Maior quantidade de cursos distintos e elegíveis concluídos | Acumulado; filtro por período como evolução |
| Empenho | Maior XP elegível obtido no período selecionado | Semana como padrão; mês como evolução |

Empenho significa atividade de estudo registrada, não um julgamento sobre dedicação pessoal. Exibir, como contexto da posição, minutos efetivos e quantidades de aulas, leituras e entregas concluídas no período. Não confundir tempo com a aba aberta com tempo de estudo. Não criar um índice opaco misturando nível, cursos, mensagens e presença.

Um mesmo curso conta uma vez na classificação de cursos, independentemente de quantas vezes a pessoa o revisitou. Repetições, cópias do cadastro e microtarefas reclassificadas como cursos não aumentam esse total. Cursos autodeclarados seguem a política de origem e revisão visível do grupo.

Regras comuns:

- Participação voluntária em placares de amigos ou grupos privados.
- Na aba Empenho, o período semanal vai de segunda-feira às 00h até a segunda seguinte, no fuso fixado pelo grupo. O fuso e o período aparecem na tela.
- A pontuação de empenho soma os eventos de XP elegíveis do período. A aba Nível usa o acumulado elegível, e a aba Cursos usa as conclusões elegíveis. Eventos de demonstração e legado ficam fora de todas as classificações.
- Após os critérios explícitos de cada aba, empates compartilham posição. Não usar quantidade de cliques, mensagens ou check-ins como desempate.
- A virada semanal abre outro período de empenho e preserva o histórico; não reinicia a classificação acumulada por nível ou cursos.
- Cada grupo informa a política de registros manuais. A proposta inicial permite autodeclaração identificada; o grupo pode escolher uma modalidade com revisão de conclusões. Não misturar modos sob o rótulo “verificado”.
- A pessoa pode estudar sem aparecer no placar e escolher o que compartilhar. Ocultar-se não apaga seu histórico privado.
- Regras e correções precisam ser transparentes para participantes; detalhes privados do material não precisam ser expostos para mostrar a pontuação autorizada.

Um evento observado por um player ou integração ainda não comprova compreensão. “Verificado” só pode significar o critério técnico efetivamente observado e documentado.

## 9. Integridade, repetição e segurança

Na implementação da nova política para contas, o servidor deverá ser a autoridade de concessão de XP e pontuação compartilhada. A autenticação existente e o armazenamento de uma cópia do estado por `/api/state` ainda não implementam essa validação nem um livro de eventos elegíveis.

O perfil entre amigos exibe XP, nível e progresso a partir dessa cópia sincronizada. São valores declarados, não validados: aparecem no perfil porque a pessoa os compartilhou, mas não tornam o registro elegível nem podem alimentar placar.

Cada evento de XP deve ter uma chave única, por exemplo:

```text
conclusão: pessoa + material canônico + tipo de conclusão + edição elegível
tempo: pessoa + identificador do bloco consolidado
```

Repetir uma requisição, reconectar após falha ou sincronizar o mesmo estudo em dois dispositivos não pode gerar uma segunda recompensa. Conceder o evento e atualizar a posição/nível de modo consistente.

Normalizar identidade de materiais e manter vínculos entre duplicatas. Somente comparar o texto da URL é insuficiente como estratégia definitiva de deduplicação.

Manter um livro de eventos com: origem, material, sessão, valor, momento, versão da política, chave de idempotência e eventuais ajustes vinculados. Conclusão do curso, bônus e conquista devem ser processados uma única vez, inclusive em novas tentativas após falhas.

Autodeclaração é uma escolha de produto, não prova antifraude. Ranking público exigirá validação e moderação adicionais; a primeira experiência social deve começar em grupos com regras visíveis.

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

A migração e a interface do saldo legado precisam ser implementadas e verificadas antes de alterar a versão dos dados. A migração de stack preservou a versão 1 dos dados e não executou essa conversão. Os rótulos de legado na interface não substituem a separação dos saldos nem o processo de revisão descrito acima.

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
- Sessão declarada, presença do Companion, convite e amizade não criam XP nem histórico de recompensa.
- Descansar ou sair do placar não retira XP acumulado.
- Mudança de política ou migração preserva o histórico e evita pontuação de legado no novo placar.
