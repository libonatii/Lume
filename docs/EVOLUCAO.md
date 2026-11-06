# Lume — diagnóstico e plano de evolução

Propostas de produto de 31/10/2026, com referências revistas em 03/11. O estado implementado está somente
em [Continuidade](CONTINUIDADE.md); a lista vigente de lacunas e decisões, em [Implementação](IMPLEMENTACAO.md).
Este documento preserva o raciocínio e os critérios das propostas: **organizar → saber o próximo passo → estudar
→ registrar avanço → receber XP → evoluir de nível e cargo → desbloquear possibilidades → compartilhar e colaborar**.

Leia antes: [Produto](PRODUTO.md), [Gamificação](GAMIFICACAO.md), [Continuidade](CONTINUIDADE.md), [Importação](IMPORTACAO.md) e [Lume (desktop)](COMPANHEIRO.md). Tudo o que está marcado como **proposta** aqui ainda não existe; a seção 7 registra o que a Etapa 1 implementou.

Legenda de estado usada em todo o documento:

| Rótulo | Significado |
| --- | --- |
| **Local verificado** | Funciona no servidor Node local e foi exercitado por teste automatizado ou e2e |
| **Publicado, não verificado** | A rota responde no site de referência, mas o fluxo completo não foi exercitado em produção |
| **Simulação** | Existe apenas como interceptação de teste, prévia sem conta ou dado de exemplo |
| **Proposta** | Ainda não implementado |

---

## 1. Diagnóstico fundamentado

**Registro histórico de 31/10, não retrato do código atual.** A persistência agora é direta pela API,
sem cópia persistida ou reconciliação no navegador. O critério de próxima aula já foi unificado em
`study-plan.js`; `nextMission` foi removido. Navegação, prioridade e cronograma estão implementados.
As tabelas abaixo explicam a origem das propostas; não devem ser usadas como lista de trabalho.

### 1.1 O que já está bem resolvido e deve ser aproveitado

| Recurso | Estado | Evidência |
| --- | --- | --- |
| Contas, sessão, recuperação | Local verificado | `api/domain/auth.js`, `tests/unit/auth.test.js`, `tests/e2e/session.spec.js` |
| Livro de XP com idempotência, bônus, teto diário, ajuste negativo | Local verificado; rota publicada (`GET /api/xp` → 401 sem sessão) | `api/domain/xp.js`, `tests/unit/xp.test.js`, `tests/e2e/xp-ranking.spec.js` |
| Ranking de amigos (nível, cursos, empenho) | Local verificado; rota publicada (`/api/ranking` → 401) | `api/domain/xp.js`, `Ranking.jsx` |
| Mensagens diretas, bloqueio, não lidas | Local verificado; rota publicada (`/api/messages/unread` → 401) | `api/domain/messages.js`, `tests/unit/messages.test.js`, `tests/e2e/messages.spec.js` |
| Importação por link, texto e página copiada | Local verificado; extração real conferida em Coursera e Alura (parcial) | `api/domain/import-server.js`, `tests/unit/import.test.js`, [Importação §4](IMPORTACAO.md) |
| Revisão otimista do estado entre dispositivos | Local verificado | `api/domain/state.js`, `tests/unit/merge.test.js`, `tests/e2e/state-conflict.spec.js` |
| Roteiro por prioridade explícita | Local verificado | `public/study-plan.js`, `tests/unit/study-plan.test.js` |
| Aplicativo de desktop (Electron): o Lume completo, bandeja e presença por allowlist | Verificado por checagem de sintaxe e Chromium; bandeja validada manualmente | [Lume §9](COMPANHEIRO.md) |

As consultas ao site publicado foram feitas em 31/10/2026 apenas com `GET` anônimo: elas mostram que as rotas existem, não que os fluxos autenticados funcionam em produção.

### 1.2 Problemas observáveis na experiência

