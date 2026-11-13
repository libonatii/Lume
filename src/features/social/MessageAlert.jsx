import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { refreshResource, useResource } from '../../lib/resources.js';
import { messageAlert } from '../../../public/social-domain.js';
import { parseHash } from '../../app/routes.jsx';
import Icon from '../../ui/Icon.jsx';
import { PersonAvatar, ease } from '../../ui/ui.jsx';

const ALERT_MS = 8000;

// Conversa aberta agora. A tela de Mensagens troca a conversa com replaceState,
// sem hashchange, então o endereço é lido na hora.
function openContactId() {
  const { requested, params } = parseHash(location.hash);
  return requested === 'mensagens' ? params.get('com') || '' : '';
}

// Aviso flutuante de mensagem direta nova. Usa o mesmo contador de não lidas do
// menu; quando ele sobe, relê as conversas (mesmo cache da tela de Mensagens)
// para saber quem escreveu. Mensagens já não lidas ao abrir o Lume não avisam.
export default function MessageAlert({ account, quiet = false }) {
  const unread = useResource('/api/messages/unread', { interval: 20000, enabled: Boolean(account) });
  const [alert, setAlert] = useState(null);
  const seen = useRef(new Set());
  const previous = useRef(null);
  const quietRef = useRef(quiet);
  quietRef.current = quiet;
  const timer = useRef(null);
  const count = account && unread.data ? Number(unread.data.unread) || 0 : null;
  const notifications = unread.data?.notifications !== false;

  useEffect(() => {
    seen.current = new Set();
    previous.current = null;
    setAlert(null);
    if (!account) return undefined;
    // Voltar à janela confere na hora, sem esperar o próximo intervalo.
    const check = () => { if (document.visibilityState !== 'hidden') refreshResource('/api/messages/unread'); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [account?.id]);

  useEffect(() => {
    if (count === null) return;
    const before = previous.current;
    previous.current = count;
    if (before === null || count <= before) return;
    let alive = true;
    refreshResource('/api/messages').then((result) => {
      if (!alive || !result?.ok) return;
      const conversations = result.data?.conversations || [];
      const next = messageAlert(conversations, { seen: seen.current, openContactId: openContactId(), notifications: notifications && !quietRef.current });
      // Tudo o que já está não lido conta como visto: um aviso por chegada, nunca repetido.
      for (const item of conversations) if (item.unread > 0 && item.lastMessage) seen.current.add(item.lastMessage.id);
      if (next) setAlert(next);
    });
    return () => { alive = false; };
  }, [count, notifications]);

  // Desligar as notificações ou abrir a conversa recolhe o aviso.
  useEffect(() => { if (!notifications) setAlert(null); }, [notifications]);
  useEffect(() => {
    if (!alert) return undefined;
    const close = () => { if (openContactId() === alert.from.id) setAlert(null); };
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [alert]);

  function schedule() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAlert(null), ALERT_MS);
  }
  useEffect(() => {
    if (alert) schedule();
    return () => clearTimeout(timer.current);
  }, [alert?.messageId]);

  return <div className="message-alert-region" role="status" aria-live="polite" aria-atomic="true">
    <AnimatePresence>{alert && <motion.div key={alert.messageId} className="message-alert" onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={schedule} onFocus={() => clearTimeout(timer.current)} onBlur={schedule} initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: .28, ease }}>
      <a className="message-alert-link" href={`#mensagens?com=${encodeURIComponent(alert.from.id)}`} onClick={() => setAlert(null)} aria-label={`Abrir conversa com ${alert.from.name}: ${alert.preview}`}>
        <PersonAvatar person={alert.from} className="social-avatar"/>
        <span className="message-alert-copy">
          <small><Icon name="mail"/>Nova mensagem</small>
          <strong>{alert.from.name}</strong>
          <span>{alert.preview}</span>
        </span>
      </a>
      <button type="button" className="icon-button" aria-label="Fechar aviso de mensagem" onClick={() => setAlert(null)}><Icon name="close"/></button>
    </motion.div>}</AnimatePresence>
  </div>;
}
