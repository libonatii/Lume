// Processamento local da imagem; somente o resultado otimizado vai à API.
const canvasToBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

export async function prepareProfileImageBlob(file, { width, height }) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (PNG, JPG, WebP ou GIF).');
  if (file.size > 12 * 1024 * 1024) throw new Error('A imagem escolhida é muito pesada (máximo 12 MB).');
  if (file.type === 'image/gif' && file.size <= 2 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(width / (bitmap.width || width), height / (bitmap.height || height));
      const drawWidth = (bitmap.width || width) * scale;
      const drawHeight = (bitmap.height || height) * scale;
      ctx.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      for (const quality of [0.86, 0.74, 0.6]) {
        const webp = await canvasToBlob(canvas, 'image/webp', quality);
        if (webp && webp.size <= 2 * 1024 * 1024) return webp;
        const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (jpeg && jpeg.size <= 2 * 1024 * 1024) return jpeg;
      }
    } finally { bitmap.close?.(); }
  } catch {
    if (file.size <= 2 * 1024 * 1024) return file;
    throw new Error('Não foi possível processar esta imagem.');
  }
  throw new Error('A imagem ficou grande demais mesmo após otimizar. Tente outra imagem.');
}

export async function uploadProfileBlob(slot, blob) {
  const response = await fetch(`/api/profile/media/${encodeURIComponent(slot)}`, {
    method: 'PUT', credentials: 'same-origin',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.url) throw new Error(data?.error || 'Não foi possível enviar a imagem para o servidor.');
  return data.url;
}
