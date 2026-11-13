# Publicação e CI do Lume

O repositório tem dois fluxos no GitHub Actions:

| Workflow | Quando roda | O que faz |
| --- | --- | --- |
| `CI` (`.github/workflows/ci.yml`) | push na `main`, pull request e manual | testes de domínio, build estático e cenários de navegador; checa sintaxe e testes do Companion em Windows e Linux |
| `Companion release` (`.github/workflows/companion-release.yml`) | tag `companion-v*` ou manual | gera os pacotes Windows (`Lume-setup.exe`) e Linux (`Lume.AppImage` e `Lume.deb`) e publica no GitHub Releases |

Os instaladores têm nomes fixos (`Lume-setup.exe`, `Lume.AppImage`, `Lume.deb`) justamente para o botão
**Instalar aplicativo** do site usar links estáveis:
- `https://github.com/libonatii/Lume/releases/latest/download/Lume-setup.exe`
- `https://github.com/libonatii/Lume/releases/latest/download/Lume.AppImage`
- `https://github.com/libonatii/Lume/releases/latest/download/Lume.deb`

## 1. Configuração única no GitHub

1. **Actions habilitado** em *Settings → Actions → General*.
2. Em *Workflow permissions*, permita **Read and write** (o release workflow declara
   `contents: write`; se a organização restringir, o bloco não basta).
3. **Assinatura (opcional, recomendada)** — em *Settings → Secrets and variables → Actions*:
   - `CSC_LINK`: certificado `.pfx` em base64 (`certutil -encode cert.pfx cert.b64`).
   - `CSC_KEY_PASSWORD`: senha do certificado.
   Sem esses secrets, o instalador é gerado **sem assinatura**: funciona, mas o
   Windows mostra o aviso do SmartScreen na primeira execução.
4. Opcional: proteger a tag `companion-v*` contra exclusão acidental em
   *Settings → Tags*.

Nenhum outro secret é necessário: o release usa o `GITHUB_TOKEN` automático.

## 2. Publicar uma versão

```powershell
# 1. Suba a versão do app
#    companion/package.json -> "version": "0.6.0"

# 2. Teste localmente (opcional, mas recomendado)
npm --prefix companion run pack      # gera release/win-unpacked para conferir

# 3. Commit e tag
git add companion/package.json companion/package-lock.json
git commit -m "lume: versão 0.6.0"
git tag companion-v0.6.0
git push origin main --tags
```

O workflow:

1. Confere se a tag bate com `companion/package.json` (falha cedo se não bater).
2. Roda `npm ci` em `companion/` no Windows e no Linux (`ubuntu-latest`).
3. Gera o instalador NSIS (`Lume-setup.exe`) e os pacotes Linux (`Lume.AppImage` e `Lume.deb`).
4. Cria a release com notas automáticas e envia `.exe`, `.blockmap`, `latest.yml`, `.AppImage`, `.deb` e `latest-linux.yml`.

Também é possível disparar manualmente em *Actions → Companion release → Run
workflow*, informando uma tag já existente.

## 3. O que vai no pacote

- `electron/`, `core.mjs`, `domain.mjs`, `update.mjs`, `discord-*.mjs` e `package.json` dentro do `app.asar`.
- Ícones da bandeja e da janela em `resources/assets` (fora do asar).
- O agente de terminal (`agent.mjs`) **não** vai no instalador.
- Configuração do usuário continua em `%APPDATA%\Lume\companion.json` (Windows) ou `~/.config/Lume/companion.json` (Linux); atualizar o app não apaga o pareamento.

## 4. Rodar os testes como o CI roda

```powershell
npm ci
npm test
npm run build
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'bundled'
npx playwright test
```

Localmente, sem `PLAYWRIGHT_CHANNEL`, os testes usam o Chrome instalado.

## 5. Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| `A tag companion-v0.3.1 não corresponde a companion-v0.3.0` | versão do `companion/package.json` diferente da tag |
| `Nenhum artefato encontrado em companion/release` | build falhou antes do NSIS; veja o log do passo "Gerar instalador" |
| Release publicada sem `.exe` | permissão de escrita negada ao token do workflow |
| Aviso do SmartScreen | instalador sem assinatura (esperado sem `CSC_LINK`) |
| `npm ci` falha no Companion | `companion/package-lock.json` desatualizado; rode `npm install --prefix companion` e commite |

## 6. Limites atuais

- Windows x64 e Linux x64 (sem macOS).
- Sem auto-update: cada versão é um instalador/pacote novo. Os arquivos `latest.yml` e `latest-linux.yml` já são gerados, então `electron-updater` pode ser adicionado depois.
- `npm audit` acusa vulnerabilidades moderadas em dependências transitivas do
  `electron-builder`; nenhuma delas entra no app empacotado (são ferramentas de build).