| Problema | Onde aparece | Evidência no código |
| --- | --- | --- |
| **Duas respostas diferentes para "o que fazer agora"** | Hoje e Missões usam `nextMission` (primeira etapa pendente do curso selecionado, na ordem da biblioteca, incluindo cursos de exemplo). O Companion e o perfil usam `studyPlan` (continuidade, primeiro passo, perto do fim, sem exemplos) | `src/features/library/Study.jsx:15`, `src/features/settings/Personal.jsx:14`, `public/study-plan.js`. [Lume §2](COMPANHEIRO.md) afirma que o site usa o mesmo critério, o que não é verdade |
| **"Ação focal única" cercada de sete blocos** | A Hoje tinha: foco, cartão de pausa com imagem, sessão, três métricas, jornada e lembrete de conforto | `Study.jsx` (antes da Etapa 1) |
| **Indicadores repetidos** | Nível aparece na barra lateral e na barra superior; o estado de sincronização aparece na barra superior e no rodapé | `src/app/Shell.jsx` |
| **Métrica que mistura preparação com conclusão** | Resolvido em 01/11/2026: `weekCount` conta só conclusões não históricas e tarefas; preparação não entra | `public/domain.js` |
| **Navegação com dez itens de mesmo peso** | Hoje, Tarefas, Biblioteca, Missões, Conquistas, Meu caminho, Amigos, Mensagens, Ranking, Configurações — mais GitHub, Perfil e Instalar fora do menu | `links` em `Shell.jsx` |
| **Tarefas sem prioridade nem relação com o plano** | Ordem só por prazo; nada indica atraso; tarefas não aparecem na Hoje | `sortTasks` em `public/tasks-domain.js` |
| **Duração conhecida descartada** | A importação guarda `duration` por aula, mas nenhuma tela usa esse dado para dizer quanto tempo reservar | `normalizeDuration` em `public/import-domain.js:165` |
| **Nível sem consequência** | Subir de nível não muda nada além do número; não existem cargos nem desbloqueios | Busca por `cargo`/`desbloque` não encontra regra de produto |
| **Paleta monocromática** | Fundo, superfícies, bordas e ação principal são variações do mesmo azul; verde (`--mint`) aparece só em detalhes | Tokens em `src/styles/00-tokens.css` |
| **Tom condescendente** | "O começo pode ser pequeno", "Se hoje não der, você pode descansar", "Pausar sem culpa", "Que bom ter você aqui" | Seção 8 deste documento |

### 1.3 Contradições na documentação (corrigidas nesta rodada)

| Documento | Afirmava | Situação real |
| --- | --- | --- |
| PRODUTO §cabeçalho, §4, §8 | Mensagens diretas pendentes; sem reconciliação nem validação de XP no servidor | Mensagens, reconciliação e XP no servidor implementados |
| GAMIFICACAO §6 | Aula importada concluída "não concede XP" | `completionKindForCourse` trata aula importada como `lesson` elegível: 100 XP pelo servidor |
| GAMIFICACAO §9 | Perfil exibe XP declarado da cópia | Perfil usa XP do livro do servidor |
| CONTINUIDADE §3, §5 | Mensagens, bloqueio, colaboração e reconciliação pendentes | Implementados |
| IMPORTACAO §10 | Leitura de repositórios GitHub não existe | `api/domain/github.js` lê repositórios públicos |
| COMPANHEIRO §2, §8 | Roteiro igual no site; mensagens diretas pendentes | Ver primeira linha da tabela 1.2; mensagens existem |

---

## 2. Proposta de experiência — jornada completa

Exemplo real de uso: Ana estuda para a OAB com um curso da Gran e quer concluir Direito Constitucional em seis semanas.

| Momento | O que Ana faz | O que o Lume responde | Estado |
| --- | --- | --- | --- |
| 1. Informar o curso | Cola o link do curso ou a página copiada da área do aluno | Disciplinas, módulos, aulas e durações encontradas, marcadas como completas ou parciais | Implementado |
| 2. Revisar | Escolhe Constitucional e Penal; desmarca o que não interessa | "68 aulas selecionadas · 41 h de duração conhecida · 9 aulas sem duração" | Contagem implementada; total de horas é **proposta** |
| 3. Planejar | Informa disponibilidade (seg/qua/sex, 1 h) e prazo | Cronograma semanal com aulas na sequência; se não couber, mostra o conflito e opções | Implementado em 01/11 |
| 4. Abrir a próxima aula | Toca em "Abrir aula" na Hoje | Abre o link da fonte; mostra por que essa aula está primeiro e quanto tempo reservar | **Etapa 1** |
| 5. Estudar | Começa a sessão; assiste à aula | Sessão declarada; com a extensão, cobertura observada do vídeo | Sessão implementada; observação é **proposta (Etapa 5)** |
| 6. Registrar | Confirma a conclusão | Servidor concede 100 XP uma vez; aula some do roteiro; cronograma recalcula | XP implementado; recálculo é **Etapa 2** |
| 7. Evoluir | Atinge o nível 5 com 12 aulas concluídas | Cargo "Estudante dedicada" e desbloqueio de modelos de cronograma | **Proposta (Etapa 4)** |
| 8. Compartilhar | Compartilha a conquista "Concluí o módulo de Controle de Constitucionalidade" | Amigos veem e reconhecem; um amigo propõe um desafio de 10 aulas até sexta | Mensagens com referência implementadas; reconhecimento e desafio são **propostas (Etapa 6)** |

