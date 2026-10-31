import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { api, apiError } from '../lib/api.js';
import { materialType } from '../../public/domain.js';
import Icon from './Icon.jsx';
import { Button, Empty, Heading } from './ui.jsx';

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
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(contactId || '');
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const threadEnd = useRef(null);

  const loadConversations = useCallback(async () => {
    if (!account) return;
    const result = await api('/api/messages');
    if (result.ok) setConversations(result.data.conversations || []);
    else setError(apiError(result));
  }, [account]);

  const loadThread = useCallback(async (friendId) => {
    if (!account || !friendId) { setThread(null); return; }
    setLoading(true);
    setError('');
    const result = await api(`/api/messages/${encodeURIComponent(friendId)}`);
    if (!result.ok) {
      setError(apiError(result));
      setThread(null);
      setLoading(false);
      return;
    }
    setThread(result.data);
    setLoading(false);
    const read = await api(`/api/messages/${encodeURIComponent(friendId)}/read`, { method: 'POST' });
    if (read.ok) {
      setConversations((previous) => previous.map((item) => item.id === friendId ? { ...item, unread: 0 } : item));
    }
  }, [account]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (contactId && contactId !== selected) setSelected(contactId);
  }, [contactId, selected]);
  useEffect(() => { if (selected) loadThread(selected); }, [selected, loadThread]);
  useEffect(() => {
    if (!account) return undefined;
    let alive = true;
    (async () => {
      const result = await api('/api/messages/settings');
      if (alive && result.ok) setNotifications(result.data.notifications !== false);
    })();
    return () => { alive = false; };
  }, [account]);
  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [thread?.messages?.length, selected]);
  useEffect(() => {
    if (!account) return undefined;
    const timer = setInterval(() => {
      loadConversations();
      if (selected) loadThread(selected);
    }, 45000);
    return () => clearInterval(timer);
  }, [account, selected, loadConversations, loadThread]);

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
      setThread((previous) => previous ? { ...previous, messages: [...previous.messages, result.data.message] } : previous);
      setText('');
      setReferenceId('');
      await loadConversations();
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
      await loadThread(selected);
      await loadConversations();
    } catch (exception) {
      setError(exception.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotifications() {
    const next = !notifications;
    setNotifications(next);
    const result = await api('/api/messages/settings', { method: 'PATCH', body: { notifications: next } });
    if (!result.ok) {
      setNotifications(!next);
      notify(apiError(result));
      return;
    }
    notify(next ? 'Notificações de mensagens ativadas.' : 'Notificações de mensagens silenciadas. As mensagens continuam guardadas.');
  }

  if (!account) return <div className="personal-root">
    <Heading eyebrow="Conversas entre amizades" title="Mensagens">Mensagens diretas exigem uma conta e uma amizade aceita. Na prévia, você pode explorar o resto do Lume.</Heading>
    <Empty title="Entre para conversar.">O convite por link é o caminho para formar sua lista de amigos.</Empty>
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

    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="messages-layout">
      <aside className="card-surface messages-list" aria-label="Conversas">
        <div className="messages-list-head">
          <strong className="title">Conversas</strong>
          <span className="muted-text">{conversations.length} {conversations.length === 1 ? 'amizade' : 'amizades'}</span>
        </div>
        {conversations.length === 0 && <p className="inline-note"><Icon name="users"/><span>Nenhuma amizade ainda. <a href="#amigos" className="text-link">Convide alguém</a> para começar.</span></p>}
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
        {selected && loading && <p className="muted-text">Carregando a conversa…</p>}
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
