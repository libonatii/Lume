import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { api, apiError } from '../../lib/api.js';
import { invalidateResources, mutateResource, useResource } from '../../lib/resources.js';
import { materialType } from '../../../public/domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Empty, Heading, Skeleton } from '../../ui/ui.jsx';

function timeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function referenceLabel(reference) {
  const types = { course: 'Curso', lesson: 'Aula', article: 'Leitura', book: 'Livro', exercise: 'Exercícios', project: 'Projeto', slide: 'Slides' };
  return `${types[reference.type] || 'Material'} · ${reference.title}`;
}

export default function Messages({ account, state, notify, go, contactId = '' }) {
  const [selected, setSelected] = useState(contactId || '');
  const [text, setText] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notificationsOverride, setNotificationsOverride] = useState(null);
  const threadEnd = useRef(null);

  // Lista, conversa aberta e preferências vêm do cache compartilhado; a lista e
  // a conversa se atualizam a cada 45 s enquanto a tela está aberta.
  const conversationsResource = useResource('/api/messages', { interval: 45000, enabled: Boolean(account) });
  const threadPath = selected ? `/api/messages/${encodeURIComponent(selected)}` : '';
  const threadResource = useResource(threadPath, { interval: 45000, enabled: Boolean(account && selected) });
  const settingsResource = useResource('/api/messages/settings', { enabled: Boolean(account) });
  const conversations = conversationsResource.data?.conversations || [];
  const thread = selected && threadResource.data ? threadResource.data : null;
  const loading = Boolean(selected) && threadResource.loading && !threadResource.data;
  const notifications = notificationsOverride ?? settingsResource.data?.notifications !== false;
  const loadError = conversationsResource.error || (selected ? threadResource.error : '');

  useEffect(() => {
    if (contactId && contactId !== selected) setSelected(contactId);
  }, [contactId, selected]);
  // Abrir (ou receber novas mensagens na) conversa marca como lida e atualiza
  // o contador do menu, que usa o mesmo cache.
  const lastMessageId = thread?.messages?.at(-1)?.id || '';
  useEffect(() => {
    if (!account || !selected || !threadResource.data) return;
    let alive = true;
    api(`/api/messages/${encodeURIComponent(selected)}/read`, { method: 'POST' }).then((read) => {
      if (!alive || !read.ok) return;
      mutateResource('/api/messages', (previous) => previous ? { ...previous, conversations: (previous.conversations || []).map((item) => item.id === selected ? { ...item, unread: 0 } : item) } : previous);
      invalidateResources('/api/messages/unread');
    });
    return () => { alive = false; };
  }, [account, selected, lastMessageId, Boolean(threadResource.data)]);
  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [thread?.messages?.length, selected]);

  async function send(event) {
    event.preventDefault();
    if (!selected || busy) return;
    const body = text.trim();
    const course = state.courses.find((item) => item.id === referenceId);
    const reference = course ? { type: course.type || 'course', id: course.id, title: course.title } : null;
    if (!body && !reference) return;
    setBusy(true);
    setError('');
    try {
      const result = await api(`/api/messages/${encodeURIComponent(selected)}`, {
        method: 'POST',
        body: { body, reference },
      });
      if (!result.ok) throw new Error(apiError(result));
      threadResource.mutate((previous) => previous ? { ...previous, messages: [...previous.messages, result.data.message] } : previous);
      setText('');
      setReferenceId('');
      await conversationsResource.refresh();
    } catch (exception) {
      setError(exception.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!selected || !thread) return;
    const blocked = thread.blockedByMe;
    if (!blocked && !window.confirm('Bloquear esta pessoa? Novas mensagens serão interrompidas nos dois sentidos; o histórico continua guardado.')) return;
    setBusy(true);
    try {
      const result = await api(`/api/blocks/${encodeURIComponent(selected)}`, { method: blocked ? 'DELETE' : 'POST' });
      if (!result.ok) throw new Error(apiError(result));
      notify(blocked ? 'Contato desbloqueado. A conversa pode continuar.' : 'Contato bloqueado. O histórico foi preservado.');
      await Promise.all([threadResource.refresh(), conversationsResource.refresh()]);
    } catch (exception) {
      setError(exception.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotifications() {
    const next = !notifications;
    setNotificationsOverride(next);
    const result = await api('/api/messages/settings', { method: 'PATCH', body: { notifications: next } });
    if (!result.ok) {
      setNotificationsOverride(!next);
      notify(apiError(result));
      return;
    }
    settingsResource.mutate({ notifications: next });
    setNotificationsOverride(null);
    invalidateResources('/api/messages/unread');
    notify(next ? 'Notificações de mensagens ativadas.' : 'Notificações de mensagens silenciadas. As mensagens continuam guardadas.');
  }

  if (!account) return <div className="personal-root">
    <Heading eyebrow="Conversas entre amizades" title="Mensagens">Mensagens diretas exigem uma conta e uma amizade aceita. Na prévia, você pode explorar o resto do Lume.</Heading>
    <Empty icon="mail" title="Entre para conversar.">O convite por link é o caminho para formar sua lista de amigos.</Empty>
    <Button onClick={() => go('login')}><Icon name="lock"/>Entrar na minha conta</Button>
  </div>;

  function selectConversation(id) {
    setSelected(id);
    try { history.replaceState(null, '', `#mensagens?com=${encodeURIComponent(id)}`); } catch { /* Hash indisponível. */ }
  }
  return <div className="messages-root">
    <Heading eyebrow="Conversas entre amizades · sem grupos" title="Mensagens" actions={<button className="chip-button" onClick={toggleNotifications} aria-pressed={notifications}><Icon name={notifications ? 'mail' : 'lock'}/>{notifications ? 'Notificações ativas' : 'Silenciadas'}</button>}>
      Conversas individuais com quem está na sua lista de amigos. Compartilhar um material não concede acesso ao conteúdo privado, e mensagens não geram XP.
    </Heading>

    {(error || loadError) && <p className="form-error" role="alert">{error || loadError}</p>}
    <div className="messages-layout">
      <aside className="card-surface messages-list" aria-label="Conversas">
        <div className="messages-list-head">
          <strong className="title">Conversas</strong>
          <span className="muted-text">{conversations.length} {conversations.length === 1 ? 'amizade' : 'amizades'}</span>
        </div>
        {!conversationsResource.data && !conversationsResource.error && <Skeleton label="Carregando as conversas…" rows={3}/>}
        {conversationsResource.data && conversations.length === 0 && <p className="inline-note"><Icon name="users"/><span>Nenhuma amizade ainda. <a href="#amigos" className="text-link">Convide alguém</a> para começar.</span></p>}
        <ul className="conversation-list">
          {conversations.map((conversation) => <li key={conversation.id}>
            <button className={`conversation-item ${selected === conversation.id ? 'active' : ''}`} onClick={() => selectConversation(conversation.id)} aria-current={selected === conversation.id ? 'true' : undefined}>
              <span className="conversation-avatar" aria-hidden="true">{conversation.name.slice(0, 1).toUpperCase()}</span>
              <span className="conversation-copy">
                <strong>{conversation.name}</strong>
                <small>{conversation.blockedByMe ? 'Você bloqueou esta pessoa' : conversation.blockedMe ? 'Mensagens bloqueadas por ela' : conversation.lastMessage ? `${conversation.lastMessage.fromMe ? 'Você: ' : ''}${conversation.lastMessage.preview}` : 'Comece uma conversa'}</small>
              </span>
              <span className="conversation-meta">
                {conversation.lastMessage && <time dateTime={conversation.lastMessage.at}>{timeLabel(conversation.lastMessage.at)}</time>}
                {conversation.unread > 0 && <span className="unread-badge" aria-label={`${conversation.unread} não lidas`}>{conversation.unread > 99 ? '99+' : conversation.unread}</span>}
              </span>
            </button>
          </li>)}
        </ul>
      </aside>

      <section className="card-surface message-thread" aria-label="Conversa selecionada">
        {!selected && <div className="messages-placeholder"><Icon name="mail"/><h2 className="title">Escolha uma conversa.</h2><p className="muted-text">Só amizades aceitas podem trocar mensagens. Não há conversas em grupo, canais ou mensagens de desconhecidos.</p></div>}
        {selected && loading && <Skeleton label="Carregando a conversa…" rows={3} variant="text"/>}
        {selected && thread && <>
          <header className="message-thread-head">
            <div>
              <span className="eyebrow">Conversa individual</span>
              <h2 className="title">{thread.friend.name}</h2>
              <p className="quiet-note">{thread.blockedByMe ? 'Você bloqueou esta pessoa.' : thread.blockedMe ? 'Esta pessoa bloqueou novas mensagens.' : 'Amizade aceita · mensagens não geram XP.'}</p>
            </div>
            <Button secondary onClick={toggleBlock} disabled={busy}><Icon name="lock"/>{thread.blockedByMe ? 'Desbloquear' : 'Bloquear'}</Button>
          </header>
          <div className="message-list" role="log" aria-live="polite" aria-label={`Mensagens com ${thread.friend.name}`}>
            {thread.messages.length === 0 && <p className="messages-placeholder-copy">Nenhuma mensagem ainda. Diga olá ou compartilhe um material.</p>}
            {thread.messages.map((message) => <motion.div key={message.id} className={`message-bubble ${message.fromMe ? 'from-me' : 'from-them'}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}>
              <p>{message.body}</p>
              {message.reference && <span className="message-reference"><Icon name="book"/>{referenceLabel(message.reference)}</span>}
              <small>{message.fromMe ? 'Você' : thread.friend.name} · {timeLabel(message.at)}{message.fromMe && message.readAt ? ' · lida' : ''}</small>
            </motion.div>)}
            <div ref={threadEnd}/>
          </div>
          {!thread.canMessage
            ? <p className="inline-note"><Icon name="lock"/><span>{thread.blockedByMe ? 'Desbloqueie para voltar a enviar mensagens.' : 'A outra pessoa precisa desbloquear para a conversa continuar.'}</span></p>
            : <form className="message-composer" onSubmit={send}>
              <label className="field">Mensagem
                <textarea value={text} maxLength={4000} rows={2} onChange={(event) => setText(event.target.value)} placeholder={`Escreva para ${thread.friend.name}…`} aria-label="Mensagem"/>
              </label>
              <div className="message-composer-row">
                <label className="field message-reference-field">Compartilhar material (opcional)
                  <select value={referenceId} onChange={(event) => setReferenceId(event.target.value)}>
                    <option value="">Nenhum</option>
                    {state.courses.map((course) => <option key={course.id} value={course.id}>{materialType(course.type).title} · {course.title}</option>)}
                  </select>
                </label>
                <Button type="submit" disabled={busy || (!text.trim() && !referenceId)}><Icon name="arrow"/>{busy ? 'Enviando…' : 'Enviar'}</Button>
              </div>
              <p className="quiet-note">Enter não envia: use o botão. O material compartilhado mostra só tipo, título e identificador; o conteúdo privado não é copiado.</p>
            </form>}
        </>}
      </section>
    </div>
  </div>;
}
