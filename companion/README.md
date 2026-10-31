# Lume Companion

Programa local que informa ao Lume **qual aplicativo da sua lista está aberto** — a
mesma ideia de "estou jogando X" do Discord, aplicada à sua atividade de estudo.

Esta é a primeira versão: agente de linha de comando, **Windows**, sem dependências
externas. A bandeja do sistema e o instalador ficam para a próxima etapa.

## O que ele faz

- Lê a lista de processos do Windows com `tasklist`.
- Compara com a **allowlist** que você escolhe: processo → nome exibido → categoria
  (`study`, `project`, `reading`, `break`, `game`, `other`).
- Envia ao Lume o aplicativo encontrado, a categoria e desde quando ele está aberto.
- Sem batimento por 90 segundos, a presença expira sozinha na conta.
- Ao encerrar (Ctrl+C), remove a presença.

## O que ele não faz

- Não lê título de janela, conteúdo de tela, teclado, arquivos ou histórico.
- Não envia nomes de aplicativos fora da sua lista.
- Não conta tempo como estudo, não conclui aulas e **não gera XP**.
- Não funciona em segundo plano sem uma conta conectada.
- Não funciona fora do Windows nesta versão.

## Conectar

1. No Lume, entre na conta e abra **Configurações → Lume Companion**.
2. Clique em **Conectar um programa**. Um código de 8 caracteres aparece (vale 10
   minutos, uso único).
3. No computador, dentro do projeto:

```sh
npm run companion:pair -- ABCD-EFGH --name "PC da Ana"
```

Se estiver testando no servidor local, informe a API:

```sh
npm run companion:pair -- ABCD-EFGH --name "PC da Ana" --api http://127.0.0.1:4173
```

4. Deixe o agente rodando:

```sh
npm run companion
```

## Comandos

```sh
node companion/agent.mjs status                 # vê o que seria detectado, sem enviar
node companion/agent.mjs allow anki --label "Anki" --category study
node companion/agent.mjs allowlist
node companion/agent.mjs run --once --dry-run   # testa a detecção sem rede
node companion/agent.mjs pause | resume
node companion/agent.mjs unpair
```

Categorias: `study`, `project`, `reading`, `break`, `game`, `other`.

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

O token é o acesso deste computador. Ele só pode **relatar presença** — não lê o
estado da conta, não altera cursos e não recebe XP. Para revogar, use
**Desconectar** no painel do Lume; o token deixa de valer imediatamente.

## Segurança e privacidade

- Cada computador tem um token próprio, guardado apenas como hash no servidor.
- O código de conexão é de uso único, curto e expira em 10 minutos.
- A allowlist é sua: nada é enviado sem você adicionar o processo.
- Presença é temporária e privada. Amigos e grupos ainda não existem; quando
  existirem, a exibição será opcional.
- "Aplicativo aberto" não é estudo comprovado e não alimenta XP nem ranking.

## Limitações conhecidas

- Só Windows, sem bandeja/instalador.
- Sem assinatura de código: o Windows pode avisar sobre o executável no futuro.
- Presença não vira tempo elegível automaticamente; a política de XP exige
  validação no servidor e blocos de tempo declarados.
- Não há integração com Discord; o Lume não lê a atividade de outros programas.
