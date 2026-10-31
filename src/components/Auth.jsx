import { useState } from 'react';
import { motion } from 'motion/react';
import Icon from './Icon.jsx';
import { Button, Glow, enter, stagger } from './ui.jsx';
import { api, apiError } from '../lib/api.js';

const promises = [
  ['book', 'Uma biblioteca que lembra onde você parou', 'Cursos, leituras, exercícios e projetos com ponto de retomada.'],
  ['trophy', 'Conquistas por estudo real', 'Reconhecimento por concluir, não por clicar.'],
  ['users', 'Amigos, ranking e mensagens', 'Amigos e ranking de amigos já funcionam; mensagens diretas são o próximo passo.'],
];

export function Login({ model, mode, setMode, go, notify }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const registering = mode === 'register';
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const result = await api(registering ? '/api/register' : '/api/login', { method: 'POST', body: { name: data.get('name'), email: data.get('email'), password: data.get('password') } });
      if (!result.ok) throw new Error(apiError(result));
      await model.loadAccountProgress(result.data.user);
      model.setAccountStatus('ready');
      setMode('login');
      go('hoje');
      notify(`Que bom ter você aqui, ${result.data.user.name.split(' ')[0]}.`);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-layout">
    <section className="auth-hero" aria-labelledby="welcome-title">
      <Glow palette="lume"/>
      <div className="auth-hero-content">
        <span className="eyebrow on-glow">Plataforma social de estudos</span>
        <h1 id="welcome-title" className="display hero-title">Descubra o prazer de aprender e ir <em>cada vez mais longe.</em></h1>
        <p className="lead">O Lume guarda o que você estuda, mostra onde parou e transforma avanços reais em conquistas — no seu ritmo, com espaço para pausar.</p>
        <ul className="promise-list">{promises.map(([icon, title, text], index) => <motion.li key={title} {...stagger(index + 2)}><span className="promise-icon"><Icon name={icon}/></span><span><strong>{title}</strong><small>{text}</small></span></motion.li>)}</ul>
      </div>
      <motion.figure className="sample-achievement" initial={{ opacity: 0, y: 12, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: -1 }} transition={{ duration: .32, ease: [.22, 1, .36, 1] }} aria-label="Exemplo ilustrativo de conquista">
        <span className="sample-badge"><Icon name="trophy"/></span>
        <figcaption><small>Exemplo de conquista</small><strong>Terminei de ler o artigo Introdução a Processo Penal</strong></figcaption>
      </motion.figure>
      <p className="auth-hero-note">Feito com cuidado por e para mentes curiosas e neurodivergentes.</p>
    </section>
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-card-top"><span className="eyebrow">{registering ? 'Um novo começo' : 'Que bom te ver'}</span><span className={`session-state state-${model.accountStatus}`}><span className="dot"/>{model.accountStatus === 'checking' ? 'Verificando sessão…' : model.accountStatus === 'offline' ? 'Servidor indisponível' : 'Sessão protegida'}</span></div>
      <div className="segmented" role="group" aria-label="Entrar ou criar conta">{[['login', 'Entrar'], ['register', 'Criar conta']].map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => { setMode(id); setError(''); }}>{mode === id && <motion.span layoutId="auth-selection" className="segmented-highlight" transition={{ duration: .3, ease: [.22, 1, .36, 1] }}/>}<span>{label}</span></button>)}</div>
      <motion.div key={mode} {...enter}>
        <div className="auth-title"><h2 id="login-title" className="headline">{registering ? 'Vamos criar seu espaço.' : 'Bem-vindo de volta ao Lume.'}</h2><p>{registering ? 'Seu nome, um e-mail e uma senha.' : 'Seu próximo aprendizado está esperando por você.'}</p></div>
        <form id="auth-form" className="form-stack" onSubmit={submit} aria-busy={busy}>
          {registering && <label className="field">Seu nome<input name="name" autoComplete="name" required minLength={2} maxLength={60} placeholder="Como você quer ser chamada"/></label>}
          <label className="field">E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="nome@exemplo.com"/></label>
          <div className="field"><span className="field-row"><label htmlFor="auth-password">Senha</label>{!registering && <a className="text-link" href="#recuperar">Esqueci minha senha</a>}</span><span className="password-field"><input id="auth-password" name="password" type={visible ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={8} maxLength={registering ? 72 : 200} placeholder={registering ? 'Pelo menos 8 caracteres' : 'Sua senha'}/><button type="button" className="text-button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ocultar' : 'Mostrar'}</button></span></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" className="full-width large" disabled={busy || model.accountStatus === 'checking'}>{busy ? 'Um instante…' : registering ? 'Criar minha conta' : 'Entrar e ir além'}<Icon name="arrow"/></Button>
        </form>
      </motion.div>
      <div className="auth-preview"><span className="divider-label">ou</span><p>Prefere olhar primeiro? <button className="text-button accent" onClick={() => { model.enterPreview(); go('inicio'); }}>Explorar a prévia<Icon name="arrow"/></button></p><small>A prévia guarda o progresso só neste navegador.</small></div>
    </section>
  </div>;
}

export function Recovery({ reset = false, notify, go }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    if (reset && data.get('password') !== data.get('confirm')) { setError('As duas senhas precisam ser iguais.'); return; }
    setBusy(true); setError('');
    try {
      const token = new URLSearchParams(location.hash.split('?')[1]).get('token') || '';
      const response = await api(reset ? '/api/password/reset' : '/api/password/request', { method: 'POST', body: reset ? { token, password: data.get('password') } : { email: data.get('email') } });
      if (!response.ok) throw new Error(apiError(response));
      setResult(response.data);
      if (reset) { history.replaceState(null, '', '#redefinir'); notify('Acesso validado. Entre com a nova senha.'); }
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section className="recovery-card">
    <span className={`dialog-emblem ${result ? 'tone-mint' : ''}`}><Icon name={result ? 'shield' : reset ? 'lock' : 'mail'}/></span>
    <h1 className="headline">{reset ? result ? 'Acesso validado.' : 'Uma nova senha.' : 'Vamos recuperar seu acesso.'}</h1>
    {result ? <>
      <p className="muted-text">{reset ? 'Sua senha foi atualizada. Você já pode entrar.' : 'Se existir uma conta para esse e-mail, o pedido de recuperação foi registrado. O envio por e-mail ainda não está disponível.'}</p>
      {!reset && result.resetUrl && <a className="text-link" href={result.resetUrl}>Link de recuperação de teste</a>}
      <Button className="full-width" onClick={() => go('login')}>Voltar à entrada<Icon name="arrow"/></Button>
    </> : <form className="form-stack" onSubmit={submit} aria-busy={busy}>
      <p className="muted-text">{reset ? 'Escolha uma senha com pelo menos 8 caracteres.' : 'Informe o e-mail da sua conta. O link de recuperação vale por 30 minutos.'}</p>
      {reset ? <><label className="field">Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required/></label><label className="field">Repita a senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required/></label></> : <label className="field">E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="nome@exemplo.com"/></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" className="full-width" disabled={busy}>{busy ? 'Um instante…' : reset ? 'Salvar nova senha' : 'Solicitar recuperação'}</Button>
      <a className="text-link centered" href="#login">Voltar à entrada</a>
    </form>}
  </section>;
}
