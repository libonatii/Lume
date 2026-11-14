import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../../lib/api.js';
import { mutateResource, refreshResource, useResource } from '../../lib/resources.js';
import { messageAlert } from '../../../public/social-domain.js';
import { useRealtime, useRealtimeStatus } from '../../lib/realtime.js';
import { parseHash } from '../../app/routes.jsx';
import { playMessagePing } from '../progress/soundscape.js';
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
  useRealtime(account);
  const live = useRealtimeStatus();
  const unread = useResource('/api/messages/unread', { interval: live ? 60000 : 10000, enabled: Boolean(account) });
  const [alert, setAlert] = useState(null);
  const seen = useRef(new Set());
  // Fica verdadeiro depois da primeira leitura das conversas desta conta: até lá,
  // as não lidas já existentes só entram em `seen`, sem aviso.
  const primed = useRef(false);
  const accountId = useRef(account?.id);
  accountId.current = account?.id;
  const quietRef = useRef(quiet);
  quietRef.current = quiet;
  const timer = useRef(null);
  const count = account && unread.data ? Number(unread.data.unread) || 0 : null;
  const notifications = unread.data?.notifications !== false;

  useEffect(() => {
    seen.current = new Set();
    primed.current = false;
    setAlert(null);
    if (!account) return undefined;
    // Voltar à janela confere na hora, sem esperar o próximo intervalo.
    const check = () => { if (document.visibilityState !== 'hidden') refreshResource('/api/messages/unread'); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [account?.id]);

  // Cada leitura do contador com mensagens não lidas confere quem escreveu. Olhar só
  // quando o número sobe perdia avisos: se a leitura de uma conversa e a chegada da
  // próxima se cruzavam, o contador ficava em 1 e a mensagem nova passava sem aviso.
  // O conjunto `seen` garante um aviso por mensagem. As que já estavam não lidas ao
  // abrir o Lume entram em `seen` sem avisar, mesmo que o contador seja relido
  // (ao montar e ao conectar o tempo real) antes de essa primeira leitura voltar.
  useEffect(() => {
    if (count === null) return;
    if (count === 0) { primed.current = true; return; }
    let alive = true;
    const owner = accountId.current;
    // Leitura própria: uma consulta já em andamento no cache pode ter começado antes da
    // mensagem chegar e devolver a lista sem ela.
    api('/api/messages').then((result) => {
      if (!result?.ok || accountId.current !== owner) return;
      const conversations = result.data?.conversations || [];
      const first = !primed.current;
      // Leitura substituída por outra mais nova: só serve para semear as já existentes;
      // a mais nova decide o aviso.
      if (!alive && !first) return;
      primed.current = true;
      const next = first ? null : messageAlert(conversations, { seen: seen.current, openContactId: openContactId(), notifications: notifications && !quietRef.current });
      for (const item of conversations) if (item.unread > 0 && item.lastMessage) seen.current.add(item.lastMessage.id);
      if (!alive) return;
      mutateResource('/api/messages', result.data);
      if (next) { setAlert(next); playMessagePing(); }
    });
    return () => { alive = false; };
  }, [unread.updatedAt, notifications]);

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
