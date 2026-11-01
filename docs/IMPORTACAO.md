# Lume — importação de cursos por link

Status: **implementado** — o endpoint `/api/import/analyze` existe no servidor local e no Worker, e a versão
por link está publicada no site de referência. A leitura de **página copiada** da conta foi implementada depois
do último deploy e depende de uma nova publicação; consulte a seção 12. Verificado com build, testes de domínio
e testes de navegador. Consulte [Produto](PRODUTO.md), [Gamificação](GAMIFICACAO.md) e
[Continuidade](CONTINUIDADE.md) para o contexto geral.

## 1. O que a pessoa faz

1. Abre **Biblioteca → Adicionar curso**.
2. Cola o link do que quer estudar, ou escolhe **Colar a grade** e envia um arquivo `.txt`/`.md`.
   Se o curso só aparece depois do login, abre o curso na plataforma com a conta, seleciona a página
   (Ctrl+A), copia (Ctrl+C) e cola no campo de grade: o Lume lê o HTML copiado e nunca recebe senha, cookie
   ou sessão.
3. O servidor identifica a plataforma e extrai o que está na página pública — ou na página copiada, quando é
   o caso — sem executar nada do conteúdo.
4. A revisão mostra as áreas encontradas com caixas de seleção, módulos expansíveis, contagem de aulas e a
   marcação de **grade completa** ou **parcial**. Dá para marcar/desmarcar áreas, módulos e aulas, ver a
   quantidade selecionada e corrigir antes de adicionar.
5. Ao confirmar, o curso entra na biblioteca com disciplinas, módulos e aulas; progresso por área, próxima
   aula, ponto de retomada, link da fonte e a origem de cada registro de progresso aparecem no detalhe do curso.

Estados previstos e implementados: analisando, revisão, resultado parcial (com avisos), acesso necessário
(fonte protegida), falha recuperável (link inválido, tempo esgotado, rede, limite de tentativas) e importação
concluída. O link digitado e as seleções permanecem na janela quando há erro.

## 2. Três origens que nunca se misturam

| Origem | O que é | Como aparece |
| --- | --- | --- |
| Conteúdo identificado na fonte | Título, disciplinas, módulos, aulas, duração e links que estavam na página (ou no texto/arquivo enviado) | Revisão e detalhe do curso, com a data da análise |
| Previsão do edital | Temas que o edital da edição/fase exige | Seção "Cobertura do edital", separada da grade |
| Sugestão de IA | Reorganização do texto fornecido | Marcada como "Organizado por IA" e com aviso de que não é conteúdo oficial |

A grade importada **nunca** é apresentada como cobertura completa da prova. Uma grade parcial também não
calcula conclusão do curso inteiro: o progresso é sempre "nas áreas escolhidas".

## 3. Capacidades por plataforma

Cada adaptador declara o que consegue fazer. Aceitar o link não significa que todas as capacidades existam.

| Capacidade | Situação atual |
| --- | --- |
| Identificar curso e importar a grade | Depende da fonte: dados estruturados, estrutura visível da página, ou texto/arquivo |
| Acessar conteúdo da conta | Não implementado como integração — o Lume não pede senha nem cookie. A grade vem da página copiada pela pessoa ou lida pela extensão na sessão dela (ver abaixo) |
| Consultar progresso automaticamente | Não implementado por API. A página copiada da conta pode trazer aulas marcadas como concluídas, importadas como histórico sem XP |
| Retomar a aula na posição exata | Não implementado — há link direto quando a fonte publica um |

Fontes com adaptador e estrutura esperada (o que a página costuma oferecer):

