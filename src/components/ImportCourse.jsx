import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import Icon from './Icon.jsx';
import { Button } from './ui.jsx';
import { api, apiError } from '../lib/api.js';
import {
  MAX_SYLLABUS_CHARS, allLessonIds, applyCourseImport, formatDuration,
  looksLikeExamCourse, normalizeImportUrl, normalizePayload, detectProvider,
} from '../../public/import-domain.js';

// Fluxo curto de importação: colar link → analisar → escolher áreas → adicionar.
// A revisão é a própria árvore de disciplinas; não existe formulário por aula.
// Nenhuma etapa concede XP: importar é organização.

const EXTRACTION_LABEL = {
  'structured-data': 'Dados estruturados da página',
  'page-outline': 'Estrutura visível da página',
  'pasted-text': 'Texto colado',
  'file-import': 'Arquivo enviado',
  'ai-assisted': 'Organizado por IA',
};

export default function ImportCourse({ state, update, close, notify, go, open, modal = {} }) {
  const updating = Boolean(modal.courseId);
  const existing = updating ? state.courses.find((course) => course.id === modal.courseId) : null;
  const [phase, setPhase] = useState('link');
  const [mode, setMode] = useState('link');
  const [url, setUrl] = useState(existing?.source?.canonicalUrl || existing?.url || '');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [payload, setPayload] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [ai, setAi] = useState(null);
  const [error, setError] = useState(null);
  const [edition, setEdition] = useState(existing?.edital?.edition || '');
  const [examPhase, setExamPhase] = useState(existing?.edital?.phase || '');
  const [imported, setImported] = useState(null);
  const heading = useRef(null);
  const fileInput = useRef(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    const node = heading.current;
    if (!node) return;
    node.tabIndex = -1;
    node.focus({ preventScroll: true });
  }, [phase]);

  const total = payload ? allLessonIds(payload).length : 0;
  const chosen = payload ? allLessonIds(payload).filter((id) => selected.has(id)).length : 0;
  const examLike = useMemo(() => payload && looksLikeExamCourse(payload), [payload]);
  const detectedProvider = useMemo(() => {
    const normalized = normalizeImportUrl(url);
    return normalized ? detectProvider(normalized) : null;
  }, [url]);

  async function analyze(source) {
    setPhase('analyzing');
    setError(null);
    const request = source.kind === 'text'
      ? api('/api/import/organize', { method: 'POST', body: { text: source.text, title: source.title, url: source.url } })
      : api('/api/import/analyze', { method: 'POST', body: { url: source.url } });
    let result;
    try { result = await request; } catch { result = { ok: false, data: { error: 'Não foi possível falar com o Lume. Confira a conexão.', code: 'network_error' } }; }
    if (!alive.current) return null;
    if (!result.ok) {
      setError({ message: apiError(result), code: result.data?.code || 'import_failed' });
      setPhase('error');
      return null;
    }
    try {
      const normalized = normalizePayload(result.data.payload);
      setAi(result.data.ai || null);
      return normalized;
    } catch (exception) {
      setError({ message: exception.message, code: 'unparsed_text' });
      setPhase('error');
      return null;
    }
  }

  async function runAnalysis(source) {
    const normalized = await analyze(source);
    if (!normalized) return;
    setPayload(normalized);
    setSelected(new Set(allLessonIds(normalized)));
    setExpanded(new Set(normalized.disciplines.slice(0, 2).map((discipline) => discipline.id)));
    setPhase('review');
  }

  // Detecta e adiciona sem abrir a árvore de revisão. Usa todas as aulas
  // encontradas; grades parciais continuam marcadas no curso e podem ser
  // atualizadas depois.
  async function detectAndAdd() {
    const value = normalizeImportUrl(url);
    if (!value) {
      setError({ message: 'Cole o endereço completo do curso, começando com https://', code: 'invalid_url' });
      setPhase('error');
      return;
    }
    setUrl(value);
    const normalized = await analyze({ kind: 'url', url: value });
    if (normalized) importPayload(normalized, { auto: true });
  }

  function handleUrlPaste(event) {
    const pasted = event.clipboardData?.getData('text') || '';
    const value = normalizeImportUrl(pasted);
    if (!value) return;
    event.preventDefault();
    setUrl(value);
    runAnalysis({ kind: 'url', url: value });
  }

  function submitLink(event) {
    event.preventDefault();
    const value = normalizeImportUrl(url);
    if (!value) {
      setError({ message: 'Cole o endereço completo do curso, começando com https://', code: 'invalid_url' });
      setPhase('error');
      return;
    }
    setUrl(value);
    runAnalysis({ kind: 'url', url: value });
  }

  function submitText(event) {
    event.preventDefault();
    if (!text.trim()) {
      setError({ message: 'Cole a grade do curso para organizar.', code: 'empty_text' });
      setPhase('error');
      return;
    }
    runAnalysis({ kind: 'text', text, title, url: url.trim() });
  }

  async function readFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 200 * 1024) {
      setError({ message: 'O arquivo é grande demais. Envie até 200 KB de texto.', code: 'too_large' });
      setPhase('error');
      return;
    }
    try {
      const content = await file.text();
      setText(content.slice(0, MAX_SYLLABUS_CHARS));
      setMode('paste');
      if (!title) setTitle(file.name.replace(/\.[a-z0-9]+$/i, ''));
      notify('Arquivo carregado. Revise o texto e organize a grade.');
    } catch {
      setError({ message: 'Não consegui ler esse arquivo. Use um arquivo de texto (.txt ou .md).', code: 'file_error' });
      setPhase('error');
    }
  }

  function toggleLesson(id) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleMany(ids, value) {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of ids) { if (value) next.add(id); else next.delete(id); }
      return next;
    });
  }

  function toggleExpanded(id) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function importPayload(normalized, { auto = false, selectedIds = null } = {}) {
    if (!normalized) return;
    const ids = selectedIds || allLessonIds(normalized);
    if (!ids.length) {
      setError({ message: 'Nenhuma aula foi encontrada para adicionar.', code: 'import_failed' });
      setPhase('error');
      return;
    }
    try {
      const next = applyCourseImport(state, normalized, {
        selectedLessonIds: ids,
        mode: updating ? 'update' : 'create',
        courseId: updating ? modal.courseId : null,
        edital: looksLikeExamCourse(normalized) && (edition || examPhase) ? { exam: 'OAB', edition: edition.trim(), phase: examPhase, checkedAt: new Date().toISOString() } : null,
      });
      const course = next.courses.find((item) => item.source?.identity === normalized.identity) || next.courses.at(-1);
      update(next);
      setPayload(normalized);
      setSelected(new Set(ids));
      setImported({
        course,
        added: ids.length,
        kept: (existing?.steps?.length || 0),
        auto,
        partial: normalized.completeness === 'partial',
      });
      setPhase('done');
    } catch (exception) {
      setError({ message: exception.message, code: 'import_failed' });
      setPhase('error');
    }
  }

  function confirmImport() {
    if (!payload || !chosen) return;
    importPayload(payload, { selectedIds: [...selected] });
  }

  // ---------- Etapas de interface ----------

  const linkStep = phase === 'link' && <>
    <span className="eyebrow">Uma entrada só · qualquer plataforma</span>
    <h2 id="dialog-title" className="headline" ref={heading}>{updating ? 'Atualizar a grade do curso' : 'Cole o link do que você quer estudar'}</h2>
    <p className="muted-text">O Lume identifica a plataforma, lê a grade pública e mostra as áreas para você escolher. Não é preciso cadastrar aula por aula.</p>
    <div className="import-mode" role="tablist" aria-label="Forma de importar">
      <button role="tab" aria-selected={mode === 'link'} className="filter-btn" onClick={() => setMode('link')}><span>Link do curso</span></button>
      <button role="tab" aria-selected={mode === 'paste'} className="filter-btn" onClick={() => setMode('paste')}><span>Colar a grade</span></button>
    </div>
    {mode === 'link'
      ? <form className="form-stack" onSubmit={submitLink}>
        <label className="field">Link do curso
          <input name="import-url" type="text" inputMode="url" maxLength={2000} value={url} onChange={(event) => setUrl(event.target.value)} onPaste={handleUrlPaste} placeholder="https://…" autoComplete="off" required/>
        </label>
        {detectedProvider && detectedProvider.id !== 'unknown' && <p className="inline-note"><Icon name="check"/><span>{detectedProvider.label} detectado. Ao colar um link, a análise começa sozinha.</span></p>}
        <p className="quiet-note">Funciona com Gran Cursos, Estratégia, Alura, Rocketseat, Udemy, Coursera e outras fontes. O que for possível ler aparece na revisão; o resto pode ser colado.</p>
        <Button className="full-width" type="submit"><Icon name="search"/>Analisar link</Button>
        <Button secondary className="full-width" type="button" onClick={detectAndAdd} disabled={!normalizeImportUrl(url)}><Icon name="spark"/>Detectar e adicionar</Button>
        <p className="quiet-note">Detectar e adicionar usa todas as aulas encontradas, sem abrir a revisão. Grades parciais continuam marcadas e podem ser atualizadas depois.</p>
      </form>
      : <form className="form-stack" onSubmit={submitText}>
        <label className="field">Nome do curso (opcional)
          <input name="import-title" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: OAB — 1ª fase"/>
        </label>
        <label className="field">Grade do curso
          <textarea name="import-text" rows={7} maxLength={MAX_SYLLABUS_CHARS} value={text} onChange={(event) => setText(event.target.value)} placeholder={'Disciplina: Direito Constitucional\nMódulo: Princípios fundamentais\nAula 1 — Conceito e fontes\nAula 2 — Direitos fundamentais'} required/>
        </label>
        <p className="quiet-note">Cole a ementa como ela aparece na plataforma. Uma linha por item já basta; o Lume organiza disciplinas, módulos e aulas.</p>
        <div className="import-file-row">
          <Button secondary onClick={() => fileInput.current?.click()} type="button"><Icon name="book"/>Enviar arquivo .txt ou .md</Button>
          <input ref={fileInput} type="file" accept=".txt,.md,.markdown,.csv,text/plain" className="sr-only" onChange={readFile} aria-label="Enviar arquivo de ementa"/>
        </div>
        <Button className="full-width" type="submit"><Icon name="spark"/>Organizar grade</Button>
      </form>}
    <p className="import-capability-note"><Icon name="focus"/><span>O Lume não pede senha nem cookie. A conclusão das aulas continua sendo registrada por você, a não ser que a fonte ofereça integração compatível.</span></p>
  </>;

  const analyzingStep = phase === 'analyzing' && <div className="import-analyzing" aria-live="polite">
    <span className="dialog-emblem"><Icon name="search"/></span>
    <h2 id="dialog-title" className="headline" ref={heading}>Analisando a fonte…</h2>
    <ol className="import-progress-list">
      {['Abrindo o link', 'Lendo o conteúdo público', 'Organizando áreas e aulas'].map((label, index) => <motion.li key={label} initial={{ opacity: .4 }} animate={{ opacity: 1 }} transition={{ delay: index * .22, duration: .4 }}><span className="import-pulse" aria-hidden="true"/>{label}</motion.li>)}
    </ol>
    <p className="quiet-note">Leva alguns segundos. Se a fonte exigir login, você poderá colar a grade em vez de digitar aula por aula.</p>
  </div>;

  const reviewStep = phase === 'review' && payload && <>
    <span className="eyebrow">{payload.provider.id === 'unknown' ? EXTRACTION_LABEL[payload.extraction.kind] : `${payload.provider.label} · ${EXTRACTION_LABEL[payload.extraction.kind] || 'análise da fonte'}`}</span>
    <h2 id="dialog-title" className="headline" ref={heading}>{payload.title}</h2>
    <div className="import-badges">
      <span className={`import-badge ${payload.completeness === 'complete' ? 'tone-mint' : 'tone-warn'}`}>
        <Icon name={payload.completeness === 'complete' ? 'check' : 'help'}/>
        {payload.completeness === 'complete' ? 'Grade publicada pela fonte' : 'Grade parcial — confira antes de adicionar'}
      </span>
      <span className="import-badge neutral"><Icon name="book"/>{payload.disciplines.length} {payload.disciplines.length === 1 ? 'área' : 'áreas'} · {total} aulas</span>
    </div>
    {payload.warnings.length > 0 && <ul className="import-warning-list">{payload.warnings.map((warning) => <li key={warning}><Icon name="help"/><span>{warning}</span></li>)}</ul>}
    {payload.demo && <p className="inline-note"><Icon name="help"/><span>Dados de demonstração: esta grade não veio de uma análise real.</span></p>}

    <div className="import-toolbar">
      <div className="import-toolbar-actions">
        <button className="text-button" onClick={() => toggleMany(allLessonIds(payload), true)}>Selecionar todas</button>
        <button className="text-button" onClick={() => toggleMany(allLessonIds(payload), false)}>Limpar seleção</button>
      </div>
      <span className="import-count" role="status">{chosen} de {total} aulas selecionadas</span>
    </div>

    <div className="import-tree" aria-label="Áreas encontradas">
      {payload.disciplines.map((discipline) => {
        const lessonIds = discipline.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
        const picked = lessonIds.filter((id) => selected.has(id)).length;
        const stateMixed = picked === 0 ? 'false' : picked === lessonIds.length ? 'true' : 'mixed';
        const isOpen = expanded.has(discipline.id);
        return <div className={`import-discipline ${isOpen ? 'is-open' : ''}`} key={discipline.id}>
          <div className="import-discipline-head">
            <button role="checkbox" aria-checked={stateMixed} aria-label={`Selecionar a área ${discipline.title}`} className="import-check" onClick={() => toggleMany(lessonIds, picked !== lessonIds.length)}>
              <Icon name={stateMixed === 'true' ? 'check' : stateMixed === 'mixed' ? 'minus' : 'plus'}/>
            </button>
            <button className="import-discipline-toggle" aria-expanded={isOpen} onClick={() => toggleExpanded(discipline.id)}>
              <span className="import-discipline-title">{discipline.title}</span>
              <small>{discipline.modules.length} {discipline.modules.length === 1 ? 'módulo' : 'módulos'} · {picked}/{lessonIds.length} aulas</small>
              <Icon name={isOpen ? 'chevron-up' : 'chevron-down'}/>
            </button>
          </div>
          {isOpen && <div className="import-modules">
            {discipline.modules.map((module) => {
              const moduleIds = module.lessons.map((lesson) => lesson.id);
              return <div className="import-module" key={module.id}>
                <div className="import-module-head">
                  <button role="checkbox" aria-checked={moduleIds.every((id) => selected.has(id)) ? 'true' : moduleIds.some((id) => selected.has(id)) ? 'mixed' : 'false'} aria-label={`Selecionar o módulo ${module.title}`} className="import-check small" onClick={() => toggleMany(moduleIds, !moduleIds.every((id) => selected.has(id)))}>
                    <Icon name={moduleIds.every((id) => selected.has(id)) ? 'check' : moduleIds.some((id) => selected.has(id)) ? 'minus' : 'plus'}/>
                  </button>
                  <strong>{module.title}</strong>
                </div>
                <ul className="import-lessons">
                  {module.lessons.map((lesson) => <li key={lesson.id}>
                    <button role="checkbox" aria-checked={selected.has(lesson.id) ? 'true' : 'false'} aria-label={`Incluir a aula ${lesson.title}`} className="import-check small" onClick={() => toggleLesson(lesson.id)}>
                      <Icon name={selected.has(lesson.id) ? 'check' : 'plus'}/>
                    </button>
                    <span className="import-lesson-title">{lesson.title}</span>
                    {lesson.duration ? <small className="import-lesson-time">{formatDuration(lesson.duration)}</small> : null}
                  </li>)}
                </ul>
              </div>;
            })}
          </div>}
        </div>;
      })}
    </div>

    {examLike && <details className="import-exam">
      <summary>Preparando para prova (opcional)</summary>
      <p className="quiet-note">O edital é uma referência separada da grade do curso. Sem edição e fase identificadas, o Lume não calcula o que falta para a prova.</p>
      <div className="field-row">
        <label className="field">Edição do exame<input value={edition} onChange={(event) => setEdition(event.target.value)} placeholder="Ex.: 1º Exame de 2026" maxLength={40}/></label>
        <label className="field">Fase<select value={examPhase} onChange={(event) => setExamPhase(event.target.value)}><option value="">Não sei ainda</option><option value="1ª fase">1ª fase</option><option value="2ª fase">2ª fase</option></select></label>
      </div>
      <p className="quiet-note">A comparação com o edital oficial só aparece quando houver um edital verificado cadastrado. A grade importada nunca é apresentada como cobertura completa da prova.</p>
    </details>}

    <div className="dialog-actions">
      <Button className="full-width" onClick={confirmImport} disabled={!chosen}><Icon name="plus"/>{updating ? 'Atualizar curso' : `Adicionar ${chosen} ${chosen === 1 ? 'aula' : 'aulas'} à biblioteca`}</Button>
      <button className="text-button centered" onClick={() => { setPhase('link'); setPayload(null); }}>Analisar outro link</button>
    </div>
    <p className="quiet-note">Adicionar o curso não gera XP. O progresso das aulas é registrado por você e fica salvo na sua conta.</p>
  </>;

  const errorView = phase === 'error' && <div className="import-error">
    <span className="dialog-emblem tone-warn"><Icon name="help"/></span>
    <h2 id="dialog-title" className="headline" ref={heading}>{errorTitle(error?.code)}</h2>
    <p className="dialog-text">{error?.message}</p>
    {error?.code === 'protected' || error?.code === 'no_syllabus' || error?.code === 'unparsed_text'
      ? <p className="quiet-note">O Lume não contorna login nem controles de acesso. A saída é colar a ementa ou enviar um arquivo — sem digitar cada aula.</p>
      : <p className="quiet-note">O link e o que você já escolheu continuam guardados nesta janela.</p>}
    <div className="dialog-actions">
      <Button onClick={() => runAnalysis(mode === 'paste' ? { kind: 'text', text, title, url: url.trim() } : { kind: 'url', url: url.trim() })}><Icon name="return"/>Tentar de novo</Button>
      <Button secondary onClick={() => { setMode('paste'); setPhase('link'); }}><Icon name="book"/>Colar a grade ou enviar arquivo</Button>
    </div>
    <button className="text-button centered" onClick={close}>Fechar e continuar depois</button>
  </div>;

  const doneView = phase === 'done' && <div className="import-done">
    <span className="dialog-emblem tone-mint"><Icon name="check"/></span>
    <span className="eyebrow">Importação concluída</span>
    <h2 id="dialog-title" className="headline" ref={heading}>{imported?.course.title || payload?.title}</h2>
    <p className="muted-text">{chosen} {chosen === 1 ? 'aula adicionada' : 'aulas adicionadas'} à sua biblioteca{updating ? '. Conclusões e marcadores anteriores foram preservados.' : '.'}</p>
    {imported?.auto && <p className="inline-note"><Icon name="spark"/><span>Detectado e adicionado automaticamente. {imported.partial ? 'A grade é parcial: confira as aulas na Biblioteca.' : 'Confira o curso na Biblioteca quando quiser.'}</span></p>}
    <ul className="import-summary">
      <li><Icon name="book"/><span>{payload?.provider.id === 'unknown' ? `Origem: ${EXTRACTION_LABEL[payload?.extraction.kind] || 'conteúdo enviado'}` : `Plataforma: ${payload?.provider.label}`}</span></li>
      <li><Icon name="spark"/><span>Conteúdo identificado: {payload?.provider.id === 'unknown' ? 'grade fornecida por você' : EXTRACTION_LABEL[payload?.extraction.kind]}{payload?.completeness === 'partial' ? ' (grade parcial)' : ''}</span></li>
      <li><Icon name="focus"/><span>Progresso das aulas: registro manual · nenhuma integração de progresso ativa</span></li>
      <li><Icon name="check"/><span>XP concedido agora: 0 — importar organiza, não recompensa</span></li>
    </ul>
    <div className="dialog-actions">
      <Button className="full-width" onClick={() => { close(); if (imported?.course) open({ type: 'course', id: imported.course.id }); else go('biblioteca'); }}>Ver o curso<Icon name="arrow"/></Button>
      <Button secondary onClick={() => { close(); go('biblioteca'); }}>Voltar à biblioteca</Button>
    </div>
  </div>;

  return <div className="dialog-content import-dialog">
    {linkStep}{analyzingStep}{reviewStep}{errorView}{doneView}
  </div>;
}

function errorTitle(code) {
  switch (code) {
    case 'protected': return 'Essa fonte pede acesso à conta';
    case 'no_syllabus': return 'A grade não está na página pública';
    case 'invalid_url': return 'Confira o link';
    case 'blocked_host': return 'Esse endereço não pode ser analisado';
    case 'timeout': return 'A fonte demorou para responder';
    case 'network_error': return 'Não consegui falar com a fonte';
    case 'too_large': return 'Conteúdo grande demais';
    case 'rate_limited': return 'Muitas análises em pouco tempo';
    case 'unparsed_text': case 'empty_text': return 'Não encontrei aulas nesse texto';
    default: return 'A análise não terminou';
  }
}
