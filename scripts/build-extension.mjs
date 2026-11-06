import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Empacota o leitor da extensão (extension/src/capture.js + registro de
// provedores em public/providers/) num script clássico em extension/capture.js.
// O arquivo gerado fica no repositório porque a pasta extension/ é carregada
// como está no modo desenvolvedor do Chrome; o teste extension-build.test.js
// falha se ele estiver desatualizado.

export const BANNER = '// Gerado por scripts/build-extension.mjs a partir de extension/src/capture.js. Não edite: rode npm run extension:build.';

export async function buildCapture({ outfile = fileURLToPath(new URL('../extension/capture.js', import.meta.url)), write = true } = {}) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../extension/src/capture.js', import.meta.url))],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome110'],
    charset: 'utf8',
    legalComments: 'none',
    banner: { js: BANNER },
    outfile,
    write,
    logLevel: 'silent',
  });
  return write ? outfile : new TextDecoder().decode(result.outputFiles[0].contents);
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/').replace(/^\//, '')}` || process.argv[1]?.endsWith('build-extension.mjs')) {
  await buildCapture();
  console.log('extension/capture.js atualizado.');
}
