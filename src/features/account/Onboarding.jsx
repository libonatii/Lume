import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { STUDY_RHYTHMS, emptyOnboarding } from '../../../public/domain.js';
import { PDF_PLANS, formatBytes } from '../../../public/pdf-domain.js';
import { SUBJECT_COLORS, SUBJECT_COLOR_LABELS as COLOR_LABELS } from '../../../public/subject-domain.js';
import { discardPdf, inspectPdf, uploadPdf } from '../library/pdf-client.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Logo, ease, stagger } from '../../ui/ui.jsx';
import { api, apiError } from '../../lib/api.js';
import { copyText, selectText } from '../../lib/clipboard.js';

const PHASES = [
  ['user', 'Identidade'],
  ['settings', 'Ritmo de estudo'],
  ['book', 'Primeira matéria'],
  ['users', 'Amigos · opcional'],
];

const DAILY_GOALS = [
  { id: 'light', minutes: 45, icon: 'leaf', title: 'Leve e Constante', label: '45 min / dia', desc: '1 a 2 blocos curtos. Excelente para retomar o hábito sem sobrecarga.', cycles: '1 a 2 blocos serenos com pausas suaves.' },
  { id: 'ideal', minutes: 90, icon: 'spark', title: 'Ritmo Ideal', label: '1h 30m / dia', badge: 'Recomendado', desc: 'Equilíbrio saudável entre concentração e descanso ativo.', cycles: '3 ciclos de foco serenos com micro-pausas de 5 minutos.' },
  { id: 'deep', minutes: 180, icon: 'flame', title: 'Imersão Profunda', label: '3h / dia', desc: 'Para períodos intensos de preparação ou entrega de projetos.', cycles: 'Blocos mais longos com intervalos programados.' },
  { id: 'custom', minutes: null, icon: 'tune', title: 'Personalizado', label: 'Defina seu fluxo', desc: 'Ajuste sua meta diária em minutos conforme sua semana.', cycles: 'Meta flexível ajustada ao seu momento.' },
];

const SOUND_OPTIONS = [
  { id: 'off', icon: 'volume-off', title: 'Silêncio Total', subtitle: 'Sem áudio', preview: 'Silêncio Total' },
  { id: 'rain', icon: 'rain', title: 'Chuva Serena', subtitle: 'Ruído suave', preview: 'Chuva Serena de Janela' },
  { id: 'noise', icon: 'wave', title: 'Ruído Branco', subtitle: 'Foco linear', preview: 'Ruído Branco Suave' },
  { id: 'library', icon: 'book', title: 'Biblioteca', subtitle: 'Calor acústico', preview: 'Biblioteca Noturna' },
];

const QUICK_SUBJECTS = [
  'Direito Administrativo',
  'Inglês Instrumental',
  'Estrutura de Dados',
  'Anatomia',
  'Redação',
];

function formatDailyDuration(minutes) {
  const m = Math.max(15, Number(minutes) || 90);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (!h) return `${rem} min`;
  if (!rem) return `${h}h`;
  return `${h}h ${String(rem).padStart(2, '0')}m`;
}

function Stepper({ phase, total = 4 }) {
  return <nav className="onboarding-phases" aria-label="Progresso da personalização">
    <ol>
      {PHASES.map(([icon, label], index) => (
        <li
          key={label}
          className={index < phase ? 'is-done' : index === phase ? 'is-current' : ''}
          aria-current={index === phase ? 'step' : undefined}
        >
          <span className="phase-mark" aria-hidden="true"><Icon name={index < phase ? 'check' : icon}/></span>
          <span className="phase-copy"><small>Passo {index + 1}</small><strong>{label}</strong></span>
        </li>
      ))}
    </ol>
    <div
      className="phase-track"
      role="progressbar"
      aria-label={`Passo ${phase + 1} de ${total}`}
      aria-valuemin={0}
      aria-valuemax={PHASES.length}
      aria-valuenow={phase + 1}
    >
      <motion.span animate={{ scaleX: (phase + 1) / PHASES.length }} initial={false} transition={{ duration: .3, ease }}/>
    </div>
  </nav>;
}