| Plataforma | Estrutura esperada | Leitura automática |
| --- | --- | --- |
| Gran Cursos Online | disciplinas e assuntos | parcial; a página pública mostra disciplinas, a grade de aulas exige login (use a página copiada) |
| Estratégia Concursos | disciplinas e assuntos | parcial; a grade completa exige login (use a página copiada) |
| Alura | cursos, módulos e aulas | parcial, por estrutura visível |
| Rocketseat | trilhas, módulos e projetos | parcial; páginas que só publicam contagem de aulas não são importadas |
| Udemy | seções e aulas | parcial, por dados estruturados; costuma bloquear robôs |
| Coursera | semanas e aulas | parcial/boa, por estrutura visível (currículo com durações) |
| DIO | bootcamps e módulos | parcial; a página de catálogo não é um curso |
| Hotmart | módulos e aulas | normalmente só por texto/arquivo |
| Fonte desconhecida | conteúdo genérico | tenta dados estruturados e hierarquia de títulos; se não bastar, texto/arquivo |

Cada fonte também declara sua nota (`public/import-domain.js`), exibida na revisão e no painel "O que esta
fonte permite".

### Página copiada (curso logado)

Pedir senha ou cookie não é opção: isso entregaria a sessão da pessoa ao servidor e contornaria controles de
acesso das plataformas. O caminho implementado é o inverso: a pessoa abre o curso com a própria conta, copia a
página e cola no Lume. O navegador remove scripts, estilos e atributos, mantém títulos, listas e links, e envia
esse HTML ao próprio servidor do Lume, que o trata como dado.

- Funciona com qualquer plataforma, inclusive as que montam a grade por JavaScript.
- Vale o que estava visível ou expandido na tela; módulos fechados não aparecem.
- A leitura é heurística: exige cara de aula (rota com identificador, palavra de aula ou duração) e pelo menos
  três itens. A revisão continua obrigatória.
- O resultado é marcado como **página copiada da sua conta**, sempre **parcial**.
- Sem o link informado, a reimportação usa o título como identidade; informar o link evita duplicata.

### Extensão do navegador (leitura na sessão da pessoa)

Para cursos logados, colar a página é frágil: plataformas montam a grade por JavaScript e escondem módulos
fechados. A extensão (`extension/`, Chrome/Edge, Manifest V3) lê a página **já aberta pela pessoa, com a conta
dela**, quando ela clica no ícone. Ver [extension/LEIAME.md](../extension/LEIAME.md).

- **Permissões mínimas:** `activeTab` (só a aba em que a pessoa clicou, só naquele momento), `scripting`, `storage`
  e acesso às origens do próprio Lume. Não há permissão permanente sobre Udemy, Alura, Coursera, Gran etc.
- **O que lê:** título do curso, grupos (módulos/seções), nome, link e duração de cada aula e a marca de
  concluída visível. Abre as seções fechadas (o mesmo clique que a pessoa daria) e as fecha de novo.
  Não lê cookie, senha, token, URL de mídia nem o conteúdo das aulas, e não chama a API da plataforma.
- **Como funciona:** leitor genérico sobre o DOM (itens com rota de aula, dados `data-*`, listas com duração;
  agrupa pelo título anterior; reconhece conclusão por checkbox marcado, `aria-checked`, rótulos de acessibilidade,
  ícones com título e classes como `completed`/`done`/`concluido`), mais regras de URL por plataforma para
  identificar o curso (Udemy, Coursera, Alura, Rocketseat, Gran, Estratégia, DIO, Hotmart; outras entram como fonte
  não reconhecida, com o mesmo leitor).
- **Entrega ao Lume:** o service worker acha (ou abre) a aba do Lume e um script de ponte repassa a leitura à página
  por `postMessage` na mesma origem, repetindo até a página confirmar. A leitura passa por `normalizePayload` e a
  pessoa **sempre revisa** antes de adicionar; a extensão nunca adiciona sozinha. Nenhum endpoint novo foi criado.
- **Progresso e XP:** a primeira leitura de um curso importa as conclusões visíveis como **histórico sem XP**.
  Nas leituras seguintes do mesmo curso (mesma identidade), aulas que aparecem concluídas e que o Lume ainda não
  tinha são oferecidas em uma caixa **marcada por padrão**, que a pessoa pode desmarcar. Se confirmada, a conclusão
  entra no `studyLog` com origem `integration` e o servidor decide o XP pela política vigente (100 XP por aula,
  teto diário). Aula do histórico nunca é convertida em XP. É uma observação da plataforma confirmada pela pessoa,
  não prova de que a aula foi assistida.
