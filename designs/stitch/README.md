# Exportações do Stitch — Lume

Projeto de origem: **Projeto Lume** (`10906855451665474274`), anteriormente chamado NeuroFocus Learning Hub.

| Tela | Código original | Imagem |
| --- | --- | --- |
| Lume — Hoje (Foco Tranquilo) | [hoje/index.html](hoje/index.html) | [hoje/screenshot.png](hoje/screenshot.png) |
| Lume — Biblioteca de Cursos | [biblioteca/index.html](biblioteca/index.html) | [biblioteca/screenshot.png](biblioteca/screenshot.png) |
| Lume — Onboarding: Ritmo de Estudo | [onboarding/index.html](onboarding/index.html) | [onboarding/screenshot.jpg](onboarding/screenshot.jpg) |
| Lume — Início & Login | [inicio-login/index.html](inicio-login/index.html) | [inicio-login/screenshot.jpg](inicio-login/screenshot.jpg) |

Arquivos obtidos dos URLs hospedados com `curl -L`, autenticado pela configuração local do MCP. O pacote JSON devolvido pelo Stitch foi extraído para HTML em UTF-8 e imagens PNG ou JPEG, conforme o formato de origem. A chave de acesso não faz parte desta exportação. As dimensões registradas no manifesto são as dimensões reais das imagens baixadas.

Os HTMLs desta pasta preservam o código exportado, incluindo referências externas a Tailwind, Google Fonts e imagens. Precisam de internet para carregar esses recursos. São referências visuais com dados ilustrativos.

O aplicativo funcional usa **Astro + React**, com entrada em [src/pages/index.astro](../../src/pages/index.astro). Entrada e conta estão em [Auth.jsx](../../src/components/Auth.jsx); Hoje, Biblioteca e personalização estão em [Study.jsx](../../src/components/Study.jsx). O sistema visual é reutilizado em [public/stitch.css](../../public/stitch.css), com imagens locais em [public/assets/stitch](../../public/assets/stitch/), estilos complementares em [public/neurofocus.css](../../public/neurofocus.css) e [public/entry.css](../../public/entry.css), e interações em [public/motion.css](../../public/motion.css) e nos componentes React com Motion.

Para executar o aplicativo, use `npm run dev` na raiz do projeto e acesse [http://localhost:4321](http://localhost:4321). O Live Server pode exibir os HTMLs de referência desta pasta, mas não compila o aplicativo Astro/React nem atende as APIs de conta. Instruções de portas e build estão no [README principal](../../README.md#executar-localmente).

Cadastro, login com e-mail e senha, saída, recuperação por link e sincronização básica de cópia do progresso funcionam na API local. O backend é mantido em [server.js](../../server.js) e [worker.js](../../worker.js). A prévia sem conta continua disponível; envio de e-mail, reconciliação entre dispositivos e XP validado no servidor ainda estão pendentes. A migração React + Astro não foi publicada nesta etapa.

As escolhas de ritmo e os três apoios visíveis ajustam sugestões e plano semanal. Modo essencial e tratamento de movimento reduzido foram retirados a pedido da responsável; referências a esses modos nos HTMLs exportados são históricas e não descrevem o aplicativo atual. As exportações também podem mostrar integrações ou recursos sociais ilustrativos que ainda não estão implementados. Consulte [Continuidade](../../docs/CONTINUIDADE.md) antes de interpretar uma referência visual como funcionalidade pronta.

O arquivo [manifest.json](manifest.json) registra os identificadores das telas, tamanhos, dimensões e hashes SHA-256 dos downloads.
