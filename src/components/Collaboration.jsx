import { useEffect, useState } from 'react';
import { api, apiError } from '../lib/api.js';
import Icon from './Icon.jsx';
import { Button } from './ui.jsx';

const STATUS_LABEL = { pending: 'aguardando', accepted: 'aceito', declined: 'recusado', cancelled: 'cancelado' };

function InviteRow({ invite, children }) {
  return <li className="collab-row">
    <span className="collab-icon"><Icon name="users"/></span>
    <span className="collab-copy">
      <strong>{invite.courseTitle}</strong>
      <small>{invite.stepTitle} · {invite.person} · {STATUS_LABEL[invite.status] || invite.status}</small>
      {invite.note && <span className="quiet-note">{invite.note}</span>}
    </span>
    {children}
  </li>;
}

export function CollaborationPanel({ course, account, notify }) {
  const [friends, setFriends] = useState([]);
  const [invites, setInvites] = useState([]);
  const [friendId, setFriendId] = useState('');
  const [stepId, setStepId] = useState(course.steps[0]?.id || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!account) return;
    const [friendsResult, invitesResult] = await Promise.all([api('/api/friends'), api('/api/collaboration/invites')]);
    if (friendsResult.ok) setFriends(friendsResult.data.friends || []);
    if (invitesResult.ok) setInvites((invitesResult.data.sent || []).filter((invite) => invite.courseId === course.id));
  }
  useEffect(() => { load(); }, [account, course.id]);
  useEffect(() => { setStepId(course.steps[0]?.id || ''); }, [course.id]);

  async function send(event) {
    event.preventDefault();
    if (!friendId || !stepId || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/collaboration/invites', {
        method: 'POST',
        body: { friendId, courseId: course.id, stepId, note },
      });
      if (!result.ok) throw new Error(apiError(result));
      notify('Convite enviado. A outra pessoa decide se quer ajudar; isso não copia o projeto nem concede XP.');
      setNote('');
      await load();
    } catch (exception) {
      setError(exception.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id) {
    const result = await api(`/api/collaboration/invites/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!result.ok) { notify(apiError(result)); return; }
    notify('Convite cancelado.');
    await load();
  }

  if (course.type !== 'project') return null;
  if (!account) return <section className="collab-panel"><p className="inline-note"><Icon name="lock"/><span>Convites de colaboração exigem conta e amizade aceita.</span></p></section>;

  return <section className="collab-panel" aria-labelledby="collab-title">
    <div className="panel-title"><span className="pace-icon"><Icon name="users"/></span><div><h3 id="collab-title" className="title">Colaborar nesta entrega</h3><p className="muted-text">Convide uma amizade para ajudar em uma entrega específica. Aceitar não copia o projeto, não concede acesso ao GitHub e não gera XP.</p></div></div>
    {friends.length === 0
      ? <p className="inline-note"><Icon name="users"/><span>Convide alguém na página Amigos para poder colaborar.</span></p>
      : <form className="form-stack" onSubmit={send}>
        <div className="field-row">
          <label className="field">Amizade
            <select value={friendId} onChange={(event) => setFriendId(event.target.value)} required>
              <option value="">Escolha uma pessoa</option>
              {friends.map((friend) => <option key={friend.id} value={friend.id}>{friend.name}</option>)}
            </select>
          </label>
          <label className="field">Entrega
            <select value={stepId} onChange={(event) => setStepId(event.target.value)} required>
              {course.steps.map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}
            </select>
          </label>
        </div>
        <label className="field">Mensagem (opcional)
          <textarea value={note} maxLength={400} rows={2} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: pode revisar a parte de autenticação comigo?"/>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy || !friendId}><Icon name="mail"/>{busy ? 'Enviando…' : 'Convidar para colaborar'}</Button>
      </form>}
    {invites.length > 0 && <ul className="collab-list">
      {invites.map((invite) => <InviteRow key={invite.id} invite={invite}>
        {invite.status === 'pending' && <button className="text-button" onClick={() => cancel(invite.id)}>Cancelar</button>}
      </InviteRow>)}
    </ul>}
  </section>;
}

export function CollaborationInbox({ account, notify }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  async function load() {
    if (!account) return;
    const result = await api('/api/collaboration/invites');
    if (result.ok) setData(result.data);
    else setError(apiError(result));
  }
  useEffect(() => { load(); }, [account]);
  async function respond(id, accept) {
    const result = await api(`/api/collaboration/invites/${encodeURIComponent(id)}/respond`, { method: 'POST', body: { accept } });
    if (!result.ok) { notify(apiError(result)); return; }
    notify(accept ? 'Você aceitou ajudar. O projeto não foi copiado e nenhum XP foi concedido.' : 'Convite recusado.');
    await load();
  }
  if (!account) return null;
  const pending = (data?.received || []).filter((invite) => invite.status === 'pending');
  if (!data || pending.length === 0) return null;
  return <section className="card-surface settings-panel" aria-labelledby="collab-inbox-title">
    <div className="panel-title"><span className="pace-icon"><Icon name="users"/></span><div><h2 className="title" id="collab-inbox-title">Convites de colaboração</h2><p className="muted-text">Uma amizade pediu ajuda em uma entrega. Aceitar é só um acordo; o material continua na biblioteca de quem convidou.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <ul className="collab-list">
      {pending.map((invite) => <InviteRow key={invite.id} invite={invite}>
        <span className="collab-actions">
          <Button secondary onClick={() => respond(invite.id, true)}><Icon name="check"/>Aceitar</Button>
          <Button ghost onClick={() => respond(invite.id, false)}>Recusar</Button>
        </span>
      </InviteRow>)}
    </ul>
  </section>;
}
