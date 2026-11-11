import { useEffect, useState } from 'react';
import { PDF_PLANS, formatBytes, suggestSubject } from '../../../public/pdf-domain.js';
import { discardPdf, inspectPdf, storageInfo, uploadPdf } from './pdf-client.js';
import Icon from '../../ui/Icon.jsx';
import { Button } from '../../ui/ui.jsx';

const NEW = '__nova';

// Anexar um PDF como material de estudo, sem curso nem link. O arquivo é lido
// no navegador (páginas, sumário, primeiras páginas) para sugerir a disciplina
// e só então enviado ao servidor, privado da conta. Anexar não gera XP.
export default function AttachPdf({ state, actions, close, notify, open, go, account, subjectId: preset = '' }) {
  const [file, setFile] = useState(null);
  const [info, setInfo] = useState(null);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(preset);
  const [chosen, setChosen] = useState(Boolean(preset));
  const [newSubject, setNewSubject] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [storage, setStorage] = useState(null);
  useEffect(() => {
    if (!account) return undefined;
    let alive = true;
    storageInfo().then((value) => { if (alive) setStorage(value); }).catch(() => {});
    return () => { alive = false; };
  }, [account]);

  const suggestion = info ? suggestSubject(state.subjects, { title: info.title || title, name: file?.name || '', outline: info.outline, text: info.text }) : null;
  const limit = storage?.fileBytes || PDF_PLANS.free.fileBytes;

  if (!account) return <div className="dialog-content">
    <span className="dialog-emblem"><Icon name="book"/></span>
    <h2 id="dialog-title" className="title">Entre na conta para anexar PDFs.</h2>
    <p className="dialog-text">O PDF fica guardado no servidor, privado da sua conta, para você abrir no site e no aplicativo de desktop. A prévia sem conta não guarda arquivos.</p>
    <Button className="full-width" onClick={() => { close(); go('login'); }}>Entrar ou criar conta<Icon name="arrow"/></Button>
  </div>;

  async function choose(event) {
    const picked = event.target.files?.[0] || null;
    setError('');
    setInfo(null);
    setFile(picked);
    if (!picked) return;
    if (picked.type && picked.type !== 'application/pdf' && !/\.pdf$/i.test(picked.name)) { setError('Escolha um arquivo PDF.'); return; }
    if (picked.size > limit) { setError(`O PDF tem ${formatBytes(picked.size)}; o limite do seu plano é ${formatBytes(limit)} por arquivo.`); return; }
    setStatus('reading');
    try {
      const read = await inspectPdf(picked);
      setInfo(read);
      setTitle((current) => current || read.title || picked.name.replace(/\.pdf$/i, ''));
      if (!chosen) {
        const best = suggestSubject(state.subjects, { title: read.title, name: picked.name, outline: read.outline, text: read.text });
        if (best) setSubjectId(best.subject.id);
      }
    } catch {
      setError('Não foi possível ler este PDF. Ele pode estar corrompido ou protegido por senha.');
    } finally {
      setStatus('idle');
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!file || !info) { setError('Escolha um PDF.'); return; }
    if (subjectId === NEW && !newSubject.trim()) { setError('Dê um nome à nova disciplina.'); return; }
    setError('');
    setStatus('uploading');
    const fileId = crypto.randomUUID();
    try {
      const uploaded = await uploadPdf(file, fileId);
      const result = actions.addPdf({
        title,
        file: { fileId, name: file.name, size: uploaded.size, pages: info.pages, outline: info.outline, uploadedAt: new Date().toISOString() },
        subjectId: subjectId === NEW ? '' : subjectId,
        newSubject: subjectId === NEW ? newSubject : '',
      });
      if (!result) { await discardPdf(fileId); setStatus('idle'); return; }
      notify('PDF anexado. Ele abre no leitor do Lume e guarda a página em que você parar.');
      close();
      open({ type: 'pdf', id: result.state.selectedCourseId });
    } catch (exception) {
      await discardPdf(fileId);
      setError(exception.message);
      setStatus('idle');
    }
  }

  const busy = status !== 'idle';
  return <div className="dialog-content course-editor attach-pdf">
    <span className="eyebrow">Estudo por PDF, sem curso</span>
    <h2 id="dialog-title" className="headline">Anexar PDF</h2>
    <p className="muted-text">Apostilas, livros e resumos em PDF viram material da biblioteca, com leitor próprio e retomada na página em que você parou.</p>
    <form className="form-stack" onSubmit={submit}>
      <label className="field">Arquivo PDF
        <input type="file" accept="application/pdf,.pdf" onChange={choose} disabled={busy}/>
      </label>
      {status === 'reading' && <p className="quiet-note" role="status">Lendo o PDF no seu navegador…</p>}
      {info && <p className="inline-note"><Icon name="book"/><span>{info.pages} {info.pages === 1 ? 'página' : 'páginas'} · {formatBytes(file.size)}{info.outline.length ? ` · sumário com ${info.outline.length} itens` : ' · sem sumário no arquivo'}</span></p>}
      <label className="field">Título
        <input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Apostila de Direito Penal" disabled={busy}/>
      </label>
      <label className="field">Disciplina
        <select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setChosen(true); }} disabled={busy}>
          <option value="">Sem disciplina</option>
          {(state.subjects || []).map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}
          <option value={NEW}>Nova disciplina…</option>
        </select>
      </label>
      {subjectId === NEW && <label className="field">Nome da nova disciplina
        <input value={newSubject} maxLength={80} onChange={(event) => setNewSubject(event.target.value)} placeholder="Ex.: Direito Penal" disabled={busy}/>
      </label>}
      {suggestion && subjectId === suggestion.subject.id && !chosen && <p className="quiet-note">Disciplina sugerida pelo texto do PDF ({suggestion.hits.slice(0, 3).join(', ')}). Troque se não for essa.</p>}
      <p className="quiet-note">Anexar não concede XP. Concluir a leitura do PDF inteiro vale como leitura concluída, uma vez.
        {storage ? ` Uso da conta: ${formatBytes(storage.used)} de ${formatBytes(storage.accountBytes)}; até ${formatBytes(storage.fileBytes)} por arquivo.` : ''}
        {storage?.plan === 'free' ? ` Ampliar para ${formatBytes(PDF_PLANS.plus.fileBytes)} por arquivo e ${formatBytes(PDF_PLANS.plus.accountBytes)} exigirá assinatura, ainda não disponível.` : ''}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <Button type="submit" disabled={busy || !info}><Icon name="plus"/>{status === 'uploading' ? 'Enviando…' : 'Anexar PDF'}</Button>
        <Button ghost onClick={close} disabled={status === 'uploading'}>Cancelar</Button>
      </div>
    </form>
  </div>;
}
