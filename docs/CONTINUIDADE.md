# Lume — estado atual e continuidade de desenvolvimento

Este documento separa o protótipo existente da visão em [Produto](PRODUTO.md) e das regras futuras em [Gamificação](GAMIFICACAO.md). Deve ser atualizado quando uma funcionalidade for realmente implementada.

## 1. Resumo para outra IA

> Estamos construindo o Lume, uma plataforma social de estudos com amigos, grupos, compartilhamento de aprendizados, colaboração, conquistas personalizadas e placares. A pessoa deve organizar e retomar cursos, videoaulas, artigos, exercícios e projetos. A gamificação reconhece estudo efetivo e conclusões substanciais. Abrir uma janela, preparar materiais ou clicar em botões não gera XP. O código atual ainda contém recompensas antigas de microtarefas; isso é uma divergência a corrigir com migração explícita. Leia AGENTS.md, docs/PRODUTO.md e docs/GAMIFICACAO.md antes de alterar o projeto. Não confunda telas de demonstração com contas reais ou integrações funcionais.

## 2. O que existe no código

Na revisão que acompanha esta documentação, o projeto é uma aplicação local em HTML, CSS e JavaScript, servida por `server.js` ou Live Server.

| Capacidade | Situação |
| --- | --- |
| Entrada | Prévia local sem autenticação de conta |
| Ritmo de estudo | Três ritmos, apoios e sugestões de plano semanal |
| Biblioteca | Cursos/assuntos com etapas, busca, filtros, pausa e links |
| Progresso | Registro local de conclusão de etapas e preparação |
| Gamificação | Modelo legado: 5 XP por preparação, 10 XP por etapa, nível a cada 100 XP |
| Conquistas | Selos genéricos do protótipo, incluindo ações que não serão elegíveis na nova política |
| Histórico | Dados no navegador e exportação JSON |
| Visual | Telas inspiradas em referências Stitch, temas, entradas escalonadas, destaque de cartões, respostas em botões e transições de diálogos/avisos; efeitos desativados no modo essencial e com movimento reduzido |
| Contas e sincronização | Cadastro e login com e-mail e senha são requisitos; serviço de contas em implementação, com integração completa e sincronização ainda a verificar |
| Amigos, grupos e comunicação | Não implementados |
| Placares compartilhados | Não implementados |
| GitHub e outras integrações | Não implementadas |
| Captura de posição de vídeo/leitura | Não implementada |
| Conquistas personalizadas por material | Não implementadas como sistema da nova política |

O nome “curso” no protótipo pode representar um assunto com tarefas arbitrárias. Isso ainda não é o modelo de curso com aulas e critérios de conclusão definido para o produto.

## 3. Mudança de direção documentada

### Efeitos visuais — referência FGLibs