---

## 3. Arquitetura de informação

### 3.1 Navegação proposta: cinco destinos

**Atualização de 05/11/2026:** a decisão da [Agenda](AGENDA.md) acrescenta um sexto destino próprio,
com Calendário e Tarefas. Plano mantém Cronograma e Roteiro. A tabela abaixo preserva a proposta original.

| Destino | Reúne | Pergunta que responde |
| --- | --- | --- |
| **Hoje** | Próxima ação, sessão, tarefas relevantes, evolução recente | O que faço agora? |
| **Biblioteca** | Cursos, leituras, projetos (inclui GitHub), importação | O que estou estudando e onde parei? |
| **Plano** | Cronograma, tarefas e roteiro completo (substitui Missões e Tarefas) | O que vem nesta semana e o que está atrasado? |
| **Amigos** | Amigos, mensagens (com contador), ranking como aba | Com quem estudo e como estamos? |
| **Perfil** | Nível, cargo, conquistas, desbloqueios, extrato (Meu caminho); Configurações no menu da conta | O que conquistei e o que posso usar? |

No celular, os cinco destinos ocupam a barra inferior sem rótulo abreviado. "Instalar aplicativo" vai para o menu da conta. O nível aparece **uma vez** (cartão do perfil na barra lateral); a sincronização aparece **uma vez** (barra superior, só quando há erro ou envio em andamento).

### 3.2 Hoje — ordem de prioridade visual

1. **Próxima ação** (único bloco com destaque): aula, curso, motivo, tempo a reservar (conhecido ou estimado), botão para abrir o material, quanto falta.
2. **Sessão de estudo**: iniciar, pausar, encerrar.
3. **Tarefas relevantes**: até três, com atrasadas primeiro e mensagem de impacto.
4. **Evolução**: nível, XP até o próximo nível e a última recompensa com o material de origem.
5. Sob demanda: roteiro completo (Plano), ajustes de ritmo (Configurações).

### 3.3 Estados obrigatórios por tela

| Estado | Hoje | Biblioteca | Plano | Amigos |
| --- | --- | --- | --- | --- |
| Vazio | "Adicione o primeiro curso para receber a próxima ação." + botão importar | "Sua biblioteca está vazia. Importe um curso por link ou crie um material." | "Sem tarefas. Defina a próxima ação concreta para sua prova." | "Convide alguém com um código de 7 dias." |
| Carregando | Esqueleto do bloco de próxima ação, sem animação decorativa | Esqueleto dos cartões | Esqueleto da lista | Esqueleto da lista |
| Erro | "Gravação não confirmada. Tente novamente antes de fechar a página."; conflito pede recarga | Igual | Igual | "Não foi possível carregar seus amigos." + tentar de novo |
| Conclusão | "Você concluiu {aula}. +100 XP. Próxima: {aula}." | Curso concluído com conquista | Tarefa riscada, sem XP se organizacional | — |
| Integração indisponível | "Esta fonte não informa progresso. Registre a conclusão quando terminar." | Selo "registro manual" no cartão | — | — |

---

## 4. Gamificação concreta

### 4.1 Cinco conceitos que não se misturam

| Conceito | O que é | Exemplo | Pode ser perdido? |
| --- | --- | --- | --- |
| **XP** | Avanço elegível registrado pelo servidor | +100 XP por concluir "Direitos fundamentais — aula 3" | Só por correção de integridade, com motivo no extrato |
| **Nível** | Progressão acumulada (500 XP por nível, já em execução) | Nível 7 | Não por pausa |
| **Cargo** | Identidade conquistada por combinação de nível e marcos concretos | "Estudante dedicada" | Não |
| **Conquista** | Marco associado a um material concreto | "Terminei o curso Direito Constitucional — Gran" | Não por pausa; revogada só se o evento de origem for corrigido |
| **Desbloqueio** | Recurso novo que a pessoa pode usar | Modelos de cronograma reutilizáveis | Não |

### 4.2 Política de XP: manter a v1 e acrescentar uma unidade

