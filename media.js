// Armazenamento de imagens de perfil (avatar e header) em objeto binário (Cloudflare R2
// em produção via env.MEDIA e diretório local data/media/ no servidor Node).
// Nunca armazena base64 no estado sincronizado.

import { AppError } from './api/errors.js';

export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
export const VALID_MEDIA_SLOTS = new Set(['avatar', 'header']);
export const MAX_SLIDE_IMAGE_LENGTH = 256;

export function validateSlideId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) {
    throw new MediaError('Identificador de slide inválido.', 400, 'invalid_slide');
  }
  return value;
}

export function validateCourseId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(value)) {
    throw new MediaError('Identificador de material inválido.', 400, 'invalid_course');
  }
  return value;
}

export function sanitizeSlideImage(value) {
  if (typeof value !== 'string' || value.length > MAX_SLIDE_IMAGE_LENGTH) return '';
  return /^\/api\/media\/slides\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,120}\/[A-Za-z0-9_-]{1,80}-[0-9]{1,20}\.(?:webp|png|jpg|gif)$/.test(value) ? value : '';
}

export function buildSlideKey(ownerId, courseId, slideId, ext, now = Date.now()) {
  const cleanOwner = validateOwnerId(ownerId);
  const cleanCourse = validateCourseId(courseId);
  const cleanSlide = validateSlideId(slideId);
  if (!['webp', 'png', 'jpg', 'gif'].includes(ext)) {
    throw new MediaError('Extensão de imagem inválida.', 400, 'invalid_ext');
  }
  const stamp = Math.max(1, Math.trunc(Number(now) || Date.now()));
  return `slides/${cleanOwner}/${cleanCourse}/${cleanSlide}-${stamp}.${ext}`;
}

export class MediaError extends AppError {
  constructor(message, status = 400, code = 'media_error') {
    super(message, code, status);
    this.name = 'MediaError';
  }
}

export function detectImageType(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (view.byteLength < 12) {
    throw new MediaError('O arquivo enviado é pequeno demais ou está corrompido.', 400, 'invalid_image');
  }
  if (view.byteLength > MAX_MEDIA_BYTES) {
    throw new MediaError('A imagem ultrapassa o limite de 2 MB.', 413, 'image_too_large');
  }
  // WebP: RIFF....WEBP
  if (
    view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 &&
    view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50
  ) {
    return { contentType: 'image/webp', ext: 'webp' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47 &&
    view[4] === 0x0D && view[5] === 0x0A && view[6] === 0x1A && view[7] === 0x0A
  ) {
    return { contentType: 'image/png', ext: 'png' };
  }
  // JPEG: FF D8 FF
  if (view[0] === 0xFF && view[1] === 0xD8 && view[2] === 0xFF) {
    return { contentType: 'image/jpeg', ext: 'jpg' };
  }
  // GIF: GIF87a ou GIF89a
  if (
    view[0] === 0x47 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x38 &&
    (view[4] === 0x37 || view[4] === 0x39) && view[5] === 0x61
  ) {
    return { contentType: 'image/gif', ext: 'gif' };
  }
  throw new MediaError('Formato não suportado. Use PNG, JPG, WebP ou GIF.', 400, 'unsupported_format');
}

export function validateOwnerId(ownerId) {
  if (typeof ownerId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ownerId)) {
    throw new MediaError('Identificador de perfil inválido.', 400, 'invalid_owner');
  }
  return ownerId;
}

export function validateSlot(slot) {
  if (!VALID_MEDIA_SLOTS.has(slot)) {
    throw new MediaError('Tipo de imagem inválido. Use avatar ou header.', 400, 'invalid_slot');
  }
  return slot;
}

export function buildMediaKey(ownerId, slot, ext, now = Date.now()) {
  const cleanOwner = validateOwnerId(ownerId);
  const cleanSlot = validateSlot(slot);
  if (!['webp', 'png', 'jpg', 'gif'].includes(ext)) {
    throw new MediaError('Extensão de imagem inválida.', 400, 'invalid_ext');
  }
  const stamp = Math.max(1, Math.trunc(Number(now) || Date.now()));
  return `profiles/${cleanOwner}/${cleanSlot}-${stamp}.${ext}`;
}

