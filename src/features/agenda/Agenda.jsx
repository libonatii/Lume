import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import themePlugin from '@fullcalendar/react/themes/classic';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/react/interaction';
import ptBr from '@fullcalendar/react/locales/pt-br';
import { CATEGORIES, agendaSuggestions, validDate, shiftDate } from '../../../public/agenda-domain.js';
import { localDate } from '../../../public/tasks-domain.js';
import { Button } from '../../ui/ui.jsx';
import Icon from '../../ui/Icon.jsx';
import SectionTabs from '../../app/SectionTabs.jsx';
import { requestNotifications } from './Reminders.jsx';
import { calendarEvent, calendarPatch, emptyDraft } from './calendar-model.js';
import AppointmentEditor from './AppointmentEditor.jsx';
import AppointmentDetails from './AppointmentDetails.jsx';

// O calendário mostra só o mês; horários são definidos no editor do compromisso.
const plugins = [themePlugin, dayGridPlugin, interactionPlugin];
const CATEGORY_ICONS = { study: 'book', exam: 'edit', delivery: 'flag', personal: 'user' };
const narrow = () => window.matchMedia('(max-width: 820px)').matches;

export default function Agenda({ state, actions, taskActions, confirmSave, retrySave, saveError, syncStatus, params, notify }) {
  const today = localDate();
  const initialDate = validDate(params?.get('dia')) ? params.get('dia') : today;
  const task = state.tasks.find((item) => item.id === params?.get('tarefa'));
  const calendar = useRef(null);
  const section = useRef(null);
  const tray = useRef(null);
  // null na primeira montagem: o calendário aparece sem deslizar.
  const direction = useRef(null);
  const [date, setDate] = useState(initialDate);
  const [period, setPeriod] = useState('');
  const [panel, setPanel] = useState(task ? { draft: emptyDraft(initialDate, { title: task.title, taskIds: [task.id] }) } : null);
  const [planning, setPlanning] = useState(false);
  const [settings, setSettings] = useState(false);
  const [hidden, setHidden] = useState(() => new Set(['cancelled']));
  const [permission, setPermission] = useState('Notification' in window ? Notification.permission : 'unsupported');
  const entries = state.agenda || [];
  const visible = useMemo(() => entries.filter((item) => !hidden.has(item.category) && !(item.cancelled && hidden.has('cancelled'))), [entries, hidden]);
  const events = useMemo(() => visible.map((item) => calendarEvent(item, state.tasks)), [visible, state.tasks]);
  const suggestions = useMemo(() => agendaSuggestions(state, today), [state, today]);
  const scheduled = new Set(entries.filter((item) => !item.cancelled).flatMap((item) => item.taskIds));
  const pending = state.tasks.filter((item) => !item.done && !scheduled.has(item.id));
  const late = entries.filter((item) => !item.done && !item.cancelled && item.date < today);
  const empty = !entries.some((item) => !item.cancelled);
  const blocked = ['loading', 'error', 'saving'].includes(syncStatus);
  const selected = panel?.id ? entries.find((item) => item.id === panel.id) : null;
  const api = () => calendar.current?.getApi();
  function edit(item, expected = null) { setPanel({ draft: { ...item }, expected, key: crypto.randomUUID() }); }
  // Criação rápida: popover junto ao horário no computador; painel inferior no celular.
  function quick(draft, jsEvent) {
    if (narrow() || !jsEvent) { edit(draft); return; }
    setPanel({ draft, anchor: { x: jsEvent.clientX, y: jsEvent.clientY }, key: crypto.randomUUID() });
  }
  // Recém-criado, movido ou restaurado: o bloco assenta no lugar uma vez. A animação é
  // imperativa para não redesenhar eventos (o que cancelaria um arrasto em andamento).
  function flash(ids) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const id of ids) {
        section.current?.querySelectorAll(`[data-appointment-id="${CSS.escape(id)}"]`).forEach((el) => el.animate?.(
          [{ transform: 'scale(.94)', opacity: .35 }, { transform: 'none', opacity: 1 }],
          { duration: 420, easing: 'cubic-bezier(.34, 1.4, .64, 1)' }));
      }
    }));
  }
  function offerUndo(message, previous, ids) {
    notify?.(message, { action: { label: 'Desfazer', run: async () => {
      try {
        const result = actions.restore(previous, ids);
        if (!result) return;
        await confirmSave();
        flash(ids);
        notify?.('Alteração desfeita.');
      } catch (exception) { notify?.(exception.message || 'Não foi possível desfazer. Recarregue e tente de novo.'); }
    } } });
  }
  function navigate(step) {
    direction.current = step;
    if (step < 0) api()?.prev(); else if (step > 0) api()?.next(); else api()?.today();
  }
  function goDate(value) { if (validDate(value)) api()?.gotoDate(value); }
  function toggleFilter(key) { setHidden((old) => { const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  function select(info) {
    if (blocked) return;
    quick(emptyDraft(info.startStr.slice(0, 10), calendarPatch(info)), info.jsEvent);
    api()?.unselect();
  }
  async function move(info) {
    const item = entries.find((entry) => entry.id === info.event.id);
    if (!item) { info.revert(); return; }
    const patch = calendarPatch(info.event, item.timeZone, { month: true });
    info.revert();
    if (blocked) return;
    const draft = { ...item, ...patch };
    if (item.seriesId) { edit(draft); return; }
    const previous = entries;
    let expected = null;
    try {
      const result = actions.update(item.id, patch);
      if (!result) return;
      expected = { agenda: [result.state.agenda.find((entry) => entry.id === item.id)], tasks: [] };
      const saved = await confirmSave();
      if (JSON.stringify(saved.agenda.find((entry) => entry.id === item.id)) !== JSON.stringify(expected.agenda[0])) throw new Error('Confira a alteração após recarregar os dados.');
      flash([item.id]);
      offerUndo('Horário atualizado.', previous, [item.id]);
    } catch { edit(draft, expected); }
  }
  async function remove(item, scope) {
    const previous = entries;
    const result = actions.remove(item.id, scope);
    if (!result) return;
    await confirmSave();
    const ids = previous.filter((entry) => !result.state.agenda.some((kept) => kept.id === entry.id)).map((entry) => entry.id);
    setPanel(null);
    offerUndo(ids.length > 1 ? `${ids.length} compromissos excluídos.` : 'Compromisso excluído.', previous, ids);
  }
  function saved(ids, editing) {
    flash(ids);
    notify?.(editing ? 'Compromisso atualizado.' : ids.length > 1 ? `${ids.length} compromissos agendados.` : 'Compromisso agendado.');
  }
  // Troca de período: o conteúdo novo entra deslizando alguns pixels na direção da navegação.
  function datesSet(info) {
    setPeriod(info.view.title);
    setDate(localDate(api()?.getDate() || new Date(`${initialDate}T12:00:00`)));
    const target = section.current?.querySelector('.agenda-calendar-frame');
    if (target?.animate && direction.current !== null) {
      const offset = direction.current * 10;
      target.animate([{ opacity: .35, transform: `translateX(${offset}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    }
    direction.current = 0;
  }
  useEffect(() => {
    if (!planning || !tray.current) return;
    const node = tray.current;
    const draggable = new Draggable(node, { itemSelector: '[data-task-id]', eventData: (el) => ({ title: el.dataset.title, create: false }) });
    // O cartão "levanta" enquanto é carregado para a grade.
    const lift = (event) => event.target.closest('[data-task-id]')?.classList.add('is-lifting');
    const drop = () => node.querySelectorAll('.is-lifting').forEach((el) => el.classList.remove('is-lifting'));
    node.addEventListener('pointerdown', lift);
    document.addEventListener('pointerup', drop);
    document.addEventListener('pointercancel', drop);
    return () => { draggable.destroy(); node.removeEventListener('pointerdown', lift); document.removeEventListener('pointerup', drop); document.removeEventListener('pointercancel', drop); };
  }, [planning]);
  return <div className="agenda-root">
    <header className="agenda-heading">
      <div className="agenda-title"><span className="eyebrow">Plano de estudos · Calendário</span><h1 className="display">Agenda</h1></div>
      <div className="page-heading-actions">
        <a className="button secondary" href="#agendar"><Icon name="calendar-plus"/>Agendar sessão</a>
        <Button secondary aria-expanded={planning} onClick={() => setPlanning(!planning)}>Para agendar{pending.length ? ` (${pending.length})` : ''}</Button>
        <button type="button" className="icon-button agenda-bell" aria-label="Lembretes" aria-expanded={settings} onClick={() => setSettings(!settings)}><Icon name="bell"/></button>
        <Button className="agenda-new" onClick={() => edit(emptyDraft(date))} disabled={blocked}><Icon name="plus"/><span className="agenda-new-label">Novo compromisso</span></Button>
      </div>
      {settings && <section className="card-surface agenda-notification-settings"><h2 className="title">Lembretes</h2><p>Avisos no Lume e no computador enquanto o site ou aplicativo estiver executando, com rede. Avisos vencidos há até 15 minutos são recuperados uma vez por conta. Na prévia, os lembretes não são enviados.</p><Button secondary onClick={async () => { try { setPermission(await requestNotifications()); } catch { setPermission('denied'); } }}>Ativar notificações no computador</Button><p role="status">{permission === 'granted' ? 'Notificações autorizadas neste dispositivo.' : permission === 'denied' ? 'Notificações bloqueadas. Altere a permissão do site; os avisos internos continuam disponíveis.' : permission === 'unsupported' ? 'Este ambiente não oferece notificações do sistema.' : 'Notificações do computador ainda não autorizadas.'}</p></section>}
    </header>
    <SectionTabs route="agenda"/>
    <div className="agenda-toolbar">
      <div className="agenda-period">
        <div className="agenda-nav-group"><button type="button" aria-label="Período anterior" onClick={() => navigate(-1)}><Icon name="chevron-left"/></button><button type="button" onClick={() => navigate(0)}>Hoje</button><button type="button" aria-label="Próximo período" onClick={() => navigate(1)}><Icon name="chevron"/></button></div>
        <h2>{period}</h2>{syncStatus === 'loading' && <span className="muted-text" role="status">Carregando…</span>}
      </div>
    </div>
    <div className="agenda-filters" role="group" aria-label="Mostrar no calendário">
      {Object.entries(CATEGORIES).map(([key, label]) => <button key={key} type="button" className={`agenda-chip cat-${key}`} aria-pressed={!hidden.has(key)} onClick={() => toggleFilter(key)}><span className={`agenda-category-dot cat-${key}`} aria-hidden="true"/>{label}</button>)}
      <button type="button" className="agenda-chip cat-cancelled" aria-pressed={!hidden.has('cancelled')} onClick={() => toggleFilter('cancelled')}><span className="agenda-category-dot cat-cancelled" aria-hidden="true"/>Canceladas</button>
    </div>
    <div className={`agenda-workspace${planning ? ' with-planner' : ''}`}>
      <section ref={section} className="agenda-calendar" aria-label="Calendário: mês">
        {/* Flutua sobre a grade: não desloca o calendário e deixa os cliques passarem. */}
        {empty && syncStatus !== 'loading' && <section className="agenda-empty"><span className="empty-icon"><Icon name="calendar"/></span><div><h2 className="title">Sua agenda está livre</h2><p>Clique num dia para reservar tempo; depois, arraste o bloco para outro dia ou abra-o para ajustar o horário.</p></div>{(pending.length > 0 || suggestions.length > 0) && !planning && <Button secondary onClick={() => setPlanning(true)}>Ver o que agendar</Button>}</section>}
        <div className="agenda-calendar-frame">
        <FullCalendar ref={calendar} plugins={plugins} locale={ptBr} initialView="dayGridMonth" initialDate={initialDate} headerToolbar={false}
          height="min(640px, 64vh)" firstDay={1} eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          eventClass={(info) => `${info.isDragging ? 'is-dragging' : ''}${info.isMirror ? ' is-mirror' : ''}`}
          noEventsContent="Nada agendado neste período."
          events={events} editable={!blocked} selectable={!blocked} selectMirror select={select} eventDrop={move} eventResize={move}
          eventLongPressDelay={400} selectLongPressDelay={400}
          dateClick={(info) => { if (!blocked && window.matchMedia('(max-width: 700px)').matches) edit(emptyDraft(info.dateStr.slice(0, 10), calendarPatch({ start: info.date, startStr: info.dateStr, allDay: info.allDay }))); }}
          eventClick={(info) => setPanel({ id: info.event.id })} dayMaxEvents={3}
          selectAllow={(info) => !info.allDay || info.endStr.slice(0, 10) === shiftDate(info.startStr.slice(0, 10), 1)}
          datesSet={datesSet}
          droppable={!blocked} drop={(info) => {
            const linked = state.tasks.find((item) => item.id === info.draggedEl.dataset.taskId);
            if (!linked || blocked) return;
            quick(emptyDraft(info.dateStr.slice(0, 10), { ...calendarPatch({ start: info.date, startStr: info.dateStr, allDay: info.allDay }), title: linked.title, taskIds: [linked.id] }), info.jsEvent);
          }}
          eventContent={(info) => {
            const item = info.event.extendedProps.item;
            const detail = [info.timeText, info.event.extendedProps.progress && `${info.event.extendedProps.progress} tarefas`, item?.done && 'encerrada', item?.cancelled && 'cancelada'].filter(Boolean).join(' · ');
            return <span className="agenda-event-content in-month"><strong>{item && <Icon name={CATEGORY_ICONS[item.category]}/>}{info.event.title}</strong>{detail && <span>{detail}</span>}</span>;
          }}
          eventDidMount={(info) => {
            const item = info.event.extendedProps.item;
            info.el.dataset.appointmentId = info.event.id;
            info.el.setAttribute('aria-label', `Abrir compromisso ${info.event.title}`);
            if (item) info.el.title = `${info.event.title} · ${item.start ? `${item.start}–${item.end}` : 'Sem horário'} · ${CATEGORIES[item.category]}`;
          }}
        />
        </div>
      </section>
      {planning && <aside className="agenda-planner" ref={tray} aria-label="Para agendar"><div className="agenda-planner-heading"><h2 className="title">Para agendar</h2><button type="button" className="icon-button" aria-label="Fechar Para agendar" onClick={() => setPlanning(false)}><Icon name="close"/></button></div><p>Arraste uma tarefa para um horário ou use Agendar.</p><label className="field">Ir para data<input type="date" value={date} onChange={(e) => goDate(e.target.value)}/></label>
        <h3>Tarefas sem horário reservado</h3>{pending.length ? pending.map((item) => <div key={item.id} className="agenda-planner-item" data-task-id={item.id} data-title={item.title}><strong>{item.title}</strong>{item.dueDate && <small>Prazo: {item.dueDate}</small>}<button className="text-button" disabled={blocked} onClick={() => edit(emptyDraft(date, { title: item.title, taskIds: [item.id] }))}>Agendar tarefa {item.title}</button></div>) : <p>Nenhuma tarefa para agendar.</p>}
        <h3>Sugestões de estudo</h3>{suggestions.length ? suggestions.map((item) => <div key={`${item.courseId}:${item.lessonId}`} className="agenda-planner-item"><strong>{item.title}</strong><small>{item.date} · {item.minutes} min {item.durationKnown ? '' : '(estimativa)'}</small><button className="text-button" disabled={blocked} onClick={() => { goDate(item.date); edit(emptyDraft(item.date, { title: item.title, tasks: [{ title: item.title, courseId: item.courseId, lessonId: item.lessonId }] })); }}>Revisar sugestão</button></div>) : <p>Defina sua disponibilidade no <a href="#plano">Plano</a> para receber sugestões.</p>}
        {!!late.length && <details><summary>Pendências anteriores ({late.length})</summary>{late.map((item) => <button key={item.id} className="agenda-planner-item" onClick={() => setPanel({ id: item.id })}>{item.title} · {item.date}</button>)}</details>}
      </aside>}
    </div>
    {panel?.draft && <AppointmentEditor key={panel.key || 'initial'} initial={panel.draft} initialExpected={panel.expected} anchor={panel.anchor} state={state} actions={actions} confirmSave={confirmSave} retrySave={retrySave} saveError={saveError} onSaved={saved} onExpand={(draft) => setPanel({ draft, key: crypto.randomUUID() })} onClose={() => setPanel(null)}/>}
    {selected && <AppointmentDetails key={selected.id} item={selected} state={state} actions={actions} taskActions={taskActions} confirmSave={confirmSave} retrySave={retrySave} saveError={saveError} edit={edit} onRemove={remove} onClose={() => setPanel(null)}/>}
  </div>;
}
