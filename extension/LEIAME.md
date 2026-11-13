# Extensão do Lume — leitor de curso

Lê, na página que você abriu com a sua conta, os nomes das aulas, as durações e o que aparece como concluído, e
envia ao Lume para revisão. Serve para plataformas que só mostram a grade depois do login (Gran, Estratégia,
Udemy, Alura, Coursera, Rocketseat e outras).

**Status:** protótipo. Testado com páginas de exemplo e com um trecho real do painel do Gran. A leitura do Gran pela API foi conferida com uma conta real em 01/11/2026, mas a extensão ainda não foi carregada num Chrome. As outras plataformas ainda não foram vistas com contas reais. Não está publicado na loja. Não é o aplicativo de desktop do Lume (ver [aplicativo de desktop](../companion/README.md)): ele só lê cursos na página aberta.

## Instalar (modo desenvolvedor)

1. Abra `chrome://extensions` (ou `edge://extensions`) e ligue **Modo do desenvolvedor**.
2. **Carregar sem compactação** e escolha a pasta `extension/` deste repositório.
3. Fixe o ícone na barra de ferramentas.

## Usar

1. Entre no Lume (no endereço publicado ou em `localhost:4173`) e na plataforma do curso.
2. Na plataforma, abra a tela com o índice do curso (módulos e aulas).
3. Clique no ícone e em **Ler esta página e enviar**. A extensão abre e fecha as seções para ler os nomes. No Gran,
   ela pede a grade às mesmas rotas que a página usa e não precisa abrir nada; cada aula do Gran vira uma aula no
   Lume.
4. O Lume abre a revisão. Confira, ajuste a seleção e adicione.

Em uma segunda leitura do mesmo curso, aulas novas concluídas na plataforma podem ser registradas (caixa marcada
por padrão, que você pode desmarcar); as que já constavam continuam como histórico sem XP.

## O que a extensão faz e não faz

- Só age quando você clica (permissão `activeTab`). Não há acesso permanente às plataformas.
- Não lê senha, cookie, token, vídeo nem o conteúdo das aulas; envia só título, módulos, nomes, links, durações e
  marcas de conclusão, e só para o Lume.
- Não contorna login nem proteção: lê o que a sua própria sessão já mostra na tela. No Gran, consulta só com
  `GET` as rotas de grade que a página do curso já usa; o navegador envia o cookie e a extensão não o lê.
- Se a plataforma montar a lista aos poucos ou em outro quadro, a leitura pode vir incompleta; confira na revisão.

## Outro endereço do Lume

Os endereços aceitos estão em `manifest.json` (`host_permissions` e `content_scripts.matches`) e em
`background.js`. Para um domínio próprio, acrescente-o nos três lugares e recarregue a extensão.

## Publicar na Chrome Web Store

`npm run extension:package` gera o `.zip` da loja em `dist-extension/lume-leitor-de-curso-<versão>.zip`, aceitando apenas `https://lumeacademy.site/*` (sem endereços localhost e sem arquivos de documentação/desenvolvimento); a política de privacidade pública é `public/privacidade-extensao.html`.

## Arquivos

- `src/capture.js` — fonte do leitor da página; usa o registro de provedores de `public/providers/`.
- `capture.js` — gerado por `npm run extension:build` a partir de `src/capture.js` (injetado ao clicar). Não edite à mão.
- `icons/` — ícones da extensão (gerados do logo do Lume); `store/` — imagens da ficha da loja.
- `popup.html`, `popup.js` — interface do ícone.
- `background.js` — encontra ou abre o Lume e entrega a leitura.
- `bridge.js` — roda no Lume e repassa a leitura à página.