A v1 (`public/xp-policy.js`) continua como base: 100 por aula, leitura, lista de exercícios e apresentação; 150 por entrega; 500 de bônus por curso ou projeto; 25 por bloco de 30 min (teto de 200 por dia); nível a cada 500 XP. **Não recomendo mudar a curva de nível**: ela já está publicada, é linear e explicável, e qualquer mudança alteraria níveis exibidos a pessoas com histórico.

Política v2 aprovada e implementada localmente: **bônus de disciplina concluída, 200 XP e conquista**. Uma vez por identidade de disciplina; exige todas as aulas selecionadas, grade completa e conclusões elegíveis. Não há migração ou concessão retroativa de dados antigos. A disciplina é o marco intermediário de cursos extensos.

### 4.3 Unidades e proteção contra duplicidade

| Unidade | Chave de idempotência | Não conta de novo quando |
| --- | --- | --- |
| Aula | pessoa + material + aula | reimportar, renomear, desfazer e concluir de novo |
| Leitura | pessoa + material + unidade (capítulo/artigo) | dividir a leitura em tarefas |
| Lista de exercícios | pessoa + material + lista | refazer a lista para revisão |
| Apresentação | pessoa + deck | rever os slides |
| Entrega de projeto | pessoa + projeto + entrega | colaborador conclui a mesma entrega |
| Disciplina (v2) | pessoa + material + disciplina | reimportar a grade |
| Curso / projeto | pessoa + material | revisitar |
| Tempo | pessoa + bloco consolidado | sessões sobrepostas em vários dispositivos |

Uma tarefa vinculada a uma aula **não** gera XP próprio: concluir a tarefa marca a aula e quem paga é o evento da aula.

### 4.4 Progressão esperada

Semana típica de quem estuda 5 h: 6 aulas (600) + 10 blocos de tempo (250) = 850 XP, cerca de 1,7 nível por semana.

| Perfil de estudo | XP por semana | Nível 5 (2.000 XP) | Nível 10 (4.500) | Nível 20 (9.500) |
| --- | ---: | --- | --- | --- |
| 2 h/semana, 2 aulas | ~300 | 7 semanas | 15 semanas | 32 semanas |
| 5 h/semana, 6 aulas | ~850 | 3 semanas | 6 semanas | 12 semanas |
| 12 h/semana, 14 aulas | ~1.800 | 1–2 semanas | 3 semanas | 6 semanas |

O teto diário de tempo limita quem tenta acumular XP só com relógio; conclusões continuam sendo a maior parte do XP.

### 4.5 Cargos, requisitos e desbloqueios (proposta)

**Decisão de 03/11/2026:** nomes e requisitos abaixo aprovados para títulos, com formas neutras.
As colunas de desbloqueio são propostas históricas e não são requisitos de acesso: todas as
funcionalidades disponíveis valem para todos os cargos. Pausas preservam os títulos; correções
de eventos reavaliam os requisitos. `public/title-policy.js` é a política executável e `user_titles`
registra a concessão idempotente. O perfil exibe títulos e critérios, respeitando a privacidade de XP.
Colaboração permanece por convites; contribuição individual e suas recompensas ficam adiadas.

Os requisitos combinam nível com **marcos concretos**, para que o cargo diga o que a pessoa fez, e não só quanto tempo passou. Nenhuma ferramenta fundamental (estudar, importar, tarefas, sessão, mensagens, amigos, ranking) fica atrás de um cargo.

| Cargo | Requisitos | Recompensa | Desbloqueio funcional | Valor do desbloqueio |
| --- | --- | --- | --- | --- |
| **Iniciante** | Conta criada | — | Todas as ferramentas fundamentais | A versão inicial é completa para estudar |
| **Estudante** | Nível 3 e 5 aulas ou leituras concluídas | Cargo no perfil | **Filtros salvos e visão por disciplina na Biblioteca** | Encontrar rapidamente o que retomar quando a biblioteca cresce |
| **Estudante dedicada(o)** | Nível 5 e 1 disciplina ou material concluído | Cargo + moldura | **Modelos de cronograma**: salvar um plano e reaplicá-lo a outra prova | Evitar refazer o planejamento a cada edital |
| **Curadora(or)** | Nível 8 e 2 materiais concluídos | Cargo | **Trilhas compartilháveis**: compor uma sequência de materiais e enviá-la a amigos como modelo (sem copiar conteúdo protegido, só referências) | Transformar o que deu certo em caminho para outra pessoa |
| **Parceira(o) de estudo** | Nível 10, 1 amizade aceita e 20 aulas concluídas | Cargo | **Desafios entre amigos**: meta de unidades concretas em um prazo, aceita pelos dois; termina com registro e reconhecimento, sem XP extra | Compromisso compartilhado sem punição por não atingir |
| **Construtora(or)** | 1 projeto com 3 entregas concluídas | Cargo | **Página de apresentação de projeto**: entregas, critérios, colaboradores e links escolhidos | Mostrar um resultado concreto, não só números |
| **Referência** | Nível 15, 2 cursos concluídos | Cargo | **Revisão de entregas de amigos**: aceitar ou devolver uma entrega colaborativa com comentário | Contribuição identificável e reconhecida |
| **Especialista em {área}** | 30 aulas concluídas na mesma área (ex.: Direito Constitucional) | Título por área, vários possíveis | Destaque da área no perfil e ordenação do ranking por área entre amigos | Identidade ligada ao que foi estudado |

