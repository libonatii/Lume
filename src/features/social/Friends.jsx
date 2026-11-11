import { useCallback, useEffect, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { Button, Heading, Skeleton } from '../../ui/ui.jsx';
import { api, apiError } from '../../lib/api.js';
import { copyText, selectText } from '../../lib/clipboard.js';
import { CollaborationInbox } from '../library/Collaboration.jsx';
import { useResource } from '../../lib/resources.js';

// Amizades por convite. O convite é um código reaproveitável, válido por 7 dias;
// não existe busca por e-mail. Ser amigo não compartilha biblioteca, progresso
// nem XP — isso depende do perfil e das escolhas de quem é dono dos dados.

function initialOf(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase();
}

export default function Friends({ account, notify, go }) {
  const resource = useResource('/api/friends', { enabled: Boolean(account) });
  const data = resource.data;
  const [invite, setInvite] = useState(null);
  const [code, setCode] = useState(() => new URLSearchParams(location.hash.split('?')[1] || '').get('convite') || '');
  const [actionError, setError] = useState('');
  const error = actionError || resource.error;
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!account) return;
    const result = await resource.refresh();
    if (!result.ok) { setError(apiError(result)); return; }
    setError('');
  }, [account, resource.refresh]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  async function createInvite() {
    setBusy(true); setError('');
    try {
      const result = await api('/api/friends/invite', { method: 'POST', body: {} });
      if (!result.ok) throw new Error(apiError(result));
      setInvite(result.data);
      await load();
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
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

  async function accept(event) {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await api('/api/friends/accept', { method: 'POST', body: { code } });
      if (!result.ok) throw new Error(apiError(result));
      notify(result.data.alreadyFriends ? `Você e ${result.data.friend.name} já eram amigos.` : `Agora você e ${result.data.friend.name} são amigos.`);
      setCode('');
      setInvite(null);
      history.replaceState(null, '', '#amigos');
      await load();
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  async function remove(friend) {
    setBusy(true); setError('');
    try {
      const result = await api(`/api/friends/${encodeURIComponent(friend.id)}`, { method: 'DELETE' });
      if (!result.ok) throw new Error(apiError(result));
      notify(`${friend.name} saiu da sua lista.`);
      await load();
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  return <div className="personal-root">
    <Heading eyebrow="Aprender junto, sem expor o que é seu" title="Amigos">
      Convide por link. Cada pessoa escolhe o que os amigos veem no perfil; o e-mail nunca aparece.
    </Heading>

    {!account
      ? <section className="card-surface settings-panel">
        <div className="panel-title"><span className="pace-icon"><Icon name="lock"/></span><div><h2 className="title">Amigos exigem uma conta</h2><p className="muted-text">O convite é vinculado a uma pessoa. Na prévia, você pode explorar o resto do Lume.</p></div></div>
        <Button onClick={() => go('login')}>Entrar para convidar<Icon name="arrow"/></Button>
      </section>
      : <div className="friends-layout">
        <div className="friends-column">
          <section className="card-surface settings-panel">
            <div className="panel-title"><span className="pace-icon"><Icon name="users"/></span><div><h2 className="title">Convidar alguém</h2><p className="muted-text">Você gera um convite e envia como quiser.</p></div></div>
            <p className="muted-text">Não procuramos pessoas por e-mail: assim ninguém descobre quem tem conta no Lume.</p>
            <Button onClick={createInvite} disabled={busy}><Icon name="plus"/>Criar convite</Button>
            {invite && <div className="companion-code" aria-live="polite">
              <span className="eyebrow">Convite por 7 dias</span>
              <code>{invite.code}</code>
              <p className="quiet-note">Vale por 7 dias e pode ser aceito por várias pessoas. Cada uma entra só uma vez.</p>
              <div className="action-row">
                <Button secondary onClick={copyInvite}>Copiar link do convite</Button>
                <button className="text-button" onClick={() => setInvite(null)}>Fechar</button>
              </div>
            </div>}
          </section>

          <section className="card-surface settings-panel">
            <div className="panel-title"><span className="pace-icon"><Icon name="mail"/></span><div><h2 className="title">Tenho um convite</h2><p className="muted-text">Cole o código de 12 caracteres.</p></div></div>
            <form className="form-stack" onSubmit={accept}>
              <label className="field">Código do convite
                <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" maxLength={20} autoComplete="off" spellCheck="false"/>
              </label>
              <Button type="submit" disabled={busy || !code.trim()}><Icon name="check"/>Aceitar convite</Button>
            </form>
          </section>
        </div>

        <div className="friends-column">
          <CollaborationInbox account={account} notify={notify}/>
          <section className="card-surface settings-panel">
            <div className="panel-title"><span className="pace-icon"><Icon name="heart"/></span><div><h2 className="title">Sua lista</h2><p className="muted-text">{data ? `${data.friends.length} ${data.friends.length === 1 ? 'amizade' : 'amizades'}` : 'Carregando…'}</p></div></div>
            {!data && <Skeleton label="Carregando sua lista de amigos…" rows={3}/>}
            {data && data.friends.length === 0 && <p className="inline-note"><Icon name="help"/><span>Ninguém por aqui ainda. Um convite já começa a lista.</span></p>}
            {data && data.friends.length > 0 && <ul className="friend-list">
              {data.friends.map((friend) => <li key={friend.id}>
                <span className="avatar small" aria-hidden="true">{initialOf(friend.name)}</span>
                <span className="friend-copy">
                  <strong>{friend.name}</strong>
                  <small>Amigos desde {new Date(friend.since).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</small>
                </span>
                <button className="text-button" onClick={() => go(`perfil?id=${encodeURIComponent(friend.id)}`)}>Ver perfil</button>
                <button className="text-button accent" onClick={() => go(`mensagens?com=${encodeURIComponent(friend.id)}`)} aria-label={`Conversar com ${friend.name}`}>Mensagem</button>
                <button className="text-button" onClick={() => remove(friend)} disabled={busy} aria-label={`Remover ${friend.name} da lista`}>Remover</button>
              </li>)}
            </ul>}
          </section>

          {data && data.invites.length > 0 && <section className="card-surface settings-panel">
            <div className="panel-title"><span className="pace-icon"><Icon name="clock"/></span><div><h2 className="title">Seus convites</h2><p className="muted-text">Só o mais recente fica ativo.</p></div></div>
            <ul className="invite-history">
              {data.invites.map((item, index) => <li key={`${item.createdAt}-${index}`}>
                <span>{new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                <span className={`invite-status ${item.expired ? 'is-expired' : item.uses > 0 ? 'is-used' : 'is-open'}`}>
                  {item.expired
                    ? 'expirado'
                    : item.uses > 0
                      ? `${item.uses} ${item.uses === 1 ? 'pessoa entrou' : 'pessoas entraram'}`
                      : 'aguardando'}
                </span>
              </li>)}
            </ul>
          </section>}
        </div>
      </div>}

    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="quiet-note">Convites, amizades, mensagens e remoções não geram XP. O perfil mostra só o que cada pessoa autorizou: biblioteca, fila, progresso e XP confirmado pelo servidor. Mensagens diretas entre amizades aceitas e convites de colaboração em entregas já funcionam; o compartilhamento de aprendizados ainda não existe. Grupos, comunidades e canais estão fora do escopo desta etapa. O ranking de amigos é opcional e fica em sua própria página.</p>
  </div>;
}
