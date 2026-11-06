import { useLayoutEffect, useRef } from 'react';
import Icon from '../../ui/Icon.jsx';

// Painel lateral (modal) ou, com `anchor`, popover não modal junto ao horário escolhido.
// O popover deixa o calendário livre: uma nova seleção substitui o rascunho.
export default function AgendaPanel({ title, children, onClose, busy = false, anchor = null }) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  // Abre antes de medir: o popover precisa da altura real para caber na tela.
  useLayoutEffect(() => {
    const opener = document.activeElement;
    const dialog = ref.current;
    if (anchor) dialog.show(); else dialog.showModal();
    dialog.querySelector('[data-autofocus]')?.focus();
    let outside = null;
    if (anchor) {
      outside = (event) => {
        if (busyRef.current || dialog.contains(event.target) || event.target.closest?.('.agenda-calendar, .toast-region')) return;
        close.current();
      };
      document.addEventListener('pointerdown', outside);
    }
    return () => {
      if (outside) document.removeEventListener('pointerdown', outside);
      dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  useLayoutEffect(() => {
    if (!anchor) return;
    const dialog = ref.current;
    const { width, height } = dialog.getBoundingClientRect();
    const gap = 12, margin = 16;
    const right = anchor.x + gap + width <= innerWidth - margin;
    const left = right ? anchor.x + gap : Math.max(margin, anchor.x - gap - width);
    const top = Math.min(Math.max(margin, anchor.y - 32), innerHeight - height - margin);
    Object.assign(dialog.style, { left: `${left}px`, top: `${Math.max(margin, top)}px` });
    dialog.style.setProperty('--origin', `${right ? 'left' : 'right'} ${Math.min(Math.max(anchor.y - top, 0), height)}px`);
  }, [anchor]);
  return <dialog ref={ref} className={`agenda-panel${anchor ? ' is-popover' : ''}`} aria-labelledby="agenda-panel-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) close.current(); }}
    onKeyDown={(event) => { if (anchor && event.key === 'Escape' && !busy) { event.preventDefault(); close.current(); } }}>
    <header className="agenda-panel-heading"><h2 id="agenda-panel-title" className="title">{title}</h2><button type="button" className="icon-button" aria-label="Fechar painel" disabled={busy} onClick={onClose}><Icon name="close"/></button></header>
    {children}
  </dialog>;
}
