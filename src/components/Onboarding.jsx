import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  STUDY_RHYTHMS, STUDY_TYPES, SESSION_MINUTES, CONTINUITY_OBSTACLES, TRACKING_PREFERENCES,
  studyRhythm, startJourney, saveOnboardingAnswer, completeJourney, emptyOnboarding, addMaterial,
} from '../../public/domain.js';
import Icon from './Icon.jsx';
import { Button } from './ui.jsx';

const panel = 'p-6 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-3';
const field = 'auth-field';

// Cada jornada tem a própria sequência. Não é o mesmo formulário com outro título.
const STEPS = {
  starting: [
    { key: 'subject', question: 'O que você gostaria de aprender?', hint: 'Um assunto é suficiente. Pode ser algo bem específico.' },
    { key: 'outcome', question: 'Qual resultado gostaria de alcançar?', hint: 'Ex.: entender o básico, concluir uma aula, montar um projeto.' },
    { key: 'material', question: 'Você já tem um curso, uma aula ou um material?', hint: 'Se ainda não tiver, ajudamos a definir o que procurar.' },
    { key: 'time', question: 'Quanto tempo gostaria de reservar para uma sessão?', hint: 'Pode deixar em branco. Dá para mudar depois.' },
  ],
  sometimes: [
    { key: 'studying', question: 'O que você já está estudando?', hint: 'Liste seus materiais, um por linha. Não precisa estar organizado.' },
    { key: 'priority', question: 'Qual material gostaria de retomar primeiro?', hint: 'Escolha um para virar sua prioridade.' },
    { key: 'resume', question: 'Onde você parou?', hint: 'Ex.: aula 3, página 42, metade do exercício.' },
    { key: 'obstacles', question: 'O que costuma dificultar a continuidade?', hint: 'Sem julgamento. Isso ajusta as sugestões.' },
  ],
  often: [
    { key: 'areas', question: 'Quais áreas e trilhas você acompanha?', hint: 'Uma por linha: programação, direito, idiomas, projetos.' },
    { key: 'routine', question: 'Você já possui uma rotina ou meta?', hint: 'Sua rotina é preservada; não vamos impor um plano genérico.' },
    { key: 'ongoing', question: 'Quais cursos, projetos ou leituras estão em andamento?', hint: 'Um por linha. Você define a prioridade depois.' },
    { key: 'tracking', question: 'O que gostaria de acompanhar melhor?', hint: 'Escolha o que faz sentido para o seu momento.' },
  ],
};

function Progress({ step, total }) {
  return <div className="onboarding-progress" role="group" aria-label={`Etapa ${step} de ${total}`}><div className="onboarding-progress-track"><motion.div className="onboarding-progress-fill" animate={{ width: `${(step / total) * 100}%` }} transition={{ duration: .3 }}/></div><span className="font-label-sm text-label-sm text-on-surface-variant">Etapa {step} de {total}</span></div>;
}

