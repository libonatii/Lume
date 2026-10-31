# Lume — importação de cursos por link

Status: **implementado e publicado** no site de referência — o endpoint `/api/import/analyze` responde em
produção. Verificado com build, testes de domínio e testes de navegador. Consulte [Produto](PRODUTO.md),
[Gamificação](GAMIFICACAO.md) e [Continuidade](CONTINUIDADE.md) para o contexto geral.

## 1. O que a pessoa faz

1. Abre **Biblioteca → Adicionar curso**.
2. Cola o link do que quer estudar, ou escolhe **Colar a grade** e envia um arquivo `.txt`/`.md`.
3. O servidor identifica a plataforma, busca a página pública e extrai o que realmente está publicado.
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
| Acessar conteúdo da conta | Não implementado — o Lume não pede senha nem cookie |
| Consultar progresso automaticamente | Não implementado para nenhuma plataforma |
| Retomar a aula na posição exata | Não implementado — há link direto quando a fonte publica um |

Fontes com adaptador e estrutura esperada (o que a página costuma oferecer):

| Plataforma | Estrutura esperada | Leitura automática |
| --- | --- | --- |
| Gran Cursos Online | disciplinas e assuntos | parcial, só a página pública; a grade de aulas costuma exigir login |
| Estratégia Concursos | disciplinas e assuntos | parcial, só a página pública |
| Alura | cursos, módulos e aulas | parcial, por estrutura visível |
| Rocketseat | trilhas, módulos e projetos | parcial; páginas que só publicam contagem de aulas não são importadas |
| Udemy | seções e aulas | parcial, por dados estruturados; costuma bloquear robôs |
| Coursera | semanas e aulas | parcial/boa, por estrutura visível (currículo com durações) |
| DIO | bootcamps e módulos | parcial; a página de catálogo não é um curso |
| Hotmart | módulos e aulas | normalmente só por texto/arquivo |
| Fonte desconhecida | conteúdo genérico | tenta dados estruturados e hierarquia de títulos; se não bastar, texto/arquivo |

Cada fonte também declara sua nota (`public/import-domain.js`), exibida na revisão e no painel "O que esta
fonte permite".

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
- Concluir uma aula importada registra progresso **manual**, com origem visível. Não usa a recompensa legada de
  10 XP por etapa, nem a de 5 XP por preparação.
- Nenhum XP da nova política é atribuído no navegador: a política exige validação no servidor com chave de
  idempotência, e esse livro de eventos ainda não existe para contas. A sincronização de `/api/state` continua
  sendo uma cópia do estado, não validação de pontuação.
- Não há observação de vídeo assistido. "Concluí esta aula" é autodeclaração identificada; sem integração
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
- `GITHUB_CAPABILITIES` declara que conexão, leitura de repositórios, validação de entregas e compartilhamento
  ainda não existem. Nada de colaboração simulada.
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
unitários com HTML de exemplo e pelos acessos reais listados na seção 4.

## 12. Pendências conhecidas

- Validar o caso Gran/OAB com a URL real, incluindo o que a página pública mostra de disciplinas.
- Cadastrar edital oficial com fonte e data antes de qualquer comparação de cobertura.
- Extração para páginas que só publicam módulos e contagens (Rocketseat): hoje não importamos para não inventar aulas.
- Conteúdo autenticado exige integração autorizada por plataforma; não implementado.
- Progresso automático, retomada de posição e observação de vídeo: não implementados.
- A estrutura importada é guardada na cópia do estado da conta; ela não é validada no servidor como conteúdo oficial.
- A publicação do Worker com as novas rotas depende de um `npx wrangler deploy` (não executado nesta tarefa).
