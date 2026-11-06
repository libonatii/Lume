import { useRef, useState } from 'react';
import { localDay } from '../../../public/domain.js';
import { previewBackup, readBackup } from '../../../public/backup-domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button } from '../../ui/ui.jsx';

export default function BackupPanel({ state, actions, account, notify }) {
  const [backup, setBackup] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const input = useRef(null);
  const summary = backup ? previewBackup(state, backup) : null;

  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lume-meu-caminho-${localDay(new Date())}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Cópia exportada. Para restaurar, escolha o arquivo em “Restaurar uma cópia”.');
  }

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setBackup(null);
    try {
      setBackup(readBackup(await file.text()));
      setName(file.name);
    } catch (exception) {
      setError(exception.message || 'Não foi possível ler esta cópia.');
      setName('');
    }
  }

  function restore() {
    if (!backup || !actions.restoreBackup(backup)) return;
    notify(account ? 'Restauração enviada para gravação na conta.' : 'Cópia aberta na prévia temporária.');
    setBackup(null);
    setName('');
  }

  return <section className="card-surface privacy-note">
    <div className="panel-title"><span className="pace-icon"><Icon name="shield"/></span><div><h2 className="title">Seu espaço, seu progresso.</h2></div></div>
    <p className="muted-text">{account ? 'Sua biblioteca é salva na conta e o XP elegível é confirmado no servidor. O saldo antigo do protótipo fica separado, fora do nível novo e do ranking.' : 'A prévia dura só enquanto esta página está aberta. Você pode exportar uma cópia antes de sair.'}</p>
    <p className="quiet-note">Não inclua senhas ou informações sensíveis nas suas etapas.</p>
    <button className="text-button accent" onClick={download}>Baixar cópia dos meus dados<Icon name="arrow"/></button>
    <div className="backup-restore">
      <strong className="title">Restaurar uma cópia</strong>
      <p className="muted-text">Mescla cursos, progresso, histórico, tarefas e Agenda de um arquivo JSON. Suas preferências, privacidade e onboarding atuais não são substituídos.</p>
      <input ref={input} type="file" accept=".json,application/json" className="sr-only" onChange={choose} aria-label="Escolher arquivo de cópia do Lume"/>
      <Button secondary onClick={() => input.current?.click()}><Icon name="return"/>Escolher arquivo JSON</Button>
      {name && <p className="quiet-note">Arquivo: {name}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {summary && <div className="backup-preview">
        <p className="inline-note"><Icon name="info"/><span>Esta cópia acrescenta {summary.newCourseCount} {summary.newCourseCount === 1 ? 'material novo' : 'materiais novos'}, {summary.newCompleted} {summary.newCompleted === 1 ? 'conclusão' : 'conclusões'} e {summary.newTasks} {summary.newTasks === 1 ? 'tarefa' : 'tarefas'}. {summary.unchanged > 0 ? `${summary.unchanged} material(is) já existente(s) serão mesclados.` : ''}</span></p>
        {summary.newCourses.length > 0 && <ul className="backup-course-list">{summary.newCourses.map((title) => <li key={title}>{title}</li>)}</ul>}
        <p>{summary.newAppointments} compromissos novos na Agenda.</p>
        <div className="dialog-actions inline-actions">
          <Button onClick={restore}><Icon name="check"/>Mesclar à minha biblioteca</Button>
          <Button secondary onClick={() => { setBackup(null); setName(''); }}>Cancelar</Button>
        </div>
      </div>}
    </div>
  </section>;
}
