import { useRef, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { PersonAvatar } from '../../ui/ui.jsx';
import { api } from '../../lib/api.js';
import { useResource } from '../../lib/resources.js';

const KIND_ICON = { friend: 'users', collaboration: 'steps', comment: 'message', reaction: 'heart', news: 'spark' };

function ago(at, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - Date.parse(at)) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ontem' : `há ${days} dias`;
}

// Sino do cabeçalho: abre a lista de avisos e marca tudo como visto. Os itens
// que chegaram antes de abrir continuam destacados até fechar o painel.
export default function NotificationBell({ account, positionFallback }) {
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const resource = useResource('/api/notifications', { interval: 60000, enabled: Boolean(account) });
  const [highlight, setHighlight] = useState(null);
  const items = resource.data?.items || [];
  const unseen = Number(resource.data?.unseen) || 0;

  async function onToggle(event) {
    if (event.newState !== 'open') { setHighlight(null); return; }
    positionFallback?.(popoverRef.current, triggerRef.current);
    setHighlight(new Set(items.filter((item) => item.unread).map((item) => item.id)));
    if (!unseen) return;
    const result = await api('/api/notifications/seen', { method: 'POST', body: {} });
    if (result.ok) resource.mutate((data) => data && { ...data, unseen: 0, items: data.items.map((item) => ({ ...item, unread: false })) });
  }

  const close = () => { try { popoverRef.current?.hidePopover?.(); } catch {} };
  const fresh = highlight || new Set(items.filter((item) => item.unread).map((item) => item.id));

  if (!account) return null;
  return <>
    <button type="button" ref={triggerRef} popoverTarget="notifications-popover" className="header-icon" aria-label={unseen > 0 ? `Notificações (${unseen} novas)` : 'Notificações'} title="Notificações">
      <Icon name="bell"/>{unseen > 0 && <span className="header-count" aria-hidden="true">{unseen > 9 ? '9+' : unseen}</span>}
    </button>
    <div id="notifications-popover" ref={popoverRef} popover="auto" className="shell-popover notifications-popover anchored-overlay" onToggle={onToggle} aria-label="Notificações">
      <div className="shell-popover-head"><strong>Notificações</strong><small>Amizades, convites, interações e novidades do Lume</small></div>
      {resource.error && !items.length
        ? <p className="notifications-empty">Não foi possível carregar as notificações.</p>
        : !items.length
          ? <p className="notifications-empty">{resource.data ? 'Nada novo por aqui.' : 'Carregando…'}</p>
          : <ul className="notifications-list">{items.map((item) => <li key={item.id}>
            <a className={`notification-item ${fresh.has(item.id) ? 'is-new' : ''}`} href={item.href || '#hoje'} onClick={close}>
              {item.person
                ? <PersonAvatar person={item.person} className="social-avatar notification-avatar"/>
                : <span className="notification-avatar notification-icon" aria-hidden="true"><Icon name={KIND_ICON[item.kind] || 'bell'}/></span>}
              <span className="notification-copy">
                <strong>{item.title}</strong>
                {item.body && <span>{item.body}</span>}
                <small>{ago(item.at)}{fresh.has(item.id) && <span className="sr-only"> · nova</span>}</small>
              </span>
            </a>
          </li>)}</ul>}
    </div>
  </>;
}
