import { useEffect, useMemo, useRef, useState } from 'react';
import { HIGHLIGHT_COLORS, formatBytes, highlightAt, identifyPage, readingLabel } from '../../../public/pdf-domain.js';
import { materialStanding, subjectOf } from '../../../public/subject-domain.js';
import { materialSteps } from '../../../public/material-model.js';
import { isCompleted } from '../../../public/progress-domain.js';
import { downloadDocument, identifyWithAI, readPageText, storageInfo } from './pdf-client.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Progress, Skeleton } from '../../ui/ui.jsx';

const SAVE_DELAY = 1200;
const ZOOMS = [0.75, 1, 1.25, 1.5, 2];
const colorLabel = (id) => HIGHLIGHT_COLORS.find((item) => item.id === id)?.label || id;

// Retângulos da seleção em fração da página, para a marcação acompanhar o zoom.
function selectionRects(range, box) {
  return [...range.getClientRects()]
    .filter((rect) => rect.width > 1 && rect.height > 1)
    .map((rect) => ({ x: (rect.left - box.left) / box.width, y: (rect.top - box.top) / box.height, w: rect.width / box.width, h: rect.height / box.height }));
}

function SubjectSelect({ state, course, actions, label = 'Disciplina' }) {
  return <label className="field pdf-subject-field">{label}
    <select value={course.subjectId || ''} onChange={(event) => actions.linkSubject(course.id, event.target.value)}>
      <option value="">Sem disciplina</option>
      {(state.subjects || []).map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}
    </select>
  </label>;
}

// Detalhe do PDF na biblioteca: dados do arquivo, disciplina e retomada.
export function PdfDetails({ course, state, actions, open, close }) {
  const standing = materialStanding(state, course);
  const subject = subjectOf(state, course);
  return <div className="dialog-content">
    <div className="eyebrow">PDF{subject ? ` · ${subject.title}` : ''}</div>
    <h2 id="dialog-title" className="headline">{course.title}</h2>
    <p className="muted-text">{course.pdf.name} · {course.pdf.pages} páginas · {formatBytes(course.pdf.size)}</p>
    {course.reading && <p className="resume-pill"><Icon name="return"/>Parou em: {readingLabel(course.reading, course.pdf.pages)}</p>}
    <Progress value={standing.percent} tone={standing.done ? 'mint' : 'lume'} label={`Avanço em ${course.title}`}/>
    <p className="quiet-note">{standing.done ? 'Leitura concluída.' : `Página mais adiante aberta: ${standing.reached || 0} de ${course.pdf.pages}. Abrir páginas não é prova de leitura nem gera XP.`}</p>
    <SubjectSelect state={state} course={course} actions={actions}/>
    <div className="dialog-actions">
      <Button onClick={() => open({ type: 'pdf', id: course.id })}><Icon name="book"/>{course.reading ? `Continuar na p. ${course.reading.page}` : 'Abrir no leitor'}</Button>
      {!standing.done && <Button secondary onClick={() => actions.togglePause(course.id)}><Icon name={course.paused ? 'play' : 'pause'}/>{course.paused ? 'Retomar' : 'Pausar'}</Button>}
      <Button ghost onClick={() => open({ type: 'delete', id: course.id })}><Icon name="trash"/>Excluir PDF</Button>
      <Button ghost onClick={close}>Fechar</Button>
    </div>
  </div>;
}

