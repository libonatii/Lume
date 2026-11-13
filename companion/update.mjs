// Atualização do Lume Companion sem reinstalação manual.
//
// A verificação usa a API pública de releases do GitHub e nada é baixado sem a
// pessoa clicar. No Windows, o instalador é o mesmo NSIS gerado pelo workflow
// de release; no Linux, baixa o pacote `.AppImage` ou `.deb` conforme o sistema.
// A configuração fica em %APPDATA%\Lume\companion.json (Windows) ou
// ~/.config/Lume/companion.json (Linux) e é preservada ao atualizar.

import { createWriteStream, existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const REPO = 'libonatii/Lume';
export const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=20`;
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
export const TAG_PREFIX = 'companion-v';
export const INSTALLER_NAME = 'Lume-setup.exe';
export const LINUX_APPIMAGE_NAME = 'Lume.AppImage';
export const LINUX_DEB_NAME = 'Lume.deb';
// Releases antigas publicaram o instalador com o nome do Companion. Continuam
// aceitas para que quem está nelas consiga atualizar.
export const LEGACY_INSTALLER_NAMES = ['Lume-Companion-setup.exe'];
const TRUSTED_HOSTS = new Set([
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);

export function compareVersions(left, right) {
  const parse = (value) => String(value ?? '')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

export function isNewer(candidate, current) {
  return compareVersions(candidate, current) > 0;
}

export function isTrustedUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && TRUSTED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function detectLinuxPackageType({ env = process.env, exists = existsSync } = {}) {
  if (env?.APPIMAGE) return 'appimage';
  if (exists('/etc/debian_version') || exists('/usr/bin/dpkg')) return 'deb';
  return 'appimage';
}

export function assetCandidates({ platform = process.platform, packageType, env = process.env, exists = existsSync } = {}) {
  if (platform === 'win32') return [INSTALLER_NAME, ...LEGACY_INSTALLER_NAMES];
  if (platform === 'linux') {
    const kind = packageType || detectLinuxPackageType({ env, exists });
    if (kind === 'deb') return [LINUX_DEB_NAME, LINUX_APPIMAGE_NAME];
    return [LINUX_APPIMAGE_NAME];
  }
  return [];
}

function selectReleaseAsset(assets, options) {
  const list = Array.isArray(assets) ? assets : [];
  for (const name of assetCandidates(options)) {
    const match = list.find((item) => item?.name === name);
    if (match) return match;
  }
  return null;
}

// Recebe a resposta da API de releases e escolhe a versão mais alta do Companion
// que tem instalador publicado para a plataforma atual.
export function parseRelease(payload, options = {}) {
  if (!Array.isArray(payload)) return null;
  const candidates = payload
    .filter((release) => release && !release.draft && !release.prerelease)
    .filter((release) => typeof release.tag_name === 'string' && release.tag_name.startsWith(TAG_PREFIX))
    .map((release) => {
      const version = release.tag_name.slice(TAG_PREFIX.length);
      const asset = selectReleaseAsset(release.assets, options);
      return {
        version,
        assetName: asset?.name || '',
        installerUrl: asset?.browser_download_url || '',
        size: Number(asset?.size) || 0,
        notes: typeof release.body === 'string' ? release.body : '',
        page: typeof release.html_url === 'string' ? release.html_url : RELEASES_PAGE,
        publishedAt: release.published_at || '',
      };
    })
    .filter((release) => release.version && isTrustedUrl(release.installerUrl))
    .sort((a, b) => compareVersions(b.version, a.version));
  return candidates[0] ?? null;
}

export async function checkForUpdate({ current, fetchImpl = fetch, apiUrl = RELEASES_API, platform = process.platform, packageType } = {}) {
  const response = await fetchImpl(apiUrl, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lume-Companion' },
  });
  if (!response.ok) throw new Error(`A verificação falhou (HTTP ${response.status}).`);
  const release = parseRelease(await response.json(), { platform, packageType });
  if (!release) return { available: false, current, latest: null };
  return {
    available: isNewer(release.version, current),
    current,
    latest: release.version,
    assetName: release.assetName,
    installerUrl: release.installerUrl,
    size: release.size,
    notes: release.notes,
    page: release.page,
  };
}

export function installerFilename(version, { assetName = '', url = '' } = {}) {
  const safeVersion = String(version || 'nova').replace(/[^0-9A-Za-z.-]/g, '') || 'nova';
  let sourceName = String(assetName || '').trim();
  if (!sourceName && url) {
    try {
      sourceName = new URL(url).pathname.split('/').pop() || '';
    } catch {
      sourceName = '';
    }
  }
  if (/\.AppImage$/i.test(sourceName)) return `Lume-${safeVersion}.AppImage`;
  if (/\.deb$/i.test(sourceName)) return `Lume-${safeVersion}.deb`;
  return `Lume-Companion-setup-${safeVersion}.exe`;
}

// Baixa o instalador para uma pasta local e devolve o caminho do arquivo.
export async function downloadInstaller({ url, version, assetName = '', destDir = '', fetchImpl = fetch, onProgress = () => {} }) {
  if (!isTrustedUrl(url)) throw new Error('Endereço de download não confiável.');
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'Lume-Companion' }, redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`O download falhou (HTTP ${response.status}).`);
  // Redirecionamentos também precisam terminar em endereço confiável.
  if (response.url && !isTrustedUrl(response.url)) throw new Error('O download terminou em um endereço não confiável.');

  const total = Number(response.headers.get('content-length')) || 0;
  const filename = installerFilename(version, { assetName, url });
  const createdTemp = !destDir;
  const folder = destDir || await mkdtemp(join(tmpdir(), 'lume-update-'));
  if (destDir) await mkdir(destDir, { recursive: true });
  const file = join(folder, filename);

  let received = 0;
  const source = Readable.fromWeb(response.body);
  source.on('data', (chunk) => {
    received += chunk.length;
    onProgress(total ? Math.min(100, Math.round((received / total) * 100)) : null);
  });

  try {
    await pipeline(source, createWriteStream(file));
    if (/\.AppImage$/i.test(filename)) await chmod(file, 0o755);
  } catch (error) {
    if (createdTemp) await rm(folder, { recursive: true, force: true }).catch(() => {});
    else await rm(file, { force: true }).catch(() => {});
    throw error;
  }
  return file;
}
