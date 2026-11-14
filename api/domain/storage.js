// Visão consolidada de armazenamento (Biblioteca + Social) e controle de cotas pela criadora.

import { AppError } from '../errors.js';
import { isCreator } from '../config.js';
import { isValidStorageTier, pdfPlan, storageStatus } from '../../public/pdf-domain.js';
import { discardPdf, removeOrphans, storageUsage, validateFileId } from './library-files.js';
import { applyLibraryActions } from './library-actions.js';
import { readLibrary } from './library-store.js';
import { deleteSocialPost } from './social-feed.js';

export class StorageError extends AppError {
  constructor(message, code = 'storage_error', status = 400) {
    super(message, code, status);
    this.name = 'StorageError';
  }
}

function requireCreator(actorUser, config) {
  if (!isCreator(actorUser, config)) {
    throw new StorageError('Apenas a criadora do site pode ajustar cotas de armazenamento.', 'forbidden', 403);
  }
}

function isCreatorEmail(email, config) {
  const clean = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return Boolean(clean && Array.isArray(config?.creatorEmails) && config.creatorEmails.includes(clean));
}

export async function storageOverview(db, bucket, userId, config = null) {
  if (bucket) {
    await removeOrphans(db, bucket, userId).catch(() => {});
  }
  const usage = await storageUsage(db, userId, config);
  const status = storageStatus(usage.used, usage.accountBytes);

  const [libRows, socialRows] = await Promise.all([
    db.all(`SELECT lf.id, lf.name, lf.size, lf.created_at, lf.status,
        m.id AS material_id, json_extract(m.data, '$.title') AS material_title,
        json_extract(m.data, '$.subjectId') AS subject_id
      FROM library_files lf
      LEFT JOIN materials m ON m.user_id = lf.user_id AND json_extract(m.data, '$.type') = 'pdf' AND json_extract(m.data, '$.pdf.fileId') = lf.id
      WHERE lf.user_id = ?`, [userId]),
    db.all(`SELECT id, body, kind, attachment_name, attachment_type, attachment_size, created_at
      FROM social_posts
      WHERE user_id = ? AND attachment_key IS NOT NULL AND attachment_size > 0`, [userId]),
  ]);

  const items = [
    ...libRows.map((row) => ({
      id: row.id,
      kind: 'library',
      name: row.material_title || row.name,
      fileName: row.name,
      size: Number(row.size || 0),
      createdAt: row.created_at,
      materialId: row.material_id || null,
      subjectId: row.subject_id || '',
      status: row.status || 'ready',
    })),
    ...socialRows.map((row) => ({
      id: row.id,
      kind: 'social',
      name: row.attachment_name || 'Anexo do Social',
      fileName: row.attachment_name || 'anexo',
      size: Number(row.attachment_size || 0),
      createdAt: row.created_at,
      postId: row.id,
      postKind: row.kind,
      mimeType: row.attachment_type || '',
    })),
  ].sort((a, b) => (b.size - a.size) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return {
    ...usage,
    ...status,
    items,
  };
}

export async function deleteStorageItem(db, bucket, userId, kind, itemId, config = null) {
  if (kind === 'social') {
    await deleteSocialPost(db, bucket, userId, itemId);
    return {
      removed: true,
      libraryUpdated: false,
      storage: await storageOverview(db, bucket, userId, config),
    };
  }
  if (kind === 'library') {
    const fileId = validateFileId(itemId);
    const mat = await db.first(
      "SELECT id FROM materials WHERE user_id=? AND json_extract(data, '$.type')='pdf' AND json_extract(data, '$.pdf.fileId') = ?",
      [userId, fileId],
    );
    if (mat?.id) {
      const current = await readLibrary(db, userId);
      await applyLibraryActions(db, userId, {
        id: crypto.randomUUID(),
        revision: current.revision,
        actions: [{ type: 'material.delete', id: mat.id }],
      }, { media: bucket });
    } else {
      await discardPdf(db, bucket, userId, fileId);
    }
    return {
      removed: true,
      libraryUpdated: Boolean(mat?.id),
      storage: await storageOverview(db, bucket, userId, config),
    };
  }
  throw new StorageError('Tipo de anexo inválido.', 'invalid_item_kind', 400);
}

export async function listCreatorStorageAccounts(db, config, actorUser, { q = '', filter = 'all' } = {}) {
  requireCreator(actorUser, config);
  const query = String(q || '').trim().toLowerCase();
  const where = query ? 'WHERE LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?' : '';
  const params = query ? [`%${query}%`, `%${query}%`] : [];
  const rows = await db.all(`SELECT u.id, u.name, u.email, u.created_at, sp.plan,
      COALESCE((SELECT SUM(lf.size) FROM library_files lf WHERE lf.user_id = u.id), 0) AS library_bytes,
      COALESCE((SELECT SUM(p.attachment_size) FROM social_posts p WHERE p.user_id = u.id AND p.attachment_key IS NOT NULL AND p.attachment_size > 0), 0) AS social_bytes
    FROM users u
    LEFT JOIN storage_plans sp ON sp.user_id = u.id
    ${where}
    ORDER BY (library_bytes + social_bytes) DESC, u.created_at DESC
    LIMIT 100`, params);

  const mapped = rows.map((row) => {
    const creator = isCreatorEmail(row.email, config);
    const tier = creator ? pdfPlan('creator') : pdfPlan(row.plan);
    const libraryBytes = Number(row.library_bytes || 0);
    const socialBytes = Number(row.social_bytes || 0);
    const usedBytes = libraryBytes + socialBytes;
    const status = storageStatus(usedBytes, tier.accountBytes);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      isCreator: creator,
      plan: tier.id,
      label: tier.label,
      accountBytes: tier.accountBytes,
      fileBytes: tier.fileBytes,
      libraryBytes,
      socialBytes,
      ...status,
    };
  });

  const counts = {
    all: mapped.length,
    near: mapped.filter((item) => item.nearLimit && !item.overLimit).length,
    over: mapped.filter((item) => item.overLimit).length,
  };

  const accounts = filter === 'near'
    ? mapped.filter((item) => item.nearLimit && !item.overLimit)
    : filter === 'over'
      ? mapped.filter((item) => item.overLimit)
      : mapped;

  return { accounts, counts };
}

export async function setAccountStorageTier(db, config, actorUser, targetUserId, tierId, now = Date.now()) {
  requireCreator(actorUser, config);
  if (!isValidStorageTier(tierId)) {
    throw new StorageError('Faixa de armazenamento inválida.', 'invalid_tier', 400);
  }
  const target = await db.first('SELECT id, email FROM users WHERE id=?', [String(targetUserId || '')]);
  if (!target) {
    throw new StorageError('Conta não encontrada.', 'user_not_found', 404);
  }
  const effectiveTierId = isCreatorEmail(target.email, config) ? 'creator' : tierId;
  const tier = pdfPlan(effectiveTierId);
  await db.run(`INSERT INTO storage_plans (user_id, plan, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan, updated_at=excluded.updated_at, updated_by=excluded.updated_by`,
  [target.id, tier.id, new Date(now).toISOString(), actorUser.id]);

  return {
    userId: target.id,
    plan: tier.id,
    label: tier.label,
    accountBytes: tier.accountBytes,
    fileBytes: tier.fileBytes,
  };
}
