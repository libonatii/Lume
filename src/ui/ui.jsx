import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { MeshGradient } from '@paper-design/shaders-react';
import Icon from './Icon.jsx';

// Movimento finito inspirado na Arc Library (FGLibs): entrada curta, sem rebote nem efeitos de cursor.
export const ease = [.22, 1, .36, 1];
export const enter = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: .32, ease } };
export const stagger = index => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: .36, ease, delay: Math.min(index, 8) * .045 } });

export function Button({ children, secondary = false, ghost = false, className = '', ...props }) {
  const variant = ghost ? 'ghost' : secondary ? 'secondary' : 'primary';
  return <motion.button type="button" whileTap={{ scale: .97 }} className={`button ${variant} ${className}`} {...props}>{children}</motion.button>;
}

export function Heading({ eyebrow, title, children, actions }) {
  return <header className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1 className="display">{title}</h1>{children && <p className="lead">{children}</p>}</div>{actions && <div className="page-heading-actions">{actions}</div>}</header>;
}

export function Progress({ value, max = 100, label, tone = 'mint' }) {
  const percent = Math.max(0, Math.min(100, value / (max || 1) * 100));
  return <div className={`progress tone-${tone}`} role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: percent / 100 }} transition={{ duration: .7, ease }}/></div>;
}

// Contador com mola do Motion, adaptado do padrão AnimatedNumber da Motion-Primitives (FGLibs).
// O valor real fica disponível para leitores de tela; a animação é só visual.
export function AnimatedNumber({ value, className = '' }) {
  const spring = useSpring(value, { stiffness: 110, damping: 24, mass: .6 });
  const display = useTransform(spring, current => Math.round(current).toLocaleString('pt-BR'));
  useEffect(() => { spring.set(value); }, [spring, value]);
  return <span className={`animated-number ${className}`}><motion.span aria-hidden="true">{display}</motion.span><span className="sr-only">{value.toLocaleString('pt-BR')}</span></span>;
}

