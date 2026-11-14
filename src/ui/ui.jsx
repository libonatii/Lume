import { useEffect, useRef, useState } from 'react';
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
// Cores da identidade Norte: noite, azul-claro do caminho e dourado da estrela.
const glowPalette = {
  lume: ['#0c111b', '#1c2537', '#9ec5ff', '#141b2a'],
  dusk: ['#0c111b', '#26324d', '#f6c165', '#141b2a'],
  mint: ['#0c111b', '#9ec5ff', '#f6c165', '#141b2a'],
};
export function Glow({ palette = 'lume', speed = 0, className = '' }) {
  const enabled = typeof document !== 'undefined' && supportsWebGL();
  return <div className={`glow glow-${palette} ${className}`} aria-hidden="true">{enabled && <MeshGradient className="glow-canvas" colors={glowPalette[palette] || glowPalette.lume} distortion={.85} swirl={.2} speed={speed} maxPixelCount={640 * 640} minPixelRatio={1}/>}</div>;
}

// Estrela de quatro pontas da marca. Também marca "hoje" e a aula atual.
export const STAR_PATH = 'M12 0 L14.3 9.7 L24 12 L14.3 14.3 L12 24 L9.7 14.3 L0 12 L9.7 9.7 Z';
export function Star({ size = 16, className = '' }) {
  return <svg className={`star-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={STAR_PATH} fill="var(--star, #f6c165)"/></svg>;
}

// Logo do Lume: a estrela dourada. O nome "Lume" fica ao lado, em texto.
export function Logo({ size = 24 }) {
  return <Star size={size} className="logo-mark"/>;
}

const LOADING_POINTS = [[20, 64], [54, 40], [86, 58], [128, 28]];

// Tela de carregamento: constelação com a estrela da marca e barra de progresso, sem texto visível.
export function LoadingScreen() {
  const polyline = LOADING_POINTS.map((point) => point.join(',')).join(' ');
  const [sx, sy] = LOADING_POINTS[LOADING_POINTS.length - 1];
  return <div className="loading-screen" role="status" aria-busy="true" aria-label="Carregando">
    <div className="loading-stage" aria-hidden="true">
      <svg className="loading-constellation" viewBox="0 0 160 88" focusable="false">
        <polyline points={polyline} pathLength="1" className="loading-trail-base"/>
        <polyline points={polyline} pathLength="1" className="loading-trail-glow"/>
        {LOADING_POINTS.slice(0, -1).map(([cx, cy], index) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" className={`loading-node loading-node-${index + 1}`}/>
        ))}
        <circle cx={sx} cy={sy} r="20" className="loading-star-halo"/>
        <path d={STAR_PATH} className="loading-star" transform={`translate(${sx - 15} ${sy - 15}) scale(1.25)`}/>
      </svg>
      <div className="loading-progress"><span className="loading-progress-bar"/></div>
    </div>
  </div>;
}

// Capa de material sem foto: uma pequena constelação sobre a malha de pontos.
// Cada tema (`art`) tem a sua forma, para cartões vizinhos não parecerem iguais.
const COVER_SHAPES = {
  design: [[18, 70], [52, 40], [88, 58], [124, 30]],
  code: [[16, 40], [50, 66], [86, 36], [124, 62]],
  language: [[18, 60], [54, 32], [90, 64], [126, 40]],
  nature: [[16, 52], [52, 70], [88, 34], [126, 56]],
};
export function Cover({ art = 'nature', className = '', children }) {
  const safe = Object.hasOwn(COVER_SHAPES, art) ? art : 'nature';
  const points = COVER_SHAPES[safe];
  const [x, y] = points[points.length - 1];
  return <div className={`cover art-${safe} ${className}`}>
    <svg className="cover-mark" viewBox="0 0 144 90" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <polyline points={points.map((point) => point.join(',')).join(' ')} className="cover-line"/>
      {points.slice(0, -1).map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5" className="cover-dot"/>)}
      <path d={STAR_PATH} className="cover-star" transform={`translate(${x - 9} ${y - 9}) scale(0.75)`}/>
    </svg>
    {children}
  </div>;
}

// Foto de perfil com as iniciais como reserva (sem foto ou se a imagem falhar).
export function PersonAvatar({ person, className = 'social-avatar' }) {
  const [failed, setFailed] = useState('');
  const src = person?.avatar && failed !== person.avatar ? person.avatar : '';
  return <span className={className} aria-hidden="true">{src
    ? <img src={src} alt="" loading="lazy" onError={() => setFailed(src)}/>
    : String(person?.name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>;
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
