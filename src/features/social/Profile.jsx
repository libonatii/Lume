import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import Icon from '../../ui/Icon.jsx';
import { AnimatedNumber, Button, Cover, Heading, Progress, Skeleton, stagger } from '../../ui/ui.jsx';
import { useResource } from '../../lib/resources.js';
import { profilePath } from './prefetch.js';
import SectionTabs from '../../app/SectionTabs.jsx';
import { buildProfile } from '../../../public/profile-domain.js';
import { MAX_PROFILE_BIO_LENGTH, studyRhythm } from '../../../public/domain.js';
import { prepareProfileImageBlob, uploadProfileBlob } from './profile-media.js';

// Perfil inspirado na vitrine da Steam, adaptado para estudos no Lume:
// - Banner (header) e foto de perfil enviados ao armazenamento de objetos (Cloudflare R2
//   via /api/profile/media/:slot), guardando apenas a URL /api/media/profiles/... no estado;
// - Nível + insígnia em destaque + botão Editar perfil;
// - Colecionador de Estudos (estatísticas + trilhas em destaque);
// - Atividade recente (últimas 2 semanas + barra de progresso de cada trilha);
// - Barra lateral com Conquistas/Insígnias e atalhos.

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
    'Uma disciplina por vez',
    'Progresso guardado na conta',
  ];
}

