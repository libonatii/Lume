// Limites compartilhados do feed entre amigos. Publicar e interagir não gera XP.
export const SOCIAL_POST_LIMIT = 2000;
export const SOCIAL_COMMENT_LIMIT = 1000;
export const SOCIAL_IMAGE_BYTES = 2 * 1024 * 1024;
export const SOCIAL_PDF_BYTES = 10 * 1024 * 1024;
export const SOCIAL_STORAGE_BYTES = 100 * 1024 * 1024;
export const SOCIAL_PAGE_SIZE = 20;

export function socialText(value) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim() : '';
}

export function socialFileName(value) {
  return String(value || 'anexo').replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim().slice(0, 160) || 'anexo';
}

export const MESSAGE_ALERT_PREVIEW = 90;

// Aviso de mensagem nova: a conversa mais recente com mensagem não lida vinda
// da amizade, que ainda não foi avisada. Fica em silêncio com as notificações
// de mensagens desligadas ou quando a conversa dessa pessoa já está aberta.
export function messageAlert(conversations, { seen = new Set(), openContactId = '', notifications = true } = {}) {
  if (!notifications || !Array.isArray(conversations)) return null;
  const candidate = conversations
    .filter((item) => item?.unread > 0 && item.lastMessage && !item.lastMessage.fromMe && !seen.has(item.lastMessage.id))
    .sort((left, right) => String(right.lastMessage.at || '').localeCompare(String(left.lastMessage.at || '')))[0];
  if (!candidate || candidate.id === openContactId) return null;
  const text = socialText(candidate.lastMessage.preview).replace(/\s+/g, ' ');
  return {
    messageId: candidate.lastMessage.id,
    from: { id: candidate.id, name: candidate.name, avatar: candidate.avatar || '' },
    preview: text.length > MESSAGE_ALERT_PREVIEW ? `${text.slice(0, MESSAGE_ALERT_PREVIEW).trimEnd()}…` : text,
  };
}