export function Ring({ value, max = 100, size = 88, stroke = 8, children, label }) {
  const radius = (size - stroke) / 2;
  const percent = Math.max(0, Math.min(1, value / (max || 1)));
  return <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
    <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs><linearGradient id={`ring-${size}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--lume)"/><stop offset="100%" stopColor="var(--lume-2)"/></linearGradient></defs>
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke}/>
      <motion.circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} stroke={`url(#ring-${size})`} fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: Math.max(percent, .015) }} transition={{ duration: 1, ease }} transform={`rotate(-90 ${size / 2} ${size / 2})`}/>
    </svg>
    <div className="ring-content">{children}</div>
  </div>;
}

let webglSupport;
function supportsWebGL() {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    webglSupport = !!context;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { webglSupport = false; }
  return webglSupport;
}

// Luz ambiente com o MeshGradient da Paper Shaders (FGLibs). Sem WebGL, fica o gradiente em CSS.
// As cores acompanham a paleta escolhida em Aparência (html[data-palette]).
const glowPalettes = {
  moderno: {
    lume: ['#090d1f', '#3b82f6', '#60a5fa', '#1e295d'],
    dusk: ['#090d1f', '#2563eb', '#f59e0b', '#172346'],
    mint: ['#090d1f', '#60a5fa', '#fbbf24', '#0f172a'],
  },
  variante2: {
    lume: ['#0b0b18', '#8b5cf6', '#c084fc', '#26244d'],
    dusk: ['#0b0b18', '#7c3aed', '#f59e0b', '#1c1c3d'],
    mint: ['#0b0b18', '#c084fc', '#fbbf24', '#13132b'],
  },
};
export function Glow({ palette = 'lume', speed = 0, className = '' }) {
  const enabled = typeof document !== 'undefined' && supportsWebGL();
  const scheme = glowPalettes[typeof document !== 'undefined' && document.documentElement.dataset.palette === 'variante2' ? 'variante2' : 'moderno'];
  return <div className={`glow glow-${palette} ${className}`} aria-hidden="true">{enabled && <MeshGradient className="glow-canvas" colors={scheme[palette] || scheme.lume} distortion={.85} swirl={.2} speed={speed} maxPixelCount={640 * 640} minPixelRatio={1}/>}</div>;
}

export function Logo({ size = 36 }) {
  return <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="logo-light" cx="50%" cy="28%" r="40%"><stop offset="0%" stopColor="#d8ecff"/><stop offset="55%" stopColor="#5ea8ff"/><stop offset="100%" stopColor="#5ea8ff" stopOpacity="0"/></radialGradient>
      <linearGradient id="logo-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7ff0c6"/><stop offset="100%" stopColor="#2fae86"/></linearGradient>
    </defs>
    <rect width="48" height="48" rx="14" fill="var(--logo-bg, #101b30)"/>
    <circle cx="24" cy="14" r="10" fill="url(#logo-light)" opacity=".58"/>
    <path d="m24 7 2 4.6 4.6 2-4.6 2L24 20.2l-2-4.6-4.6-2 4.6-2Z" fill="#8cc2ff"/>
    <path d="M24 39V26m0 6c-7.5.8-10-5.6-10-9.6 6.4 0 10 3.6 10 9.6Zm0-2c0-6 3.6-9.6 10-9.6 0 4-2.5 10.4-10 9.6Z" fill="url(#logo-leaf)" stroke="url(#logo-leaf)" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>;
}

export function Cover({ art = 'nature', className = '', children }) {
  const safe = ['design', 'code', 'language', 'nature'].includes(art) ? art : 'nature';
  return <div className={`cover art-${safe} ${className}`}><img src={`/assets/stitch/${safe}.png`} alt="" loading="lazy"/>{children}</div>;
}

export function Empty({ title, children, onAdd, icon = 'book' }) {
  return <motion.div {...enter} className="empty-state"><span className="empty-icon"><Icon name={icon}/></span><h2 className="title">{title}</h2><p>{children}</p>{onAdd && <Button secondary onClick={onAdd}><Icon name="plus"/>Adicionar curso</Button>}</motion.div>;
}

// Carregamento com a forma da tela que vai aparecer, para o conteúdo não pular
// de lugar quando chega. O texto para leitores de tela diz o que está carregando.
export function Skeleton({ label, rows = 3, variant = 'list' }) {
  return <div className={`skeleton skeleton-${variant}`} role="status" aria-busy="true" aria-live="polite">
    <span className="sr-only">{label}</span>
    {Array.from({ length: rows }, (_, index) => <div key={index} className="skeleton-item" aria-hidden="true">
      {variant !== 'text' && <span className="skeleton-block skeleton-avatar"/>}
      <span className="skeleton-lines"><span className="skeleton-block skeleton-line"/><span className="skeleton-block skeleton-line short"/></span>
    </div>)}
  </div>;
}

// Página inteira enquanto a biblioteca da conta carrega: título, destaque e cartões.
export function PageSkeleton({ title, variant = 'cards' }) {
  return <div className="page-skeleton" role="status" aria-busy="true">
    <span className="sr-only">Carregando {title}…</span>
    <div className="page-skeleton-heading" aria-hidden="true"><span className="skeleton-block skeleton-eyebrow"/><span className="skeleton-block skeleton-title"/><span className="skeleton-block skeleton-line"/></div>
    {variant === 'cards'
      ? <div className="page-skeleton-cards" aria-hidden="true">{[0, 1, 2].map((index) => <span key={index} className="skeleton-block skeleton-card"/>)}</div>
      : <div className="page-skeleton-panel" aria-hidden="true"><span className="skeleton-block skeleton-panel"/></div>}
  </div>;
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
  }}><button className="dialog-close icon-button" onClick={onClose} aria-label="Fechar janela"><Icon name="close"/></button><motion.div key={identity} initial={{ opacity: 0, y: 10, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .3, ease }}>{children}</motion.div></dialog>;
}