- **Estrutura completa:** a leitura abre seções dentro de seções (disciplina → aula → vídeos, até cinco rodadas e 400 cliques)
  e lê hierarquia, contagem e conclusão sem que a pessoa abra nada. Uma seção que não abriu entra como um item só, com o
  selo de concluída que a página mostrar, e a leitura avisa quantas ficaram assim; quando os vídeos forem lidos depois,
  esse item aparece como removido da fonte e preserva a conclusão. Testado com uma página de exemplo que só cria os
  filhos ao clicar; no site real do Gran ainda não foi exercitada.
- **Limites:** lista virtualizada ou carregada sob demanda só traz o que estava na tela; player ou índice em iframe de
  outra origem pode ficar fora; seção que não abre não é lida. A marca de conclusão depende de a plataforma
  mostrá-la.

## 4. O que foi realmente verificado nesta rodada

Execução local em 31/10/2026, com o extrator do projeto e acesso real à internet:

| Link | Resultado |
| --- | --- |
| `coursera.org/learn/react-basics` | **ok** — currículo público lido, 127 itens com duração, confiança média |
| `alura.com.br/formacao-programacao` | **ok, parcial** — 5 itens (cursos e objetivos misturados); aviso de conferência |
| `rocketseat.com.br/formacao/fullstack` | **sem grade** — a página publica módulos e contagens ("24 aulas"), sem títulos de aula; oferece colar/enviar arquivo |
| `dio.me/bootcamp` | **sem grade** — página de catálogo, não de curso |
| `udemy.com/course/react-the-complete-guide-incl-redux` | **acesso necessário** — resposta 403 da proteção da Udemy; o Lume informa e oferece o caminho manual |
| Gran Cursos / Estratégia | **não verificados com link real** — o link específico do curso preparatório de OAB ainda não foi fornecido |

A Udemy e a Rocketseat são exemplos de por que o produto não pode prometer "qualquer URL": a primeira bloqueia
acesso automatizado, a segunda não publica a lista de aulas. Nesses casos a extração não é contornada.

## 5. Extração, segurança e limites

- Entrada única `POST /api/import/analyze` (link) e `POST /api/import/organize` (texto/arquivo).
- Somente `http`/`https`, sem credenciais na URL, sem portas incomuns (apenas 80/443).
- Bloqueio de `localhost`, sufixos internos, endereços privados, link-local e metadados de nuvem.
- No servidor Node o domínio é resolvido antes da conexão (`dns.lookup`) e o resultado precisa ser público.
  No Worker não existe resolvedor DNS: a validação é feita na URL e em cada salto de redirecionamento.
- Redirecionamentos manuais, no máximo 3, revalidando cada destino.
- Limite de 2 MB de documento, tempo de 9 s, `content-type` de HTML/JSON/texto.
- Página copiada: até 1,5 milhão de caracteres, corpo da API até 3 MB. Não há busca externa nesse caminho;
  nenhuma credencial é enviada e o HTML não é executado.
- O HTML é tratado como dado; nenhum trecho da página é enviado como instrução para IA.
- Limites de estrutura: 40 disciplinas, 60 módulos por disciplina, 600 aulas, títulos de 200 caracteres.
- A estrutura devolvida é validada em `normalizePayload` antes de entrar no estado; URL de aula inválida é descartada.
- Limite de tentativas por IP e rota (30 por 10 minutos no servidor local, contador próprio no Worker).
- Não há contorno de login, paywall ou proteção antibot.