Os efeitos usam como referência a [Arc Library, listada na FGLibs](https://fglibs.com/), e seus [princípios de movimento](https://uiarc.dev/docs/motion). A implementação é própria em CSS e Web Animations API, sem instalar React ou dependências. O MCP da FGLibs não estava disponível na sessão; foi consultado o site como alternativa.

Entradas finitas orientam a chegada às telas de entrada, personalização, Hoje e Biblioteca; cartões recebem destaque e leve elevação com ponteiro preciso. Filtros revelam os resultados, sem repetir animações durante a busca. Diálogos, botões e avisos recebem respostas discretas. O conteúdo permanece funcional sem Web Animations API. Ativar o modo essencial ou a preferência de movimento reduzido cancela as entradas; o CSS também neutraliza as transições exportadas do Stitch.

Esta alteração é visual: não migra dados nem implementa a nova política de XP, contas sincronizadas ou recursos sociais. Verificação: sintaxe JavaScript e 20 testes existentes aprovados. A revisão visual no navegador ficou pendente: o navegador interno não alcançou a prévia local, e o controle do Chrome foi interrompido pela ferramenta por não conseguir determinar a URL atual com segurança.

O protótipo inicial enfatizou passos de preparação e pequenas recompensas. A direção atual exige progresso real de estudo e um componente social central.

Continuam válidos: conforto, ajuda para começar, tarefas divisíveis, pausas sem penalidade, preferências editáveis e preservação de dados.

Precisam evoluir: unidade de progresso, origem do registro, continuidade de materiais, cálculo de XP, níveis, conquistas, contas e funcionalidades sociais.

O código e os testes antigos descrevem o comportamento do protótipo; não anulam a nova especificação. Ao substituir uma regra, substituir também suas expectativas de teste de forma consciente.

## 4. Modelo de dados conceitual para a evolução

| Entidade | Responsabilidade |
| --- | --- |
| Pessoa e perfil | Conta, áreas, ritmo, conforto e privacidade |
| Material | Aula, leitura, exercício ou outro conteúdo com origem e identidade |
| Curso/trilha | Conjunto de materiais e requisitos de conclusão |
| Projeto e entrega | Objetivo e resultados substanciais definidos |
| Progresso do material | Estado, posição, cobertura quando disponível, marcador e origem |
| Sessão de estudo | Intervalos de atividade e tempo elegível, com reconciliação |
| Evento de XP | Registro único de recompensa, política e origem |
| Conquista obtida | Marco personalizado e seu critério |
| Amizade e grupo | Relações aceitas, membros e permissões |
| Publicação/mensagem | Aprendizado compartilhado ou comunicação, com escopo e moderação |
| Participação no placar | Consentimento, período e política do grupo |
| Conexão de integração | Provedor, permissões, capacidades e estado de sincronização |

Separar o material de seu progresso por pessoa. Um material compartilhado não significa que todos os integrantes o concluíram. Da mesma forma, uma entrega coletiva não deve conceder automaticamente a mesma recompensa a todos os membros.

Não é uma decisão de banco de dados ou fornecedor. O objetivo deste modelo é evitar continuar representando todos os recursos como uma única lista de tarefas concluídas.

## 5. Ordem recomendada de evolução

### Etapa A — progresso significativo no protótipo

- Introduzir materiais tipados e critérios de conclusão.
- Separar apoio de preparação de atividade recompensada.
- Implementar a política de XP, níveis e conquistas personalizadas com regras versionadas.
- Planejar e testar a migração do histórico legado antes de aplicá-la.
- Acrescentar marcadores manuais de leitura/vídeo e sessões de estudo claramente declaradas.

### Etapa B — contas e dados persistentes

- Autenticação real, recuperação de acesso, autorização e isolamento por pessoa.
- Persistência no servidor e sincronização recuperável.
- Livro de eventos e atribuição de XP no servidor.
- Migração voluntária e segura dos dados locais para a conta.

### Etapa C — primeira experiência social

- Amigos, grupos privados, compartilhamento e comunicação.
- Permissões, bloqueio, moderação e controle de notificações.
- Ranking com abas por nível acumulado, cursos concluídos e empenho no período; participação configurável e regras de registros manuais visíveis.
- Colaboração em entregas com contribuição individual explícita.

### Etapa D — integrações e retomada automática

- Implementar um adaptador de fonte por vez, verificando suas capacidades.
- Player compatível com posição, retomada, cobertura e tempo elegível.
- GitHub opcional com repositórios escolhidos e entregas definidas.
- Expandir para fontes de leitura e outras plataformas conforme suporte real.

A visão social deve orientar o modelo desde a Etapa A; não é um extra a ser esquecido. A ordem acima é uma proposta para reduzir dependências e evitar placares baseados em pontuação arbitrária de navegador.

## 6. Parâmetros iniciais e decisões futuras

Já definidos como direção do produto: amigos e grupos, compartilhamento, colaboração, ranking como recurso central com classificações por nível, cursos concluídos e empenho, participação configurável, conquistas por conteúdo e ausência de XP por preparação. Empenho é atividade de estudo registrada no período; não é uma avaliação de valor pessoal.

Propostos nesta documentação para balanceamento inicial: valores de XP, 500 XP por nível, blocos de 30 minutos e limite diário da recompensa por tempo.

Ainda precisam de decisão de implementação: fornecedor de autenticação e hospedagem, primeira fonte de vídeo suportada, regras detalhadas de revisão de entregas coletivas, tratamento visual do saldo legado e política para materiais muito curtos ou muito extensos. Essas escolhas não devem ser resolvidas com promessas genéricas de integração automática.

## 7. Como manter o contexto

- Atualize esta matriz de estado quando implementar recursos.
- Registre novas decisões e alterações de balanceamento com versão e motivo em `GAMIFICACAO.md`.
- Mantenha o README como porta de entrada, apontando para estes documentos.
- Envie `AGENTS.md` e os três documentos da pasta `docs` para uma IA que não tenha acesso ao repositório.
- Não use apenas screenshots ou o README antigo como especificação de produto.
- Esta rodada alterou documentação; não migrou dados, não reescreveu a pontuação em execução e não ativou integrações ou serviços externos.
