import { useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { Button, Heading, Skeleton } from '../../ui/ui.jsx';
import { api, apiError } from '../../lib/api.js';
import { copyText } from '../../lib/clipboard.js';
import { invalidateResources, useResource } from '../../lib/resources.js';
import { SocialAvatar } from './SocialFeed.jsx';

// Adicionar amigos: busca pelo @usuário exato, solicitações recebidas e enviadas
// e convite por link (para quem ainda não tem conta). A amizade só começa quando
// a outra pessoa aceita; nada disso concede XP nem expõe biblioteca ou progresso.

const TABS = [['add', 'Adicionar'], ['received', 'Recebidas'], ['sent', 'Enviadas']];

function PersonRow({ person, children }) {
  return <li className="addfriend-person">
    <SocialAvatar person={person}/>
    <span className="addfriend-person-name"><strong>{person.name}</strong>{person.handle && <small className="mono">@{person.handle}</small>}</span>
    <span className="addfriend-person-actions">{children}</span>
  </li>;
}

export default function AddFriends({ account, notify, go }) {
  const requests = useResource('/api/friends/requests', { enabled: Boolean(account), interval: 30000 });
  const data = requests.data;
  const [tab, setTab] = useState('add');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(null);

  async function run(action) {
    setBusy(true); setError('');
    try { return await action(); } catch (exception) { setError(exception.message); return null; } finally { setBusy(false); }
  }

  async function refresh() {
    await requests.refresh();
    invalidateResources('/api/friends');
    invalidateResources('/api/social/');
  }

  async function search(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setFound(null);
    await run(async () => {
      const result = await api(`/api/friends/search?handle=${encodeURIComponent(query.trim())}`);
      if (!result.ok) throw new Error(apiError(result));
      setFound(result.data);
    });
  }

  async function sendRequest() {
    await run(async () => {
      const result = await api('/api/friends/requests', { method: 'POST', body: { handle: found.user.handle } });
      if (!result.ok) throw new Error(apiError(result));
      setFound({ ...found, status: result.data.status, requestId: result.data.requestId });
      notify(result.data.status === 'friends' ? `Você e ${found.user.name} agora são amigos.` : `Solicitação enviada para ${found.user.name}.`);
      await refresh();
    });
  }

  async function respond(request, action) {
    await run(async () => {
      const result = await api(`/api/friends/requests/${encodeURIComponent(request.id)}/respond`, { method: 'POST', body: { action } });
      if (!result.ok) throw new Error(apiError(result));
      notify(action === 'accept' ? `Agora você e ${request.user.name} são amigos.` : `Solicitação de ${request.user.name} recusada.`);
      await refresh();
    });
  }

  async function cancel(request) {
    await run(async () => {
      const result = await api(`/api/friends/requests/${encodeURIComponent(request.id)}`, { method: 'DELETE' });
      if (!result.ok) throw new Error(apiError(result));
      notify(`Solicitação para ${request.user.name} cancelada.`);
      if (found?.requestId === request.id) setFound({ ...found, status: 'none', requestId: undefined });
      await refresh();
    });
  }

  async function inviteLink() {
    if (invite) return `${location.origin}/#amigos?convite=${invite.code}`;
    return run(async () => {
      const result = await api('/api/friends/invite', { method: 'POST', body: {} });
      if (!result.ok) throw new Error(apiError(result));
      setInvite(result.data);
      return `${location.origin}/#amigos?convite=${result.data.code}`;
    });
  }

  async function copyInvite() {
    const link = await inviteLink();
    if (!link) return;
    notify(await copyText(link) ? 'Link do convite copiado. Vale por 7 dias.' : `Não foi possível copiar automaticamente. Link: ${link}`);
  }

  async function shareInvite() {
    const link = await inviteLink();
    if (!link) return;
    if (navigator.share) {
      try { await navigator.share({ title: 'Convite para o Lume', text: `${account.name} convidou você para ser amigo no Lume.`, url: link }); return; } catch (exception) { if (exception?.name === 'AbortError') return; }
    }
    notify(await copyText(link) ? 'Compartilhar não está disponível aqui: o link foi copiado.' : `Link do convite: ${link}`);
  }

  if (!account) {
    return <div className="social-root">
      <Heading eyebrow="amigos, mensagens e ranking" title="Adicione seus amigos">Encontre quem já está aqui ou convide alguém para o Lume.</Heading>
      <section className="card-surface social-feed-empty">
        <span className="social-empty-icon"><Icon name="lock"/></span><h2 className="title">Entre para adicionar amigos.</h2>
        <p>Com uma conta você acha pessoas pelo @usuário e convida quem ainda não usa o Lume.</p>
        <Button onClick={() => go('login')}>Entrar<Icon name="arrow"/></Button>
      </section>
    </div>;
  }

  const received = data?.received || [];
  const sent = data?.sent || [];
  const counts = { add: 0, received: received.length, sent: sent.length };

  const searchCard = <section className="card-surface addfriend-card" aria-labelledby="addfriend-search-title">
    <h2 id="addfriend-search-title" className="title">Encontre pelo @usuário</h2>
    <p className="quiet-note">Busque quem já tem uma conta no Lume.{data?.handle && <> Seu @usuário é <strong className="mono">@{data.handle}</strong>.</>}</p>
    <form className="addfriend-search" onSubmit={search} role="search">
      <label className="addfriend-search-field"><span className="sr-only">@usuário</span><Icon name="search"/>
        <input value={query} onChange={event => { setQuery(event.target.value); setFound(null); setError(''); }} placeholder="@usuario" maxLength={26} autoComplete="off" autoCapitalize="none" spellCheck="false" disabled={busy}/>
      </label>
      <Button type="submit" secondary disabled={busy || !query.trim()}>Buscar</Button>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {found && <ul className="addfriend-list" aria-live="polite">
      <PersonRow person={found.user}>
        {found.status === 'none' && <Button onClick={sendRequest} disabled={busy}>Enviar solicitação</Button>}
        {found.status === 'sent' && <Button secondary disabled>Solicitação enviada</Button>}
        {found.status === 'friends' && <Button secondary onClick={() => go(`perfil?id=${encodeURIComponent(found.user.id)}`)}>Já são amigos</Button>}
        {found.status === 'received' && <Button onClick={() => respond({ id: found.requestId, user: found.user }, 'accept')} disabled={busy}>Aceitar</Button>}
        {found.status === 'self' && <span className="quiet-note">Esse é você.</span>}
        {found.publicProfile && found.status !== 'friends' && found.status !== 'self' && <Button secondary onClick={() => go(`perfil?id=${encodeURIComponent(found.user.id)}`)}>Ver perfil</Button>}
      </PersonRow>
    </ul>}
    {found?.status === 'none' && <p className="addfriend-note"><Icon name="lock"/>A amizade começa quando a outra pessoa aceita.</p>}
  </section>;

  const receivedList = !data && !requests.error ? <Skeleton label="Carregando solicitações…" rows={2}/>
    : received.length === 0 ? <p className="social-sidebar-empty">Nenhuma solicitação recebida por enquanto.</p>
      : <ul className="addfriend-list">{received.map(request => <PersonRow key={request.id} person={request.user}>
        <Button secondary onClick={() => respond(request, 'decline')} disabled={busy}>Recusar</Button>
        <Button onClick={() => respond(request, 'accept')} disabled={busy}>Aceitar</Button>
      </PersonRow>)}</ul>;

  const sentList = !data && !requests.error ? <Skeleton label="Carregando solicitações…" rows={2}/>
    : sent.length === 0 ? <p className="social-sidebar-empty">Você não tem solicitações aguardando resposta.</p>
      : <ul className="addfriend-list">{sent.map(request => <PersonRow key={request.id} person={request.user}>
        <span className="soft-badge">Aguardando</span>
        <Button secondary onClick={() => cancel(request)} disabled={busy}>Cancelar</Button>
      </PersonRow>)}</ul>;

  return <div className="social-root">
    <Heading eyebrow="amigos, mensagens e ranking" title="Adicione seus amigos">Encontre quem já está aqui ou convide alguém para o Lume.</Heading>
    <div className="addfriend-tabs" role="tablist" aria-label="Solicitações de amizade">
      {TABS.map(([id, label]) => <button key={id} type="button" role="tab" id={`addfriend-tab-${id}`} aria-selected={tab === id} aria-controls="addfriend-panel" className="filter-btn" onClick={() => setTab(id)}>
        <span>{label}{counts[id] > 0 && <span className="nav-badge addfriend-badge" aria-label={`${counts[id]} pendentes`}>{counts[id]}</span>}</span>
      </button>)}
    </div>
    {requests.error && <div className="form-error form-error-block" role="alert">{requests.error}<Button secondary onClick={() => requests.refresh()}>Tentar novamente</Button></div>}
    <div className="addfriend-layout">
      <div className="addfriend-main" id="addfriend-panel" role="tabpanel" aria-labelledby={`addfriend-tab-${tab}`}>
        {tab === 'add' && <>
          {searchCard}
          {received.length > 0 && <section className="card-surface addfriend-card"><h2 className="title">Solicitações recebidas</h2>{receivedList}</section>}
        </>}
        {tab === 'received' && <section className="card-surface addfriend-card"><h2 className="title">Solicitações recebidas</h2>{receivedList}</section>}
        {tab === 'sent' && <section className="card-surface addfriend-card"><h2 className="title">Solicitações enviadas</h2>{sentList}</section>}
      </div>

      <aside className="card-surface addfriend-card addfriend-invite" aria-labelledby="addfriend-invite-title">
        <span className="addfriend-invite-icon" aria-hidden="true"><Icon name="external"/></span>
        <h2 id="addfriend-invite-title" className="title">Convide alguém para o Lume</h2>
        <p className="quiet-note">Envie um link para quem ainda não tem conta.</p>
        <Button onClick={shareInvite} disabled={busy}><Icon name="upload"/>Compartilhar link</Button>
        <Button secondary onClick={copyInvite} disabled={busy}>Copiar link</Button>
        <p className="quiet-note">O convite continua com a pessoa durante o cadastro.</p>
      </aside>
    </div>
  </div>;
}