export default function Onboarding({ state, actions, libraryActions, go, notify, account, onExit }) {
  const saved = state.onboarding ?? emptyOnboarding();
  const savedAnswers = saved.answers ?? {};
  const [journey, setJourney] = useState(saved.journey ?? state.habit ?? null);
  const initialPhase = saved.journey && saved.status === 'active'
    ? Math.min(3, Math.max(0, Number(saved.step) || 1))
    : 0;
  const [phase, setPhase] = useState(initialPhase);
  const [answers, setAnswers] = useState(savedAnswers);

  // Passo 2: Ritmo Diário & Conforto Sonoro
  const [rhythmChoice, setRhythmChoice] = useState(savedAnswers.rhythmMode || 'ideal');
  const [dailyMinutes, setDailyMinutes] = useState(Number(savedAnswers.dailyMinutes ?? state.preferences?.dailyMinutes) || 90);
  const [soundscape, setSoundscape] = useState(savedAnswers.soundscape ?? state.preferences?.soundscape ?? 'rain');

  // Passo 3: Primeira Matéria
  const [subjectTitle, setSubjectTitle] = useState(savedAnswers.subjectName ?? savedAnswers.subject ?? '');
  const [subjectColor, setSubjectColor] = useState(savedAnswers.subjectColor || 'lume');
  const [studyMode, setStudyMode] = useState(savedAnswers.studyMode || 'notebook');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [error, setError] = useState('');
  const [invite, setInvite] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const activeSound = useMemo(
    () => SOUND_OPTIONS.find(item => item.id === soundscape) || SOUND_OPTIONS[0],
    [soundscape],
  );
  const activeGoal = useMemo(
    () => DAILY_GOALS.find(item => item.id === rhythmChoice) || DAILY_GOALS[1],
    [rhythmChoice],
  );
  const weeklyHours = useMemo(() => {
    const totalMinutes = (Number(dailyMinutes) || 90) * 7;
    return formatDailyDuration(totalMinutes);
  }, [dailyMinutes]);

  function selectRhythm(id) {
    if (!actions.startJourney(id)) return;
    setJourney(id);
    setPhase(1);
    setError('');
  }

  function persistSnapshot(nextPhase, extra = {}) {
    const merged = {
      ...answers,
      rhythmMode: rhythmChoice,
      dailyMinutes,
      soundscape,
      subjectName: subjectTitle.trim(),
      subjectColor,
      studyMode,
      ...extra,
    };
    if (!actions.saveAnswers(merged, nextPhase)) return false;
    setAnswers(merged);
    return merged;
  }

  function selectDailyOption(option) {
    setRhythmChoice(option.id);
    if (option.minutes) setDailyMinutes(option.minutes);
  }

  async function pickPdf(event) {
    const picked = event.target.files?.[0] || null;
    setError('');
    setPdfInfo(null);
    setPdfFile(picked);
    if (!picked) return;
    if (picked.type && picked.type !== 'application/pdf' && !/\.pdf$/i.test(picked.name)) {
      setError('Escolha um arquivo PDF.');
      return;
    }
    if (picked.size > PDF_PLANS.free.fileBytes) {
      setError(`O PDF tem ${formatBytes(picked.size)}; o limite inicial é ${formatBytes(PDF_PLANS.free.fileBytes)}.`);
      return;
    }
    setPdfBusy(true);
    try {
      const read = await inspectPdf(picked);
      setPdfInfo(read);
      if (!subjectTitle.trim()) {
        setSubjectTitle(read.title || picked.name.replace(/\.pdf$/i, ''));
      }
    } catch {
      setError('Não foi possível ler este PDF. Ele pode estar protegido por senha ou corrompido.');
    } finally {
      setPdfBusy(false);
    }
  }

  async function continueFromMaterial() {
    setError('');
    const title = subjectTitle.trim();
    if (!title && !(studyMode === 'pdf' && pdfFile)) {
      setError('Dê um nome para sua primeira matéria ou clique em Pular por enquanto.');
      return;
    }

    if (studyMode === 'pdf' && pdfFile && pdfInfo) {
      if (!account) {
        setError('Entre na sua conta para anexar arquivos PDF. Você pode usar Caderno em Branco na prévia.');
        return;
      }
      setPdfBusy(true);
      const fileId = crypto.randomUUID();
      try {
        const uploaded = await uploadPdf(pdfFile, fileId);
        const created = libraryActions.addPdf({
          title: pdfInfo.title || title || pdfFile.name.replace(/\.pdf$/i, ''),
          file: { fileId, name: pdfFile.name, size: uploaded.size, pages: pdfInfo.pages, outline: pdfInfo.outline, uploadedAt: new Date().toISOString() },
          newSubject: title || pdfInfo.title || 'Estudos em PDF',
        });
        if (!created) {
          await discardPdf(fileId);
          return;
        }
      } catch (err) {
        await discardPdf(fileId);
        setError(err.message);
        return;
      } finally {
        setPdfBusy(false);
      }
    } else if (title) {
      const added = libraryActions.addNotebookWithSubject({
        title,
        color: subjectColor,
        materialTitle: `${title} · Primeiro Caderno`,
        firstActivity: `Organizar primeiro tópico de ${title}`,
      });
      if (!added) return;
    }

    if (!persistSnapshot(3)) return;
    setPhase(3);
  }

  function finish() {
    const merged = {
      ...answers,
      rhythmMode: rhythmChoice,
      dailyMinutes,
      soundscape,
      subjectName: subjectTitle.trim(),
      subjectColor,
      studyMode,
    };
    if (!actions.finishJourney(merged, 4)) return;
    go('hoje');
    notify('Seu santuário está pronto. Você pode ajustar tudo quando quiser.');
  }

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
    notify('Não foi possível copiar automaticamente. O código está selecionado.');
  }

  return <div className="stitch-onboarding-layout">
    <header className="stitch-entry-topbar">
      <div className="stitch-entry-topbar-inner">
        <a className="brand" href="#conheca" aria-label="Lume — início">
          <Logo size={34}/>
          <span className="brand-name">Lume <span className="brand-sub">Academy</span></span>
        </a>
        <div className="stitch-entry-topbar-actions">
          <span className="soft-badge">Passo {phase + 1} de 4</span>
          <button type="button" className="text-button" onClick={() => onExit?.()}>Sair</button>
        </div>
      </div>
    </header>

    <div className="stitch-onboarding-main">
      <Stepper phase={phase}/>

      <motion.section
        key={phase}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .28, ease }}
        className="onboarding-card crest-card stitch-onboarding-card"
      >
        {phase === 0 && <>
          <header className="step-header">
            <span className="eyebrow">Sua jornada de descoberta</span>
            <h1 className="headline">Como os estudos fazem parte da sua vida hoje?</h1>
            <p className="muted-text">Não existe resposta certa, nem ritmo melhor. Você pode mudar tudo depois, sem perder nada do que já estudou.</p>
          </header>
          <fieldset className="rhythm-grid">
            <legend className="sr-only">Seu ritmo de estudo</legend>
            {STUDY_RHYTHMS.map((item, index) => (
              <motion.button
                key={item.id}
                type="button"
                {...stagger(index)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: .99 }}
                className={`pace-card ${journey === item.id ? 'selected' : ''}`}
                onClick={() => selectRhythm(item.id)}
                aria-pressed={journey === item.id}
              >
                <div className="pace-card-top">
                  <span className="pace-icon"><Icon name={item.icon}/></span>
                  <span className="card-indicator">{journey === item.id && <Icon name="check"/>}</span>
                </div>
                <span className="eyebrow">{item.label}</span>
                <h2 className="title">{item.title}</h2>
                <p className="muted-text">{item.text}</p>
                <span className="pace-detail">{item.detail}</span>
              </motion.button>
            ))}
          </fieldset>
          <div className="step-actions">
            <Button
              secondary
              onClick={() => {
                if (!actions.skipJourney()) return;
                go('hoje');
                notify('Você pode personalizar quando quiser.');
              }}
            >
              Explorar sem personalizar agora
            </Button>
          </div>
        </>}

        {phase === 1 && <>
          <header className="step-header">
            <span className="soft-badge tone-mint"><Icon name="spark"/>Passo 2 · Ritmo Diário</span>
            <h1 className="headline">Defina seu ritmo sem cobranças.</h1>
            <p className="muted-text">Escolha quanto tempo faz sentido por dia e qual ambiente sonoro acompanha melhor seu foco.</p>
          </header>

          <div className="stitch-onb-rhythm-split">
            <div className="stitch-onb-rhythm-controls">
              <div className="stitch-onb-section">
                <div className="stitch-onb-section-head">
                  <strong>Meta Diária Sugerida</strong>
                  <span>Você pode alterar depois</span>
                </div>
                <div className="stitch-goal-grid" role="radiogroup" aria-label="Meta Diária Sugerida">
                  {DAILY_GOALS.map(option => {
                    const selected = rhythmChoice === option.id;
                    return <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`stitch-goal-card ${selected ? 'is-selected' : ''}`}
                      onClick={() => selectDailyOption(option)}
                    >
                      <div className="stitch-goal-top">
                        <span className="stitch-goal-icon"><Icon name={option.icon}/></span>
                        <div className="stitch-goal-badges">
                          {option.badge && <span className="soft-badge tone-mint">{option.badge}</span>}
                          <span className="card-indicator">{selected && <Icon name="check"/>}</span>
                        </div>
                      </div>
                      <h2 className="title">{option.title}</h2>
                      <small className="stitch-goal-time">{option.label}</small>
                      <p className="muted-text">{option.desc}</p>
                    </button>;
                  })}
                </div>
                {rhythmChoice === 'custom' && <label className="field stitch-custom-minutes">
                  Minutos por dia ({dailyMinutes} min)
                  <input
                    type="range"
                    min={15}
                    max={300}
                    step={15}
                    value={dailyMinutes}
                    onChange={e => setDailyMinutes(Number(e.target.value))}
                  />
                </label>}
              </div>

              <div className="stitch-onb-section">
                <div className="stitch-onb-section-head">
                  <strong>Preferência de Conforto Sonoro</strong>
                  <span>Som sintético gerado no navegador</span>
                </div>
                <div className="stitch-sound-grid" role="radiogroup" aria-label="Preferência Sonora">
                  {SOUND_OPTIONS.map(option => {
                    const selected = soundscape === option.id;
                    return <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`stitch-sound-card ${selected ? 'is-selected' : ''}`}
                      onClick={() => setSoundscape(option.id)}
                    >
                      <Icon name={option.icon}/>
                      <strong>{option.title}</strong>
                      <small>{option.subtitle}</small>
                    </button>;
                  })}
                </div>
              </div>
            </div>

            <aside className="stitch-sanctuary-preview" aria-label="Prévia do Santuário">
              <div className="stitch-preview-header">
                <span className="stitch-preview-title">
                  <span className="soft-dot tone-mint-text" aria-hidden="true"/>
                  Prévia do santuário
                </span>
                <span className="soft-badge">Tempo Real</span>
              </div>
              <div className="stitch-preview-capsule">
                <div className="stitch-preview-sound-pill">
                  <span className="stitch-preview-sound-icon"><Icon name={activeSound.icon}/></span>
                  <div>
                    <strong>{activeSound.preview}</strong>
                    <small>{soundscape === 'off' ? 'Modo silencioso' : 'Ambiente ativo'}</small>
                  </div>
                  <div className={`landing-eq ${soundscape === 'off' ? 'is-paused' : ''}`} aria-hidden="true">
                    <span/><span/><span/>
                  </div>
                </div>
              </div>
              <div className="stitch-preview-projection">
                <div className="stitch-projection-row">
                  <span>Meta Diária Projetada:</span>
                  <strong className="tone-mint-text">{formatDailyDuration(dailyMinutes)}</strong>
                </div>
                <p className="quiet-note">{activeGoal.cycles}</p>
                <div className="stitch-weekly-bar-wrap">
                  <div className="stitch-weekly-bar-head">
                    <span>Expectativa Semanal</span>
                    <strong>{weeklyHours} total</strong>
                  </div>
                  <div className="stitch-weekly-bar" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, Math.round((dailyMinutes / 240) * 100))}%` }}/>
                  </div>
                </div>
              </div>
              <p className="stitch-calm-pledge">
                <Icon name="leaf"/>
                <span>Se você não estudar em algum dia, o Lume recalcula seu progresso sem alarmes vermelhos ou quebra punitiva de sequências.</span>
              </p>
            </aside>
          </div>

          <div className="step-actions">
            <Button secondary onClick={() => setPhase(0)}>Voltar</Button>
            <Button onClick={() => { if (persistSnapshot(2)) setPhase(2); }}>
              Continuar<Icon name="arrow"/>
            </Button>
          </div>
        </>}

        {phase === 2 && <>
          <header className="step-header">
            <span className="soft-badge tone-mint"><Icon name="book"/>Passo 3 · Primeira Matéria</span>
            <h1 className="headline">Adicione sua primeira matéria.</h1>
            <p className="muted-text">Comece organizando uma disciplina, projeto ou apostila. Nada aqui é definitivo.</p>
          </header>

          <div className="stitch-subject-setup">
            <div className="field">
              <label htmlFor="onb-subject-title">Nome da disciplina ou assunto</label>
              <input
                id="onb-subject-title"
                className="auth-input"
                value={subjectTitle}
                onChange={e => setSubjectTitle(e.target.value)}
                placeholder="Ex.: Direito Constitucional, Cálculo I, Inglês..."
                maxLength={80}
              />
              <div className="stitch-quick-chips" aria-label="Sugestões rápidas">
                {QUICK_SUBJECTS.map(name => (
                  <button
                    key={name}
                    type="button"
                    className={`filter-btn ${subjectTitle === name ? 'selected' : ''}`}
                    onClick={() => setSubjectTitle(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="stitch-color-row">
              <span>Cor de identificação</span>
              <div className="stitch-color-pills" role="radiogroup" aria-label="Cor da matéria">
                {SUBJECT_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={subjectColor === color}
                    aria-label={COLOR_LABELS[color] || color}
                    className={`stitch-color-dot color-${color} ${subjectColor === color ? 'is-selected' : ''}`}
                    onClick={() => setSubjectColor(color)}
                  >
                    {subjectColor === color && <Icon name="check"/>}
                  </button>
                ))}
              </div>
            </div>

            <div className="stitch-format-grid">
              <button
                type="button"
                className={`stitch-format-card ${studyMode === 'notebook' ? 'is-selected' : ''}`}
                aria-pressed={studyMode === 'notebook'}
                onClick={() => setStudyMode('notebook')}
              >
                <div className="stitch-format-head">
                  <span className="stitch-goal-icon"><Icon name="book"/></span>
                  <span className="card-indicator">{studyMode === 'notebook' && <Icon name="check"/>}</span>
                </div>
                <h2 className="title">Caderno em Branco</h2>
                <p className="muted-text">Comece do zero com sua matéria estruturada na Biblioteca e seu primeiro bloco pronto para estudar.</p>
              </button>

              <button
                type="button"
                className={`stitch-format-card ${studyMode === 'pdf' ? 'is-selected' : ''}`}
                aria-pressed={studyMode === 'pdf'}
                onClick={() => setStudyMode('pdf')}
              >
                <div className="stitch-format-head">
                  <span className="stitch-goal-icon tone-mint"><Icon name="upload"/></span>
                  <span className="card-indicator">{studyMode === 'pdf' && <Icon name="check"/>}</span>
                </div>
                <h2 className="title">Anexar PDF / Apostila</h2>
                <p className="muted-text">Envie apostilas ou livros para ler no leitor embutido com retomada automática na última página.</p>
              </button>
            </div>

            {studyMode === 'pdf' && <div className="stitch-pdf-dropzone">
              {account ? <>
                <Icon name="upload"/>
                <strong>{pdfFile ? pdfFile.name : 'Selecione seu arquivo PDF'}</strong>
                <p className="quiet-note">
                  {pdfInfo
                    ? `${pdfInfo.pages} páginas · ${formatBytes(pdfFile.size)}`
                    : `Até ${formatBytes(PDF_PLANS.free.fileBytes)} com sumário e retomada de página`}
                </p>
                <label className="button secondary">
                  <span>{pdfBusy ? 'Lendo PDF…' : pdfFile ? 'Trocar arquivo PDF' : 'Escolher arquivo PDF'}</span>
                  <input type="file" className="sr-only" accept="application/pdf,.pdf" onChange={pickPdf} disabled={pdfBusy}/>
                </label>
              </> : <p className="muted-text">A prévia sem conta não envia arquivos PDF. Use <strong>Caderno em Branco</strong> agora ou entre na sua conta depois.</p>}
            </div>}

            <p className="stitch-calm-pledge">
              <Icon name="leaf"/>
              <span>Você pode adicionar matérias ilimitadas e reorganizar seus ciclos depois na sua <strong>Biblioteca</strong>.</span>
            </p>
          </div>

          {error && <p role="alert" className="form-error">{error}</p>}
          <div className="step-actions">
            <div className="step-actions-left">
              <Button secondary onClick={() => setPhase(1)}>Voltar</Button>
              <button type="button" className="text-button" onClick={() => { if (persistSnapshot(3)) setPhase(3); }}>
                Pular por enquanto
              </button>
            </div>
            <Button onClick={continueFromMaterial} disabled={pdfBusy}>
              {pdfBusy ? 'Enviando…' : 'Criar material e continuar'}<Icon name="arrow"/>
            </Button>
          </div>
        </>}

        {phase === 3 && <>
          <header className="step-header">
            <span className="eyebrow">Passo 4 · Etapa opcional</span>
            <h1 className="headline">Quer estudar com alguém?</h1>
            <p className="muted-text">Você pode pular esta parte. Ela não muda seu XP nem seu plano.</p>
          </header>
          <div className="social-preview-grid">
            <div className="card-surface">
              <div className="card-head">
                <span className="pace-icon"><Icon name="users"/></span>
                <span className={`soon-badge${account ? ' is-ready' : ''}`}>{account ? 'Disponível' : 'Com conta'}</span>
              </div>
              <strong className="title">Convidar amigos</strong>
              {account
                ? invite
                  ? <>
                      <p className="muted-text">Envie este código. Vale por 7 dias e várias pessoas podem usá-lo.</p>
                      <code className="invite-code">{invite.code}</code>
                      <Button secondary onClick={copyInvite}><Icon name="check"/>Copiar link do convite</Button>
                    </>
                  : <>
                      <p className="muted-text">Gere um convite por link. Ser amigo não compartilha sua biblioteca nem seu XP.</p>
                      <Button secondary onClick={createInvite} disabled={inviteBusy}><Icon name="plus"/>{inviteBusy ? 'Gerando convite…' : 'Convidar amigos'}</Button>
                    </>
                : <>
                    <p className="muted-text">O convite fica vinculado a uma conta. Na prévia, ele não pode ser gerado.</p>
                    <Button secondary onClick={() => go('login')}><Icon name="lock"/>Entrar para convidar</Button>
                  </>}
              {inviteError && <p role="alert" className="form-error">{inviteError}</p>}
            </div>
            <div className="card-surface">
              <div className="card-head"><span className="pace-icon"><Icon name="mail"/></span><span className="soon-badge">Amigos</span></div>
              <strong className="title">Mensagens diretas</strong>
              <p className="muted-text">Conversas individuais entre amizades aceitas. O Lume não tem grupos, comunidades ou canais.</p>
              <a className="text-link" href="#mensagens">Abrir mensagens<Icon name="arrow"/></a>
            </div>
            <div className="card-surface">
              <div className="card-head"><span className="pace-icon"><Icon name="podium"/></span><span className="soon-badge">Opcional</span></div>
              <strong className="title">Ranking de amigos</strong>
              <p className="muted-text">Compare nível, cursos concluídos e empenho no período com participação opcional.</p>
              <a className="text-link" href="#ranking">Conhecer o ranking<Icon name="arrow"/></a>
            </div>
          </div>
          <div className="step-actions">
            <Button secondary onClick={() => setPhase(2)}>Voltar</Button>
            <Button onClick={finish}>Concluir e ir para Hoje<Icon name="arrow"/></Button>
          </div>
        </>}
      </motion.section>
    </div>

    <footer className="stitch-entry-footer">
      <div className="stitch-entry-footer-inner">
        <span>Lume · Seu ritmo, sua jornada.</span>
        <span>Suas configurações ficam salvas e podem ser alteradas depois.</span>
      </div>
    </footer>
  </div>;
}
