import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import themePlugin from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/react/interaction';
import ptBr from '@fullcalendar/react/locales/pt-br';
import { agendaSuggestions, validDate, shiftDate } from '../../../public/agenda-domain.js';
import { localDate } from '../../../public/tasks-domain.js';
import { Button } from '../../ui/ui.jsx';
import { requestNotifications } from './Reminders.jsx';
import { calendarEvent, calendarPatch, emptyDraft } from './calendar-model.js';
import AppointmentEditor from './AppointmentEditor.jsx';
import AppointmentDetails from './AppointmentDetails.jsx';

const plugins = [themePlugin, timeGridPlugin, dayGridPlugin, interactionPlugin];
const views = { timeGridDay: 'Dia', timeGridWeek: 'Semana', dayGridMonth: 'Mês' };

export default function Agenda({ state, actions, taskActions, confirmSave, retrySave, saveError, syncStatus, params }) {
  const today = localDate();
  const initialDate = validDate(params?.get('dia')) ? params.get('dia') : today;
  const task = state.tasks.find((item) => item.id === params?.get('tarefa'));
  const calendar = useRef(null);
  const tray = useRef(null);
  const [view, setView] = useState(() => window.matchMedia('(max-width: 700px)').matches ? 'timeGridDay' : 'timeGridWeek');
  const [date, setDate] = useState(initialDate);
  const [period, setPeriod] = useState('');
  const [panel, setPanel] = useState(task ? { draft: emptyDraft(initialDate, { title: task.title, taskIds: [task.id] }) } : null);
  const [planning, setPlanning] = useState(false);
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState('');
  const [permission, setPermission] = useState('Notification' in window ? Notification.permission : 'unsupported');
  const entries = state.agenda || [];
  const events = useMemo(() => entries.map((item) => calendarEvent(item, state.tasks)), [entries, state.tasks]);
  const suggestions = useMemo(() => agendaSuggestions(state, today), [state, today]);
  const scheduled = new Set(entries.filter((item) => !item.cancelled).flatMap((item) => item.taskIds));
  const pending = state.tasks.filter((item) => !item.done && !scheduled.has(item.id));
  const late = entries.filter((item) => !item.done && !item.cancelled && item.date < today);
  const blocked = ['loading', 'error', 'saving'].includes(syncStatus);
  const selected = panel?.id ? entries.find((item) => item.id === panel.id) : null;
  function edit(item, expected = null) { setPanel({ draft: { ...item }, expected, key: crypto.randomUUID() }); }
  function switchView(next) { calendar.current?.getApi().changeView(next); }
  function goDate(value) { if (validDate(value)) calendar.current?.getApi().gotoDate(value); }
  function select(info) {
    if (blocked) return;
    edit(emptyDraft(info.startStr.slice(0, 10), calendarPatch(info)));
    calendar.current?.getApi().unselect();
  }
  async function move(info) {
    const item = entries.find((entry) => entry.id === info.event.id);
    if (!item) { info.revert(); return; }
    const patch = calendarPatch(info.event, item.timeZone);
    info.revert();
    if (blocked) return;
    const draft = { ...item, ...patch };
    if (item.seriesId) { edit(draft); return; }
    let expected = null;
    try {
      const result = actions.update(item.id, patch);
      if (!result) return;
      expected = { agenda: [result.state.agenda.find((entry) => entry.id === item.id)], tasks: [] };
      const saved = await confirmSave();
      if (JSON.stringify(saved.agenda.find((entry) => entry.id === item.id)) !== JSON.stringify(expected.agenda[0])) throw new Error('Confira a alteração após recarregar os dados.');
      setNotice('Horário atualizado.');
    } catch { edit(draft, expected); }
  }
  useEffect(() => {
    if (!planning || !tray.current) return;
    const draggable = new Draggable(tray.current, { itemSelector: '[data-task-id]', eventData: (el) => ({ title: el.dataset.title, duration: '00:30', create: false }) });
    return () => draggable.destroy();
  }, [planning]);
  return <div className="agenda-root">
    <header className="agenda-heading"><div><h1 className="display">Agenda</h1><p>Reserve tempo para o que importa.</p></div><div className="page-heading-actions"><Button secondary aria-expanded={planning} onClick={() => setPlanning(!planning)}>Para agendar{pending.length ? ` (${pending.length})` : ''}</Button><Button onClick={() => edit(emptyDraft(date))} disabled={blocked}>Novo compromisso</Button></div></header>
    <div className="agenda-toolbar"><div className="agenda-period"><Button secondary aria-label="Período anterior" onClick={() => calendar.current?.getApi().prev()}>‹</Button><Button secondary onClick={() => calendar.current?.getApi().today()}>Hoje</Button><Button secondary aria-label="Próximo período" onClick={() => calendar.current?.getApi().next()}>›</Button><h2>{period}</h2></div><div className="agenda-view-switch" aria-label="Visualização">{Object.entries(views).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => switchView(key)}>{label}</button>)}</div></div>
    <div className={`agenda-workspace${planning ? ' with-planner' : ''}`}>
      <section className="agenda-calendar" aria-label={`Calendário: ${view === 'dayGridMonth' ? 'mês' : view === 'timeGridWeek' ? 'semana' : 'dia'}`}>
        <FullCalendar ref={calendar} plugins={plugins} locale={ptBr} initialView={view} initialDate={initialDate} headerToolbar={false} views={{ timeGridWeek: { titleFormat: { day: 'numeric', month: 'short', year: 'numeric' } } }}
          height="min(740px, 72vh)" firstDay={1} nowIndicator allDayText="Sem horário" slotDuration="00:30:00" snapDuration="00:30:00" scrollTime="08:00:00"
          slotHeaderFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} slotLaneClass="lume-time-slot"
          events={events} editable={!blocked} selectable={!blocked} selectMirror select={select} eventDrop={move} eventResize={move}
          dateClick={(info) => { if (!blocked && window.matchMedia('(max-width: 700px)').matches) edit(emptyDraft(info.dateStr.slice(0, 10), calendarPatch({ start: info.date, startStr: info.dateStr, allDay: info.allDay }))); }}
          eventClick={(info) => setPanel({ id: info.event.id })} dayMaxEvents={3} slotEventOverlap={false}
          selectAllow={(info) => !info.allDay || info.endStr.slice(0, 10) === shiftDate(info.startStr.slice(0, 10), 1)}
          datesSet={(info) => { setView(info.view.type); setPeriod(info.view.title); setDate(localDate(calendar.current?.getApi().getDate() || new Date(`${initialDate}T12:00:00`))); }}
          droppable={!blocked} drop={(info) => {
            const linked = state.tasks.find((item) => item.id === info.draggedEl.dataset.taskId);
            if (!linked || blocked) return;
            edit(emptyDraft(info.dateStr.slice(0, 10), { ...calendarPatch({ start: info.date, startStr: info.dateStr, allDay: info.allDay }), title: linked.title, taskIds: [linked.id] }));
          }}
          eventContent={(info) => <span className="agenda-event-content"><strong>{info.event.title}</strong><span>{info.timeText}{info.event.extendedProps.progress ? ` · ${info.event.extendedProps.progress} tarefas` : ''}{info.event.extendedProps.item?.done ? ' · encerrada' : ''}{info.event.extendedProps.item?.cancelled ? ' · cancelada' : ''}</span></span>}
          eventDidMount={(info) => { info.el.dataset.appointmentId = info.event.id; info.el.setAttribute('aria-label', `Abrir compromisso ${info.event.title}`); }}
        />
      </section>
      {planning && <aside className="agenda-planner" ref={tray} aria-label="Para agendar"><h2 className="title">Para agendar</h2><p>Arraste uma tarefa para um horário ou use Agendar.</p><label className="field">Ir para data<input type="date" value={date} onChange={(e) => goDate(e.target.value)}/></label>
        <h3>Tarefas sem horário reservado</h3>{pending.length ? pending.map((item) => <div key={item.id} className="agenda-planner-item" data-task-id={item.id} data-title={item.title}><strong>{item.title}</strong>{item.dueDate && <small>Prazo: {item.dueDate}</small>}<button className="text-button" disabled={blocked} onClick={() => edit(emptyDraft(date, { title: item.title, taskIds: [item.id] }))}>Agendar tarefa {item.title}</button></div>) : <p>Nenhuma tarefa para agendar.</p>}
        <h3>Sugestões de estudo</h3>{suggestions.length ? suggestions.map((item) => <div key={`${item.courseId}:${item.lessonId}`} className="agenda-planner-item"><strong>{item.title}</strong><small>{item.date} · {item.minutes} min {item.durationKnown ? '' : '(estimativa)'}</small><button className="text-button" disabled={blocked} onClick={() => { goDate(item.date); edit(emptyDraft(item.date, { title: item.title, tasks: [{ title: item.title, courseId: item.courseId, lessonId: item.lessonId }] })); }}>Revisar sugestão</button></div>) : <p>Defina sua disponibilidade no <a href="#plano">Plano</a> para receber sugestões.</p>}
        {!!late.length && <details><summary>Pendências anteriores ({late.length})</summary>{late.map((item) => <button key={item.id} className="agenda-planner-item" onClick={() => setPanel({ id: item.id })}>{item.title} · {item.date}</button>)}</details>}
      </aside>}
    </div>
    <footer className="agenda-help"><span>{syncStatus === 'loading' ? 'Carregando Agenda…' : 'Selecione um horário para criar. Arraste para mover; ajuste a borda para mudar a duração.'}</span><button className="text-button" aria-expanded={settings} onClick={() => setSettings(!settings)}>Lembretes</button></footer>
    {notice && <p role="status" className="muted-text">{notice}</p>}
    {settings && <section className="card-surface agenda-notification-settings"><h2 className="title">Lembretes</h2><p>Avisos no Lume e no computador enquanto o site ou aplicativo estiver executando, com rede. Avisos vencidos há até 15 minutos são recuperados uma vez por conta. Na prévia, os lembretes não são enviados.</p><Button secondary onClick={async () => { try { setPermission(await requestNotifications()); } catch { setPermission('denied'); } }}>Ativar notificações no computador</Button><p role="status">{permission === 'granted' ? 'Notificações autorizadas neste dispositivo.' : permission === 'denied' ? 'Notificações bloqueadas. Altere a permissão do site; os avisos internos continuam disponíveis.' : permission === 'unsupported' ? 'Este ambiente não oferece notificações do sistema.' : 'Notificações do computador ainda não autorizadas.'}</p></section>}
    {panel?.draft && <AppointmentEditor key={panel.key || 'initial'} initial={panel.draft} initialExpected={panel.expected} state={state} actions={actions} confirmSave={confirmSave} retrySave={retrySave} saveError={saveError} onClose={() => setPanel(null)}/>}
    {selected && <AppointmentDetails key={selected.id} item={selected} state={state} actions={actions} taskActions={taskActions} confirmSave={confirmSave} retrySave={retrySave} saveError={saveError} edit={edit} onClose={() => setPanel(null)}/>}
  </div>;
}
