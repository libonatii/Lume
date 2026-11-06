import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';

export async function requestNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}
export function showNotification(item) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    // O fuso só aparece quando difere do dispositivo, em forma legível.
    const zone = item.timeZone && item.timeZone !== Intl.DateTimeFormat().resolvedOptions().timeZone ? ` (${item.timeZone.replaceAll('_', ' ')})` : '';
    const notification = new Notification('Lume · Agenda', { body: `${item.title} · ${item.start || 'Hoje'}${zone}`, tag: item.key });
    notification.onclick = () => { window.focus(); location.hash = `agenda?dia=${item.date}`; notification.close(); };
    return true;
  } catch { return false; }
}
export default function Reminders({ account, syncStatus }) {
  const [items, setItems] = useState([]);
  const status = useRef(syncStatus);
  status.current = syncStatus;
  useEffect(() => {
    setItems([]);
    if (!account) return undefined;
    let stopped = false, running = false;
    const controller = new AbortController();
    async function check() {
      if (stopped || running || status.current !== 'saved') return;
      running = true;
      try {
        const response = await api('/api/agenda/reminders', { method: 'POST', signal: controller.signal });
        if (stopped || !response.ok) return;
        const reminders = response.data.reminders || [];
        for (const item of reminders) showNotification(item);
        if (reminders.length) setItems((old) => [...old, ...reminders].slice(-20));
      } catch { /* A próxima consulta tenta novamente; nenhum aviso de sucesso fictício. */ }
      finally { running = false; }
    }
    check();
    const timer = setInterval(check, 15000);
    window.addEventListener('focus', check);
    return () => { stopped = true; controller.abort(); clearInterval(timer); window.removeEventListener('focus', check); };
  }, [account?.id]);
  if (!account || !items.length) return null;
  return <aside className="agenda-reminders card-surface" aria-label="Lembretes da Agenda" role="status">
    <strong>Lembretes da Agenda</strong>
    {items.map((item) => <div key={item.key}><a href={`#agenda?dia=${item.date}`}>{item.title} · {item.start || 'Sem horário'}</a><button className="text-button" aria-label={`Dispensar lembrete ${item.title}`} onClick={() => setItems((old) => old.filter((entry) => entry.key !== item.key))}>Dispensar</button></div>)}
  </aside>;
}
