import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLume } from '../hooks/useLume.js';
import Shell from './Shell.jsx';
import { Login, Recovery } from './Auth.jsx';
import { Home, Library } from './Study.jsx';
import Onboarding from './Onboarding.jsx';
import { Achievements, History, Missions, Preferences } from './Personal.jsx';
import StudyDialog from './StudyDialog.jsx';
import { Button, Dialog, enter, ease } from './ui.jsx';
import Icon from './Icon.jsx';

const titles = { login: 'Bem-vindo', inicio: 'Seu ritmo', hoje: 'Hoje', biblioteca: 'Biblioteca', missoes: 'Missões', conquistas: 'Conquistas', historico: 'Meu caminho', configuracoes: 'Do seu jeito', recuperar: 'Recuperar acesso', redefinir: 'Nova senha' };
export default function App() {
  const [hash, setHash] = useState(() => location.hash);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const toastTimer = useRef(null);
  const notify = useCallback(message => { clearTimeout(toastTimer.current); setToast({ message, id: Date.now() }); toastTimer.current = setTimeout(() => setToast(null), 6500); }, []);
  const model = useLume(notify);
  const { state, setState: update } = model;
  const requested = hash.slice(1).split('?')[0];
  const route = ['recuperar', 'redefinir'].includes(requested) ? requested : (!model.account && !model.preview) || requested === 'login' ? 'login' : !state.onboarded ? 'inicio' : titles[requested] ? requested : 'hoje';
  const previousRoute = useRef(null);
  const go = useCallback(destination => { location.hash = destination; }, []);
  useEffect(() => {
    const change = () => { setHash(location.hash); setModal(null); };
    window.addEventListener('hashchange', change);
    return () => { window.removeEventListener('hashchange', change); clearTimeout(toastTimer.current); };
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = state.preferences.theme;
    document.documentElement.dataset.text = state.preferences.textSize;
    document.documentElement.dataset.page = route;
    document.documentElement.removeAttribute('data-essential');
    document.querySelector('meta[name="theme-color"]').content = state.preferences.theme === 'light' ? '#f7f3ea' : '#0e0d14';
    document.title = `${titles[route]} · Lume`;
    if (previousRoute.current && previousRoute.current !== route) {
      document.querySelector('#main')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    previousRoute.current = route;
  }, [route, state.preferences.theme, state.preferences.textSize]);
  const open = useCallback(value => setModal(value), []);
  const close = useCallback(() => setModal(null), []);
  async function exit() {
    try { await model.exit(); go('login'); notify('Você saiu. Seu progresso foi preservado.'); }
    catch { notify('Não foi possível sair da conta agora. Tente novamente.'); }
  }
  let page;
  switch (route) {
    case 'login': page = <Login model={model} mode={authMode} setMode={setAuthMode} go={go} notify={notify}/>; break;
    case 'inicio': page = <Onboarding state={state} update={update} go={go} notify={notify}/>; break;
    case 'recuperar': case 'redefinir': page = <Recovery key={route === 'redefinir' ? hash : route} reset={route === 'redefinir'} notify={notify} go={go}/>; break;
    case 'hoje': page = <Home state={state} open={open} go={go}/>; break;
    case 'biblioteca': page = <Library state={state} open={open}/>; break;
    case 'missoes': page = <Missions state={state} open={open}/>; break;
    case 'conquistas': page = <Achievements state={state}/>; break;
    case 'historico': page = <History state={state}/>; break;
    case 'configuracoes': page = <Preferences state={state} update={update} account={model.account} notify={notify} onPersonalize={() => go('inicio')}/>; break;
  }
  return <><Shell route={route} model={model} onComfort={() => open({ type: 'comfort' })} onHelp={() => open({ type: 'help' })} onRegister={() => setAuthMode('register')} onExit={exit}><motion.div className={`page page-${route}`} key={route} {...enter}>{page}</motion.div></Shell>
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true"><AnimatePresence>{toast && <motion.div key="feedback" className="toast" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: .28, ease }}><span className="toast-icon"><Icon name="check"/></span><span>{toast.message}</span><button aria-label="Fechar aviso" className="icon-button" onClick={() => setToast(null)}><Icon name="close"/></button></motion.div>}</AnimatePresence></div>
    {modal && <Dialog onClose={close} identity={`${modal.type}:${modal.id || ''}`}>
      {['comfort', 'help', 'break'].includes(modal.type) ? <div className="dialog-content">{modal.type === 'break' && <span className="dialog-emblem tone-mint"><Icon name="leaf"/></span>}{modal.type === 'help' && <span className="dialog-emblem"><Icon name="help"/></span>}{modal.type === 'comfort' && <span className="dialog-emblem"><Icon name="sun"/></span>}<h2 id="dialog-title" className="title">{modal.type === 'comfort' ? 'Conforto visual' : modal.type === 'help' ? 'Um começo simples' : 'Pode pausar.'}</h2>{modal.type === 'comfort' ? <label className="setting-row"><span><strong>Tema</strong><span>Escolha o ambiente mais confortável.</span></span><select value={state.preferences.theme} onChange={event => update(previous => ({ ...previous, preferences: { ...previous.preferences, theme: event.target.value } }))}><option value="dark">Escuro</option><option value="light">Claro</option></select></label> : <p className="dialog-text">{modal.type === 'help' ? 'Entre na conta ou explore a prévia. Escolha seu ritmo, adicione materiais e retome seus estudos pela biblioteca.' : 'Descanse pelo tempo que precisar. Nenhuma etapa foi concluída e seu progresso continua guardado.'}</p>}<Button className="full-width" onClick={close}>Pronto<Icon name="check"/></Button></div> : <StudyDialog key={modal.type} modal={modal} state={state} update={update} open={open} close={close} notify={notify} go={go}/>}
    </Dialog>}
  </>;
}
