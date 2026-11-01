// Fotos de perfil antigas eram guardadas em base64 dentro do estado. Na
// entrada, elas são enviadas uma vez ao armazenamento de imagens e o estado
// passa a guardar só o endereço.

export function readLegacyBase64Profile(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    const found = {};
    for (const slot of ['avatar', 'header']) {
      const value = parsed?.profile?.[slot];
      if (typeof value === 'string' && value.startsWith('data:image/')) found[slot] = value;
    }
    return found;
  } catch {
    return {};
  }
}

export async function uploadLegacyProfileMedia(pending, setState) {
  for (const [slot, dataUrl] of Object.entries(pending || {})) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const response = await fetch(`/api/profile/media/${encodeURIComponent(slot)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': blob.type || 'image/webp' },
        body: blob,
      });
      const uploaded = await response.json();
      if (response.ok && uploaded?.url) {
        setState((previous) => ({ ...previous, profile: { ...previous.profile, [slot]: uploaded.url } }));
      }
    } catch { /* Se falhar, a pessoa pode reenviar pelo perfil. */ }
  }
}
