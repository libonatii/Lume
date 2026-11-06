import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import Icon from '../../ui/Icon.jsx';
import { AnimatedNumber, Button, Cover, Glow, Heading, Progress, stagger } from '../../ui/ui.jsx';
import { api, apiError } from '../../lib/api.js';
import { buildProfile } from '../../../public/profile-domain.js';
import { MAX_PROFILE_BIO_LENGTH, studyRhythm } from '../../../public/domain.js';
import { prepareProfileImageBlob, uploadProfileBlob } from './profile-media.js';

// Perfil inspirado na vitrine da Steam, adaptado para estudos no Lume:
// - Banner (header) e foto de perfil enviados ao armazenamento de objetos (Cloudflare R2
//   via /api/profile/media/:slot), guardando apenas a URL /api/media/profiles/... no estado;
// - Nível + insígnia em destaque + botão Editar perfil;
// - Colecionador de Estudos (estatísticas + trilhas em destaque);
// - Atividade recente (últimas 2 semanas + barra de progresso de cada trilha);
// - Barra lateral com Conquistas/Insígnias, Na fila, Projetos públicos e atalhos.

const STATUS_LABEL = { active: 'Em andamento', new: 'Começando', paused: 'Pausado', completed: 'Concluído' };

function formatBioLines(bio, fallbackRhythm) {
  const lines = String(bio || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (lines.length > 0) return lines;
  return [
    `Ritmo atual: ${fallbackRhythm}`,
    'Aprendendo passo a passo, sem pressa',
    'Progresso guardado e retomável a qualquer momento',
  ];
}

export default function Profile({ id, state, actions, account, notify, go, xp }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [bioDraft, setBioDraft] = useState(() => state.profile?.bio || '');
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  const isSelf = !id || Boolean(account && id === account.id);

  useEffect(() => {
    setBioDraft(state.profile?.bio || '');
  }, [state.profile?.bio]);

  useEffect(() => {
    setError('');
    setProfile(null);
    setEditing(false);
    if (isSelf || !id) return undefined;
    let alive = true;
    (async () => {
      const result = await api(`/api/profile/${encodeURIComponent(id)}`);
      if (!alive) return;
      if (!result.ok) { setError(apiError(result)); return; }
      setProfile(result.data.profile);
    })().catch(() => { if (alive) setError('Não foi possível abrir este perfil agora.'); });
    return () => { alive = false; };
  }, [id, isSelf]);

  const selfName = account?.name || 'Estudante na Prévia';
  const validated = xp?.summary ? { ...xp.summary, achievements: xp.achievements, titles: xp.titles } : null;
  const view = isSelf
    ? { user: { id: account?.id || 'local', name: selfName }, updatedAt: null, ...buildProfile(state, { validated }) }
    : profile;

  async function handleImageUpload(kind, event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !actions) return;
    setUploadError('');
    try {
      const dimensions = kind === 'avatar' ? { width: 320, height: 320 } : { width: 1280, height: 420 };
      const blob = await prepareProfileImageBlob(file, dimensions);
      const mediaUrl = await uploadProfileBlob(kind, blob);
      if (!actions.updateProfile({ [kind]: mediaUrl })) return;
      notify(kind === 'avatar' ? 'Foto do perfil enviada e atualizada.' : 'Capa (header) enviada e atualizada.');
    } catch (exception) {
      setUploadError(exception.message || 'Não foi possível enviar a imagem.');
    }
  }

  function clearImage(kind) {
    if (!actions?.updateProfile({ [kind]: '' })) return;
    fetch(`/api/profile/media/${encodeURIComponent(kind)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).catch(() => {});
    notify(kind === 'avatar' ? 'Foto do perfil removida.' : 'Capa do perfil restaurada ao padrão.');
  }

  function saveProfileText(event) {
    event.preventDefault();
    if (!actions?.updateProfile({ bio: bioDraft })) return;
    setEditing(false);
    notify('Detalhes do perfil salvos.');
  }

  if (error) return <div className="personal-root">
    <Heading eyebrow="Perfis ficam entre amigos" title="Não foi possível abrir"/>
    <section className="card-surface settings-panel">
      <p className="muted-text">{error}</p>
      <Button secondary onClick={() => go('amigos')}>Voltar aos amigos<Icon name="arrow"/></Button>
    </section>
  </div>;

  if (!view) return <div className="personal-root">
    <Heading eyebrow="Perfil" title="Carregando…"/>
  </div>;

  const {
    user,
    customization = { bio: '', avatar: '', header: '' },
    stats,
    studying = [],
    completed = [],
    queue = [],
    projects = [],
    achievements: badges = [],
    featuredBadge = null,
    recentActivity = [],
  } = view;

  const nothingShared = !studying.length && !queue.length && !projects.length && !completed.length;
  const showcaseCourses = [...studying, ...completed].slice(0, 6);
  const unlockedBadges = badges.filter((item) => item.unlocked);
  const rhythmLabel = studyRhythm(state).title;
  const bioLines = formatBioLines(customization.bio, rhythmLabel);

  return <div className="personal-root steam-profile-root">
    {/* Cabeçalho / vitrine superior estilo Steam */}
    <section
      className={`steam-hero ${customization.header ? 'has-custom-header' : ''}`}
      style={customization.header ? { '--profile-header-image': `url(${customization.header})` } : undefined}
      aria-labelledby="profile-user-title"
    >
      {!customization.header && <Glow palette="lume"/>}
      <div className="steam-hero-backdrop" aria-hidden="true"/>

      <div className="steam-hero-inner">
        {/* Moldura de Avatar */}
        <div className="steam-avatar-column">
          <div className="steam-avatar-frame">
            {customization.avatar
              ? <img src={customization.avatar} alt={`Foto de perfil de ${user.name}`} className="steam-avatar-img"/>
              : <span className="steam-avatar-fallback" aria-hidden="true">{String(user.name || '?').slice(0, 1).toUpperCase()}</span>}
            {isSelf && <button
              type="button"
              className="steam-avatar-upload-trigger"
              onClick={() => avatarInputRef.current?.click()}
              title="Enviar foto do computador"
              aria-label="Alterar foto do perfil"
            >
              <Icon name="image"/><span>Foto</span>
            </button>}
          </div>
        </div>

        {/* Identidade + Bio em tópicos estilo Steam */}
        <div className="steam-identity">
          <span className="eyebrow on-glow">{isSelf ? 'Seu perfil como os amigos veem' : 'Perfil de amigo'}</span>
          <h1 id="profile-user-title" className="display steam-persona-name">{user.name}</h1>
          {view.titles?.length > 0 && <section aria-label="Cargos de estudo">
            <h2>Cargos de estudo</h2>
            <p className="muted-text">Títulos por avanço real. Todas as funcionalidades estão disponíveis para todos os cargos.</p>
            <ul>{view.titles.map((item) => <li key={item.id}><strong>{item.title}</strong> — {item.criterion}</li>)}</ul>
          </section>}
          <p className="steam-subname">
            {isSelf
              ? 'Este é o recorte que outras pessoas da sua lista enxergam. Ajuste em Configurações › O que amigos veem.'
              : 'O que esta pessoa escolheu compartilhar com amigos.'}
          </p>
          <ul className="steam-bio-list" aria-label="Destaques do estudante">
            {bioLines.map((line, index) => <li key={`${index}-${line}`}>
              <span className="steam-diamond" aria-hidden="true">♦</span>
              <span>{line}</span>
            </li>)}
          </ul>
        </div>

        {/* Coluna direita do topo: Nível + Insígnia em destaque + Botões */}
        <div className="steam-level-panel">
          {stats.level !== null ? <div className="steam-level-header">
            <span className="steam-level-word">Nível</span>
            <span className="steam-level-circle" aria-label={`Nível ${stats.level}`}>{stats.level}</span>
          </div> : <div className="steam-level-header">
            <span className="steam-level-word">Nível privado</span>
          </div>}

          <div className="steam-featured-badge">
            <span className="steam-featured-icon">
              <Icon name={featuredBadge?.icon || 'spark'}/>
            </span>
            <div className="steam-featured-copy">
              <strong>{featuredBadge ? featuredBadge.title : 'Caminho em construção'}</strong>
              <small>{stats.xp !== null ? `${stats.xp} XP ${stats.xpValidated ? 'confirmados pelo servidor' : 'da prévia local'}` : 'XP oculto no perfil'}</small>
            </div>
          </div>

          <div className="steam-hero-actions">
            {isSelf && <Button secondary onClick={() => setEditing((prev) => !prev)} aria-expanded={editing}>
              <Icon name="edit"/>{editing ? 'Fechar edição' : 'Editar perfil'}
            </Button>}
            <Button secondary onClick={() => go('amigos')}>
              <Icon name="users"/>Amigos
            </Button>
            {isSelf && <Button ghost onClick={() => go('configuracoes')}>
              <Icon name="settings"/>Privacidade
            </Button>}
          </div>
        </div>
      </div>

      {/* Painel expansível de personalização (Upload de foto, header e bio) */}
      {isSelf && editing && <motion.div
        className="steam-customizer"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Selecionar foto de perfil do computador"
          onChange={(event) => handleImageUpload('avatar', event)}
        />
        <input
          ref={headerInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Selecionar imagem de capa (header) do computador"
          onChange={(event) => handleImageUpload('header', event)}
        />

        <div className="steam-customizer-grid">
          <div className="steam-upload-box">
            <span className="eyebrow">Foto do perfil</span>
            <p className="muted-text">Envie uma imagem do seu computador (quadrada recomendada).</p>
            <div className="action-row">
              <Button secondary onClick={() => avatarInputRef.current?.click()}><Icon name="image"/>Enviar foto</Button>
              {customization.avatar && <button type="button" className="text-button" onClick={() => clearImage('avatar')}>Remover foto</button>}
            </div>
          </div>

          <div className="steam-upload-box">
            <span className="eyebrow">Capa do cabeçalho (Header)</span>
            <p className="muted-text">Imagem panorâmica para o fundo do topo do perfil.</p>
            <div className="action-row">
              <Button secondary onClick={() => headerInputRef.current?.click()}><Icon name="image"/>Enviar header</Button>
              {customization.header && <button type="button" className="text-button" onClick={() => clearImage('header')}>Restaurar padrão</button>}
            </div>
          </div>

          <form className="steam-bio-form" onSubmit={saveProfileText}>
            <label className="field" htmlFor="profile-bio-input">
              Apresentação e metas (até 4 linhas com ♦ no perfil)
              <textarea
                id="profile-bio-input"
                rows={3}
                maxLength={MAX_PROFILE_BIO_LENGTH}
                value={bioDraft}
                onChange={(event) => setBioDraft(event.target.value)}
                placeholder={'Ex.: Estudando Direito Processual e Python\nMeta: 3 sessões por semana\nFoco atual: concluir projetos práticos'}
              />
            </label>
            <div className="action-row">
              <Button type="submit"><Icon name="check"/>Salvar apresentação</Button>
            </div>
          </form>
        </div>
        {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
      </motion.div>}
    </section>

    {nothingShared && <section className="card-surface settings-panel">
      <p className="muted-text">Esta pessoa ainda não compartilhou nada do estudo com amigos.</p>
    </section>}

    {/* Corpo em 2 colunas estilo Steam: Esquerda (Vitrines + Atividade Recente), Direita (Status + Conquistas + Links) */}
    <div className="steam-body-grid">
      <div className="steam-main-column">
        {/* Vitrine 1: Colecionador de Estudos */}
        <section className="steam-showcase" aria-labelledby="showcase-collector-title">
          <header className="steam-showcase-header">
            <h2 id="showcase-collector-title" className="steam-showcase-title">Colecionador de estudos</h2>
            <span className="steam-showcase-sub">Estante compartilhada</span>
          </header>

          <div className="steam-showcase-body">
            <div className="steam-collector-stats">
              <div className="steam-stat-cell">
                <strong><AnimatedNumber value={stats.activeCourses ?? 0}/></strong>
                <span>Materiais na estante</span>
              </div>
              {stats.doneLessons !== null && <div className="steam-stat-cell">
                <strong><AnimatedNumber value={stats.doneLessons}/></strong>
                <span>Aulas concluídas (de {stats.lessons})</span>
              </div>}
              {stats.completedCourses !== null && <div className="steam-stat-cell">
                <strong><AnimatedNumber value={stats.completedCourses}/></strong>
                <span>Materiais completos</span>
              </div>}
              <div className="steam-stat-cell">
                <strong><AnimatedNumber value={projects.length}/></strong>
                <span>Projetos públicos</span>
              </div>
            </div>

            <div className="steam-featured-shelf">
              <span className="steam-sublabel">Trilhas em destaque</span>
              {showcaseCourses.length > 0 ? <div className="steam-capsule-grid">
                {showcaseCourses.map((item, index) => <motion.article key={item.id} className="steam-capsule" {...stagger(index)}>
                  <Cover art={item.art} className="steam-capsule-cover">
                    <span className={`course-status status-${item.status}`}>{STATUS_LABEL[item.status] || item.status}</span>
                  </Cover>
                  <div className="steam-capsule-info">
                    <strong>{item.title}</strong>
                    <small>{item.type}{item.progress ? ` · ${item.progress.percent}%` : ''}</small>
                  </div>
                </motion.article>)}
              </div> : <p className="inline-note"><Icon name="info"/><span>Nada em andamento compartilhado.</span></p>}
            </div>
          </div>
        </section>

        {/* Vitrine 2: Atividade Recente */}
        <section className="steam-showcase" aria-labelledby="showcase-activity-title">
          <header className="steam-showcase-header">
            <h2 id="showcase-activity-title" className="steam-showcase-title">Atividade recente</h2>
            <span className="steam-showcase-sub">
              {stats.recentStepsTwoWeeks !== null
                ? `${stats.recentStepsTwoWeeks} ${stats.recentStepsTwoWeeks === 1 ? 'passo registrado' : 'passos registrados'}${stats.recentMinutesTwoWeeks ? ` · ${stats.recentMinutesTwoWeeks} min declarados` : ''} nas últimas 2 semanas`
                : 'Histórico de passos oculto'}
            </span>
          </header>

          <div className="steam-showcase-body">
            {recentActivity.length > 0 ? <div className="steam-activity-list">
              {recentActivity.map((item) => <article key={item.id} className="steam-activity-card">
                <div className="steam-activity-top">
                  <Cover art={item.art} className="steam-activity-thumb"/>
                  <div className="steam-activity-heading">
                    <h3 className="title">{item.title}</h3>
                    <small>{item.type} · {STATUS_LABEL[item.status] || item.status}</small>
                  </div>
                  <div className="steam-activity-meta">
                    {item.durationMinutes && <strong>{item.durationMinutes} min declarados</strong>}
                    <small>
                      {item.lastAt
                        ? `Último registro em ${new Date(item.lastAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                        : 'Progresso na biblioteca'}
                    </small>
                  </div>
                </div>

                {item.progress && <div className="steam-activity-progress">
                  <div className="steam-activity-progress-head">
                    <span><Icon name="trophy"/>Etapas concluídas</span>
                    <strong>{item.progress.done} de {item.progress.total} · {item.progress.percent}%</strong>
                  </div>
                  <Progress value={item.progress.done} max={item.progress.total || 1} tone={item.status === 'completed' ? 'mint' : 'lume'} label={`Progresso de ${item.title}`}/>
                  {item.lastLabel && <small className="steam-activity-step">Último passo: {item.lastLabel}</small>}
                </div>}
              </article>)}
            </div> : <p className="inline-note"><Icon name="clock"/><span>Nenhuma atividade recente compartilhada nas últimas semanas.</span></p>}
          </div>
        </section>

        {/* Vitrine 3: Na fila e Concluídos (mantém compatibilidade com os recortes do perfil) */}
        <div className="profile-grid">
          <section className="card-surface profile-section">
            <div className="panel-title"><span className="pace-icon"><Icon name="flag"/></span><div><h2 className="title">Na fila</h2><p className="muted-text">O roteiro que a pessoa vê em Hoje.</p></div></div>
            {queue.length > 0 ? <ol className="profile-queue">
              {queue.map((step, index) => <li key={`${step.course}-${step.lesson}-${index}`}>
                <span className="profile-queue-index">{index + 1}</span>
                <span className="profile-item-copy"><strong>{step.lesson}</strong><small>{step.course} · {step.reason}</small></span>
              </li>)}
            </ol> : <p className="inline-note"><Icon name="info"/><span>Sem próximos passos compartilhados.</span></p>}
          </section>

          <section className="card-surface profile-section">
            <div className="panel-title"><span className="pace-icon"><Icon name="check"/></span><div><h2 className="title">Concluídos</h2><p className="muted-text">Materiais que chegaram ao fim.</p></div></div>
            {completed.length > 0 ? <ul className="profile-list">
              {completed.map((item) => <li key={item.id}>
                <span className="profile-item-copy"><strong>{item.title}</strong><small>{item.type} · concluído</small></span>
                <span className="profile-check"><Icon name="check"/></span>
              </li>)}
            </ul> : <p className="inline-note"><Icon name="info"/><span>Nada concluído por enquanto.</span></p>}
          </section>
        </div>
      </div>

      {/* Coluna lateral direita estilo Steam */}
      <aside className="steam-sidebar" aria-label="Resumo e insígnias do perfil">
        <div className="steam-status-box">
          <span className="steam-online-label">
            <span className="companion-dot" aria-hidden="true"/>
            {isSelf && state.activeSession
              ? `Estudando agora · ${state.activeSession.label}`
              : studying.length > 0 ? 'Em jornada de estudos' : 'Disponível no Lume'}
          </span>
          <small className="muted-text">
            {isSelf ? `Ritmo: ${rhythmLabel}` : 'Presença respeitosa · sem cobrança de tempo'}
          </small>
        </div>

        {/* Conquistas / Insígnias */}
        <section className="steam-side-section" aria-labelledby="sidebar-badges-title">
          <div className="steam-side-head">
            <h2 id="sidebar-badges-title" className="steam-side-title">Conquistas</h2>
            {stats.unlockedAchievements !== null && <span className="steam-side-count">{stats.unlockedAchievements}/{stats.totalAchievements}</span>}
          </div>
          {badges.length > 0 ? <>
            <div className="steam-badge-row">
              {badges.map((badge) => <div
                key={badge.id}
                className={`steam-badge-slot ${badge.unlocked ? 'is-unlocked' : 'is-locked'}`}
                title={`${badge.title} — ${badge.text} (${badge.current}/${badge.target})`}
              >
                <Icon name={badge.icon}/>
              </div>)}
            </div>
            <p className="quiet-note">
              {unlockedBadges.length > 0
                ? `Última desbloqueada: ${unlockedBadges[unlockedBadges.length - 1].title}`
                : 'Complete passos de estudo para desbloquear insígnias.'}
            </p>
            {isSelf && <button type="button" className="text-button accent" onClick={() => go('conquistas')}>
              Ver vitrine de conquistas<Icon name="arrow"/>
            </button>}
          </> : <p className="quiet-note">Conquistas e XP ocultos neste perfil.</p>}
        </section>

        {/* Projetos públicos */}
        <section className="steam-side-section" aria-labelledby="sidebar-projects-title">
          <div className="steam-side-head">
            <h2 id="sidebar-projects-title" className="steam-side-title">Projetos públicos</h2>
            <span className="steam-side-count">{projects.length}</span>
          </div>
          {projects.length > 0 ? <ul className="profile-list">
            {projects.map((project) => <li key={project.id}>
              <span className="profile-item-copy">
                <strong>{project.title}</strong>
                <small>{STATUS_LABEL[project.status] || project.status}{project.progress ? ` · ${project.progress.percent}%` : ''}</small>
              </span>
            </li>)}
          </ul> : <p className="quiet-note">Nenhum projeto marcado como público.</p>}
        </section>

        {/* Contadores e links estilo menu lateral da Steam */}
        <nav className="steam-side-links" aria-label="Atalhos do perfil">
          <div className="steam-side-link-item">
            <span>Estudando agora</span>
            <strong>{studying.length}</strong>
          </div>
          <div className="steam-side-link-item">
            <span>Aulas concluídas</span>
            <strong>{stats.doneLessons ?? '—'}</strong>
          </div>
          <div className="steam-side-link-item">
            <span>Materiais completos</span>
            <strong>{stats.completedCourses ?? '—'}</strong>
          </div>
          <div className="steam-side-link-item">
            <span>Passos na fila</span>
            <strong>{queue.length}</strong>
          </div>
          {isSelf && <>
            <button type="button" className="steam-side-nav-btn" onClick={() => go('biblioteca')}>
              <span>Abrir biblioteca</span><Icon name="arrow"/>
            </button>
            <button type="button" className="steam-side-nav-btn" onClick={() => go('historico')}>
              <span>Meu caminho completo</span><Icon name="arrow"/>
            </button>
          </>}
        </nav>
      </aside>
    </div>

    <p className="quiet-note">XP, níveis e conquistas de contas são confirmados pelo servidor e refletem apenas eventos elegíveis; o saldo legado do protótipo fica fora do ranking. Perfis de amigos mostram somente o que cada pessoa escolheu compartilhar.</p>
  </div>;
}
