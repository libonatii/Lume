import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { applyMigrations, sqliteAdapter } from '../../api/adapters/sqlite.js';
import { readConfig } from '../../api/config.js';
import { uploadPdf } from '../../api/domain/library-files.js';
import { createSocialPost } from '../../api/domain/social-feed.js';
import { applyLibraryActions } from '../../api/domain/library-actions.js';
import { readLibrary } from '../../api/domain/library-store.js';
import {
  deleteStorageItem,
  listCreatorStorageAccounts,
  setAccountStorageTier,
  storageOverview,
} from '../../api/domain/storage.js';
import { STORAGE_TIER_MAP, addPdfMaterial } from '../../public/pdf-domain.js';

const PDF_BYTES = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'.padEnd(256, ' '));
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

function fixture(t) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  applyMigrations(sql, fileURLToPath(new URL('../../migrations/', import.meta.url)));
  sql.prepare('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)')
    .run('creator-1', 'Criadora', 'criadora@lume.test', 'x', '2026-11-14T10:00:00Z');
  sql.prepare('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)')
    .run('ana-1', 'Ana Costa', 'ana@lume.test', 'x', '2026-11-14T10:00:00Z');
  sql.prepare('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)')
    .run('bia-1', 'Bia Lima', 'bia@lume.test', 'x', '2026-11-14T10:00:00Z');
  const objects = new Map();
  const bucket = {
    async put(key, bytes) { objects.set(key, bytes); },
    async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; },
    async delete(key) { objects.delete(key); },
  };
  const config = readConfig({ LUME_CREATOR_EMAIL: 'criadora@lume.test' });
  const creator = { id: 'creator-1', name: 'Criadora', email: 'criadora@lume.test' };
  const ana = { id: 'ana-1', name: 'Ana Costa', email: 'ana@lume.test' };
  return { db: sqliteAdapter(sql), sql, bucket, objects, config, creator, ana };
}

test('faixa padrão é 10 MB, criadora tem 1 GB e uso soma Biblioteca + Social segmentado', async (t) => {
  const { db, bucket, objects, config, creator, ana } = fixture(t);

  const creatorOverview = await storageOverview(db, bucket, creator.id, config);
  assert.equal(creatorOverview.plan, 'creator');
  assert.equal(creatorOverview.accountBytes, STORAGE_TIER_MAP.creator.accountBytes);

  await uploadPdf(db, bucket, ana.id, { fileId: 'pdf-file-001', name: 'Apostila.pdf', bytes: PDF_BYTES, config });
  const lib = await readLibrary(db, ana.id);
  const next = addPdfMaterial(lib.state, {
    title: 'Apostila de Redes',
    file: { fileId: 'pdf-file-001', name: 'Apostila.pdf', size: PDF_BYTES.byteLength, pages: 10, outline: [] },
  }, 'mat-pdf-1');
  await applyLibraryActions(db, ana.id, {
    id: 'op-1',
    revision: lib.revision,
    actions: [{ type: 'material.put', value: next.courses[0] }],
  }, { media: bucket });

  await createSocialPost(db, bucket, ana.id, { id: 'post-img-1', body: 'Resumo' }, { name: 'mapa.png', bytes: PNG_BYTES }, Date.now(), config);

  const overview = await storageOverview(db, bucket, ana.id, config);
  assert.equal(overview.plan, 'starter');
  assert.equal(overview.accountBytes, STORAGE_TIER_MAP.starter.accountBytes);
  assert.equal(overview.breakdown.libraryBytes, PDF_BYTES.byteLength);
  assert.equal(overview.breakdown.socialBytes, PNG_BYTES.byteLength);
  assert.equal(overview.used, PDF_BYTES.byteLength + PNG_BYTES.byteLength);
  assert.equal(overview.items.length, 2);

  // Excluir PDF remove o material da biblioteca e libera o objeto.
  const afterPdfDelete = await deleteStorageItem(db, bucket, ana.id, 'library', 'pdf-file-001', config);
  assert.equal(afterPdfDelete.libraryUpdated, true);
  assert.equal((await readLibrary(db, ana.id)).state.courses.length, 0);
  assert.equal(objects.has('pdfs/ana-1/pdf-file-001.pdf'), false);
  assert.equal(afterPdfDelete.storage.breakdown.libraryBytes, 0);
  assert.equal(afterPdfDelete.storage.breakdown.socialBytes, PNG_BYTES.byteLength);

  // Excluir anexo do Social remove a publicação e zera o armazenamento.
  const afterSocialDelete = await deleteStorageItem(db, bucket, ana.id, 'social', 'post-img-1', config);
  assert.equal(afterSocialDelete.storage.used, 0);
  assert.equal(objects.size, 0);
});

test('controle da criadora ajusta cotas sem ID manual e redução bloqueia novos uploads sem apagar arquivos', async (t) => {
  const { db, sql, bucket, config, creator, ana } = fixture(t);

  await assert.rejects(
    () => listCreatorStorageAccounts(db, config, ana),
    { code: 'forbidden' },
  );
  await assert.rejects(
    () => setAccountStorageTier(db, config, ana, 'bia-1', 'basic'),
    { code: 'forbidden' },
  );

  // Criadora amplia Ana para 50 MB, simula 15 MB ocupados, e depois reduz para 10 MB.
  const upgraded = await setAccountStorageTier(db, config, creator, ana.id, 'basic');
  assert.equal(upgraded.plan, 'basic');
  assert.equal(upgraded.accountBytes, STORAGE_TIER_MAP.basic.accountBytes);

  sql.prepare('INSERT INTO library_files (user_id,id,size,name,created_at,status) VALUES (?,?,?,?,?,?)')
    .run(ana.id, 'grande-001', 15 * 1024 * 1024, 'Grande.pdf', new Date().toISOString(), 'ready');

  await setAccountStorageTier(db, config, creator, ana.id, 'starter');

  const over = await storageOverview(db, bucket, ana.id, config);
  assert.equal(over.plan, 'starter');
  assert.equal(over.overLimit, true);
  assert.equal(over.items.length, 1);

  // Novo upload de PDF e novo anexo no Social são bloqueados, mas o arquivo existente permanece.
  await assert.rejects(
    () => uploadPdf(db, bucket, ana.id, { fileId: 'novo-pdf-002', name: 'Novo.pdf', bytes: PDF_BYTES, config }),
    { code: 'storage_full' },
  );
  await assert.rejects(
    () => createSocialPost(db, bucket, ana.id, { id: 'post-2', body: 'Foto' }, { name: 'foto.png', bytes: PNG_BYTES }, Date.now(), config),
    { code: 'post_not_reserved' },
  );

  // Criadora filtra contas acima do limite e busca por nome/e-mail.
  const overList = await listCreatorStorageAccounts(db, config, creator, { q: 'ana', filter: 'over' });
  assert.equal(overList.accounts.length, 1);
  assert.equal(overList.accounts[0].id, ana.id);
  assert.equal(overList.counts.over, 1);
});
