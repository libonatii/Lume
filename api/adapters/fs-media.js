// Armazenamento de imagens em diretório local, com a interface do adaptador R2
// de media.js (put, get, delete, listKeys).

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function fsMediaBucket(root) {
  mkdirSync(root, { recursive: true });
  const pathFor = (key) => join(root, ...key.split('/'));
  return {
    async put(key, bytes) {
      const target = pathFor(key);
      mkdirSync(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    },
    async get(key) {
      const target = pathFor(key);
      if (!existsSync(target)) return null;
      return { body: await readFile(target), contentType: null, etag: null };
    },
    async delete(key) {
      await rm(pathFor(key), { force: true });
    },
    async listKeys(prefix) {
      const parts = prefix.split('/');
      const filenamePrefix = parts.pop() || '';
      const folder = join(root, ...parts);
      if (!existsSync(folder)) return [];
      const folderKey = parts.join('/');
      return readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.startsWith(filenamePrefix))
        .map((entry) => `${folderKey}/${entry.name}`);
    },
  };
}