Gêneros: o cargo é exibido na forma escolhida pela pessoa no perfil (padrão neutro quando houver: "Pessoa curadora").

Regras: desbloqueios são permanentes; ficam registrados no servidor (`user_unlocks`, migração nova) a partir de eventos do livro; nunca dependem de sequência diária; um desbloqueio só é anunciado quando a tela correspondente existe e funciona.

### 4.6 Transição sem apagar histórico

**Substituída pela decisão de 03/11/2026: não migrar dados.** O contrato atual é v3;
formatos antigos são recusados explicitamente, sem apagar bancos ou converter documentos.
Tarefa vinculada conclui a aula (recompensa da aula, uma vez); tarefa sem vínculo concede 0 XP.
Os passos abaixo registram a proposta antiga, não uma autorização de migração.

1. `user_unlocks` é calculado a partir de `xp_events` e `user_achievements` existentes: quem já tem nível e marcos recebe os cargos ao abrir a versão nova, com o critério visível.
2. O saldo legado (5/10 XP) continua fora de nível, cargo e ranking.
3. Tarefas de prova: a regra transitória de 10 XP permanece até aprovação desta migração — **tarefa vinculada a uma aula conclui a aula (100 XP pelo servidor, uma vez); tarefa sem vínculo é organizacional (0 XP)**. O XP legado já obtido por tarefas fica no saldo legado.
4. A v2 entra com `XP_POLICY_VERSION = 'v2'`; eventos v1 não são reprocessados.

---

## 5. Integrações com cursos externos

### 5.1 Três capacidades diferentes

1. **Importar a estrutura** — disciplinas, módulos, aulas, durações. Já funciona por página pública ou página copiada.
2. **Consultar conclusões registradas pela plataforma** — exige API oficial ou página copiada com marcação de concluído (já lida como histórico, sem XP).
3. **Observar reprodução** — exige acesso ao player no navegador da própria pessoa.

### 5.2 Matriz por plataforma

Referência histórica da pesquisa de 31/10. Capacidades e conferências atuais ficam em
[Importação](IMPORTACAO.md); em especial, o Gran passou a ter leitor próprio pela API da página em 01/11.

