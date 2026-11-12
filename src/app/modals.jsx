// Diálogos abertos por `open({ type, ... })`. Os de estudo (sessão, curso,
// importação…) ficam em StudyDialog; aqui só os avisos simples da casca.

import StudyDialog from '../features/progress/StudyDialog.jsx';
import Icon from '../ui/Icon.jsx';
import { Button } from '../ui/ui.jsx';

import { PALETTES } from '../../public/domain.js';

function ComfortDialog({ state, settingsActions, close }) {
  const setTheme = (theme) => settingsActions.setPreference('theme', theme);
  const setPalette = (palette) => settingsActions.setPreference('palette', palette);
  const setTextSize = (size) => settingsActions.setPreference('textSize', size);
  return <div className="dialog-content">
    <span className="dialog-emblem tone-mint"><Icon name="leaf"/></span>
    <h2 id="dialog-title" className="title">Conforto visual</h2>
    <label className="setting-row">
      <span><strong>Tema</strong><span>Escolha o ambiente mais confortável.</span></span>
      <select value={state.preferences.theme} onChange={(event) => setTheme(event.target.value)}>
        <option value="dark">Escuro</option>
        <option value="light">Claro</option>
      </select>
    </label>
    <fieldset className="comfort-fieldset">
      <legend>Paleta de cores</legend>
      <div className="comfort-pills">
        {PALETTES.map((palette) => (
          <label key={palette.id} className={`comfort-pill ${state.preferences.palette === palette.id ? 'active' : ''}`}>
            <input type="radio" name="dialog-palette" value={palette.id} checked={state.preferences.palette === palette.id} onChange={() => setPalette(palette.id)}/>
            <span>{palette.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
    <label className="setting-row">
      <span><strong>Tamanho do texto</strong><span>Ajuste a leitura em toda a interface.</span></span>
      <select value={state.preferences.textSize} onChange={(event) => setTextSize(event.target.value)}>
        <option value="normal">Padrão</option>
        <option value="large">Maior</option>
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
  break: ({ close }) => <NoticeDialog icon="leaf" tone="tone-mint" title="Pausa registrada." close={close}>O progresso está salvo e nenhuma etapa foi marcada como concluída. Ao voltar, retome pela próxima ação no Início.</NoticeDialog>,
};

export function ModalContent({ modal, state, settingsActions, libraryActions, progressActions, open, close, notify, go, account }) {
  const simple = SIMPLE[modal.type];
  if (simple) return simple({ state, settingsActions, close });
  return <StudyDialog key={modal.type} modal={modal} state={state} libraryActions={libraryActions} progressActions={progressActions} open={open} close={close} notify={notify} go={go} account={account}/>;
}