export default function Profile({ id, handle = '', state, actions, account, notify, go, xp }) {
  const [editing, setEditing] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [bioDraft, setBioDraft] = useState(() => state.profile?.bio || '');
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  // O perfil abre por id (#perfil?id=) ou por @usuário (/@usuario). Pelo @usuário só se
  // sabe se é o da própria conta depois de ler o @usuário dela.
  const own = useResource('/api/friends/handle', { enabled: Boolean(account) });
  const ownHandle = own.data?.handle || '';
  const ownReady = !account || own.data !== undefined || Boolean(own.error);
  const byHandle = Boolean(handle) && !id;
  // Pelo @usuário, o servidor também avisa se é a própria conta (resposta `self`).
  const [selfByServer, setSelfByServer] = useState(false);
  useEffect(() => { setSelfByServer(false); }, [handle]);
  const isSelf = byHandle ? Boolean(account && ((ownReady && handle === ownHandle) || selfByServer)) : (!id || Boolean(account && id === account.id));

  useEffect(() => {
    setBioDraft(state.profile?.bio || '');
  }, [state.profile?.bio]);

  useEffect(() => { setEditing(false); }, [id, handle]);

  // Dados do perfil de outra pessoa: recurso em cache. Quem já foi aberto (ou buscado ao
  // passar o mouse) aparece na hora e é atualizado em segundo plano.
  const path = !isSelf && (id || handle) ? profilePath({ id, handle: byHandle ? handle : '' }) : '';
  const remote = useResource(path, { enabled: Boolean(path) });
  useEffect(() => { if (remote.data?.self) setSelfByServer(true); }, [remote.data]);
  const profile = remote.data?.profile || null;
  // Perfil que deixou de ser acessível (fechado, removido) não fica no ar só por estar em cache.
  const error = remote.error && (!remote.data || remote.status === 403 || remote.status === 404)
    ? remote.error
    : (remote.data && !remote.data.self && !remote.data.profile ? 'Não foi possível abrir este perfil agora.' : '');

  // Endereço limpo do perfil: lumeacademy.site/@usuario.
  const addressHandle = isSelf ? ownHandle : profile?.user?.handle;
  useEffect(() => {
    if (!addressHandle) return;
    const clean = `/@${addressHandle}`;
    if (location.pathname !== clean) history.replaceState(null, '', clean);
  }, [addressHandle]);

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
    <Heading eyebrow="Perfis ficam entre amigos e perfis públicos" title="Não foi possível abrir"/>
    <section className="card-surface settings-panel">
      <p className="muted-text">{error}</p>
      <Button secondary onClick={() => go('amigos')}>Voltar aos amigos<Icon name="arrow"/></Button>
    </section>
  </div>;

  if (!view) return <div className="personal-root">
    <Heading eyebrow="Perfil" title="Perfil"/>
    <Skeleton label="Carregando o perfil…" rows={4}/>
  </div>;

  const {
    user,
    customization = { bio: '', avatar: '', header: '' },
    stats,
    studying = [],
    completed = [],
    queue = [],
    achievements: badges = [],
    featuredBadge = null,
    recentActivity = [],
  } = view;

  const nothingShared = !studying.length && !queue.length && !completed.length;
  const showcaseCourses = [...studying, ...completed].slice(0, 6);
  const rhythmLabel = studyRhythm(state).title;
  const bioLines = formatBioLines(customization.bio, rhythmLabel);

  return <div className="personal-root steam-profile-root">
    {byHandle && isSelf && <SectionTabs route="perfil"/>}
    {/* Cabeçalho / vitrine superior estilo Steam */}
    <section
      className={`steam-hero crest-card ${customization.header ? 'has-custom-header' : ''}`}
      style={customization.header ? { '--profile-header-image': `url(${customization.header})` } : undefined}
      aria-labelledby="profile-user-title"
    >
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
          {!isSelf && <span className="soft-badge tone-mint"><span className="soft-dot" aria-hidden="true"/>{view.viewer === 'public' ? 'Perfil público' : 'Perfil de amigo'}</span>}
          <h1 id="profile-user-title" className="display steam-persona-name">{user.name}</h1>
          {(isSelf ? ownHandle : user.handle) && <p className="steam-handle mono">@{isSelf ? ownHandle : user.handle}</p>}
          {view.titles?.length > 0 && <section className="profile-titles" aria-label="Cargos de estudo">
            <ul className="soft-badges">{view.titles.map((item) => <li key={item.id} className="soft-badge tone-reward" title={item.criterion}><Icon name="trophy"/><strong>{item.title}</strong><span className="profile-title-criterion">· {item.criterion}</span></li>)}</ul>
          </section>}
          {!isSelf && <p className="steam-subname">{view.viewer === 'public' ? 'O que esta pessoa escolheu tornar público.' : 'O que esta pessoa escolheu compartilhar com amigos.'}</p>}
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
              <strong>{featuredBadge ? featuredBadge.title : 'Primeira conquista a caminho'}</strong>
              <small>{stats.xp !== null ? `${stats.xp} XP ${stats.xpValidated ? 'confirmados pelo servidor' : 'da prévia local'}` : 'XP oculto no perfil'}</small>
            </div>
          </div>

          <div className="steam-hero-actions">
            {isSelf && <Button secondary onClick={() => setEditing((prev) => !prev)} aria-expanded={editing}>
              <Icon name="edit"/>{editing ? 'Fechar edição' : 'Editar perfil'}
            </Button>}
            {!isSelf && <Button secondary onClick={() => go('amigos')}>
              <Icon name="users"/>Amigos
            </Button>}
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
            <span className="steam-showcase-sub">o que está compartilhado</span>
          </header>

          <div className="steam-showcase-body">
            <div className="steam-collector-stats">
              <div className="steam-stat-cell">
                <strong><AnimatedNumber value={stats.activeCourses ?? 0}/></strong>
                <span>Materiais na biblioteca</span>
              </div>
              {stats.doneLessons !== null && <div className="steam-stat-cell">
                <strong><AnimatedNumber value={stats.doneLessons}/></strong>
                <span>Aulas concluídas (de {stats.lessons})</span>
              </div>}
              {stats.completedCourses !== null && <div className="steam-stat-cell">
                <strong><AnimatedNumber value={stats.completedCourses}/></strong>
                <span>Materiais completos</span>
              </div>}
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
      </div>

      {/* Coluna lateral direita estilo Steam */}
      <aside className="steam-sidebar" aria-label="Resumo e insígnias do perfil">
        <div className="steam-status-box">
          <span className="steam-online-label">
            <span className="companion-dot" aria-hidden="true"/>
            {isSelf && state.activeSession
              ? `Estudando agora · ${state.activeSession.label}`
              : studying.length > 0 ? 'Estudando' : 'Disponível no Lume'}
          </span>
          {!isSelf && <small className="muted-text">Mostra só se está estudando agora, sem o tempo.</small>}
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
            {isSelf && <button type="button" className="text-button accent" onClick={() => go('conquistas')}>
              Ver conquistas<Icon name="arrow"/>
            </button>}
          </> : <p className="quiet-note">Conquistas e XP ocultos neste perfil.</p>}
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
        </nav>
      </aside>
    </div>
  </div>;
}
