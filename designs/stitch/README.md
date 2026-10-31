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

O design foi integrado ao aplicativo funcional em `../../index.html`, `../../app.js` e `../../neurofocus.css`, com imagens locais em `../../assets/stitch/`. Para usar o Lume no VS Code, abra o **index.html da raiz do projeto** com Live Server.

As telas de Onboarding e Início & Login também foram integradas ao aplicativo funcional, com estilos em `../../entry.css` e transições em `../../motion.css`. A entrada funciona como prévia local sem credenciais; autenticação real ainda não está implementada. As escolhas de ritmo e apoio ajustam o plano semanal e a experiência da página Hoje, preservando o progresso existente.

O arquivo [manifest.json](manifest.json) registra os identificadores das telas, tamanhos, dimensões e hashes SHA-256 dos downloads.