// Leitor embutido. A página aberta é gravada como ponto de retomada depois de
// uma pausa curta; o painel do leitor inteligente identifica seção, assuntos e
// disciplina a partir do texto extraído aqui mesmo. IA só sob pedido.
export default function PdfReader({ course, state, actions, progressActions, notify, open, account }) {
  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(course.reading?.page || 1);
  const [draft, setDraft] = useState(String(course.reading?.page || 1));
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [content, setContent] = useState({ page: 0, text: '', lines: [] });
  const [showOutline, setShowOutline] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [ai, setAi] = useState({ available: false, status: 'idle', result: null, error: '' });
  const [marker, setMarker] = useState({ on: false, color: HIGHLIGHT_COLORS[0].id, erase: false });
  const stage = useRef(null);
  const sheet = useRef(null);
  const canvas = useRef(null);
  const layer = useRef(null);
  const pending = useRef(null);
  const step = materialSteps(course)[0];
  const done = step ? isCompleted(state, step.id) : false;
  const pages = course.pdf.pages;
  const subject = subjectOf(state, course);
  const outline = course.pdf.outline;
  const highlights = course.highlights || [];
  const pageHighlights = highlights.filter((item) => item.page === page);

  useEffect(() => {
    const controller = new AbortController();
    let loaded = null;
    downloadDocument(course.pdf.fileId, controller.signal)
      .then((value) => { loaded = value; if (controller.signal.aborted) value.close(); else setDoc(value.doc); })
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error.message || 'Não foi possível abrir o PDF.'); });
    return () => { controller.abort(); loaded?.close(); };
  }, [course.pdf.fileId]);

  useEffect(() => {
    if (!account) return undefined;
    let alive = true;
    storageInfo().then((info) => { if (alive) setAi((value) => ({ ...value, available: info.ai === true })); }).catch(() => {});
    return () => { alive = false; };
  }, [account]);

  useEffect(() => {
    const node = stage.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Desenho da página: canvas na largura do palco e camada de texto selecionável.
  useEffect(() => {
    if (!doc || !width) return undefined;
    let cancelled = false;
    let task = null;
    let text = null;
    (async () => {
      const pdfPage = await doc.getPage(page);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = Math.max(0.3, (width - 24) / base.width) * zoom;
      const viewport = pdfPage.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      const target = canvas.current;
      target.width = Math.floor(viewport.width * ratio);
      target.height = Math.floor(viewport.height * ratio);
      target.style.width = `${Math.floor(viewport.width)}px`;
      target.style.height = `${Math.floor(viewport.height)}px`;
      task = pdfPage.render({ canvas: target, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      await task.promise.catch(() => {});
      if (cancelled) return;
      const container = layer.current;
      container.replaceChildren();
      container.style.setProperty('--total-scale-factor', String(scale));
      const { TextLayer } = await import('pdfjs-dist');
      text = new TextLayer({ textContentSource: pdfPage.streamTextContent(), container, viewport });
      await text.render().catch(() => {});
    })();
    return () => { cancelled = true; task?.cancel(); text?.cancel?.(); };
  }, [doc, page, width, zoom]);

  useEffect(() => {
    if (!doc) return undefined;
    let alive = true;
    readPageText(doc, page).then((value) => { if (alive) setContent({ page, ...value }); }).catch(() => { if (alive) setContent({ page, text: '', lines: [] }); });
    return () => { alive = false; };
  }, [doc, page]);

  const identity = useMemo(() => identifyPage({ subjects: state.subjects, subject, outline, page, text: content.page === page ? content.text : '', lines: content.page === page ? content.lines : [] }),
    [state.subjects, subject, outline, page, content]);

  // Grava a retomada com uma pausa curta; ao fechar o leitor, grava na hora.
  const sectionTitle = identity.section?.source === 'outline' ? identity.section.title : '';
  useEffect(() => {
    setDraft(String(page));
    pending.current = { page, section: sectionTitle };
    const timer = setTimeout(() => {
      if (pending.current) actions.setReadingPage(course.id, pending.current);
      pending.current = null;
    }, SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [page, sectionTitle, course.id, actions]);
  useEffect(() => () => { if (pending.current) actions.setReadingPage(course.id, pending.current); }, [course.id, actions]);

  useEffect(() => {
    const key = (event) => {
      if (event.target.closest?.('input, select, textarea')) return;
      if (['ArrowRight', 'PageDown'].includes(event.key)) { event.preventDefault(); setPage((value) => Math.min(pages, value + 1)); }
      if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); setPage((value) => Math.max(1, value - 1)); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [pages]);

  useEffect(() => { stage.current?.scrollTo({ top: 0 }); setAi((value) => ({ ...value, status: 'idle', result: null, error: '' })); }, [page]);

  function go(target) {
    const value = Math.max(1, Math.min(pages, Math.round(Number(target) || 1)));
    setPage(value);
    setDraft(String(value));
  }

  function finish() {
    if (!step) return;
    const result = progressActions.completeMission(course.id, step.id, { now: new Date().toISOString() });
    if (!result) return;
    notify(result.added ? `Leitura concluída: ${course.title}. Em uma conta, o XP da leitura é confirmado pelo servidor.` : 'Esta leitura já estava concluída.');
  }

  async function askAI() {
    setAi((value) => ({ ...value, status: 'loading', error: '' }));
    try {
      const result = await identifyWithAI(content.text, (state.subjects || []).map((item) => item.title));
      setAi((value) => ({ ...value, status: 'idle', result }));
    } catch (error) {
      setAi((value) => ({ ...value, status: 'idle', error: error.message }));
    }
  }

  function mark(rule) {
    try { rule(); } catch (error) { notify(error.message); }
  }

  // Com o marca-texto ligado: selecionar texto marca na cor escolhida; clicar
  // numa marcação troca a cor dela, ou apaga com a borracha.
  function onMarkerUp(event) {
    if (!marker.on) return;
    const box = sheet.current.getBoundingClientRect();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range && !range.collapsed && layer.current.contains(range.commonAncestorContainer)) {
      if (marker.erase) return;
      const rects = selectionRects(range, box);
      const text = selection.toString();
      selection.removeAllRanges();
      mark(() => actions.addHighlight(course.id, { page, color: marker.color, rects, text }));
      return;
    }
    const hit = highlightAt(highlights, page, { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height });
    if (!hit) return;
    mark(() => marker.erase ? actions.removeHighlight(course.id, hit.id) : actions.recolorHighlight(course.id, hit.id, marker.color));
  }

  const aiSubject = ai.result?.subject ? (state.subjects || []).find((item) => item.title === ai.result.subject) : null;
  return <div className={`pdf-reader ${showPanel ? 'with-panel' : ''}`}>
    <header className="pdf-toolbar">
      <div className="pdf-title">
        <span className="eyebrow">{subject ? subject.title : 'PDF'}</span>
        <h2 id="dialog-title" className="title">{course.title}</h2>
      </div>
      <div className="pdf-controls" role="group" aria-label="Navegação do PDF">
        <button type="button" className="icon-button" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Página anterior"><Icon name="back"/></button>
        <form className="pdf-page-form" onSubmit={(event) => { event.preventDefault(); go(draft); }}>
          <label><span className="sr-only">Página</span><input inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))} onBlur={() => go(draft)} aria-label="Página atual"/></label>
          <span>de {pages}</span>
        </form>
        <button type="button" className="icon-button" onClick={() => go(page + 1)} disabled={page >= pages} aria-label="Próxima página"><Icon name="arrow"/></button>
        <button type="button" className="icon-button" onClick={() => setZoom((value) => ZOOMS[Math.max(0, ZOOMS.indexOf(value) - 1)])} disabled={zoom === ZOOMS[0]} aria-label="Diminuir zoom"><Icon name="minus"/></button>
        <span className="pdf-zoom" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" className="icon-button" onClick={() => setZoom((value) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(value) + 1)])} disabled={zoom === ZOOMS.at(-1)} aria-label="Aumentar zoom"><Icon name="plus"/></button>
        {outline.length > 0 && <button type="button" className="chip-button" aria-expanded={showOutline} onClick={() => setShowOutline((value) => !value)}><Icon name="list"/>Sumário</button>}
        <button type="button" className="chip-button" aria-expanded={showPanel} onClick={() => setShowPanel((value) => !value)}><Icon name="spark"/>Leitor inteligente</button>
      </div>
      <div className="pdf-marker" role="group" aria-label="Marca-texto">
        <button type="button" className={`chip-button ${marker.on ? 'is-active' : ''}`} aria-pressed={marker.on} onClick={() => setMarker((value) => ({ ...value, on: !value.on, erase: false }))}><Icon name="highlighter"/>Marca-texto</button>
        {marker.on && <>
          <div className="pdf-marker-colors" role="radiogroup" aria-label="Cor do marca-texto">
            {HIGHLIGHT_COLORS.map((item) => <button key={item.id} type="button" role="radio" aria-checked={!marker.erase && marker.color === item.id} aria-label={item.label} title={item.label}
              className={`marker-swatch marker-${item.id}`} onClick={() => setMarker((value) => ({ ...value, color: item.id, erase: false }))}/>)}
          </div>
          <button type="button" className={`icon-button ${marker.erase ? 'is-active' : ''}`} aria-pressed={marker.erase} aria-label="Borracha: clique numa marcação para apagar" title="Borracha" onClick={() => setMarker((value) => ({ ...value, erase: !value.erase }))}><Icon name="eraser"/></button>
          <span className="pdf-marker-hint" aria-live="polite">{marker.erase ? 'Clique numa marcação para apagar.' : 'Selecione o texto para marcar; clique numa marcação para trocar a cor.'}</span>
        </>}
      </div>
    </header>

    <div className="pdf-body">
      {showOutline && <nav className="pdf-outline" aria-label="Sumário do PDF">
        <ol>{outline.map((item, index) => <li key={`${item.page}-${index}`} style={{ paddingInlineStart: `${item.depth * 0.9}rem` }}>
          <button type="button" className={`text-button ${identity.section?.title === item.title && identity.section?.page === item.page ? 'is-current' : ''}`} onClick={() => go(item.page)}>{item.title}<small>p. {item.page}</small></button>
        </li>)}</ol>
      </nav>}

      <div className="pdf-stage" ref={stage} tabIndex={0} aria-label={`Página ${page} de ${pages}`}>
        {loadError
          ? <p className="form-error" role="alert">{loadError}</p>
          : !doc && <Skeleton label="Abrindo o PDF…" rows={3} variant="text"/>}
        <div ref={sheet} className={`pdf-page ${marker.on ? (marker.erase ? 'is-erasing' : `is-marking marker-${marker.color}`) : ''}`} hidden={!doc || Boolean(loadError)} onPointerUp={onMarkerUp}>
          <canvas ref={canvas}/>
          <div className="pdf-highlights" aria-hidden="true">
            {pageHighlights.flatMap((item) => item.rects.map((rect, index) => <span key={`${item.id}-${index}`} className={`pdf-highlight marker-${item.color}`}
              style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}/>))}
          </div>
          <div ref={layer} className="textLayer"/>
        </div>
      </div>

      {showPanel && <aside className="pdf-panel" aria-label="Leitor inteligente">
        <h3 className="title">Nesta página</h3>
        <dl className="pdf-facts">
          <div><dt>Disciplina</dt><dd>{identity.subject
            ? <>{identity.subject.subject.title} <small className="fact-source">{identity.subject.source === 'link' ? 'vínculo do material' : `pelo texto: ${identity.subject.hits.slice(0, 3).join(', ')}`}</small></>
            : 'Não identificada pelo texto.'}</dd></div>
          {!subject && identity.subject && <div><dd><Button secondary onClick={() => actions.linkSubject(course.id, identity.subject.subject.id)}><Icon name="plus"/>Vincular a {identity.subject.subject.title}</Button></dd></div>}
          {identity.elsewhere && <div><dd className="quiet-note">Esta página cita mais termos de {identity.elsewhere.subject.title} ({identity.elsewhere.hits.slice(0, 3).join(', ')}).</dd></div>}
          <div><dt>Seção</dt><dd>{identity.section
            ? <>{identity.section.path.join(' › ')} <small className="fact-source">{identity.section.source === 'outline' ? 'sumário do PDF' : 'título da página'}</small></>
            : 'Sem sumário nem título reconhecível.'}</dd></div>
          <div><dt>Assuntos da página</dt><dd>{identity.keywords.length
            ? <ul className="pdf-keywords">{identity.keywords.map((word) => <li key={word}>{word}</li>)}</ul>
            : identity.empty ? 'Sem texto extraível (página digitalizada ou só imagem).' : 'Poucos termos repetidos.'}</dd></div>
        </dl>
        {ai.available && <div className="pdf-ai">
          <Button secondary onClick={askAI} disabled={ai.status === 'loading' || identity.empty}><Icon name="spark"/>{ai.status === 'loading' ? 'Identificando…' : 'Identificar com IA'}</Button>
          <p className="quiet-note">Envia ao servidor só o texto desta página e os nomes das suas disciplinas.</p>
          {ai.error && <p className="form-error" role="alert">{ai.error}</p>}
          {ai.result && <div className="pdf-ai-result" role="status">
            <span className="pill">Sugestão da IA</span>
            {ai.result.topic && <p><strong>{ai.result.topic}</strong></p>}
            <p className="muted-text">{aiSubject ? `Disciplina: ${aiSubject.title}` : 'Nenhuma das suas disciplinas.'}{ai.result.keywords.length ? ` · ${ai.result.keywords.join(', ')}` : ''}</p>
            {aiSubject && aiSubject.id !== course.subjectId && <Button ghost onClick={() => actions.linkSubject(course.id, aiSubject.id)}>Vincular a {aiSubject.title}</Button>}
          </div>}
        </div>}
        <section className="pdf-marks" aria-labelledby="pdf-marks-title">
          <h3 id="pdf-marks-title" className="title">Marcações <small className="fact-source">{pageHighlights.length} nesta página · {highlights.length} no PDF</small></h3>
          {pageHighlights.length
            ? <ul className="pdf-marks-list">{pageHighlights.map((item) => <li key={item.id}>
              <span className={`marker-dot marker-${item.color}`} aria-hidden="true"/>
              <p className="pdf-mark-text">{item.text || 'Trecho sem texto extraível'}</p>
              <div className="pdf-mark-actions">
                <label><span className="sr-only">Cor da marcação</span>
                  <select value={item.color} onChange={(event) => mark(() => actions.recolorHighlight(course.id, item.id, event.target.value))} aria-label={`Cor da marcação: ${colorLabel(item.color)}`}>
                    {HIGHLIGHT_COLORS.map((color) => <option key={color.id} value={color.id}>{color.label}</option>)}
                  </select>
                </label>
                <button type="button" className="icon-button" onClick={() => mark(() => actions.removeHighlight(course.id, item.id))} aria-label="Apagar marcação"><Icon name="trash"/></button>
              </div>
            </li>)}</ul>
            : <p className="quiet-note">{marker.on ? 'Selecione um trecho da página para marcar.' : 'Ligue o marca-texto na barra do leitor para destacar trechos.'}</p>}
          {highlights.length > pageHighlights.length && <p className="quiet-note">Outras páginas com marcações: {[...new Set(highlights.filter((item) => item.page !== page).map((item) => item.page))].sort((a, b) => a - b).slice(0, 12).map((value, index) => <span key={value}>{index ? ', ' : ''}<button type="button" className="text-button" onClick={() => go(value)}>p. {value}</button></span>)}</p>}
        </section>
        <SubjectSelect state={state} course={course} actions={actions} label="Vínculo do material"/>
        <div className="pdf-finish">
          {done
            ? <p className="completed-message"><Icon name="check"/>Leitura concluída.</p>
            : <Button onClick={finish}><Icon name="check"/>Concluí a leitura do PDF</Button>}
          <p className="quiet-note">A página fica salva para retomar. Virar páginas não gera XP; concluir o PDF inteiro vale como leitura concluída, uma vez.</p>
          <Button ghost onClick={() => open({ type: 'course', id: course.id })}>Detalhes do material</Button>
        </div>
      </aside>}
    </div>
  </div>;
}
