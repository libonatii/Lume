import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  STUDY_RHYTHMS,
  studyRhythm, emptyOnboarding,
} from '../../../public/domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Glow, ease, stagger } from '../../ui/ui.jsx';
import { api, apiError } from '../../lib/api.js';
import { copyText, selectText } from '../../lib/clipboard.js';
import StepBody from './OnboardingFields.jsx';

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

// Fases mostradas no topo: a escolha da jornada, as perguntas, o primeiro
// material e o convite opcional. As perguntas de cada jornada ficam em "Ritmo".
const PHASES = [
  ['user', 'Identidade'],
  ['settings', 'Ritmo de estudo'],
  ['book', 'Primeira matéria'],
  ['users', 'Amigos · opcional'],
];

function Stepper({ phase, step = 0, total = 0 }) {
  return <nav className="onboarding-phases" aria-label="Progresso da personalização">
    <ol>{PHASES.map(([icon, label], index) => <li key={label} className={index < phase ? 'is-done' : index === phase ? 'is-current' : ''} aria-current={index === phase ? 'step' : undefined}>
      <span className="phase-mark" aria-hidden="true"><Icon name={index < phase ? 'check' : icon}/></span>
      <span className="phase-copy"><small>Passo {index + 1}</small><strong>{label}</strong></span>
    </li>)}</ol>
    <div className="phase-track" role="progressbar" aria-label={total ? `Etapa ${step} de ${total}` : 'Escolha da jornada'} aria-valuemin={0} aria-valuemax={PHASES.length} aria-valuenow={phase + 1}><motion.span animate={{ scaleX: (phase + 1) / PHASES.length }} initial={false} transition={{ duration: .3, ease }}/></div>
  </nav>;
}

export default function Onboarding({ state, actions, libraryActions, go, notify, account }) {
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
    if (!actions.saveAnswers(merged, nextStep)) return false;
    setAnswers(merged);
    return true;
  }

  function choose(id) {
    if (!actions.startJourney(id)) return;
    setJourney(id);
    setStep(1);
    setError('');
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
      if (!createMaterial()) return;
      if (!persist(patch ?? {}, socialStep)) return;
      setStep(socialStep);
      return;
    }
    if (!persist(patch ?? {}, step + 1)) return;
    setStep(step + 1);
  }

  function back() {
    if (step <= 1) { setStep(0); return; }
    if (!persist({}, step - 1)) return;
    setStep(step - 1);
  }

  function finish() {
    if (!actions.finishJourney(answers, socialStep)) return;
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
    return !payload || Boolean(libraryActions.addMaterial(payload, 'onboarding'));
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
      <Stepper phase={0}/>
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
      <div className="onboarding-actions"><Button secondary onClick={() => { if (!actions.skipJourney()) return; go('hoje'); notify('Você pode personalizar quando quiser.'); }}>Explorar sem personalizar agora</Button></div>
    </div>;
  }

  const current = steps[step - 1];

  const phase = step === socialStep ? 3 : step === reviewStep ? 2 : 1;
  return <div className="onboarding-step-shell">
    <Stepper phase={phase} step={step} total={total}/>
    {/* Sem AnimatePresence em modo wait: a espera pela saída travava a troca de etapa. */}
    <motion.section key={`${journey}-${step}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28, ease }} className="onboarding-card crest-card">
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
