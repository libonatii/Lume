import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Button, Heading, Progress } from './ui.jsx';
import { api, apiError } from '../lib/api.js';
import { buildProfile } from '../../public/profile-domain.js';

// Perfil de outra pessoa: só a amizade abre. A própria pessoa vê a mesma projeção
// calculada no navegador, sem ida à API. XP e progresso vêm do estado que a pessoa
// sincronizou, então a tela diz que são declarados.

const STATUS_LABEL = { active: 'Em andamento', new: 'Começando', paused: 'Pausado', completed: 'Concluído' };

function Section({ icon, title, note, children, empty }) {
  return <section className="card-surface profile-section">
    <div className="panel-title"><span className="pace-icon"><Icon name={icon}/></span><div><h2 className="title">{title}</h2>{note && <p className="muted-text">{note}</p>}</div></div>
    {children || <p className="inline-note"><Icon name="info"/><span>{empty}</span></p>}
  </section>;
}

function ProgressLine({ progress }) {
  if (!progress) return null;
  return <div className="profile-progress">
    <Progress value={progress.done} max={progress.total || 1} label={`${progress.done} de ${progress.total} concluídos`} tone="lume"/>
    <small>{progress.done} de {progress.total} · {progress.percent}%</small>
  </div>;
}

export default function Profile({ id, state, account, go }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const isSelf = Boolean(account && id === account.id);

  useEffect(() => {
    setError('');
    setProfile(null);
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

  const view = isSelf ? { user: { id: account.id, name: account.name }, updatedAt: null, ...buildProfile(state) } : profile;

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

  const { user, stats, studying, completed, queue, projects } = view;
  const nothingShared = !studying.length && !queue.length && !projects.length && !completed.length;

  return <div className="personal-root">
    <div className="profile-hero">
      <span className="avatar profile-avatar" aria-hidden="true">{String(user.name || '?').slice(0, 1).toUpperCase()}</span>
      <div className="profile-identity">
        <span className="eyebrow">{isSelf ? 'Seu perfil como os amigos veem' : 'Perfil de amigo'}</span>
        <h1 className="display">{user.name}</h1>
        <p className="muted-text">
          {isSelf
            ? 'Este é o recorte que outras pessoas da sua lista enxergam. Ajuste em Configurações › O que amigos veem.'
            : 'O que esta pessoa escolheu compartilhar com amigos.'}
        </p>
      </div>
      <div className="profile-actions">
        <Button secondary onClick={() => go('amigos')}>Amigos<Icon name="users"/></Button>
        {isSelf && <Button onClick={() => go('configuracoes')}>Ajustar o que aparece<Icon name="settings"/></Button>}
      </div>
    </div>

    {(stats.level !== null || stats.doneLessons !== null) && <div className="profile-stats">
      {stats.level !== null && <div className="profile-stat"><span className="eyebrow">Nível</span><strong>{stats.level}</strong><small>{stats.xp} XP declarados</small></div>}
      {stats.doneLessons !== null && <div className="profile-stat"><span className="eyebrow">Aulas concluídas</span><strong>{stats.doneLessons}</strong><small>de {stats.lessons} na biblioteca</small></div>}
      {stats.completedCourses !== null && <div className="profile-stat"><span className="eyebrow">Materiais completos</span><strong>{stats.completedCourses}</strong><small>{stats.activeCourses} na biblioteca</small></div>}
    </div>}

    {nothingShared && <section className="card-surface settings-panel">
      <p className="muted-text">Esta pessoa ainda não compartilhou nada do estudo com amigos.</p>
    </section>}

    <div className="profile-grid">
      <Section icon="book" title="Estudando agora" note="Da biblioteca compartilhada." empty="Nada em andamento compartilhado.">
        {studying.length > 0 && <ul className="profile-list">
          {studying.map((item) => <li key={item.id}>
            <span className="profile-item-copy">
              <strong>{item.title}</strong>
              <small>{item.type} · {STATUS_LABEL[item.status] || item.status}</small>
            </span>
            <ProgressLine progress={item.progress}/>
          </li>)}
        </ul>}
      </Section>

      <Section icon="flag" title="Na fila" note="O roteiro que a pessoa vê em Hoje." empty="Sem próximos passos compartilhados.">
        {queue.length > 0 && <ol className="profile-queue">
          {queue.map((step, index) => <li key={`${step.course}-${step.lesson}-${index}`}>
            <span className="profile-queue-index">{index + 1}</span>
            <span className="profile-item-copy"><strong>{step.lesson}</strong><small>{step.course} · {step.reason}</small></span>
          </li>)}
        </ol>}
      </Section>

      <Section icon="trophy" title="Projetos públicos" note="Só aparecem os que a própria pessoa marcou." empty="Nenhum projeto marcado como público.">
        {projects.length > 0 && <ul className="profile-list">
          {projects.map((project) => <li key={project.id}>
            <span className="profile-item-copy"><strong>{project.title}</strong><small>{STATUS_LABEL[project.status] || project.status}</small></span>
            <ProgressLine progress={project.progress}/>
          </li>)}
        </ul>}
      </Section>

      <Section icon="check" title="Concluídos" note="Materiais que chegaram ao fim." empty="Nada concluído por enquanto.">
        {completed.length > 0 && <ul className="profile-list">
          {completed.map((item) => <li key={item.id}>
            <span className="profile-item-copy"><strong>{item.title}</strong><small>{item.type} · concluído</small></span>
            <span className="profile-check"><Icon name="check"/></span>
          </li>)}
        </ul>}
      </Section>
    </div>

    <p className="quiet-note">XP, níveis e progresso são informados pela cópia sincronizada de cada pessoa, não validados pelo servidor. Por isso ainda não alimentam ranking — os placares continuam planejados.</p>
  </div>;
}