Qualidade da heurística: preferimos dados estruturados (schema.org). Sem eles, só aceitamos listas dentro de
seções de conteúdo/currículo, itens que parecem aula (ou têm duração), e exigimos pelo menos três aulas;
caso contrário a resposta é "não encontrei a grade" e o caminho assistido é oferecido. Páginas de marketing
ainda podem gerar itens indevidos — por isso a revisão existe e a grade é marcada como parcial.

## 6. IA

- Chamadas de IA acontecem **somente no servidor**. Nenhuma chave vai para o navegador ou para o repositório.
- Desligada por padrão. Para habilitar: `LUME_AI_API_KEY` (ou `OPENAI_API_KEY`), opcionalmente
  `LUME_AI_BASE_URL` e `LUME_AI_MODEL` (padrão `gpt-4o-mini`).
- Sem chave, o organizador determinístico (`parseSyllabusText`) faz o trabalho: entende `Disciplina:`, `Módulo:`,
  `Aula:`, markdown, numeração (`1`, `1.1`, `1.1.1`) e indentação.
- Com chave, a IA apenas organiza o texto enviado: o prompt proíbe inventar itens e manda ignorar instruções
  dentro do conteúdo. A resposta passa pela mesma validação; se falhar, o resultado determinístico é usado.
- A interface informa quando o resultado veio de IA e que ele não é conteúdo oficial.

## 7. Modelo de dados e persistência

`public/import-domain.js` é a fonte das regras, compartilhada por navegador, servidor e testes.

- Curso importado = `course` com `steps` (lista plana das aulas selecionadas, compatível com as telas atuais) e
  `structure` (disciplinas → módulos → aulas).
- Identidade: provedor + URL canônica (sem `utm`/`ref`/hash) ou provedor + hash do título quando a origem é texto.
  Reimportar a mesma fonte atualiza o curso em vez de duplicar.
- Aulas têm id estável derivado da identidade e do caminho (disciplina/módulo/título), então renomear um módulo
  não apaga conclusões.
- `course.source` guarda provedor, identidade, data da análise, tipo de extração, completude, capacidades,
  avisos e a marca de demonstração.
- Progresso continua separado do conteúdo: `completed` (ids de aula concluída), `studyLog` (registro com origem
  `manual` ou `integration`, data e possível desfazer) e `imports` (histórico de importações).
- `restoreState` aceita dados antigos sem `studyLog`/`imports` e descarta registros inválidos sem zerar o progresso.

Reimportação:

- aulas que continuam existem uma vez;
- aulas removidas da fonte ficam marcadas como "removida da fonte" e não perdem conclusão;
- conclusões, ponto de retomada e histórico são preservados;
- o curso mantém o mesmo id e a data da primeira importação.

## 8. Progresso e gamificação

- Importar curso, escolher disciplinas, atualizar grade e conectar fonte **não geram XP**. A interface diz isso
  explicitamente na conclusão.
- Concluir uma aula importada registra progresso **manual**, com origem visível. A conclusão manual é elegível
  para 100 XP de aula, concedidos pelo servidor no livro de eventos; não usa a recompensa legada de 10 XP por etapa.
- A página copiada da conta pode marcar aulas como concluídas. Elas entram como `studyLog` com origem `import` e
  `historical: true`, somam no progresso exibido, mas **não geram XP** e não podem ser desfeitas como conclusão
  manual. O Lume não converte progresso antigo em recompensa nova.
- Importar, escolher disciplinas, atualizar a grade e conectar uma fonte continuam sem XP. A política de XP vive
  em `xp.js`/`xp_events`, com chave de idempotência; `/api/state` continua sendo a cópia do estado, não a
  autoridade de pontuação.
- Não há observação de vídeo assistido por API. "Concluí esta aula" é autodeclaração identificada; sem integração
  compatível, não existe retomada automática.

## 9. Edital e OAB

- A seção de edital pede **somente** edição e fase quando elas não estão identificadas.
- O registro de editais verificados (`EDITAL_SOURCES`) está **vazio de propósito**: cadastrar um edital exige
  conferir a fonte oficial e a data. Enquanto não houver entrada, a interface informa que a comparação não está
  disponível e não calcula o que falta para a prova.
