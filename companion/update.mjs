// Atualização do Lume Companion sem reinstalação manual.
//
// A verificação usa a API pública de releases do GitHub e nada é baixado sem a
// pessoa clicar. O instalador é o mesmo NSIS gerado pelo workflow de release:
// atualizar por ele mantém a conta pareada, porque a configuração fica em
// %APPDATA%\Lume\companion.json. O arquivo ainda não tem assinatura digital, então
// o Windows pode pedir confirmação ao executá-lo.

import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const REPO = 'libonatii/Lume';
export const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=20`;
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
export const TAG_PREFIX = 'companion-v';
export const INSTALLER_NAME = 'Lume-setup.exe';
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

// Recebe a resposta da API de releases e escolhe a versão mais alta do Companion
// que tem instalador publicado.
export function parseRelease(payload) {
  if (!Array.isArray(payload)) return null;
  const candidates = payload
    .filter((release) => release && !release.draft && !release.prerelease)
    .filter((release) => typeof release.tag_name === 'string' && release.tag_name.startsWith(TAG_PREFIX))
    .map((release) => {
      const version = release.tag_name.slice(TAG_PREFIX.length);
      const asset = (release.assets || []).find((item) => item?.name === INSTALLER_NAME)
        || (release.assets || []).find((item) => LEGACY_INSTALLER_NAMES.includes(item?.name));
      return {
        version,
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

export async function checkForUpdate({ current, fetchImpl = fetch, apiUrl = RELEASES_API } = {}) {
  const response = await fetchImpl(apiUrl, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lume-Companion' },
  });
  if (!response.ok) throw new Error(`A verificação falhou (HTTP ${response.status}).`);
  const release = parseRelease(await response.json());
  if (!release) return { available: false, current, latest: null };
  return {
    available: isNewer(release.version, current),
    current,
    latest: release.version,
    installerUrl: release.installerUrl,
    size: release.size,
    notes: release.notes,
    page: release.page,
  };
}

// Baixa o instalador para uma pasta temporária e devolve o caminho do arquivo.
export async function downloadInstaller({ url, version, fetchImpl = fetch, onProgress = () => {} }) {
  if (!isTrustedUrl(url)) throw new Error('Endereço de download não confiável.');
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'Lume-Companion' }, redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`O download falhou (HTTP ${response.status}).`);
  // Redirecionamentos também precisam terminar em endereço confiável.
  if (response.url && !isTrustedUrl(response.url)) throw new Error('O download terminou em um endereço não confiável.');

  const total = Number(response.headers.get('content-length')) || 0;
  const folder = await mkdtemp(join(tmpdir(), 'lume-update-'));
  const file = join(folder, `Lume-Companion-setup-${String(version || 'nova').replace(/[^0-9A-Za-z.-]/g, '')}.exe`);

  let received = 0;
  const source = Readable.fromWeb(response.body);
  source.on('data', (chunk) => {
    received += chunk.length;
    onProgress(total ? Math.min(100, Math.round((received / total) * 100)) : null);
  });

  try {
    await pipeline(source, createWriteStream(file));
  } catch (error) {
    await rm(folder, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  return file;
}
