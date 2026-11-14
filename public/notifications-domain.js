// Sino de notificações: amizades novas, convites de colaboração, interações nas
// suas publicações e novidades do Lume. Notificação é aviso, nunca recompensa:
// ler ou abrir não gera XP.

import { GENERATED_NEWS } from './news-generated.js';

export const NOTIFICATION_WINDOW_DAYS = 30;
export const NOTIFICATION_LIMIT = 30;

// Novidades do produto, da mais recente para a mais antiga. Uma linha por
// mudança visível; o id é estável para não repetir o aviso.
const MANUAL_NEWS = [
  { id: 'news-2026-11-14-norte', at: '2026-11-14T15:00:00.000Z', title: 'Novo visual do Lume', body: 'Início, biblioteca, plano, amigos e perfil foram redesenhados, com a estrela dourada e fundo escuro.', href: '#hoje' },
  { id: 'news-2026-11-13-mensagens', at: '2026-11-13T18:00:00.000Z', title: 'Mensagens em tempo real', body: 'Conversas com amigos chegam na hora, com som de aviso e tela nova.', href: '#amigos' },
  { id: 'news-2026-11-13-sino', at: '2026-11-13T03:00:00.000Z', title: 'Notificações no sino', body: 'Amizades novas, convites e comentários agora aparecem aqui.', href: '#amigos' },
  { id: 'news-2026-11-12-social', at: '2026-11-12T12:00:00.000Z', title: 'Feed entre amigos', body: 'Compartilhe aprendizados, dúvidas e conquistas com suas amizades.', href: '#amigos' },
  { id: 'news-2026-11-11-pdf', at: '2026-11-11T12:00:00.000Z', title: 'PDFs e disciplinas', body: 'Anexe PDFs à biblioteca e organize materiais por disciplina.', href: '#biblioteca' },
];

export const LUME_NEWS = [...GENERATED_NEWS, ...MANUAL_NEWS];

// Junta, ordena e marca como novo o que chegou depois do último "visto".
// Sem marco de leitura, só conta o que chegou depois da criação da conta.
export function notificationFeed(items, { seenAt = null, since = null, now = Date.now() } = {}) {
  const floor = now - NOTIFICATION_WINDOW_DAYS * 86400000;
  const mark = Date.parse(seenAt || since || '') || 0;
  const list = items
    .filter((item) => item && Number.isFinite(Date.parse(item.at)) && Date.parse(item.at) >= floor && Date.parse(item.at) <= now + 60000)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || String(a.id).localeCompare(String(b.id)))
    .slice(0, NOTIFICATION_LIMIT)
    .map((item) => ({ ...item, unread: Date.parse(item.at) > mark }));
  return { items: list, unseen: list.filter((item) => item.unread).length, seenAt };
}