export default function Onboarding({ state, update, go, notify }) {
  const saved = state.onboarding ?? emptyOnboarding();
  const [journey, setJourney] = useState(saved.journey ?? state.habit ?? null);
  const [step, setStep] = useState(saved.journey && saved.status === 'active' ? saved.step : 0);
  const [answers, setAnswers] = useState(saved.answers ?? {});
  const [error, setError] = useState('');

  const steps = journey ? STEPS[journey] : [];
  const reviewStep = steps.length + 1;
  const socialStep = steps.length + 2;
  const total = socialStep;
  const resuming = saved.status === 'active' && saved.journey === journey;

  function persist(patch, nextStep) {
    const merged = { ...answers, ...patch };
    setAnswers(merged);
    update(previous => saveOnboardingAnswer(previous, patch, nextStep));
  }

  function choose(id) {
    setJourney(id);
    setStep(1);
    setError('');
    update(previous => startJourney(previous, id));
  }

  function advance(patch) {
    if (step >= socialStep) return;
    const key = steps[step - 1]?.key;
    if (key === 'subject' && !String(patch?.subject ?? answers.subject ?? '').trim()) {
      setError('Escreva um assunto para continuar.');
      return;
    }
    setError('');
    if (step === reviewStep) {
      createMaterial();
      persist(patch ?? {}, socialStep);
      setStep(socialStep);
      return;
    }
    persist(patch ?? {}, step + 1);
    setStep(step + 1);
  }

  function back() {
    if (step <= 1) { setStep(0); return; }
    persist({}, step - 1);
    setStep(step - 1);
  }

  function finish() {
    update(previous => completeJourney(saveOnboardingAnswer(previous, answers, socialStep)));
    go('hoje');
    notify('Seu começo está pronto. Você pode ajustar tudo depois.');
  }

  // Cria o primeiro material a partir das respostas. Não concede XP.
  function createMaterial() {
    const a = answers;
    let payload = null;
    if (journey === 'starting') {
      const title = (a.materialTitle || a.subject || '').trim();
      if (title) payload = { title, url: a.materialUrl || '', type: a.materialType || 'lesson', firstActivity: a.firstActivity || `Concluir a primeira atividade de ${title}` };
    } else if (journey === 'sometimes') {
      const title = (a.priority || String(a.studying ?? '').split('\n')[0] || '').trim();
      if (title) payload = { title, type: 'lesson', resumeAt: a.resume || '', firstActivity: a.resume ? `Retomar em: ${a.resume}` : 'Retomar de onde parei' };
    } else {
      const title = (String(a.ongoing ?? '').split('\n')[0] || String(a.areas ?? '').split('\n')[0] || '').trim();
      if (title) payload = { title, type: 'course', firstActivity: `Definir o próximo marco de ${title}` };
    }
    if (payload) update(previous => addMaterial(previous, payload));
  }

  const summary = useMemo(() => {
    if (!journey) return null;
    const a = answers;
    if (journey === 'starting') return [a.subject && `Assunto: ${a.subject}`, a.outcome && `Resultado: ${a.outcome}`, a.sessionMinutes && `Sessão de ${a.sessionMinutes} min`].filter(Boolean);
    if (journey === 'sometimes') return [a.priority && `Prioridade: ${a.priority}`, a.resume && `Ponto: ${a.resume}`, a.sessionMinutes && `Sessão de ${a.sessionMinutes} min`].filter(Boolean);
    return [a.areas && `Áreas: ${a.areas.split('\n').filter(Boolean).join(', ')}`, a.routine && `Rotina: ${a.routine}`].filter(Boolean);
  }, [journey, answers]);

  if (!journey || step === 0) {
    return <div data-stitch="" className="w-full max-w-5xl mx-auto flex flex-col gap-space-lg">
      <header><span className="text-secondary font-label-sm text-label-sm">SUA JORNADA DE DESCOBERTA</span><h1 className="font-display-lg text-display-lg text-on-surface mt-6">Como os estudos fazem parte da sua vida hoje?</h1><p className="font-body-lg text-body-lg text-on-surface-variant mt-6">Não existe resposta certa, nem ritmo melhor. Você pode mudar depois, sem perder nada do que já estudou.</p></header>
      <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-space-md"><legend className="sr-only">Seu ritmo de estudo</legend>{STUDY_RHYTHMS.map(item => <motion.button key={item.id} type="button" whileHover={{ y: -3 }} whileTap={{ scale: .99 }} className={`pace-card relative flex flex-col text-left p-6 rounded-xl bg-surface-container cursor-pointer ${journey === item.id ? 'selected' : ''}`} onClick={() => choose(item.id)} aria-pressed={journey === item.id}><div className="flex items-center justify-between mb-6"><Icon name={item.icon}/><span className="card-indicator w-6 h-6 rounded-full">{journey === item.id && <Icon name="check"/>}</span></div><span className="text-secondary font-label-sm text-label-sm">{item.label}</span><h2 className="font-headline-sm text-headline-sm text-on-surface mt-6">{item.title}</h2><p className="font-body-sm text-body-sm text-on-surface-variant mt-6">{item.text}</p><p className="font-label-sm text-label-sm text-outline mt-6">{item.detail}</p></motion.button>)}</fieldset>
      {saved.status === 'active' && saved.journey && <p role="status" className="font-body-md text-body-md text-on-surface-variant">Você parou na etapa {saved.step}. Escolher a mesma jornada retoma de onde parou.</p>}
      <div className="flex flex-wrap justify-between gap-4"><Button secondary onClick={() => { update(previous => ({ ...previous, onboarded: true, onboarding: { ...emptyOnboarding(), status: 'done', finishedAt: new Date().toISOString() } })); go('hoje'); notify('Você pode personalizar quando quiser.'); }}>Explorar sem personalizar agora</Button></div>
    </div>;
  }

  const current = steps[step - 1];
  const isReview = step === reviewStep;

  return <div data-stitch="" className="w-full max-w-3xl mx-auto flex flex-col gap-space-lg">
    <Progress step={step} total={total}/>
    {/* Sem AnimatePresence em modo wait: a espera pela saída travava a troca de etapa. */}
    <motion.section key={`${journey}-${step}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28, ease: [.22, 1, .36, 1] }} className="flex flex-col gap-space-md">
        {current ? <>
          <header><span className="text-secondary font-label-sm text-label-sm">{STUDY_RHYTHMS.find(item => item.id === journey).title} · etapa {step}</span><h1 className="font-headline-lg text-headline-lg text-on-surface mt-6">{current.question}</h1><p className="font-body-md text-body-md text-on-surface-variant mt-6">{current.hint}</p></header>
          <StepBody journey={journey} stepKey={current.key} answers={answers} setAnswers={setAnswers} persist={persist}/>
          {error && <p role="alert" className="auth-error">{error}</p>}
          <div className="flex flex-wrap justify-between gap-4"><Button secondary onClick={back}>Voltar</Button><Button onClick={() => advance()}>Continuar<Icon name="arrow"/></Button></div>
        </> : step === socialStep ? <>
          <header><span className="text-secondary font-label-sm text-label-sm">ETAPA OPCIONAL</span><h1 className="font-headline-lg text-headline-lg text-on-surface mt-6">Quer estudar com alguém?</h1><p className="font-body-md text-body-md text-on-surface-variant mt-6">Você pode pular esta parte. Ela não muda seu XP nem seu plano.</p></header>
          <div className="flex flex-col gap-3">
            <div className={panel}><strong className="font-headline-sm text-headline-sm text-on-surface">Convidar amigos</strong><p className="font-body-sm text-body-sm text-on-surface-variant">Convites ainda não estão disponíveis nesta versão.</p><Button secondary disabled><Icon name="plus"/>Convidar (em breve)</Button></div>
            <div className={panel}><strong className="font-headline-sm text-headline-sm text-on-surface">Entrar em um grupo</strong><p className="font-body-sm text-body-sm text-on-surface-variant">Entrada por convite será liberada quando os grupos existirem.</p><Button secondary disabled><Icon name="plus"/>Entrar com convite (em breve)</Button></div>
            <div className={panel}><strong className="font-headline-sm text-headline-sm text-on-surface">Ranking</strong><p className="font-body-sm text-body-sm text-on-surface-variant">O ranking por nível, cursos concluídos e empenho está planejado. Você não entra nele automaticamente.</p><a className="text-link" href="#conquistas">Ver conquistas e progresso<Icon name="arrow"/></a></div>
          </div>
          <div className="flex flex-wrap justify-between gap-4"><Button secondary onClick={() => { go('hoje'); }}>Pular esta etapa</Button><Button onClick={finish}>Concluir e ir para Hoje<Icon name="arrow"/></Button></div>
        </> : <>
          <header><span className="text-secondary font-label-sm text-label-sm">PRONTO PARA COMEÇAR</span><h1 className="font-headline-lg text-headline-lg text-on-surface mt-6">Seu plano inicial</h1><p className="font-body-md text-body-md text-on-surface-variant mt-6">Este é o começo sugerido para o seu momento. Nada aqui é obrigatório e você pode ajustar depois.</p></header>
          <div className={panel}>
            <strong className="font-headline-sm text-headline-sm text-on-surface">{studyRhythm({ ...state, habit: journey }).title}</strong>
            <p className="font-body-md text-body-md text-on-surface-variant">{studyRhythm({ ...state, habit: journey }).message}</p>
            <ul className="flex flex-col gap-1 font-body-sm text-body-sm text-on-surface-variant">{(summary ?? []).map(line => <li key={line}>· {line}</li>)}<li>· Meta sugerida: {STUDY_RHYTHMS.find(item => item.id === journey).weeklyGoal} passos por semana</li></ul>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Primeiro material: <strong>{answers.materialTitle || answers.priority || String(answers.ongoing ?? '').split('\n')[0] || answers.subject || 'a definir na biblioteca'}</strong></p>
            <p className="font-label-sm text-label-sm text-outline">O onboarding não concede XP. Pontuação só existe para estudo registrado.</p>
          </div>
          <div className="flex flex-wrap justify-between gap-4"><Button secondary onClick={back}>Voltar</Button><Button onClick={() => advance()}>Criar material e continuar<Icon name="arrow"/></Button></div>
        </>}
    </motion.section>
  </div>;
}

function StepBody({ journey, stepKey, answers, setAnswers, persist }) {
  const text = (key, props = {}) => <input className="auth-input" value={answers[key] ?? ''} onChange={event => setAnswers(previous => ({ ...previous, [key]: event.target.value }))} {...props}/>;
  const area = (key, props = {}) => <textarea className="auth-input" rows={3} value={answers[key] ?? ''} onChange={event => setAnswers(previous => ({ ...previous, [key]: event.target.value }))} {...props}/>;

  if (journey === 'starting') {
    if (stepKey === 'subject') return <label className={field} htmlFor="onb-subject">Assunto<input id="onb-subject" className="auth-input" autoFocus value={answers.subject ?? ''} onChange={event => setAnswers(previous => ({ ...previous, subject: event.target.value }))} placeholder="Ex.: fundamentos de redes"/></label>;
    if (stepKey === 'outcome') return <label className={field} htmlFor="onb-outcome">Resultado esperado<input id="onb-outcome" className="auth-input" value={answers.outcome ?? ''} onChange={event => setAnswers(previous => ({ ...previous, outcome: event.target.value }))} placeholder="Ex.: concluir a primeira aula"/></label>;
    if (stepKey === 'material') return <div className="flex flex-col gap-4">
      <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-space-sm"><legend className="sr-only">Você já tem material?</legend>
        <label className="pace-card p-4 rounded-xl bg-surface-container cursor-pointer flex flex-col gap-2"><input className="sr-only" type="radio" name="hasMaterial" checked={answers.hasMaterial === 'yes'} onChange={() => setAnswers(previous => ({ ...previous, hasMaterial: 'yes' }))}/><strong>A. Já tenho um material</strong><small className="font-body-sm text-body-sm text-on-surface-variant">Cadastro o link e o tipo agora.</small></label>
        <label className="pace-card p-4 rounded-xl bg-surface-container cursor-pointer flex flex-col gap-2"><input className="sr-only" type="radio" name="hasMaterial" checked={answers.hasMaterial === 'no'} onChange={() => setAnswers(previous => ({ ...previous, hasMaterial: 'no' }))}/><strong>B. Ainda não escolhi</strong><small className="font-body-sm text-body-sm text-on-surface-variant">Definimos o assunto e o que procurar, sem inventar links.</small></label>
      </fieldset>
      {answers.hasMaterial === 'yes' && <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
        <label className="auth-field">Nome do material<input className="auth-input" value={answers.materialTitle ?? ''} onChange={event => setAnswers(previous => ({ ...previous, materialTitle: event.target.value }))} placeholder="Ex.: Curso de redes — módulo 1"/></label>
        <label className="auth-field">Link (opcional)<input className="auth-input" type="url" value={answers.materialUrl ?? ''} onChange={event => setAnswers(previous => ({ ...previous, materialUrl: event.target.value }))} placeholder="https://…"/></label>
        <label className="auth-field">Tipo<select className="auth-input" value={answers.materialType ?? 'lesson'} onChange={event => setAnswers(previous => ({ ...previous, materialType: event.target.value }))}>{STUDY_TYPES.map(type => <option key={type.id} value={type.id}>{type.title}</option>)}</select></label>
        <label className="auth-field">Primeira atividade<input className="auth-input" value={answers.firstActivity ?? ''} onChange={event => setAnswers(previous => ({ ...previous, firstActivity: event.target.value }))} placeholder="Ex.: assistir à aula completa"/></label>
      </div>}
      {answers.hasMaterial === 'no' && <p className={panel + ' font-body-sm text-body-sm text-on-surface-variant'}>Vamos registrar <strong>{answers.subject || 'seu assunto'}</strong> e a primeira coisa a procurar: um material introdutório. Nenhum curso ou link é inventado pelo Lume.</p>}
    </div>;
    if (stepKey === 'time') return <div className="flex flex-wrap gap-2" role="group" aria-label="Tempo por sessão">{[...SESSION_MINUTES, null].map(minutes => <button key={String(minutes)} type="button" className={`filter-btn ${String(answers.sessionMinutes ?? '') === String(minutes ?? '') ? 'selected' : ''}`} aria-pressed={String(answers.sessionMinutes ?? '') === String(minutes ?? '')} onClick={() => setAnswers(previous => ({ ...previous, sessionMinutes: minutes ?? null }))}>{minutes ? `${minutes} minutos` : 'Ainda não sei'}</button>)}</div>;
  }

  if (journey === 'sometimes') {
    if (stepKey === 'studying') return <label className={field} htmlFor="onb-studying">Materiais em andamento<textarea id="onb-studying" className="auth-input" rows={4} value={answers.studying ?? ''} onChange={event => setAnswers(previous => ({ ...previous, studying: event.target.value }))} placeholder={'Um por linha\nEx.: Curso de estatística\nArtigo sobre amostragem'}/></label>;
    if (stepKey === 'priority') {
      const options = String(answers.studying ?? '').split('\n').map(item => item.trim()).filter(Boolean);
      if (!options.length) return <p className="font-body-sm text-body-sm text-on-surface-variant">Volte e escreva ao menos um material para escolher a prioridade.</p>;
      return <fieldset className="flex flex-col gap-2"><legend className="sr-only">Prioridade</legend>{options.map(option => <label key={option} className="pace-card p-4 rounded-xl bg-surface-container cursor-pointer flex items-center gap-3"><input className="sr-only" type="radio" name="priority" checked={answers.priority === option} onChange={() => setAnswers(previous => ({ ...previous, priority: option }))}/><span className="card-indicator w-6 h-6 rounded-full">{answers.priority === option && <Icon name="check"/>}</span><span>{option}</span></label>)}</fieldset>;
    }
    if (stepKey === 'resume') return <label className={field} htmlFor="onb-resume">Onde você parou?<input id="onb-resume" className="auth-input" value={answers.resume ?? ''} onChange={event => setAnswers(previous => ({ ...previous, resume: event.target.value }))} placeholder="Ex.: aula 3, página 42"/></label>;
    if (stepKey === 'obstacles') return <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-space-sm"><legend className="sr-only">Dificuldades</legend>{CONTINUITY_OBSTACLES.map(item => <label key={item.id} className="pace-card p-4 rounded-xl bg-surface-container cursor-pointer flex items-center gap-3"><input type="checkbox" className="sr-only" checked={(answers.obstacles ?? []).includes(item.id)} onChange={event => setAnswers(previous => ({ ...previous, obstacles: event.target.checked ? [...(previous.obstacles ?? []), item.id] : (previous.obstacles ?? []).filter(id => id !== item.id) }))}/><span className="card-indicator w-6 h-6 rounded-sm">{(answers.obstacles ?? []).includes(item.id) && <Icon name="check"/>}</span><span>{item.title}</span></label>)}</fieldset>;
  }

  if (journey === 'often') {
    if (stepKey === 'areas') return <label className={field} htmlFor="onb-areas">Áreas e trilhas<textarea id="onb-areas" className="auth-input" rows={3} value={answers.areas ?? ''} onChange={event => setAnswers(previous => ({ ...previous, areas: event.target.value }))} placeholder={'Uma por linha\nEx.: programação\nidiomas'}/></label>;
    if (stepKey === 'routine') return <label className={field} htmlFor="onb-routine">Rotina ou meta atual<input id="onb-routine" className="auth-input" value={answers.routine ?? ''} onChange={event => setAnswers(previous => ({ ...previous, routine: event.target.value }))} placeholder="Ex.: 3 noites por semana, 40 minutos"/></label>;
    if (stepKey === 'ongoing') return <label className={field} htmlFor="onb-ongoing">Em andamento<textarea id="onb-ongoing" className="auth-input" rows={4} value={answers.ongoing ?? ''} onChange={event => setAnswers(previous => ({ ...previous, ongoing: event.target.value }))} placeholder={'Um por linha\nEx.: curso de algoritmos\nprojeto de API'}/></label>;
    if (stepKey === 'tracking') return <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-space-sm"><legend className="sr-only">O que acompanhar</legend>{TRACKING_PREFERENCES.map(item => <label key={item.id} className="pace-card p-4 rounded-xl bg-surface-container cursor-pointer flex items-center gap-3"><input type="checkbox" className="sr-only" checked={(answers.tracking ?? []).includes(item.id)} onChange={event => setAnswers(previous => ({ ...previous, tracking: event.target.checked ? [...(previous.tracking ?? []), item.id] : (previous.tracking ?? []).filter(id => id !== item.id) }))}/><span className="card-indicator w-6 h-6 rounded-sm">{(answers.tracking ?? []).includes(item.id) && <Icon name="check"/>}</span><span>{item.title}</span></label>)}<p className="md:col-span-2 font-label-sm text-label-sm text-outline">As integrações automáticas por área ainda não estão disponíveis; o acompanhamento é por registro manual.</p></fieldset>;
  }

  return null;
}
