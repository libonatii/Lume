// Diálogos abertos por `open({ type, ... })`. Os de estudo (sessão, curso,
// importação…) ficam em StudyDialog; aqui só os avisos simples da casca.

import StudyDialog from '../features/progress/StudyDialog.jsx';
import Icon from '../ui/Icon.jsx';
import { Button } from '../ui/ui.jsx';

function ComfortDialog({ state, update, close }) {
  const setTheme = (theme) => update((previous) => ({ ...previous, preferences: { ...previous.preferences, theme } }));
  return <div className="dialog-content">
    <span className="dialog-emblem"><Icon name="sun"/></span>
    <h2 id="dialog-title" className="title">Conforto visual</h2>
    <label className="setting-row">
      <span><strong>Tema</strong><span>Escolha o ambiente mais confortável.</span></span>
      <select value={state.preferences.theme} onChange={(event) => setTheme(event.target.value)}>
        <option value="dark">Escuro</option>
        <option value="light">Claro</option>
      </select>
    </label>
    <Button className="full-width" onClick={close}>Pronto<Icon name="check"/></Button>
  </div>;
}

function NoticeDialog({ icon, tone = '', title, children, close }) {
  return <div className="dialog-content">
    <span className={`dialog-emblem ${tone}`.trim()}><Icon name={icon}/></span>
    <h2 id="dialog-title" className="title">{title}</h2>
    <p className="dialog-text">{children}</p>
    <Button className="full-width" onClick={close}>Pronto<Icon name="check"/></Button>
  </div>;
}

const SIMPLE = {
  comfort: (props) => <ComfortDialog {...props}/>,
  help: ({ close }) => <NoticeDialog icon="help" title="Um começo simples" close={close}>Entre na conta ou explore a prévia. Escolha seu ritmo, adicione materiais e retome seus estudos pela biblioteca.</NoticeDialog>,
  break: ({ close }) => <NoticeDialog icon="leaf" tone="tone-mint" title="Pausa registrada." close={close}>O progresso está salvo e nenhuma etapa foi marcada como concluída. Ao voltar, retome pela próxima ação em Hoje.</NoticeDialog>,
};

export function ModalContent({ modal, state, update, act, open, close, notify, go, account }) {
  const simple = SIMPLE[modal.type];
  if (simple) return simple({ state, update, close });
  return <StudyDialog key={modal.type} modal={modal} state={state} update={update} act={act} open={open} close={close} notify={notify} go={go} account={account}/>;
}
