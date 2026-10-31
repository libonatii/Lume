import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import Icon from './Icon.jsx';

// Arc Library (FGLibs): transições finitas, sem rebote ou efeitos de cursor.
export const enter = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: .28, ease: [.22, 1, .36, 1] } };
export function Button({ children, secondary = false, className = '', ...props }) {
  return <motion.button type="button" whileTap={{ scale: .98 }} className={`button ${secondary ? 'secondary' : 'primary'} ${className}`} {...props}>{children}</motion.button>;
}
export function Heading({ title, children }) {
  return <header className="page-heading"><div><h1>{title}</h1>{children && <p>{children}</p>}</div></header>;
}
export function Progress({ value, max = 100, label }) {
  const percent = Math.max(0, Math.min(100, value / (max || 1) * 100));
  return <div className="animated-progress" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><motion.span initial={false} animate={{ scaleX: percent / 100 }} transition={{ duration: .4, ease: [.22, 1, .36, 1] }}/></div>;
}
export function Empty({ title, children, onAdd }) {
  return <motion.div {...enter} className="empty-state"><Icon name="book"/><h2>{title}</h2><p>{children}</p>{onAdd && <Button secondary onClick={onAdd}><Icon name="plus"/>Adicionar curso</Button>}</motion.div>;
}
export function Dialog({ children, onClose, identity }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    const node = ref.current;
    node.showModal();
    const cancel = event => { event.preventDefault(); closeRef.current(); };
    node.addEventListener('cancel', cancel);
    return () => { node.removeEventListener('cancel', cancel); node.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  useEffect(() => {
    const heading = ref.current?.querySelector('#dialog-title');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }, [identity]);
  return <dialog ref={ref} id="dialog" aria-labelledby="dialog-title" onClick={event => {
    if (event.target !== ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}><button className="dialog-close icon-button" onClick={onClose} aria-label="Fechar janela"><Icon name="close"/></button><motion.div key={identity} {...enter}>{children}</motion.div></dialog>;
}
