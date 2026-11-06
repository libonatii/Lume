import { useEffect, useRef } from 'react';
import Icon from '../../ui/Icon.jsx';

export default function AgendaPanel({ title, children, onClose, busy = false }) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    dialog.querySelector('[data-autofocus]')?.focus();
    return () => { dialog.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={ref} className="agenda-panel" aria-labelledby="agenda-panel-title" onCancel={(event) => { event.preventDefault(); if (!busy) close.current(); }}>
    <header className="agenda-panel-heading"><h2 id="agenda-panel-title" className="title">{title}</h2><button type="button" className="icon-button" aria-label="Fechar painel" disabled={busy} onClick={onClose}><Icon name="close"/></button></header>
    {children}
  </dialog>;
}
