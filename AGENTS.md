# Lume — instruções de continuidade para agentes e colaboradores

Antes de propor ou alterar comportamento do produto, leia nesta ordem:

1. [Visão e requisitos do produto](docs/PRODUTO.md).
2. [Gamificação e conquistas](docs/GAMIFICACAO.md).
3. [Estado atual e plano de evolução](docs/CONTINUIDADE.md).

Esses documentos descrevem o destino do Lume. O código atual é um protótipo e contém regras antigas que não representam mais o produto desejado. Instruções explícitas da pessoa responsável pelo projeto prevalecem; mantenha a documentação coerente com novas decisões.

## Contexto obrigatório

- Lume é uma plataforma social de estudos: biblioteca, continuidade de materiais, amigos, grupos, compartilhamento de aprendizados, colaboração, conquistas e placares de estudo.
- Cadastro e login com e-mail e senha são requisitos do Lume, assim como recuperação de acesso e saída da conta. A prévia local é temporária; não descrevê-la como decisão de que o produto não terá login ou senha.
- A gamificação deve reconhecer avanço real: estudo efetivo, aula concluída, leitura concluída, curso concluído e entrega de projeto. Não premiar cliques ou movimentação na interface.
- Abrir uma janela, entrar no site, cadastrar um material, preparar a mesa, abrir uma aula, conectar uma conta, pausar ou enviar mensagens não gera XP.
- Apoios para começar e dividir uma tarefa continuam úteis, mas não são automaticamente eventos de recompensa. Não confundir preparação com conclusão de estudo.
- A inclusão de pessoas neurodivergentes é central. Personalização, conforto visual e pausas sem punição devem conviver com uma gamificação substancial e uma experiência social opcional.
- Não reduzir o produto a um organizador individual de microtarefas, nem retirar amigos ou placares por presumir que competição nunca pode ser inclusiva.
- O ranking é um recurso central obrigatório, com classificações por nível acumulado, cursos distintos concluídos e empenho no período. Não substituí-lo somente por um placar semanal de XP. Participação configurável não torna o desenvolvimento do ranking dispensável.
- Nenhum registro de atividade deve ser descrito como prova de compreensão, inteligência ou benefício clínico.

## Regras para implementar

- Preserve os dados existentes. A migração dos eventos antigos exige tratamento explícito; não apague progresso nem converta preparações antigas em aulas concluídas.
- Separe recursos implementados, simulações locais e funcionalidades planejadas. Não apresente login local como autenticação real.
- Integrações devem declarar suas capacidades. Não prometa rastreamento automático de qualquer URL, videoaula, PDF, artigo ou repositório.
- Não coloque credenciais de integrações no frontend, em arquivos versionados ou em saídas de ferramentas. Não publicar o conteúdo de repositórios privados por padrão.
- A atribuição de XP da versão com contas deve ser validada no servidor, com eventos identificáveis e proteção contra repetição. O navegador não deve ser a autoridade de um placar compartilhado.
- Os valores iniciais de balanceamento estão em `docs/GAMIFICACAO.md`. Não espalhe valores contraditórios entre telas e regras de domínio.
- Ao mudar uma regra de produto, atualize os documentos afetados e os testes relevantes. Testes do protótipo não são justificativa para conservar uma regra já substituída.
- Ao receber uma tarefa só de documentação, documente as divergências; não aproveite para migrar dados, ativar serviços, alterar a pontuação ou publicar mudanças funcionais.

## Verificação e entrega

O projeto usa Astro, React e Motion, com build estático e API em JavaScript no servidor local ou Cloudflare Worker. Execute `npm test` quando alterar regras de domínio, `npm run build` para validar a aplicação e `npm run test:e2e` para verificar os fluxos de interface afetados. Mudanças apenas em documentação exigem revisão de coerência e links, sem necessidade de repetir testes de código inalterado. Por decisão explícita da responsável, a interface não oferece modo essencial nem tratamento de movimento reduzido; os campos antigos permanecem apenas para compatibilidade dos dados.

Na entrega, informe o que mudou, o que foi verificado e o que ainda não está implementado. Não chame um recurso de concluído com base apenas em sua aparência.