export function parseMediaKeyFromPath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/api/media/')) return null;
  const key = pathname.slice('/api/media/'.length);
  const slide = /^slides\/([A-Za-z0-9_-]{1,64})\/([A-Za-z0-9_-]{1,120})\/([A-Za-z0-9_-]{1,80})-([0-9]{1,20})\.(webp|png|jpg|gif)$/.exec(key);
  if (slide) {
    const ext = slide[5];
    return {
      key, ownerId: slide[1], courseId: slide[2], slideId: slide[3], ext,
      contentType: ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : 'image/gif',
      kind: 'slide',
    };
  }
  const match = /^profiles\/([A-Za-z0-9_-]{1,64})\/(avatar|header)-([0-9]{1,20})\.(webp|png|jpg|gif)$/.exec(key);
  if (!match) return null;
  const ext = match[4];
  const contentType = ext === 'webp'
    ? 'image/webp'
    : ext === 'png'
      ? 'image/png'
      : ext === 'jpg'
        ? 'image/jpeg'
        : 'image/gif';
  return { key, ownerId: match[1], slot: match[2], ext, contentType };
}

export async function uploadProfileObject(bucket, { ownerId, slot, bytes, now = Date.now() }) {
  if (!bucket) {
    throw new MediaError('Armazenamento de mídia R2 não configurado.', 503, 'r2_unavailable');
  }
  const cleanOwner = validateOwnerId(ownerId);
  const cleanSlot = validateSlot(slot);
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const { contentType, ext } = detectImageType(view);
  const key = buildMediaKey(cleanOwner, cleanSlot, ext, now);
  const prefix = `profiles/${cleanOwner}/${cleanSlot}-`;

  // Remove imagens anteriores do mesmo slot para não acumular arquivos órfãos no R2.
  const existingKeys = await bucket.listKeys(prefix);
  await bucket.put(key, view, contentType);
  for (const oldKey of existingKeys) {
    if (oldKey !== key) {
      await bucket.delete(oldKey).catch(() => {});
    }
  }

  return {
    key,
    slot: cleanSlot,
    url: `/api/media/${key}`,
    contentType,
    size: view.byteLength,
  };
}

export async function deleteProfileObject(bucket, { ownerId, slot }) {
  if (!bucket) {
    throw new MediaError('Armazenamento de mídia R2 não configurado.', 503, 'r2_unavailable');
  }
  const cleanOwner = validateOwnerId(ownerId);
  const cleanSlot = validateSlot(slot);
  const prefix = `profiles/${cleanOwner}/${cleanSlot}-`;
  const existingKeys = await bucket.listKeys(prefix);
  for (const oldKey of existingKeys) {
    await bucket.delete(oldKey).catch(() => {});
  }
  return { deleted: existingKeys.length, slot: cleanSlot };
}

export async function uploadSlideObject(bucket, { ownerId, courseId, slideId, bytes, now = Date.now() }) {
  if (!bucket) {
    throw new MediaError('Armazenamento de mídia R2 não configurado.', 503, 'r2_unavailable');
  }
  const cleanOwner = validateOwnerId(ownerId);
  const cleanCourse = validateCourseId(courseId);
  const cleanSlide = validateSlideId(slideId);
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const { contentType, ext } = detectImageType(view);
  const key = buildSlideKey(cleanOwner, cleanCourse, cleanSlide, ext, now);
  const prefix = `slides/${cleanOwner}/${cleanCourse}/${cleanSlide}-`;
  const existingKeys = await bucket.listKeys(prefix);
  await bucket.put(key, view, contentType);
  for (const oldKey of existingKeys) {
    if (oldKey !== key) await bucket.delete(oldKey).catch(() => {});
  }
  return {
    key,
    courseId: cleanCourse,
    slideId: cleanSlide,
    url: `/api/media/${key}`,
    contentType,
    size: view.byteLength,
  };
}

export async function deleteSlideObject(bucket, { ownerId, courseId, slideId }) {
  if (!bucket) {
    throw new MediaError('Armazenamento de mídia R2 não configurado.', 503, 'r2_unavailable');
  }
  const cleanOwner = validateOwnerId(ownerId);
  const cleanCourse = validateCourseId(courseId);
  const cleanSlide = validateSlideId(slideId);
  const prefix = `slides/${cleanOwner}/${cleanCourse}/${cleanSlide}-`;
  const existingKeys = await bucket.listKeys(prefix);
  for (const oldKey of existingKeys) {
    await bucket.delete(oldKey).catch(() => {});
  }
  return { deleted: existingKeys.length, courseId: cleanCourse, slideId: cleanSlide };
}

export function r2BucketAdapter(r2) {
  if (!r2) return null;
  return {
    async put(key, bytes, contentType) {
      await r2.put(key, bytes, { httpMetadata: { contentType } });
    },
    async get(key) {
      const object = await r2.get(key);
      if (!object) return null;
      return {
        body: object.body,
        contentType: object.httpMetadata?.contentType || null,
        etag: object.httpEtag || null,
      };
    },
    async delete(key) {
      await r2.delete(key);
    },
    async listKeys(prefix) {
      const listed = await r2.list({ prefix });
      return (listed?.objects || []).map(item => item.key);
    },
  };
}
