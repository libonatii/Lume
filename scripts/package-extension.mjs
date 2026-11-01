import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

// Gera o pacote da extensão para a Chrome Web Store em dist-extension/.
// A versão da loja fala só com o Lume publicado: os endereços localhost saem do
// manifesto e a escolha de destino sai do popup. A pasta extension/ continua
// servindo para instalar em modo desenvolvedor, com o Lume local.
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const source = join(root, 'extension');
const output = join(root, 'dist-extension');
// Documentação e imagens da ficha da loja não vão dentro do pacote.
const SKIP = new Set(['LEIAME.md', 'LOJA.md']);
const SKIP_DIRS = ['store/'];
const isLocal = (pattern) => /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(pattern);

function storeManifest(text) {
  const manifest = JSON.parse(text);
  // A loja recusa o pacote com nome acima de 75 ou descrição acima de 132 caracteres.
  if (manifest.name.length > 75 || manifest.description.length > 132) throw new Error('manifest.json: nome ou descrição longos demais para a loja.');
  manifest.host_permissions = manifest.host_permissions.filter((pattern) => !isLocal(pattern));
  for (const script of manifest.content_scripts) script.matches = script.matches.filter((pattern) => !isLocal(pattern));
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function storePopup(text) {
  const result = text.replace(/[ \t]*<!--[^]*?-->\s*(?=<label data-dev>)/, '').replace(/[ \t]*<label data-dev>[^]*?<\/label>\r?\n?/, '');
  if (result.includes('data-dev') || result.includes('localhost')) throw new Error('popup.html: a escolha de destino não saiu do pacote da loja.');
  return result;
}

const TRANSFORMS = { 'manifest.json': storeManifest, 'popup.html': storePopup };

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

// Zip mínimo (deflate, sem criptografia nem zip64): o suficiente para a loja.
function zip(entries) {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const entries = listFiles(source)
  .map((path) => ({ path, name: relative(source, path).split('\\').join('/') }))
  .filter(({ name }) => !SKIP.has(name) && !SKIP_DIRS.some((prefix) => name.startsWith(prefix)))
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(({ path, name }) => {
    const transform = TRANSFORMS[name];
    return { name, data: transform ? Buffer.from(transform(readFileSync(path, 'utf8')), 'utf8') : readFileSync(path) };
  });

const { version } = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
mkdirSync(output, { recursive: true });
const file = join(output, `lume-leitor-de-curso-${version}.zip`);
writeFileSync(file, zip(entries));
console.log(`${relative(root, file)}: ${entries.length} arquivos (${entries.map((entry) => entry.name).join(', ')})`);
