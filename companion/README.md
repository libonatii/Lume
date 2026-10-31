# Lume — programa de desktop

Este README cobre o pacote `companion/`. A visão completa do programa está em
[docs/COMPANHEIRO.md](../docs/COMPANHEIRO.md); a publicação do instalador está em
[docs/RELEASE.md](../docs/RELEASE.md).

O app é o **Lume completo em uma janela**: carrega o site publicado na mesma origem
(mesma conta, mesmos amigos e perfil), mantém a bandeja com presença local e um
painel de presença, e verifica/baixa atualizações. O agente de linha de comando
continua disponível para diagnóstico.

## O que ele faz

- Abre o site do Lume em uma janela própria (1240×820), com barra de título do
  Lume e links externos enviados ao navegador.
- Fecha para a bandeja em vez de encerrar; a bandeja mostra estado, próxima aula
  e o atalho para sair.
- Painel de presença (400×640): dispositivo, aplicativo detectado, roteiro por
  prioridade, pausa, pareamento, versão e atualização.
- Lê a lista de processos do Windows com `tasklist` e compara com a **allowlist**
  que você escolhe: processo → nome exibido → categoria
  (`study`, `project`, `reading`, `break`, `game`, `other`).
- Envia ao Lume o aplicativo encontrado, a categoria e desde quando ele está
  aberto. Sem batimento por 90 segundos, a presença expira sozinha.
- Mostra quantas aulas faltam por curso e o roteiro por prioridade
  (continuidade, primeiro passo, proximidade do fim, ordem da biblioteca).
- Botão de atualização consulta a última release `companion-v*` no GitHub, baixa
  o `Lume-setup.exe` com progresso e abre o instalador. A configuração em
  `%APPDATA%\Lume\companion.json` é preservada.

## O que ele não faz

- Não lê título de janela, conteúdo de tela, teclado, arquivos ou histórico.
- Não envia nomes de aplicativos fora da sua lista.
- Não conta tempo como estudo, não conclui aulas e **não gera XP**.
- Não tem banco local nem uma segunda conta: o app usa a API do site.
- Não funciona fora do Windows nesta versão.
- Presença social entre amigos, mensagens diretas e feed continuam pendentes no produto; ranking de amigos já existe. Comunidades, servidores, canais e grupos estão fora do escopo desta etapa.

## Desenvolvimento

Node **22.23.4 ou superior** (testado com 24) e Windows. O Electron tem
dependências próprias, com lockfile separado:

```sh
npm install --prefix companion    # Electron e electron-builder, uma vez
npm run companion:app             # bandeja + janela
npm run companion                 # agente de terminal
```

Comandos do pacote, a partir de `companion/`:

```sh
npm start      # igual a npm run companion:app
npm run smoke  # abre a janela escondida, grava smoke-result.json e encerra
npm run pack   # electron-builder --win dir (release/win-unpacked)
npm run dist   # instalador NSIS (release/Lume-setup.exe)
```

Fora da pasta do projeto, use o iniciador: `D:\tabletop\lume.cmd`
(`--debug` abre com o console visível).

## Conectar

1. No Lume, entre na conta e abra **Instalar aplicativo** na barra lateral.
2. Gere o código de conexão de 8 caracteres (vale 10 minutos, uso único).
3. No computador, dentro do projeto:

```sh
npm run companion:pair -- ABCD-EFGH --name "PC da Ana"
```

No servidor local, informe a API:

```sh
npm run companion:pair -- ABCD-EFGH --name "PC da Ana" --api http://127.0.0.1:4173
```

4. Deixe o agente rodando (`npm run companion`) ou use a janela/bandeja.

## Comandos do agente

```sh
node companion/agent.mjs status                 # vê o que seria detectado, sem enviar
node companion/agent.mjs plan                   # aulas restantes e roteiro por prioridade
node companion/agent.mjs allow anki --label "Anki" --category study
node companion/agent.mjs allowlist
node companion/agent.mjs remove anki
node companion/agent.mjs run --once --dry-run   # testa a detecção sem rede
node companion/agent.mjs pause | resume
node companion/agent.mjs unpair
```

## Configuração

Fica em `%APPDATA%\Lume\companion.json` (fora do repositório):

```json
{
  "apiUrl": "https://lume.lume-prototype.workers.dev",
  "token": "…",
  "deviceName": "PC da Ana",
  "intervalSeconds": 5,
  "paused": false,
  "allowlist": [
    { "process": "anki", "label": "Anki", "category": "study" },
    { "process": "code", "label": "VS Code", "category": "project" }
  ]
}
```

O token é o acesso deste computador. Ele só pode **relatar presença** e ler o
roteiro — não lê o estado da conta, não altera cursos e não recebe XP. Para
revogar, use **Desconectar** no painel do Lume; o token deixa de valer
imediatamente.

## Segurança e privacidade

- Cada computador tem um token próprio, guardado apenas como hash no servidor.
- O código de conexão é de uso único, curto e expira em 10 minutos.
- A allowlist é sua: nada é enviado sem você adicionar o processo.
- Presença é temporária e privada; o painel não lê tela nem títulos de janela.
- "Aplicativo aberto" não é estudo comprovado e não alimenta XP nem ranking.

## Release e limitações

- O instalador é gerado pelo GitHub Actions a partir de uma tag
  `companion-v<versão>` que precisa bater com `companion/package.json`.
- Sem assinatura de código: o Windows pode avisar na primeira execução.
- Atualização é manual (botão na janela), não automática.
- Só Windows x64; sem suporte a Linux/macOS.
- Sem leitura de progresso automático das plataformas: a conclusão continua
  manual e identificada.
- Sem integração com Discord; o Lume não lê a atividade de outros programas.
