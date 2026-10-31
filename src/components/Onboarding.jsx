import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  STUDY_RHYTHMS, STUDY_TYPES, SESSION_MINUTES, CONTINUITY_OBSTACLES, TRACKING_PREFERENCES,
  studyRhythm, startJourney, saveOnboardingAnswer, completeJourney, emptyOnboarding, addMaterial,
} from '../../public/domain.js';
import Icon from './Icon.jsx';
import { Button, Glow, ease, stagger } from './ui.jsx';
import { api, apiError } from '../lib/api.js';
import { copyText, selectText } from '../lib/clipboard.js';

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

function Stepper({ step, total }) {
  return <div className="onboarding-progress" role="group" aria-label={`Etapa ${step} de ${total}`}>
    <div className="onboarding-segments" aria-hidden="true">{Array.from({ length: total }, (_, index) => <span key={index} className={`segment ${index < step ? 'active' : ''}`}>{index === step - 1 && <motion.span layoutId="onboarding-segment" className="segment-fill" transition={{ duration: .3, ease }}/>}</span>)}</div>
    <span className="eyebrow">Etapa {step} de {total}</span>
  </div>;
}

export default function Onboarding({ state, update, go, notify, account }) {
  const saved = state.onboarding ?? emptyOnboarding();
  const [journey, setJourney] = useState(saved.journey ?? state.habit ?? null);
  const [step, setStep] = useState(saved.journey && saved.status === 'active' ? saved.step : 0);
  const [answers, setAnswers] = useState(saved.answers ?? {});
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const steps = journey ? STEPS[journey] : [];
  const reviewStep = steps.length + 1;
  const socialStep = steps.length + 2;
  const total = socialStep;

  function persist(patch, nextStep) {
    const merged = { ...answers, ...patch };
    setAnswers(merged);
    update(previous => saveOnboardingAnswer(previous, merged, nextStep));
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

  // Convite dentro do onboarding: mesmo endpoint da página Amigos, sem sair da etapa.
  async function createInvite() {
    setInviteBusy(true);
    setInviteError('');
    try {
      const result = await api('/api/friends/invite', { method: 'POST', body: {} });
      if (!result.ok) throw new Error(apiError(result));
      setInvite(result.data);
    } catch (exception) {
      setInviteError(exception.message);
    } finally {
      setInviteBusy(false);
    }
  }

  async function copyInvite() {
    if (!invite) return;
    const link = `${location.origin}/#amigos?convite=${invite.code}`;
    if (await copyText(link)) {
      notify('Link do convite copiado. Vale por 7 dias e pode ser usado por várias pessoas.');
      return;
    }
    selectText('.invite-code');
    notify('Não foi possível copiar automaticamente. O código está selecionado: use Ctrl+C ou toque e segure.');
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
      if (title) payload = { title, type: 'course', firstActivity: `Definir o próximo marco de ${title}`, planning: true };
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
    return <div className="onboarding-root">
      <header className="onboarding-header">
        <span className="eyebrow">Sua jornada de descoberta</span>
        <h1 className="display">Como os estudos fazem parte da sua vida <em>hoje?</em></h1>
        <p className="lead">Não existe resposta certa, nem ritmo melhor. Você pode mudar depois, sem perder nada do que já estudou.</p>
      </header>
      <fieldset className="rhythm-grid"><legend className="sr-only">Seu ritmo de estudo</legend>
        {STUDY_RHYTHMS.map((item, index) => <motion.button key={item.id} type="button" {...stagger(index)} whileHover={{ y: -4 }} whileTap={{ scale: .99 }} className={`pace-card ${journey === item.id ? 'selected' : ''}`} onClick={() => choose(item.id)} aria-pressed={journey === item.id}>
          <div className="pace-card-top"><span className="pace-icon"><Icon name={item.icon}/></span><span className="card-indicator">{journey === item.id && <Icon name="check"/>}</span></div>
          <span className="eyebrow">{item.label}</span>
          <h2 className="title">{item.title}</h2>
          <p className="muted-text">{item.text}</p>
          <span className="pace-detail">{item.detail}</span>
        </motion.button>)}
      </fieldset>
      {saved.status === 'active' && saved.journey && <p role="status" className="resume-banner"><Icon name="return"/>Você parou na etapa {saved.step}. Escolher a mesma jornada retoma de onde parou.</p>}
      <div className="onboarding-actions"><Button secondary onClick={() => { update(previous => ({ ...previous, onboarded: true, onboarding: { ...emptyOnboarding(), status: 'done', finishedAt: new Date().toISOString() } })); go('hoje'); notify('Você pode personalizar quando quiser.'); }}>Explorar sem personalizar agora</Button></div>
    </div>;
  }

  const current = steps[step - 1];

  return <div className="onboarding-step-shell">
    <Stepper step={step} total={total}/>
    {/* Sem AnimatePresence em modo wait: a espera pela saída travava a troca de etapa. */}
    <motion.section key={`${journey}-${step}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28, ease }} className="onboarding-card">
      {current ? <>
        <header className="step-header">
          <span className="eyebrow">{STUDY_RHYTHMS.find(item => item.id === journey).title} · etapa {step}</span>
          <h1 className="headline">{current.question}</h1>
          <p className="muted-text">{current.hint}</p>
        </header>
        <StepBody journey={journey} stepKey={current.key} answers={answers} setAnswers={setAnswers}/>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="step-actions"><Button secondary onClick={back}>Voltar</Button><Button onClick={() => advance()}>Continuar<Icon name="arrow"/></Button></div>
      </> : step === socialStep ? <>
        <header className="step-header">
          <span className="eyebrow">Etapa opcional</span>
          <h1 className="headline">Quer estudar com alguém?</h1>
          <p className="muted-text">Você pode pular esta parte. Ela não muda seu XP nem seu plano.</p>
        </header>
        <div className="social-preview-grid">
          <div className="card-surface">
            <div className="card-head"><span className="pace-icon"><Icon name="users"/></span><span className={`soon-badge${account ? ' is-ready' : ''}`}>{account ? 'Disponível' : 'Com conta'}</span></div>
            <strong className="title">Convidar amigos</strong>
            {account
              ? invite
                ? <>
                    <p className="muted-text">Envie este código. Vale por 7 dias e várias pessoas podem usá-lo.</p>
                    <code className="invite-code">{invite.code}</code>
                    <Button secondary onClick={copyInvite}><Icon name="check"/>Copiar link do convite</Button>
                  </>
                : <>
                    <p className="muted-text">Gere um convite por link. Ser amigo não compartilha sua biblioteca, seu progresso nem seu XP.</p>
                    <Button secondary onClick={createInvite} disabled={inviteBusy}><Icon name="plus"/>{inviteBusy ? 'Gerando convite…' : 'Convidar amigos'}</Button>
                  </>
              : <>
                  <p className="muted-text">O convite fica vinculado a uma conta. Na prévia, ele não pode ser gerado.</p>
                  <Button secondary onClick={() => go('login')}><Icon name="lock"/>Entrar para convidar</Button>
                </>}
            {inviteError && <p role="alert" className="form-error">{inviteError}</p>}
          </div>
          <div className="card-surface"><div className="card-head"><span className="pace-icon"><Icon name="mail"/></span><span className="soon-badge">Amigos</span></div><strong className="title">Mensagens diretas</strong><p className="muted-text">Conversas individuais entre amizades aceitas. O Lume não tem grupos, comunidades ou canais.</p><a className="text-link" href="#mensagens">Abrir mensagens<Icon name="arrow"/></a></div>
          <div className="card-surface"><div className="card-head"><span className="pace-icon"><Icon name="podium"/></span><span className="soon-badge">Opcional</span></div><strong className="title">Ranking de amigos</strong><p className="muted-text">Compare nível, cursos concluídos e empenho no período. Só entram XP confirmado pelo servidor e quem escolher participar.</p><a className="text-link" href="#ranking">Conhecer o ranking<Icon name="arrow"/></a></div>
        </div>
        <div className="step-actions"><Button secondary onClick={() => { go('hoje'); }}>Pular esta etapa</Button><Button onClick={finish}>Concluir e ir para Hoje<Icon name="arrow"/></Button></div>
      </> : <>
        <header className="step-header">
          <span className="eyebrow">Pronto para começar</span>
          <h1 className="headline">Seu plano inicial</h1>
          <p className="muted-text">Este é o começo sugerido para o seu momento. Nada aqui é obrigatório e você pode ajustar depois.</p>
        </header>
        <div className="plan-summary-card">
          <Glow palette="mint"/>
          <div className="plan-summary-body">
            <span className="eyebrow on-glow">Resumo da sua jornada</span>
            <strong className="title">{studyRhythm({ ...state, habit: journey }).title}</strong>
            <p className="muted-text">{studyRhythm({ ...state, habit: journey }).message}</p>
            <ul className="plan-bullets">{(summary ?? []).map(line => <li key={line}><Icon name="check"/><span>{line}</span></li>)}<li><Icon name="spark"/><span>Meta sugerida: {STUDY_RHYTHMS.find(item => item.id === journey).weeklyGoal} passos por semana</span></li></ul>
            <div className="plan-material-highlight"><span>Primeiro material</span><strong>{answers.materialTitle || answers.priority || String(answers.ongoing ?? '').split('\n')[0] || answers.subject || 'a definir na biblioteca'}</strong></div>
            <p className="quiet-note">O onboarding não concede XP. Pontuação só existe para estudo registrado.</p>
          </div>
        </div>
        <div className="step-actions"><Button secondary onClick={back}>Voltar</Button><Button onClick={() => advance()}>Criar material e continuar<Icon name="arrow"/></Button></div>
      </>}
    </motion.section>
  </div>;
}

function StepBody({ journey, stepKey, answers, setAnswers }) {
  if (journey === 'starting') {
    if (stepKey === 'subject') return <label className="field" htmlFor="onb-subject">Assunto<input id="onb-subject" className="auth-input" autoFocus value={answers.subject ?? ''} onChange={event => setAnswers(previous => ({ ...previous, subject: event.target.value }))} placeholder="Ex.: fundamentos de redes"/></label>;
    if (stepKey === 'outcome') return <label className="field" htmlFor="onb-outcome">Resultado esperado<input id="onb-outcome" className="auth-input" value={answers.outcome ?? ''} onChange={event => setAnswers(previous => ({ ...previous, outcome: event.target.value }))} placeholder="Ex.: concluir a primeira aula"/></label>;
    if (stepKey === 'material') return <div className="form-stack">
      <fieldset className="option-grid two-col"><legend className="sr-only">Você já tem material?</legend>
        <label className={`pace-card compact ${answers.hasMaterial === 'yes' ? 'selected' : ''}`}><input className="sr-only" type="radio" name="hasMaterial" checked={answers.hasMaterial === 'yes'} onChange={() => setAnswers(previous => ({ ...previous, hasMaterial: 'yes' }))}/><strong>A. Já tenho um material</strong><small className="muted-text">Cadastro o link e o tipo agora.</small></label>
        <label className={`pace-card compact ${answers.hasMaterial === 'no' ? 'selected' : ''}`}><input className="sr-only" type="radio" name="hasMaterial" checked={answers.hasMaterial === 'no'} onChange={() => setAnswers(previous => ({ ...previous, hasMaterial: 'no' }))}/><strong>B. Ainda não escolhi</strong><small className="muted-text">Definimos o assunto e o que procurar, sem inventar links.</small></label>
      </fieldset>
      {answers.hasMaterial === 'yes' && <div className="option-grid two-col">
        <label className="field">Nome do material<input className="auth-input" value={answers.materialTitle ?? ''} onChange={event => setAnswers(previous => ({ ...previous, materialTitle: event.target.value }))} placeholder="Ex.: Curso de redes — módulo 1"/></label>
        <label className="field">Link (opcional)<input className="auth-input" type="url" value={answers.materialUrl ?? ''} onChange={event => setAnswers(previous => ({ ...previous, materialUrl: event.target.value }))} placeholder="https://…"/></label>
        <label className="field">Tipo<select className="auth-input" value={answers.materialType ?? 'lesson'} onChange={event => setAnswers(previous => ({ ...previous, materialType: event.target.value }))}>{STUDY_TYPES.map(type => <option key={type.id} value={type.id}>{type.title}</option>)}</select></label>
        <label className="field">Primeira atividade<input className="auth-input" value={answers.firstActivity ?? ''} onChange={event => setAnswers(previous => ({ ...previous, firstActivity: event.target.value }))} placeholder="Ex.: assistir à aula completa"/></label>
      </div>}
      {answers.hasMaterial === 'no' && <p className="card-surface muted-text">Vamos registrar <strong>{answers.subject || 'seu assunto'}</strong> e a primeira coisa a procurar: um material introdutório. Nenhum curso ou link é inventado pelo Lume.</p>}
    </div>;
    if (stepKey === 'time') return <div className="pill-group" role="group" aria-label="Tempo por sessão">{[...SESSION_MINUTES, null].map(minutes => <button key={String(minutes)} type="button" className={`filter-btn ${String(answers.sessionMinutes ?? '') === String(minutes ?? '') ? 'selected' : ''}`} aria-pressed={String(answers.sessionMinutes ?? '') === String(minutes ?? '')} onClick={() => setAnswers(previous => ({ ...previous, sessionMinutes: minutes ?? null }))}>{minutes ? `${minutes} minutos` : 'Ainda não sei'}</button>)}</div>;
  }

  if (journey === 'sometimes') {
    if (stepKey === 'studying') return <label className="field" htmlFor="onb-studying">Materiais em andamento<textarea id="onb-studying" className="auth-input" rows={4} value={answers.studying ?? ''} onChange={event => setAnswers(previous => ({ ...previous, studying: event.target.value }))} placeholder={'Um por linha\nEx.: Curso de estatística\nArtigo sobre amostragem'}/></label>;
    if (stepKey === 'priority') {
      const options = String(answers.studying ?? '').split('\n').map(item => item.trim()).filter(Boolean);
      if (!options.length) return <p className="muted-text">Volte e escreva ao menos um material para escolher a prioridade.</p>;
      return <fieldset className="option-stack"><legend className="sr-only">Prioridade</legend>{options.map(option => <label key={option} className={`pace-card row ${answers.priority === option ? 'selected' : ''}`}><input className="sr-only" type="radio" name="priority" checked={answers.priority === option} onChange={() => setAnswers(previous => ({ ...previous, priority: option }))}/><span className="card-indicator">{answers.priority === option && <Icon name="check"/>}</span><span>{option}</span></label>)}</fieldset>;
    }
    if (stepKey === 'resume') return <label className="field" htmlFor="onb-resume">Onde você parou?<input id="onb-resume" className="auth-input" value={answers.resume ?? ''} onChange={event => setAnswers(previous => ({ ...previous, resume: event.target.value }))} placeholder="Ex.: aula 3, página 42"/></label>;
    if (stepKey === 'obstacles') return <fieldset className="option-grid two-col"><legend className="sr-only">Dificuldades</legend>{CONTINUITY_OBSTACLES.map(item => <label key={item.id} className={`pace-card row ${(answers.obstacles ?? []).includes(item.id) ? 'selected' : ''}`}><input type="checkbox" className="sr-only" checked={(answers.obstacles ?? []).includes(item.id)} onChange={event => setAnswers(previous => ({ ...previous, obstacles: event.target.checked ? [...(previous.obstacles ?? []), item.id] : (previous.obstacles ?? []).filter(id => id !== item.id) }))}/><span className="card-indicator square">{(answers.obstacles ?? []).includes(item.id) && <Icon name="check"/>}</span><span>{item.title}</span></label>)}</fieldset>;
  }

  if (journey === 'often') {
    if (stepKey === 'areas') return <label className="field" htmlFor="onb-areas">Áreas e trilhas<textarea id="onb-areas" className="auth-input" rows={3} value={answers.areas ?? ''} onChange={event => setAnswers(previous => ({ ...previous, areas: event.target.value }))} placeholder={'Uma por linha\nEx.: programação\nidiomas'}/></label>;
    if (stepKey === 'routine') return <label className="field" htmlFor="onb-routine">Rotina ou meta atual<input id="onb-routine" className="auth-input" value={answers.routine ?? ''} onChange={event => setAnswers(previous => ({ ...previous, routine: event.target.value }))} placeholder="Ex.: 3 noites por semana, 40 minutos"/></label>;
    if (stepKey === 'ongoing') return <label className="field" htmlFor="onb-ongoing">Em andamento<textarea id="onb-ongoing" className="auth-input" rows={4} value={answers.ongoing ?? ''} onChange={event => setAnswers(previous => ({ ...previous, ongoing: event.target.value }))} placeholder={'Um por linha\nEx.: curso de algoritmos\nprojeto de API'}/></label>;
    if (stepKey === 'tracking') return <fieldset className="option-grid two-col"><legend className="sr-only">O que acompanhar</legend>{TRACKING_PREFERENCES.map(item => <label key={item.id} className={`pace-card row ${(answers.tracking ?? []).includes(item.id) ? 'selected' : ''}`}><input type="checkbox" className="sr-only" checked={(answers.tracking ?? []).includes(item.id)} onChange={event => setAnswers(previous => ({ ...previous, tracking: event.target.checked ? [...(previous.tracking ?? []), item.id] : (previous.tracking ?? []).filter(id => id !== item.id) }))}/><span className="card-indicator square">{(answers.tracking ?? []).includes(item.id) && <Icon name="check"/>}</span><span>{item.title}</span></label>)}<p className="quiet-note span-two">As integrações automáticas por área ainda não estão disponíveis; o acompanhamento é por registro manual.</p></fieldset>;
  }

  return null;
}
