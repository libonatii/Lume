import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  MAX_SLIDE_BODY, MAX_SLIDE_TITLE, SLIDE_COMPLETION_RATIO, SLIDE_XP,
  addSlide, completeDeck, markSlideSeen, moveSlide, normalizeSlides,
  removeSlide, setSlideImage, slidePositionLabel, slidesSummary, updateSlide,
} from '../../public/slides-domain.js';
import Icon from './Icon.jsx';
import { Button, Progress } from './ui.jsx';

function SlideForm({ initial = { title: '', body: '' }, onSubmit, onCancel, submitLabel }) {
  const [title, setTitle] = useState(initial.title || '');
  const [body, setBody] = useState(initial.body || '');
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    if (!title.trim() && !body.trim()) { setError('Dê um título ou escreva o conteúdo do slide.'); return; }
    try {
      onSubmit({ title, body });
    } catch (exception) {
      setError(exception.message);
    }
  }
  return <form className="slide-form" onSubmit={submit}>
    <label className="field">Título do slide
      <input value={title} maxLength={MAX_SLIDE_TITLE} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Conceito de jurisdição"/>
    </label>
    <label className="field">Conteúdo
      <textarea value={body} maxLength={MAX_SLIDE_BODY} rows={4} onChange={(event) => setBody(event.target.value)} placeholder="Escreva o que você quer lembrar neste slide."/>
    </label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions inline-actions">
      <Button type="submit"><Icon name="check"/>{submitLabel}</Button>
      {onCancel && <Button secondary type="button" onClick={onCancel}>Cancelar</Button>}
    </div>
  </form>;
}

