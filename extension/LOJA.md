# Publicar a extensão na Chrome Web Store

Roteiro e textos prontos para o painel <https://chrome.google.com/webstore/devconsole>. O cadastro de editor, a
taxa e o envio são feitos pela pessoa responsável pela conta; nada disso é automatizado aqui.

## 1. Gerar o pacote

```sh
npm run extension:package
```

Gera `dist-extension/lume-leitor-de-curso-<versão>.zip` a partir de `extension/`, com três diferenças em relação
à pasta de desenvolvimento:

- o manifesto aceita só `https://lume.lume-prototype.workers.dev/*` (os endereços localhost saem);
- o popup não mostra a escolha entre Lume publicado e local;
- `LEIAME.md`, `LOJA.md` e `store/` ficam de fora.

Cada envio novo precisa de uma `version` maior no `manifest.json`. A loja recusa versão repetida.

## 2. Antes do primeiro envio

- A política de privacidade precisa estar publicada: `public/privacidade-extensao.html` entra no site com
  `npx wrangler deploy`. Endereço: <https://lume.lume-prototype.workers.dev/privacidade-extensao.html>.
- Teste o `.zip` instalado: descompacte numa pasta, carregue em `chrome://extensions` (modo do desenvolvedor,
  **Carregar sem compactação**), entre no Lume publicado e leia um curso.

## 3. Painel → Novo item

Envie o `.zip`. Depois, preencha as abas abaixo.

### Ficha da loja

- **Idioma:** português (Brasil).
- **Categoria:** Educação (se o painel agrupar as categorias, fica dentro de Produtividade).
- **Ícone:** `extension/icons/icon-128.png`.
- **Captura de tela:** `extension/store/captura-1280x800.png`.
- **Bloco promocional pequeno:** `extension/store/promo-440x280.png`.
- **Site:** <https://lume.lume-prototype.workers.dev>.

**Resumo:** vem do `description` do manifesto, que a loja limita a 132 caracteres (o script recusa se passar):

> Envia ao Lume as aulas e o que aparece como concluído no curso aberto com a sua conta. Não lê senha, cookie nem vídeo.

**Descrição:**

> O Lume é uma plataforma de estudos com biblioteca, plano, progresso e amigos. Esta extensão leva para ele a
> lista de aulas de um curso que você faz em outra plataforma.
>
> Como funciona:
> 1. Abra o curso na plataforma, com a sua conta.
> 2. Clique no ícone do Lume e em "Ler esta página e enviar".
> 3. O Lume abre a revisão: confira as disciplinas, aulas, durações e o que já aparece como concluído, e adicione.
>
> Na página de uma aula, o botão "Concluí esta aula" abre essa aula no Lume para você confirmar.
>
> O que a extensão não faz:
> • não lê senha, cookie, vídeo nem o conteúdo das aulas;
> • não age sozinha: só quando você clica, e só na aba aberta;
> • não altera nada na plataforma de curso;
> • não envia dados a terceiros. A leitura vai direto para o Lume aberto no seu navegador.
>
> Leitura testada no Gran Cursos Online. Em outras plataformas, a leitura usa a estrutura da página e pode vir
> incompleta; a revisão mostra o que foi encontrado antes de adicionar.
>
> Uma aula marcada como assistida na plataforma não comprova que ela foi estudada; o Lume trata essa informação
> como observação da plataforma, confirmada por você.

### Práticas de privacidade

**Finalidade única:**

> Ler, quando a pessoa clica, a lista de aulas e o estado de conclusão do curso aberto na aba atual e entregá-la ao
> Lume aberto no navegador, para revisão e importação.

**Justificativas das permissões:**

| Permissão | Justificativa |
| --- | --- |
| `activeTab` | Ler a lista de aulas só da aba em que a pessoa clicou no ícone, só naquele momento, sem acesso permanente a nenhum site de curso. |
| `scripting` | Injetar o leitor (`capture.js`) na aba ativa depois do clique, para ler disciplinas, aulas, durações e marcas de conclusão. |
| `storage` | Guardar a escolha do endereço do Lume que recebe a leitura. Nenhum dado de curso é guardado na extensão. |
| Permissão de host (`lume.lume-prototype.workers.dev`) | Encontrar ou abrir a aba do Lume e entregar a leitura a ela por um script de ponte, que só roda nesse endereço. |

**Código remoto:** não. Todo o código está no pacote; a extensão não carrega nem executa scripts de fora.

**Dados tratados** (marque só estes):

- **Conteúdo do site:** sim. Nomes de curso, disciplinas e aulas, links, durações e marcas de conclusão lidos
  da página aberta.
- Informações de identificação pessoal, de saúde, financeiras, de autenticação, comunicações pessoais,
  localização, histórico da web e atividade do usuário: **não**.

**Declarações:** marque as três (não vende dados a terceiros; não usa nem transfere para fins não relacionados à
finalidade única; não usa para determinar crédito ou empréstimos).

**Política de privacidade:** <https://lume.lume-prototype.workers.dev/privacidade-extensao.html>

### Distribuição

- **Visibilidade:** recomendado **Não listada** enquanto o Lume é protótipo. Só quem tem o link instala, e é
  possível mudar para Pública depois.
- **Regiões:** todas, ou só Brasil.

Depois de enviar para revisão, a análise costuma levar de alguns dias a algumas semanas. Uma recusa vem com o motivo
por e-mail; corrija, suba a `version` e envie de novo.

## 4. Atualizar uma versão publicada

1. Altere `extension/` e suba `version` no `manifest.json`.
2. `npm run extension:package`.
3. No painel, **Pacote → Enviar novo pacote** e envie para revisão.
