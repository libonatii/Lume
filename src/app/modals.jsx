// Diálogos abertos por `open({ type, ... })`. Os de estudo (sessão, curso,
// importação…) ficam em StudyDialog; aqui só os avisos simples da casca.

import StudyDialog from '../features/progress/StudyDialog.jsx';
import Icon from '../ui/Icon.jsx';
import { Button } from '../ui/ui.jsx';

function NoticeDialog({ icon, tone = '', title, children, close }) {
  return <div className="dialog-content">
    <span className={`dialog-emblem ${tone}`.trim()}><Icon name={icon}/></span>
    <h2 id="dialog-title" className="title">{title}</h2>
    <p className="dialog-text">{children}</p>
    <Button className="full-width" onClick={close}>Pronto<Icon name="check"/></Button>
  </div>;
}

const SIMPLE = {
  help: ({ close }) => <NoticeDialog icon="help" title="Um começo simples" close={close}>Entre na conta ou explore a prévia. Escolha seu ritmo, adicione materiais e retome seus estudos pela biblioteca.</NoticeDialog>,
  break: ({ close }) => <NoticeDialog icon="pause" tone="tone-mint" title="Pausa registrada." close={close}>O progresso está salvo e nenhuma etapa foi marcada como concluída. Ao voltar, retome pela próxima ação no Início.</NoticeDialog>,
};

export function ModalContent({ modal, state, settingsActions, libraryActions, progressActions, open, close, notify, go, account }) {
  const simple = SIMPLE[modal.type];
  if (simple) return simple({ state, settingsActions, close });
  return <StudyDialog key={modal.type} modal={modal} state={state} libraryActions={libraryActions} progressActions={progressActions} open={open} close={close} notify={notify} go={go} account={account}/>;
}