- Quando uma entrada existir, a comparação lista temas cobertos, temas ausentes, a fonte, a data de publicação
  e a data da conferência. O texto deixa claro que isso não mede domínio nem garante aprovação.
- O caso Gran/OAB só será validado de ponta a ponta quando a URL real do curso for fornecida.

## 10. GitHub (preparação)

- `deliveryCandidates(repository)` transforma issues abertas em **sugestões** que exigem validação, com a nota de
  que issue aberta não significa projeto incompleto.
- A leitura pública de repositórios existe em `github.js` (README, issues e milestones, sem token e sem
  repositórios privados). Conexão por OAuth, validação automática de entregas e escrita no GitHub não existem.
- Quando a integração for implementada, ela deve ser opcional, com escopo mínimo, escolha explícita de
  repositórios e nada de repositórios privados expostos por padrão.

## 11. Como verificar

```sh
npm test          # domínio, autenticação e importação (17 testes próprios)
npm run build
npm run test:e2e  # desktop e celular
```

Os testes de navegador cobrem: link inválido, fonte protegida, falha de rede com link preservado, seleção
parcial, reimportação sem duplicata com progresso preservado, conclusão manual sem XP e isolamento entre contas.
A análise por link nesses testes é simulada por interceptação de rota; a extração real é verificada por testes
unitários com HTML de exemplo e pelos acessos reais listados na seção 4. O teste **página copiada de um curso
logado é lida sem receber a sessão** cobre um painel autenticado simulado, com menu, disciplinas e links de aula.

A matriz de viabilidade por plataforma (Alura, Coursera, Gran, Estratégia), as alternativas técnicas e a primeira
prova de observação de reprodução estão em [Evolução §5](EVOLUCAO.md#5-integrações-com-cursos-externos).

## 12. Pendências conhecidas

- **Extensão:** o leitor foi testado contra páginas de exemplo no formato esperado (`tests/e2e/capture.spec.js`) e,
  para o Gran, contra um trecho real do painel do curso (`tests/fixtures/gran-painel.html`: disciplina → aula →
  vídeo, com duração, código do curso e endereço). Do Gran falta ver como um vídeo **assistido** aparece (o
  arquivo analisado não tinha nenhum); a leitura supõe ícone `circle-check` ou selo "Concluído" na aula. Udemy,
  Alura, Coursera e Rocketseat não foram testadas com páginas reais.
- **Tamanho:** o Lume aceita até 600 aulas por importação e 320 KB de estado por conta; um curso grande do Gran
  (31 disciplinas) pode passar disso. A leitura avisa e corta; elevar o limite é decisão de produto pendente.
- **Extensão, o que falta:** conferir o DOM real de cada plataforma (ícones e classes de conclusão incluídos) e
  ajustar as regras. A extensão também não foi carregada no Chrome como extensão; a ponte e a entrega pelo service worker não têm teste automatizado.
  Publicação na Chrome Web Store, ícones e configuração de outro endereço do Lume não existem.

- Validar o caso Gran/OAB com a URL real, incluindo o que a página pública mostra de disciplinas.
- Cadastrar edital oficial com fonte e data antes de qualquer comparação de cobertura.
- Extração para páginas que só publicam módulos e contagens (Rocketseat): hoje não importamos para não inventar aulas.
- Conteúdo autenticado como integração autorizada por plataforma continua não implementado. O caminho atual é a
  página copiada pela própria pessoa: depende do que estava visível na tela e não recupera módulos fechados.
- Progresso automático, retomada de posição e observação de vídeo: não implementados.
- A estrutura importada é guardada na cópia do estado da conta; ela não é validada no servidor como conteúdo oficial.
- A leitura de página copiada (`analyzeSnapshot`) depende de publicar o Worker com `npx wrangler deploy`, não
  executado nesta tarefa. O limite de corpo da rota passou de 96 KB para 3 MB nos dois backends.