| | Alura | Coursera | Gran Cursos | Estratégia Concursos |
| --- | --- | --- | --- | --- |
| Importação da grade | Parcial por página pública (verificado: 5 itens em uma formação); completa pela página copiada | Boa por página pública (verificado: 127 itens com duração) | Página pública mostra disciplinas; aulas exigem login → página copiada | Grade exige login → página copiada |
| Autenticação necessária | Para aulas e progresso | Para progresso; aulas de auditoria gratuitas exigem conta | Sim | Sim |
| Acesso ao progresso | Só pela página copiada (marcações visíveis) | API corporativa (Coursera for Business) para organizações; não há API individual documentada | Só pela página copiada | Só pela página copiada |
| Observação de reprodução | Possível por extensão se o player for `<video>` acessível no DOM — **a verificar** | Possível por extensão se o player for `<video>` acessível — **a verificar** | Player não identificado publicamente — **a verificar** com conta autorizada | Player não identificado publicamente — **a verificar** |
| Retomada da posição | A plataforma retoma a própria posição; o Lume abre o link da aula | Igual | Igual | Igual |
| Mecanismo possível | Página copiada + extensão | Página pública + extensão; API só para empresas | Página copiada + extensão | Página copiada + extensão |
| Limitações | Sem API pública encontrada | API voltada a clientes corporativos, com sincronização em lotes | Sem API pública; termos proíbem redistribuição | Sem API pública; termos do produto irmão restringem acesso fora da área do aluno |
| Evidência | Busca sem documentação de API (31/10/2026); [Importação §4](IMPORTACAO.md) | [Coursera for Business — integrações](https://www.coursera.org/business/integrations); [Oracle — conclusões do Coursera por xAPI em lotes de 4 h](https://docs.oracle.com/en/cloud/saas/talent-management/faiol/handling-coursera-learning-completions.html) | Busca sem documentação de API ou de player (31/10/2026) | [Termos do Estratégia Vestibulares](https://vestibulares.estrategia.com/termos-de-uso/); busca sem API (31/10/2026) |

### 5.3 Alternativas técnicas

| Alternativa | Permissões | Dependências | Manutenção | Recomendação |
| --- | --- | --- | --- | --- |
| API oficial | OAuth ou chave da organização | Contrato com a plataforma | Baixa, se existir | Só Coursera, e só para organizações. Não é caminho individual |
| Página copiada (existente) | Nenhuma | A pessoa copia a página | Heurística de HTML | Manter como base de importação e de conclusões históricas |
| **Extensão de navegador (MV3)** | `host_permissions` apenas para os domínios escolhidos; `all_frames` se o player estiver em iframe de outra origem (exige permissão também para essa origem) | Chrome/Edge; publicação na loja | Média: muda quando o player muda | **Primeira integração** |
| Janela do desktop observando o player | Login da plataforma dentro do Electron | Electron | Alta; risco de violar termos | Não recomendado agora |

A extensão **não** consegue observar players desenhados em `canvas`, players em iframe sem permissão para a origem ou aplicativos nativos. Ela nunca envia cookies, senhas, URLs de mídia ou conteúdo: só identificadores da aula e intervalos de tempo.

**Estado (31/10/2026):** a primeira parte da extensão existe em `extension/`: **leitura de grade e de conclusões**
na página aberta pela pessoa, com entrega ao Lume e revisão obrigatória (ver
[Importação](IMPORTACAO.md#extensão-do-navegador-leitura-na-sessão-da-pessoa)). A **observação de vídeo** (5.4)
continua proposta. A leitura foi testada com páginas de exemplo, não com contas reais das plataformas.

### 5.4 Algoritmo de acompanhamento de vídeo (proposta)

- Eventos lidos do `HTMLMediaElement`: `play`, `pause`, `waiting`, `playing`, `seeking`, `seeked`, `ratechange`, `timeupdate`, `ended`.
- **Cobertura**: entre dois `timeupdate`, se o vídeo está tocando, não está em `seeking` e o avanço de `currentTime` é ≤ 2 s × velocidade, o intervalo é somado. Intervalos são unidos; cobertura = união / duração.
- **Tempo efetivo**: tempo de relógio em reprodução (sem pausa, sem buffering). A 2×, uma aula de 60 min gera ~30 min de tempo efetivo.
- **Saltos** não criam cobertura; **chegar ao fim** não conclui.
- **Conclusão observada**: cobertura ≥ 95% e trecho final reproduzido. Mesmo assim, a pessoa confirma; a origem do registro fica "observado pela extensão".
- **Falhas de conexão**: o desenho de lotes persistidos desta proposta não foi aprovado. A decisão de 03/11
  exige API direta, sem fila offline; uma futura observação deve definir recuperação explícita sem reintroduzi-la.
- Observar reprodução não comprova compreensão; a interface diz "reprodução observada", não "aula assimilada".

### 5.5 Primeira prova técnica recomendada

**Coursera, aula gratuita (auditoria) com a conta da responsável.** É a única das quatro com aula real acessível sem compra, o que torna a prova reproduzível. Critérios:

1. A extensão, instalada sem empacotamento, detecta o `<video>` da aula e envia lotes ao servidor local.
2. Assistir 3 min, pular 5 min e assistir mais 2 min resulta em cobertura de ~5 min, não 10.
3. Assistir a 2× por 4 min de relógio gera 4 min de tempo efetivo e ~8 min de cobertura.
4. Desligar a rede informa a interrupção; ao religar, a retomada não duplica registros confirmados.
5. Fechar o navegador e voltar preserva a cobertura acumulada.

Em paralelo, um **roteiro de inspeção manual** (30 min, com a conta da responsável) para Gran e Estratégia: o player é `<video>` no DOM? Em iframe de qual origem? A URL da aula é estável? Só depois dessa resposta a extensão ganha permissão para esses domínios.

### 5.6 Caminho manual e como reduzir o esforço

Hoje: abrir a aula pelo Lume e voltar para marcar a conclusão. Evolução proposta, em ordem:

1. **Etapa 1 (feito)**: a Hoje mostra a aula, o tempo a reservar e o link direto.
2. **Etapa 2**: concluir uma aula oferece "Concluir e abrir a próxima" em um toque; conclusão em lote para aulas sequenciais já vistas.
3. **Etapa 5**: a extensão propõe a conclusão quando a cobertura passa de 95%; a pessoa confirma com um clique na própria página da aula.

---

## 6. Cronograma e tarefas

### 6.1 Modelo proposto

| Campo | Tarefa | Cronograma |
| --- | --- | --- |
| Prioridade | 1 (alta) a 3 (baixa), mais "sem prioridade"; texto e cor, nunca só cor (**Etapa 1**) | Ordem das disciplinas escolhidas |
| Prazo | Opcional (já existe) | Data-alvo do objetivo |
| Vínculo | Curso (já existe); aula ou disciplina (Etapa 2) | Aulas na sequência da fonte |
| Subtarefas | Até 10, só quando úteis (Etapa 2) | — |
| Duração | Estimativa opcional | Conhecida (da fonte) ou estimada (sessão padrão), sempre rotulada |
| Disponibilidade | — | Minutos por dia da semana |

### 6.2 Recalcular, adiar e conflito

- **Recalcular** distribui as aulas restantes na disponibilidade a partir de hoje, respeitando sequência e prioridade. Aulas concluídas nunca voltam ao plano.
- **Adiar** move a atividade para o próximo dia disponível e recalcula o resto.
- **Pausar** um curso tira suas aulas do cronograma sem apagar progresso.
- **Conflito**: "Faltam 41 h de aula e há 24 h disponíveis até 15/12. Opções: aumentar para 7 h/semana, adiar o prazo para 19/01 ou reduzir para as disciplinas de prioridade alta." Nenhuma opção é aplicada sem escolha.

### 6.3 Inclusão sem infantilizar

Uma ação principal por vez na Hoje; instruções com verbo e objeto ("Assista à aula 3 de Constitucional — 25 min"); posição fixa dos blocos; tarefas divisíveis; retomada com o ponto exato. Sem mascotes, sem exclamações em série, sem "parabéns" por abrir a tela.

---

## 7. Plano de evolução

| Etapa | Escopo | Depende de | Critérios de aceite (comportamento) |
| --- | --- | --- | --- |
| **1. Hoje orientada à ação** — **implementada nesta rodada** | Roteiro único (`nextAction` em `study-plan.js`) usado pela Hoje; tempo conhecido × estimado; link da aula; tarefas com prioridade e atraso; bloco de evolução; revisão de tom; documentação coerente | — | Hoje e Companion mostram a mesma próxima aula; concluir uma aula muda a próxima ação após recarregar; tarefa atrasada aparece primeiro com a mensagem de impacto; prioridade sobrevive ao recarregamento; criar ou priorizar tarefa não altera XP |
| 2. Plano — **implementada (01/11/2026), exceto "Concluir e abrir a próxima"** | Disponibilidade semanal, prazo, cronograma, conflitos, adiar/recalcular, subtarefas, tarefa vinculada a aula, "Concluir e abrir a próxima" | 1 | Concluir uma aula recalcula a semana; fechar e abrir o app preserva o plano; conflito explica números e oferece três ajustes |
| 3. Identidade visual e navegação — **implementada (01/11/2026), exceto esqueletos de carregamento** | Tokens azul + verde com superfícies neutras; cinco destinos; estados vazios/erro/carregamento; logo intocado | 1 | Contraste AA em todos os pares de token; nenhum estado comunicado só por cor; navegação com cinco itens no celular |
| 4. Cargos e desbloqueios | `user_unlocks` no servidor, cálculo a partir do livro, tela de progressão, primeiro desbloqueio utilizável (modelos de cronograma) | 2 | Cargo concedido uma única vez mesmo com requisições repetidas; o modelo de cronograma pode ser salvo e reaplicado; pausa de 30 dias não retira cargo |
| 5. Extensão observadora | Prova Coursera da seção 5.5; inspeção Gran/Estratégia | 1 | Os cinco critérios da seção 5.5 com aula real |
| 6. Social com propósito | Reconhecimento a conquistas de amigos, compartilhamento de aprendizados, desafios entre amigos (desbloqueio) | 4 | Reconhecer não gera XP; bloqueio impede reconhecimento e mensagens; preferências de notificação respeitadas |

### Referências de produto

| Referência | Aproveitar | Evitar |
| --- | --- | --- |
| Steam | Biblioteca como coleção, perfil com vitrine escolhida | Conquistas por ações triviais |
| Discord | Proximidade, presença opcional, mensagens diretas | Servidores, canais e grupos (fora do escopo) |
| Notion | Estrutura de disciplinas, materiais e tarefas | Página em branco que exige montar tudo |
| [Are.na](https://www.are.na/about) | Blocos reutilizados em várias coleções → trilhas compartilháveis que referenciam materiais sem copiá-los; ausência de métricas de curtidas | Coleções públicas por padrão |
| [Strava — kudos](https://support.strava.com/en-us/articles/15402054-what-is-kudos) | Reconhecimento leve vinculado a uma atividade concreta, com notificação configurável | Kudos irrevogável e feed infinito |
| [Todoist — prioridades](https://www.todoist.com/help/articles/set-a-priority-in-todoist-Wy82Jp) | Poucos níveis explícitos, padrão "sem prioridade", ordenação por prioridade | Codificação apenas por cor |
| [Habitica](https://habitica.com/) | Relação explícita entre tarefa concluída e recompensa de jogo; classes como identidade | Perda de vida e de nível por tarefas diárias não feitas — contraria "pausas sem punição". (Mecânica descrita na wiki pública do Habitica; a página não pôde ser lida nesta sessão, bloqueio HTTP 402.) |

---

## 8. Tom de voz

Princípios: tratar a pessoa como capaz; nomear o objetivo, a próxima ação e o resultado; diante de atraso, mostrar impacto e oferecer ajuste; reconhecer com referência ao que foi estudado; preservar pausas sem absolver automaticamente nem desvalorizar a constância.

| Onde | Antes (texto real) | Depois |
| --- | --- | --- |
| Hoje, título | "Olá. Que bom ter você aqui." | "Hoje" + "Sua próxima aula é {aula}. Reserve {n} minutos para avançar." |
| Hoje, sobretítulo | "Espaço seu · sem urgência" | Data e objetivo atual |
| Hoje, foco | "O começo pode ser pequeno." / "Você não precisa fazer tudo agora. Escolha um próximo movimento, no seu tempo." | "Próxima ação" + motivo da prioridade |
| Hoje, cartão de pausa | "Se hoje não der, você pode descansar. Seu progresso continua aqui para quando quiser voltar." / "Pausar sem culpa" | Removido. Pausa fica no controle da sessão |
| Hoje, conforto | "Você pode parar e voltar depois. Seu caminho não precisa seguir o ritmo de ninguém." | Removido (ajustes em Configurações) |
| Hoje, métrica | "Sem cobrança. Seu progresso não expira." | Substituído por nível e última recompensa concreta |
| Diálogo de pausa | "Pode pausar." / "Descanse pelo tempo que precisar. Nenhuma etapa foi concluída e seu progresso continua guardado." | "Pausa registrada." / "O progresso está salvo. Ao voltar, a próxima ação continua sendo {aula}." |
| Ritmo (retomar) | "Seu próximo passo continua aqui. Você pode retomar sem compensar os dias de pausa." | "Retome pela próxima aula da lista. Se o prazo mudou, ajuste o plano." |
| Ritmo (começar) | "Preparar o material já pode ser um começo. Você escolhe quando continuar." | "Comece pela primeira aula. Preparar o material ajuda, mas o avanço vem ao concluir." |
| Rodapé | "Feito para o seu ritmo, não o contrário." | Removido (repetia o estado de sincronização) |
| Entrada | "Aprender no seu ritmo, com espaço para recomeçar." | "Organize o estudo, conclua o que começou e acompanhe o progresso com amigos." |
| Tarefas vazias | "Nada pendente por aqui." / "…ou aproveite para revisar o que já concluiu." | "Sem tarefas pendentes." / "Defina a próxima ação concreta para sua prova." |
| Tarefas atrasadas | (não existia) | "Duas tarefas passaram do prazo. Reorganize a semana para manter seu objetivo." |
| Conclusão de aula | (toast genérico) | "Você concluiu {aula}. Próxima: {aula}." |
| Perfil | "Aprendendo passo a passo, sem pressa" | Bio padrão vazia; a pessoa escreve a própria |

Itens da tabela marcados como removidos ou substituídos na Hoje, no diálogo de pausa, no ritmo, no rodapé, na entrada e nas tarefas foram aplicados na Etapa 1. Onboarding, perfil e Companion ficam para a Etapa 3, junto com a revisão visual.