function SlideImageControl({ courseId, slide, update, notify }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('Escolha uma imagem PNG, JPG, WebP ou GIF.'); return; }
    if (file.size > 12 * 1024 * 1024) { notify('A imagem é grande demais (máximo 12 MB).'); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/slides/media/${encodeURIComponent(courseId)}/${encodeURIComponent(slide.id)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Não foi possível enviar a imagem.');
      update((previous) => setSlideImage(previous, courseId, slide.id, data.url));
      notify('Imagem do slide enviada.');
    } catch (exception) {
      notify(exception.message || 'Não foi possível enviar a imagem do slide.');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/slides/media/${encodeURIComponent(courseId)}/${encodeURIComponent(slide.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      update((previous) => setSlideImage(previous, courseId, slide.id, ''));
      notify('Imagem removida do slide.');
    } finally {
      setBusy(false);
    }
  }
  return <div className="slide-image-control">
    {slide.image ? <img src={slide.image} alt={`Imagem do slide ${slide.title}`}/> : <span className="slide-image-empty"><Icon name="image"/></span>}
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={upload} aria-label={`Escolher imagem para o slide ${slide.title}`}/>
    <button type="button" className="text-button" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Enviando…' : slide.image ? 'Trocar imagem' : 'Adicionar imagem'}</button>
    {slide.image && <button type="button" className="text-button" onClick={remove} disabled={busy}>Remover imagem</button>}
  </div>;
}

export function SlidesEditor({ course, update, notify }) {
  const slides = normalizeSlides(course.slides);
  const summary = slidesSummary(course);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState('');

  function add(values) {
    update((previous) => addSlide(previous, course.id, values));
    setAdding(false);
    notify('Slide adicionado à apresentação.');
  }
  function save(slideId, values) {
    update((previous) => updateSlide(previous, course.id, slideId, values));
    setEditingId('');
    notify('Slide atualizado.');
  }
  function remove(slideId) {
    if (!window.confirm('Excluir este slide? O progresso dele sai da apresentação; o XP já concedido não é retirado.')) return;
    update((previous) => removeSlide(previous, course.id, slideId));
    notify('Slide excluído.');
  }
  function move(slideId, direction) {
    update((previous) => moveSlide(previous, course.id, slideId, direction));
  }

  return <section className="slides-editor" aria-labelledby="slides-editor-title">
    <div className="slides-editor-head">
      <div>
        <span className="eyebrow">Apresentação interna</span>
        <h3 id="slides-editor-title" className="title">Slides de {course.title}</h3>
        <p className="muted-text">Crie os slides aqui e abra no Lume, sem depender do site de origem. {slidePositionLabel(summary)}.</p>
      </div>
      {slides.length > 0 && <Button secondary onClick={() => setAdding((value) => !value)}><Icon name="plus"/>Adicionar slide</Button>}
    </div>

    {slides.length === 0 && !adding && <div className="slides-empty">
      <Icon name="book"/>
      <p>Nenhum slide ainda. Você pode montar uma apresentação curta para revisar este material.</p>
      <Button onClick={() => setAdding(true)}><Icon name="plus"/>Criar o primeiro slide</Button>
    </div>}

    {adding && <SlideForm submitLabel="Adicionar slide" onSubmit={add} onCancel={() => setAdding(false)}/>}

    {slides.length > 0 && <ol className="slides-editor-list">
      {slides.map((slide, index) => <li key={slide.id} className="slide-editor-item">
        {editingId === slide.id
          ? <SlideForm initial={slide} submitLabel="Salvar slide" onSubmit={(values) => save(slide.id, values)} onCancel={() => setEditingId('')}/>
          : <>
            <span className="slide-number">{String(index + 1).padStart(2, '0')}</span>
            <div className="slide-editor-copy">
              <strong>{slide.title}</strong>
              {slide.body && <p className="muted-text">{slide.body.length > 160 ? `${slide.body.slice(0, 160)}…` : slide.body}</p>}
              <SlideImageControl courseId={course.id} slide={slide} update={update} notify={notify}/>
            </div>
            <div className="slide-editor-actions">
              <button className="icon-button" onClick={() => move(slide.id, 'up')} disabled={index === 0} aria-label={`Mover o slide ${slide.title} para cima`}><Icon name="chevron-up"/></button>
              <button className="icon-button" onClick={() => move(slide.id, 'down')} disabled={index === slides.length - 1} aria-label={`Mover o slide ${slide.title} para baixo`}><Icon name="chevron-down"/></button>
              <button className="icon-button" onClick={() => setEditingId(slide.id)} aria-label={`Editar o slide ${slide.title}`}><Icon name="edit"/></button>
              <button className="icon-button" onClick={() => remove(slide.id)} aria-label={`Excluir o slide ${slide.title}`}><Icon name="close"/></button>
            </div>
          </>}
      </li>)}
    </ol>}

    <p className="quiet-note">O XP de apresentação é único: exige {Math.round(SLIDE_COMPLETION_RATIO * 100)}% dos slides vistos, o último slide aberto e uma confirmação. Abrir ou pular direto para o fim não concede nada.</p>
  </section>;
}

export function SlidesViewer({ course, state, update, close, notify, account }) {
  const slides = normalizeSlides(course.slides);
  const summary = slidesSummary(course);
  const initial = Math.max(0, slides.findIndex((slide) => slide.id === summary.progress.lastId));
  const [index, setIndex] = useState(initial);
  const heading = useRef(null);

  useEffect(() => {
    if (!slides.length) return;
    update((previous) => markSlideSeen(previous, course.id, slides[index]?.id || slides[0].id));
  }, [course.id, index, slides.length, update]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.defaultPrevented) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); setIndex((value) => Math.min(slides.length - 1, value + 1)); }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
      if (event.key === 'Home') { event.preventDefault(); setIndex(0); }
      if (event.key === 'End') { event.preventDefault(); setIndex(Math.max(0, slides.length - 1)); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [slides.length]);

  useEffect(() => {
    if (heading.current) heading.current.focus({ preventScroll: true });
  }, [index]);

  if (!slides.length) return <div className="dialog-content">
    <h2 id="dialog-title" className="title">Esta apresentação ainda não tem slides.</h2>
    <p className="muted-text">Volte ao material e crie o primeiro slide.</p>
    <Button onClick={close}>Voltar</Button>
  </div>;

  const slide = slides[index] || slides[0];
  const current = slidesSummary({ ...course, slideProgress: { ...summary.progress, lastId: slide.id } });
  const completed = Boolean(summary.progress.completedAt);

  function conclude() {
    const result = completeDeck(state, course.id);
    if (!result.completed) {
      notify(result.reason === 'coverage'
        ? `Veja pelo menos ${Math.round(SLIDE_COMPLETION_RATIO * 100)}% dos slides antes de concluir.`
        : result.reason === 'last'
          ? 'Abra o último slide antes de concluir a apresentação.'
          : 'Esta apresentação já foi concluída.');
      return;
    }
    update(result.state);
    notify(account
      ? 'Apresentação concluída. O XP elegível será confirmado pelo servidor na sua conta.'
      : 'Apresentação concluída nesta prévia. Entre na conta para o XP valer no ranking.');
    close();
  }

  return <div className="slides-viewer">
    <div className="slides-viewer-top">
      <span className="eyebrow">Apresentação · {slidePositionLabel(summary)}</span>
      <h2 id="dialog-title" className="headline" ref={heading}>{course.title}</h2>
      <Progress value={current.percent} tone={completed ? 'mint' : 'lume'} label={`Cobertura da apresentação: ${current.percent}%`}/>
    </div>
    <motion.article key={slide.id} className="slide-canvas" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .24, ease: [.22, 1, .36, 1] }} aria-live="polite">
      <span className="slide-counter">{index + 1} / {slides.length}</span>
      <h3 className="slide-title">{slide.title}</h3>
      {slide.image && <img className="slide-image" src={slide.image} alt={`Imagem do slide ${slide.title}`}/>}
      {slide.body ? <p className="slide-body">{slide.body}</p> : <p className="muted-text">Este slide só tem título.</p>}
      {completed && <span className="slide-completed"><Icon name="check"/>Apresentação concluída</span>}
    </motion.article>
    <div className="slides-viewer-actions">
      <Button secondary onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}><Icon name="back"/>Anterior</Button>
      <Button secondary onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))} disabled={index === slides.length - 1}>Próximo<Icon name="arrow"/></Button>
      {!completed && current.nearEnd && current.lastSeen && <Button onClick={conclude}><Icon name="check"/>Concluir apresentação</Button>}
      {!completed && (!current.nearEnd || !current.lastSeen) && <span className="quiet-note">Faltam slides para liberar a conclusão.</span>}
      {completed && <span className="quiet-note">{account ? `+${SLIDE_XP} XP elegível, uma única vez, confirmado pelo servidor.` : 'Apresentação concluída nesta prévia. O XP de ranking só vale em uma conta.'}</span>}
    </div>
    <p className="quiet-note">Use as setas do teclado para navegar. O progresso é salvo na sua conta; abrir o último slide sem ver os outros não conclui a apresentação.</p>
  </div>;
}
