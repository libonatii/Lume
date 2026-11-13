import { useEffect, useMemo, useRef, useState } from 'react';
import { HIGHLIGHT_COLORS, formatBytes, highlightAt, identifyPage, readingLabel } from '../../../public/pdf-domain.js';
import { materialStanding, subjectOf } from '../../../public/subject-domain.js';
import { materialSteps } from '../../../public/material-model.js';
import { isCompleted } from '../../../public/progress-domain.js';
import {
  downloadDocument, extractDocumentMarkdown, generatePdfInsights, getPdfInsights, readPageText, savePdfMarkdown, storageInfo,
} from './pdf-client.js';
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

// Leitor embutido. Abre em 2 zonas limpas (Palco + Painel editorial com abas);
// Sumário e Marca-texto ficam recolhidos até serem acionados.
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
  const [activeTab, setActiveTab] = useState('marcacoes');
  const [aiAvailable, setAiAvailable] = useState(false);
  const [summary, setSummary] = useState({
    status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
    markdownStatus: 'pending',
    insights: null,
    error: '',
    freshReveal: false,
  });
  const [marker, setMarker] = useState({ on: false, color: HIGHLIGHT_COLORS[0].id, erase: false });
  const stage = useRef(null);
  const sheet = useRef(null);
  const canvas = useRef(null);
  const layer = useRef(null);
  const pending = useRef(null);
  const summaryAbort = useRef(null);
  const step = materialSteps(course)[0];
  const done = step ? isCompleted(state, step.id) : false;
  const pages = course.pdf.pages;
  const subject = subjectOf(state, course);
  const standing = materialStanding(state, course);
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
    const controller = new AbortController();
    let alive = true;
    storageInfo().then((info) => {
      if (!alive) return;
      const available = info.ai === true;
      setAiAvailable(available);
      if (available) {
        setActiveTab((current) => (current === 'marcacoes' ? 'resumo' : current));
        getPdfInsights(course.pdf.fileId, controller.signal)
          .then((res) => {
            if (!alive) return;
            setSummary((prev) => ({
              ...prev,
              markdownStatus: res.markdownStatus || 'pending',
              insights: res.insights || null,
              status: res.insights ? 'ready' : 'idle',
              freshReveal: false,
            }));
          })
          .catch(() => {});
      }
    }).catch(() => {});
    return () => {
      alive = false;
      controller.abort();
      summaryAbort.current?.abort();
    };
  }, [account, course.pdf.fileId]);

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
      const scale = Math.max(0.3, (width - 48) / base.width) * zoom;
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

  useEffect(() => { stage.current?.scrollTo({ top: 0 }); }, [page]);

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

  async function requestInsights({ refresh = false } = {}) {
    summaryAbort.current?.abort();
    const controller = new AbortController();
    summaryAbort.current = controller;
    setSummary((prev) => ({ ...prev, status: 'loading', error: '', freshReveal: false }));
    try {
      if (summary.markdownStatus !== 'ready' && doc) {
        const markdown = await extractDocumentMarkdown(doc);
        if (controller.signal.aborted) return;
        const saved = await savePdfMarkdown(course.pdf.fileId, markdown, 'pdfjs');
        if (saved.markdownStatus !== 'ready') {
          throw new Error('Este PDF não possui texto extraível para resumir.');
        }
      }
      const res = await generatePdfInsights(course.pdf.fileId, { refresh, signal: controller.signal });
      if (controller.signal.aborted) return;
      setSummary((prev) => ({
        ...prev,
        markdownStatus: 'ready',
        status: 'ready',
        insights: res.insights,
        error: '',
        freshReveal: !res.cached || refresh,
      }));
    } catch (error) {
      if (controller.signal.aborted) return;
      setSummary((prev) => ({
        ...prev,
        status: prev.insights ? 'ready' : 'error',
        error: error.message || 'Não foi possível gerar o resumo agora.',
      }));
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

  const otherHighlightedPages = [...new Set(highlights.filter((item) => item.page !== page).map((item) => item.page))].sort((a, b) => a - b);

  return <div className={`pdf-reader ${showPanel ? 'with-panel' : ''}`}>
    <header className="pdf-toolbar">
      <div className="pdf-title">
        <h2 id="dialog-title" className="title">{course.title}</h2>
      </div>

      <div className="pdf-controls" role="group" aria-label="Navegação do PDF">
        <button type="button" className="icon-button" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Página anterior"><Icon name="chevron-left"/></button>
        <form className="pdf-page-form" onSubmit={(event) => { event.preventDefault(); go(draft); }}>
          <label><span className="sr-only">Página</span><input inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))} onBlur={() => go(draft)} aria-label="Página atual"/></label>
          <span>/ {pages}</span>
        </form>
        <button type="button" className="icon-button" onClick={() => go(page + 1)} disabled={page >= pages} aria-label="Próxima página"><Icon name="chevron"/></button>
        <span className="pdf-dot" aria-hidden="true">·</span>
        <button type="button" className="icon-button" onClick={() => setZoom((value) => ZOOMS[Math.max(0, ZOOMS.indexOf(value) - 1)])} disabled={zoom === ZOOMS[0]} aria-label="Diminuir zoom"><Icon name="minus"/></button>
        <span className="pdf-zoom" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" className="icon-button" onClick={() => setZoom((value) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(value) + 1)])} disabled={zoom === ZOOMS.at(-1)} aria-label="Aumentar zoom"><Icon name="plus"/></button>
      </div>

      <div className="pdf-toolbar-actions">
        {outline.length > 0 && <button type="button" className={`icon-button ${showOutline ? 'is-active' : ''}`} aria-expanded={showOutline} aria-label="Sumário" title="Sumário" onClick={() => setShowOutline((value) => !value)}><Icon name="list"/></button>}
        <button type="button" className={`icon-button ${marker.on ? 'is-active' : ''}`} aria-pressed={marker.on} aria-label="Marca-texto" title="Marca-texto" onClick={() => setMarker((value) => ({ ...value, on: !value.on, erase: false }))}><Icon name="highlighter"/></button>
        <button type="button" className={`icon-button ${showPanel ? 'is-active' : ''}`} aria-expanded={showPanel} aria-label="Painel lateral" title="Painel" onClick={() => setShowPanel((value) => !value)}><Icon name="spark"/></button>
        {done
          ? <span className="pdf-done-badge"><Icon name="check"/>Concluída</span>
          : <Button secondary onClick={finish}><Icon name="check"/>Concluir</Button>}
      </div>
    </header>

    {marker.on && <div className="pdf-marker-bar" role="group" aria-label="Opções do marca-texto">
      <div className="pdf-marker-colors" role="radiogroup" aria-label="Cor do marca-texto">
        {HIGHLIGHT_COLORS.map((item) => <button key={item.id} type="button" role="radio" aria-checked={!marker.erase && marker.color === item.id} aria-label={item.label} title={item.label}
          className={`marker-swatch marker-${item.id}`} onClick={() => setMarker((value) => ({ ...value, color: item.id, erase: false }))}/>)}
      </div>
      <button type="button" className={`icon-button ${marker.erase ? 'is-active' : ''}`} aria-pressed={marker.erase} aria-label="Borracha: clique numa marcação para apagar" title="Borracha" onClick={() => setMarker((value) => ({ ...value, erase: !value.erase }))}><Icon name="eraser"/></button>
      <span className="pdf-marker-hint" aria-live="polite">{marker.erase ? 'Clique numa marcação para apagar.' : 'Selecione o texto para marcar; clique numa marcação para trocar a cor.'}</span>
    </div>}

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

      {showPanel && <aside className="pdf-panel" aria-label="Painel do documento">
        <div className="pdf-panel-tabs" role="tablist" aria-label="Abas do leitor">
          {aiAvailable && <button type="button" role="tab" aria-selected={activeTab === 'resumo'} className={`pdf-tab ${activeTab === 'resumo' ? 'is-active' : ''}`} onClick={() => setActiveTab('resumo')}>Resumo IA</button>}
          <button type="button" role="tab" aria-selected={activeTab === 'marcacoes'} className={`pdf-tab ${activeTab === 'marcacoes' ? 'is-active' : ''}`} onClick={() => setActiveTab('marcacoes')}>Marcações</button>
          <button type="button" role="tab" aria-selected={activeTab === 'detalhes'} className={`pdf-tab ${activeTab === 'detalhes' ? 'is-active' : ''}`} onClick={() => setActiveTab('detalhes')}>Detalhes</button>
        </div>

        <div className="pdf-panel-body">
          {activeTab === 'resumo' && aiAvailable && <section className="pdf-summary-tab" role="tabpanel" aria-label="Resumo IA">
            {summary.status === 'loading' && <div className="pdf-summary-skeleton" aria-live="polite" aria-label="Preparando resumo do documento">
              <div className="pdf-shimmer-line is-long"/>
              <div className="pdf-shimmer-line is-long"/>
              <div className="pdf-shimmer-line is-medium"/>
              <div className="pdf-shimmer-line is-short"/>
              <p className="quiet-note">Lendo e organizando o conteúdo do PDF…</p>
            </div>}

            {summary.status !== 'loading' && !summary.insights && <div className="pdf-summary-empty">
              <p className="muted-text">Resumo do conteúdo, tópicos-chave e pontos de revisão gerados a partir do texto deste PDF.</p>
              {summary.error && <p className="form-error" role="alert">{summary.error}</p>}
              <Button onClick={() => requestInsights()} disabled={!doc}><Icon name="spark"/>Gerar resumo e insights</Button>
            </div>}

            {summary.status !== 'loading' && summary.insights && <div className={`pdf-summary-content ${summary.freshReveal ? 'is-revealing' : ''}`}>
              <div className="pdf-overview-head">
                <p className="pdf-overview-text">{summary.insights.overview}</p>
                <button type="button" className="icon-button pdf-refresh-btn" onClick={() => requestInsights({ refresh: true })} aria-label="Atualizar resumo" title="Atualizar resumo"><Icon name="history"/></button>
              </div>

              {summary.error && <p className="form-error" role="alert">{summary.error}</p>}

              {summary.insights.keyTopics?.length > 0 && <p className="pdf-inline-topics">
                {summary.insights.keyTopics.join(' · ')}
              </p>}

              {summary.insights.insights?.length > 0 && <ul className="pdf-insights-list">
                {summary.insights.insights.map((item, idx) => <li key={idx} className="pdf-insight-item">
                  <div className="pdf-insight-head">
                    <strong>{item.title}</strong>
                    {item.pageRef && <button type="button" className="pdf-page-chip" onClick={() => go(item.pageRef)}>p. {item.pageRef}</button>}
                  </div>
                  <p>{item.detail}</p>
                </li>)}
              </ul>}

              <p className="pdf-summary-footnote">
                {summary.insights.coverage === 'condensed'
                  ? 'Gerado a partir do conteúdo condensado do PDF.'
                  : 'Gerado a partir do conteúdo do PDF.'}
              </p>
            </div>}
          </section>}

          {activeTab === 'marcacoes' && <section className="pdf-marks" role="tabpanel" aria-label="Marcações">
            <div className="pdf-marks-header">
              <span className="quiet-note">{pageHighlights.length} nesta página · {highlights.length} no PDF</span>
            </div>
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
              : <p className="quiet-note">{marker.on ? 'Selecione um trecho da página para marcar.' : 'Ligue o marca-texto na barra superior para destacar trechos.'}</p>}
            {otherHighlightedPages.length > 0 && <div className="pdf-other-marks">
              <span className="quiet-note">Outras páginas marcadas:</span>
              <div className="pdf-page-chips">
                {otherHighlightedPages.slice(0, 12).map((value) => <button key={value} type="button" className="pdf-page-chip" onClick={() => go(value)}>p. {value}</button>)}
              </div>
            </div>}
          </section>}

          {activeTab === 'detalhes' && <section className="pdf-details-tab" role="tabpanel" aria-label="Detalhes">
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

            <div className="pdf-details-section">
              <SubjectSelect state={state} course={course} actions={actions} label="Vínculo do material"/>
              <Progress value={standing.percent} tone={standing.done ? 'mint' : 'lume'} label={`Avanço em ${course.title}`}/>
              <p className="quiet-note">{course.pdf.name} · {pages} páginas · {formatBytes(course.pdf.size)}</p>
              <p className="quiet-note">A página fica salva para retomar. Virar páginas não gera XP; concluir o PDF inteiro vale como leitura concluída, uma vez.</p>
              <Button ghost onClick={() => open({ type: 'course', id: course.id })}>Detalhes do material</Button>
            </div>
          </section>}
        </div>
      </aside>}
    </div>
  </div>;
}
