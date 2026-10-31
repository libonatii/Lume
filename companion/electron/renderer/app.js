// Interface da janela. Recebe estado pronto do processo principal; não acessa
// rede, sistema de arquivos nem o token do dispositivo.

const $ = (id) => document.getElementById(id);
const CATEGORY_LABEL = {
  study: 'Estudo',
  project: 'Projeto',
  reading: 'Leitura',
  break: 'Pausa',
  game: 'Jogo',
  other: 'Outra atividade',
};

let state = null;
let busy = false;

function show(id, visible) {
  $(id).classList.toggle('hidden', !visible);
}

function elapsed(since) {
  const start = Date.parse(since);
  if (!Number.isFinite(start)) return '—';
  const total = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderStatus() {
  const status = $('status');
  if (!state.paired) {
    status.textContent = 'desconectado';
    status.className = 'pill off';
    return;
  }
  if (state.paused) {
    status.textContent = 'pausado';
    status.className = 'pill paused';
    return;
  }
  status.textContent = state.detected ? 'observando' : 'ativo';
  status.className = 'pill on';
}

function renderPresence() {
  const active = Boolean(state.detected) && !state.paused;
  $('presence-dot').className = `dot ${active ? 'on' : state.paused ? 'paused' : ''}`;
  $('presence-app').textContent = state.paused
    ? 'Presença pausada'
    : state.detected?.label || 'Nenhum aplicativo da lista';
  $('presence-meta').textContent = state.paused
    ? 'Nada está sendo enviado ao Lume.'
    : state.detected
      ? `${CATEGORY_LABEL[state.detected.category] || 'Outra atividade'} · ${state.deviceName || 'este computador'}`
      : 'Aguardando um aplicativo autorizado.';
  $('presence-time').textContent = active && state.since ? elapsed(state.since) : '—';
  $('pause').textContent = state.paused ? 'Retomar presença' : 'Pausar presença';
}

function renderPlan() {
  const plan = state.plan;
  show('plan', Boolean(plan));
  if (!plan) return;
  $('plan-totals').textContent = plan.totals.remaining
    ? `Faltam ${plan.totals.remaining} ${plan.totals.remaining === 1 ? 'aula' : 'aulas'} em ${plan.totals.activeCourses} ${plan.totals.activeCourses === 1 ? 'curso ativo' : 'cursos ativos'}`
    : 'Nada pendente nos cursos em andamento';
  const steps = $('plan-steps');
  steps.replaceChildren();
  for (const step of (plan.steps || []).slice(0, 3)) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = step.title;
    const meta = document.createElement('small');
    meta.textContent = [step.courseTitle, step.discipline, step.reason?.label].filter(Boolean).join(' · ');
    item.append(title, meta);
    steps.append(item);
  }
  const note = $('plan-note');
  note.textContent = plan.note || (plan.steps?.length ? '' : 'Sem passos pendentes.');
  note.classList.toggle('hidden', !note.textContent);
}

function renderError(message) {
  const node = $('error');
  node.textContent = message || '';
  node.classList.toggle('hidden', !message);
}

function render() {
  if (!state) return;
  $('device').textContent = state.paired
    ? `${state.deviceName || 'este computador'}${state.paused ? ' · pausado' : ''}`
    : 'Desconectado';
  renderStatus();
  show('pair', !state.paired);
  show('presence', state.paired);
  show('unpair', state.paired);
  if (state.paired) renderPresence();
  renderPlan();
  renderError(state.error);
  document.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
}

async function run(action, payload) {
  busy = true;
  render();
  try {
    const result = await window.companion.action(action, payload);
    if (result) {
      state = { ...state, ...result };
      render();
    }
    renderError('');
  } catch (error) {
    renderError(String(error?.message || error).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
  } finally {
    busy = false;
    render();
  }
}

$('pair-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const code = $('pair-code').value.trim();
  const name = $('pair-name').value.trim();
  const apiUrl = $('pair-api').value.trim();
  if (!code) { renderError('Informe o código mostrado no Lume.'); return; }
  run('pair', { code, name, apiUrl }).then(() => {
    if (state?.paired) {
      $('pair-code').value = '';
      $('pair-name').value = '';
    }
  });
});

$('pause').addEventListener('click', () => run('toggle-pause'));
$('refresh').addEventListener('click', () => run('refresh'));
$('open-settings').addEventListener('click', () => run('open-settings'));
$('unpair').addEventListener('click', () => {
  if (confirm('Desconectar este computador? A presença deixa de ser enviada até um novo pareamento.')) run('unpair');
});
$('open').addEventListener('click', () => run('open-lume'));

window.companion.onState((value) => {
  state = value;
  render();
});

setInterval(() => { if (state?.detected && !state.paused) $('presence-time').textContent = elapsed(state.since); }, 1000);

window.companion.action('state').then((value) => { state = value; render(); }).catch(() => renderError('Não foi possível carregar o estado do Companion.'));
