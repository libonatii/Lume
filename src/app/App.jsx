import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLume } from './useLume.js';
import Shell from './Shell.jsx';
import { Dialog, enter, ease } from '../ui/ui.jsx';
import { ENTRY_ROUTES, ROUTE_BY_ID, parseHash } from './routes.jsx';
import { ModalContent } from './modals.jsx';
import Icon from '../ui/Icon.jsx';
import { markDesktop, syncTitleBar } from '../lib/desktop.js';
import { listenForExtension } from '../lib/extension.js';
import { findLessonByUrl } from '../../public/import-domain.js';
import Reminders from '../features/agenda/Reminders.jsx';

// Marca o documento antes do primeiro desenho: no app, a barra de título ocupa
// o topo; no navegador, nada muda.
markDesktop();

export default function App() {
  const [hash, setHash] = useState(() => location.hash);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const toastTimer = useRef(null);
  const notify = useCallback(message => { clearTimeout(toastTimer.current); setToast({ message, id: Date.now() }); toastTimer.current = setTimeout(() => setToast(null), 6500); }, []);
  const model = useLume(notify);
  const { state } = model;
  const { requested, params } = parseHash(hash);
  const signedIn = Boolean(model.account);
  // A sessão verificada vale mais que o hash: #login não pode derrubar quem já entrou.
  const route = ['recuperar', 'redefinir'].includes(requested) ? requested
    : (!signedIn && !model.preview) || (requested === 'login' && !signedIn) ? 'login'
    : !state.onboarded ? 'inicio'
    : requested && requested !== 'login' && ROUTE_BY_ID.has(requested) ? requested : 'hoje';
  const checkingSession = model.accountStatus === 'checking' && !signedIn && !model.preview;
  const previousRoute = useRef(null);
  const go = useCallback(destination => { location.hash = destination; }, []);
  // Leitura de curso enviada pela extensão: abre a revisão da importação.
  const captureReady = useRef(false);
  captureReady.current = signedIn || Boolean(model.preview);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => listenForExtension({
    capture: payload => {
      if (!captureReady.current) { notify('Entre na sua conta do Lume e envie a leitura de novo pela extensão.'); return false; }
      setModal({ type: 'import', capture: payload });
      return true;
    },
    // "Concluí esta aula" na página da plataforma: abre a aula certa para a pessoa confirmar.
    complete: payload => {
      if (!captureReady.current) { notify('Entre na sua conta do Lume e tente de novo pela extensão.'); return false; }
      const found = findLessonByUrl(stateRef.current, payload?.url);
      if (!found) { notify('Não encontrei esta aula nos seus cursos. Importe o curso pela extensão antes.'); return 'not_found'; }
      setModal({ type: 'session', id: found.course.id, stepId: found.lesson.id });
      return true;
    },
  }), [notify]);
  useEffect(() => {
    const change = () => { setHash(location.hash); setModal(null); };
    window.addEventListener('hashchange', change);
    return () => { window.removeEventListener('hashchange', change); clearTimeout(toastTimer.current); };
  }, []);
  // #login preso na URL não deve sobreviver a uma sessão válida.
  useLayoutEffect(() => {
    if (!model.account || requested !== 'login') return;
    const destination = state.onboarded ? 'hoje' : 'inicio';
    history.replaceState(null, '', `#${destination}`);
    setHash(`#${destination}`);
  }, [model.account, requested, state.onboarded]);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = state.preferences.theme;
    document.documentElement.dataset.palette = state.preferences.palette || 'moderno';
    syncTitleBar(state.preferences.theme);
    document.documentElement.dataset.text = state.preferences.textSize;
    document.documentElement.dataset.page = route;
    document.documentElement.removeAttribute('data-essential');
    document.querySelector('meta[name="theme-color"]').content = state.preferences.theme === 'light' ? '#f4f6fb' : (state.preferences.palette === 'variante2' ? '#0b0b18' : '#090d1f');
    document.title = `${ROUTE_BY_ID.get(route).title} · Lume`;
    if (previousRoute.current && previousRoute.current !== route) {
      document.querySelector('#main')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    previousRoute.current = route;
  }, [route, state.preferences.theme, state.preferences.palette, state.preferences.textSize]);
  const open = useCallback(value => setModal(value), []);
  const close = useCallback(() => setModal(null), []);
  async function exit() {
    try { await model.exit(); go('login'); notify('Você saiu. Seu progresso foi preservado.'); }
    catch { notify('Não foi possível sair da conta agora. Tente novamente.'); }
  }
  const current = ROUTE_BY_ID.get(route);
  const routeContext = { model, state, open, go, notify, params, hash, authMode, setAuthMode, checkingSession };
  const page = <>{model.saveError && <div role="alert"><p>{model.saveError}</p><button onClick={() => model.retrySave().catch(() => notify('Não foi possível carregar a biblioteca. Tente novamente.'))}>Recarregar ou tentar novamente</button></div>}{current.render(routeContext)}</>;
  const hideTabs = Boolean(current.hideTabs?.(routeContext));
  return <><Shell route={route} model={model} hideTabs={hideTabs} onComfort={() => open({ type: 'comfort' })} onHelp={() => open({ type: 'help' })} onRegister={() => setAuthMode('register')} onExit={exit}><Reminders account={model.account} syncStatus={model.syncStatus}/><motion.div className={`page page-${route}`} key={route} {...enter}>{page}</motion.div></Shell>
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true"><AnimatePresence>{toast && <motion.div key="feedback" className="toast" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: .28, ease }}><span className="toast-icon"><Icon name="check"/></span><span>{toast.message}</span><button aria-label="Fechar aviso" className="icon-button" onClick={() => setToast(null)}><Icon name="close"/></button></motion.div>}</AnimatePresence></div>
    {modal && <Dialog onClose={close} identity={`${modal.type}:${modal.id || ''}`}>
      <ModalContent modal={modal} state={state} settingsActions={model.settingsActions} libraryActions={model.libraryActions} progressActions={model.progressActions} open={open} close={close} notify={notify} go={go} account={model.account}/>
    </Dialog>}
  </>;
}
