import { useEffect, useRef, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { Button, PersonAvatar, Skeleton } from '../../ui/ui.jsx';
import { api, apiError } from '../../lib/api.js';
import { invalidateResources, useResource } from '../../lib/resources.js';
import { SOCIAL_POST_LIMIT, SOCIAL_COMMENT_LIMIT, SOCIAL_IMAGE_BYTES, SOCIAL_PDF_BYTES, socialText } from '../../../public/social-domain.js';
import { formatBytes } from '../../../public/pdf-domain.js';

const LABELS = { post: ['message', 'Entre amigos'], question: ['help', 'Dúvida rápida'], material: ['file', 'Material compartilhado'], image: ['image', 'Foto / Print'], achievement: ['trophy', 'Conquista'] };

export function SocialAvatar({ person, size = '' }) {
  return <PersonAvatar person={person} className={`social-avatar ${size}`}/>;
}

function PostTime({ at }) {
  const date = new Date(at);
  return <time dateTime={at} title={date.toLocaleString('pt-BR')}><Icon name="clock"/>{date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>;
}

function Composer({ account, avatar, xp, onPosted }) {
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('post');
  const [file, setFile] = useState(null);
  const [pickAchievement, setPickAchievement] = useState(false);
  const [achievementId, setAchievementId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const fileInput = useRef(null);
  const imageInput = useRef(null);
  const achievements = xp?.achievements || [];

  useEffect(() => {
    if (!file?.type.startsWith('image/')) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(event) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    const pdf = picked.type === 'application/pdf';
    if (!pdf && !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(picked.type)) { setError('Escolha um PDF, PNG, JPG, WebP ou GIF.'); return; }
    if (picked.size > (pdf ? SOCIAL_PDF_BYTES : SOCIAL_IMAGE_BYTES)) { setError(pdf ? 'O PDF pode ter até 10 MB.' : 'A imagem pode ter até 2 MB.'); return; }
    setFile(picked); setPickAchievement(false); setAchievementId(''); setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.set('id', requestId.current); form.set('body', body); form.set('kind', kind);
      if (achievementId) form.set('achievementId', achievementId);
      if (file) form.set('attachment', file);
      const response = await fetch('/api/social/posts', { method: 'POST', credentials: 'same-origin', body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiError({ data }));
      setBody(''); setFile(null); setAchievementId(''); setPickAchievement(false); setKind('post');
      requestId.current = crypto.randomUUID();
      onPosted();
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  return <section className="card-surface social-composer" aria-label="Criar publicação">
    <form onSubmit={submit}>
      <div className="social-compose-body">
        <SocialAvatar person={{ name: account.name, avatar }}/>
        <label className="field social-compose-field"><span className="sr-only">Sua publicação</span>
          <textarea value={body} onChange={event => setBody(event.target.value)} placeholder="No que você está focando hoje? Conte para seus amigos…" rows={3} maxLength={SOCIAL_POST_LIMIT} disabled={busy}/>
        </label>
      </div>
      {file && <div className="social-draft-attachment">
        {preview ? <img className="social-draft-image" src={preview} alt="Prévia do anexo"/> : <Icon name="file"/>}
        <span><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
        <button type="button" className="icon-button" onClick={() => setFile(null)} disabled={busy} aria-label="Remover anexo"><Icon name="close"/></button>
      </div>}
      {pickAchievement && <label className="field social-achievement-select">Conquista para compartilhar
        <select value={achievementId} disabled={busy} onChange={event => setAchievementId(event.target.value)}>
          <option value="">{achievements.length ? 'Escolha uma conquista' : 'Você ainda não tem conquistas validadas'}</option>
          {achievements.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>}
      <div className="social-compose-footer">
        <div className="social-attach-actions">
          <button type="button" className="chip-button" onClick={() => fileInput.current?.click()} disabled={busy}><Icon name="file"/>Arquivo / Resumo</button>
          <button type="button" className="chip-button" aria-pressed={pickAchievement} onClick={() => { setPickAchievement(value => !value); setFile(null); setAchievementId(''); }} disabled={busy}><Icon name="trophy"/>Conquista</button>
          <button type="button" className="chip-button" onClick={() => imageInput.current?.click()} disabled={busy}><Icon name="image"/>Foto / Print</button>
          <label className="social-kind"><span className="sr-only">Tipo de publicação</span><select value={kind} onChange={event => setKind(event.target.value)} disabled={busy}><option value="post">Publicação</option><option value="question">Dúvida rápida</option></select></label>
        </div>
        <Button type="submit" disabled={busy || (!socialText(body) && !file && !achievementId)}>{busy ? 'Publicando…' : 'Postar'}<Icon name="arrow"/></Button>
      </div>
      <input ref={fileInput} type="file" accept="application/pdf" className="sr-only" aria-label="Anexar PDF à publicação" onChange={choose} disabled={busy}/>
      <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Anexar foto à publicação" onChange={choose} disabled={busy}/>
      <div className="social-compose-hint"><span><Icon name="lock"/>Visível para seus amigos · anexos: PDF até 10 MB ou imagem até 2 MB</span><span>{body.length}/{SOCIAL_POST_LIMIT}</span></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  </section>;
}

function Comments({ post, refresh }) {
  const [cursor, setCursor] = useState('');
  const [older, setOlder] = useState([]);
  const path = `/api/social/posts/${post.id}/comments`;
  const resource = useResource(`${path}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const comments = [...older, ...(resource.data?.comments || [])];

  async function send(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = await api(path, { method: 'POST', body: { id: requestId.current, body } });
      if (!result.ok) throw new Error(apiError(result));
      setBody(''); requestId.current = crypto.randomUUID();
      // Volta à primeira página para evitar esconder comentários novos.
      setCursor(''); setOlder([]);
      invalidateResources(path); refresh();
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  async function remove(comment) {
    setBusy(true); setError('');
    try {
      const result = await api(`${path}/${comment.id}`, { method: 'DELETE' });
      if (!result.ok) throw new Error(apiError(result));
      setOlder(items => items.filter(item => item.id !== comment.id));
      await resource.refresh(); refresh();
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  return <div className="social-comments">
    {resource.loading && !resource.data && <Skeleton rows={1} label="Carregando comentários…"/>}
    {comments.map(comment => <div className="social-comment" key={comment.id}>
      <SocialAvatar person={comment.author} size="small"/>
      <div><div className="social-comment-heading"><strong>{comment.author.name}</strong><PostTime at={comment.at}/></div><p>{comment.body}</p></div>
      {comment.canDelete && <button type="button" className="icon-button" aria-label={`Excluir comentário de ${comment.author.name}`} disabled={busy} onClick={() => remove(comment)}><Icon name="trash"/></button>}
    </div>)}
    {resource.data?.nextCursor && <button type="button" className="text-button" onClick={() => { setOlder(comments); setCursor(resource.data.nextCursor); }}>Mais comentários</button>}
    <form className="social-comment-form" onSubmit={send}>
      <label className="field"><span className="sr-only">Comentar publicação de {post.author.name}</span><textarea rows={2} value={body} maxLength={SOCIAL_COMMENT_LIMIT} placeholder="Deixe um comentário…" disabled={busy} onChange={event => setBody(event.target.value)}/></label>
      <Button secondary type="submit" disabled={busy || !socialText(body)}>{busy ? 'Enviando…' : 'Comentar'}</Button>
    </form>
    {(error || resource.error) && <p className="form-error" role="alert">{error || resource.error}</p>}
  </div>;
}

function PostCard({ post, refresh, go }) {
  const [showComments, setShowComments] = useState(post.comments > 0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [icon, label] = LABELS[post.kind] || LABELS.post;

  async function react() {
    setBusy(true); setError('');
    try {
      const result = await api(`/api/social/posts/${post.id}/reaction`, { method: post.reacted ? 'DELETE' : 'PUT' });
      if (!result.ok) throw new Error(apiError(result));
      await refresh();
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setError('');
    try {
      const result = await api(`/api/social/posts/${post.id}`, { method: 'DELETE' });
      if (!result.ok) throw new Error(apiError(result));
      await refresh();
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  return <article className={`card-surface social-post is-${post.kind}`} aria-label={`Publicação de ${post.author.name}`}>
    <header className="social-post-heading">
      <button type="button" className="social-author" onClick={() => go(post.author.handle ? `perfil?u=${post.author.handle}` : post.canDelete ? 'perfil' : `perfil?id=${encodeURIComponent(post.author.id)}`)} aria-label={`Ver perfil de ${post.author.name}`}>
        <SocialAvatar person={post.author}/><span><strong>{post.author.name}</strong><PostTime at={post.at}/></span>
      </button>
      <span className={`social-post-kind ${post.kind === 'achievement' ? 'is-reward' : ''}`}><Icon name={icon}/>{label}</span>
      {post.canDelete && <button type="button" className="icon-button" onClick={() => setConfirming(value => !value)} aria-label="Excluir publicação" disabled={busy}><Icon name="trash"/></button>}
    </header>
    {post.body && <p className="social-post-body">{post.body}</p>}
    {post.attachment && (post.attachment.type.startsWith('image/')
      ? imageFailed ? <p className="quiet-note">Imagem indisponível.</p> : <a href={post.attachment.url} target="_blank" rel="noreferrer" className="social-post-image"><img src={post.attachment.url} alt={post.attachment.name} loading="lazy" onError={() => setImageFailed(true)}/></a>
      : <div className="social-file"><span className="social-file-icon"><Icon name="file"/></span><span className="social-file-copy"><strong>{post.attachment.name}</strong><small>PDF · {formatBytes(post.attachment.size)}</small></span><div className="social-file-actions"><a className="button secondary" href={post.attachment.url} target="_blank" rel="noreferrer">Abrir</a><a className="button secondary" href={`${post.attachment.url}?download=1`} download><Icon name="download"/>Baixar</a></div></div>)}
    {post.achievement && <div className="social-achievement"><span className="social-achievement-icon"><Icon name="trophy"/></span><div><span className="metric-label">Conquista validada</span><strong>{post.achievement.title}</strong><p>{post.achievement.criterion}</p></div><Icon name="check"/></div>}
    {post.kind === 'achievement' && !post.achievement && <p className="quiet-note">Esta conquista foi corrigida e não está mais disponível.</p>}
    <div className="social-post-actions">
      <button type="button" className={`social-reaction ${post.reacted ? 'is-selected' : ''}`} aria-pressed={post.reacted} onClick={react} disabled={busy}><Icon name={post.kind === 'achievement' ? 'spark' : 'heart'}/>{post.kind === 'achievement' ? 'Parabenizar' : 'Curtir'}<span>{post.reactions}</span></button>
      <button type="button" className="text-button" aria-expanded={showComments} onClick={() => setShowComments(value => !value)}><Icon name="message"/>{post.comments} {post.comments === 1 ? 'comentário' : 'comentários'}</button>
    </div>
    {confirming && <div className="social-delete-confirm"><p>Excluir esta publicação e seus comentários?</p><div className="action-row"><Button className="danger-button" onClick={remove} disabled={busy}>Sim, excluir publicação</Button><Button secondary onClick={() => setConfirming(false)} disabled={busy}>Manter publicação</Button></div></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {showComments && <Comments post={post} refresh={refresh}/>}
  </article>;
}

function FeedPage({ cursor, last, onMore, go }) {
  const resource = useResource(`/api/social/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { interval: 45000 });
  const refresh = async () => { invalidateResources('/api/social/posts/'); return resource.refresh(); };
  return <div className="social-feed-page">
    {resource.loading && !resource.data && <Skeleton rows={3} label="Carregando publicações…"/>}
    {resource.error && <div className="form-error form-error-block" role="alert">{resource.error}<Button secondary onClick={resource.refresh}>Tentar novamente</Button></div>}
    {resource.data?.posts.map(post => <PostCard key={post.id} post={post} refresh={refresh} go={go}/>)}
    {!cursor && resource.data?.posts.length === 0 && !resource.error && <section className="card-surface social-feed-empty"><span className="social-empty-icon"><Icon name="message"/></span><h2 className="title">As próximas conversas começam aqui.</h2><p>Compartilhe uma dúvida, um resumo ou uma conquista. As publicações aparecem só para você e seus amigos.</p></section>}
    {last && resource.data?.nextCursor && <Button secondary className="social-load-more" onClick={() => onMore(resource.data.nextCursor)}>Ver mais publicações<Icon name="chevron-down"/></Button>}
  </div>;
}

export default function SocialFeed({ account, avatar, xp, notify, go }) {
  const [cursors, setCursors] = useState(['']);
  function posted() {
    setCursors(['']); invalidateResources('/api/social/feed');
    notify('Publicação compartilhada com seus amigos.');
  }
  return <div className="social-feed-column">
    <Composer account={account} avatar={avatar} xp={xp} onPosted={posted}/>
    <section className="social-feed" aria-label="Publicações entre amigos">{cursors.map((cursor, index) => <FeedPage key={cursor} cursor={cursor} last={index === cursors.length - 1} onMore={next => setCursors(items => [...items, next])} go={go}/>)}</section>
  </div>;
}
