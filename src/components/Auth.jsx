import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Icon from './Icon.jsx';
import { Button, enter } from './ui.jsx';
import { api, apiError } from '../lib/api.js';

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
  return <div data-stitch="" className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
    <motion.section {...enter} className="lg:col-span-5 flex flex-col justify-between p-8 rounded-xl bg-surface-container-low shadow-xl relative overflow-hidden" aria-labelledby="welcome-title">
      <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">APRENDIZADO COM PROPÓSITO</span>
      <div className="my-8"><h1 id="welcome-title" className="font-headline-lg text-headline-lg text-on-surface tracking-tight leading-snug mb-3">Descubra o prazer de aprender e ir cada vez mais longe.</h1><p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">Aprender não precisa ser uma obrigação pesada. O Lume existe para despertar sua curiosidade, transformar esforço em satisfação e impulsionar suas conquistas.</p><div className="mt-6 p-4 rounded-lg bg-surface-container flex items-start gap-3"><Icon name="leaf"/><div><strong>Entusiasmo &amp; Conquistas Reais</strong><p className="font-body-sm text-body-sm text-on-surface-variant">Cada avanço tem uma história. Construa a sua.</p></div></div></div>
      <div className="rounded-lg overflow-hidden"><motion.img whileHover={{ scale: 1.035 }} transition={{ duration: .48 }} className="w-full object-cover" src="/assets/stitch/welcome.png" alt="Jardim tranquilo com pedras e vegetação suave"/></div><p className="font-body-sm text-body-sm text-outline mt-6">Feito com cuidado por e para mentes curiosas e neurodivergentes.</p>
    </motion.section>
    <section className="lg:col-span-7 flex flex-col justify-center p-8 sm:p-10 rounded-xl bg-surface-container shadow-xl" aria-labelledby="login-title">
      <div className="flex items-center justify-between gap-3 mb-4"><span className="text-secondary font-label-sm text-label-sm">{registering ? 'UM NOVO COMEÇO' : 'ENERGIA FOCADA'}</span><span className="text-outline font-label-sm text-label-sm">{model.accountStatus === 'checking' ? 'Verificando sessão…' : model.accountStatus === 'offline' ? 'Servidor indisponível' : 'Sessão protegida'}</span></div>
      <div className="auth-tabs" role="group" aria-label="Entrar ou criar conta">{[['login', 'Entrar'], ['register', 'Criar conta']].map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => { setMode(id); setError(''); }}>{mode === id && <motion.span layoutId="auth-selection" className="selection-highlight"/>}<span>{label}</span></button>)}</div>
      <AnimatePresence mode="wait" initial={false}><motion.div key={mode} {...enter}><div className="mb-6"><h2 id="login-title" className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{registering ? 'Vamos criar seu espaço.' : 'Bem-vindo de volta ao Lume.'}</h2><p className="font-body-md text-body-md text-on-surface-variant mt-1">{registering ? 'Seu nome, um e-mail e uma senha.' : 'Seu próximo aprendizado está esperando por você.'}</p></div>
      <form id="auth-form" className="auth-form space-y-4" onSubmit={submit} aria-busy={busy}>
        {registering && <label className="auth-field">Seu nome<input name="name" autoComplete="name" required minLength={2} maxLength={60} placeholder="Como você quer ser chamada"/></label>}
        <label className="auth-field">E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="nome@exemplo.com"/></label>
        <div className="flex items-center justify-between"><label htmlFor="auth-password">Senha</label>{!registering && <a className="text-link" href="#recuperar">Esqueci minha senha</a>}</div><div className="password-field"><input id="auth-password" name="password" type={visible ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={8} maxLength={200} placeholder={registering ? 'Pelo menos 8 caracteres' : 'Sua senha'}/><button type="button" className="text-button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ocultar' : 'Mostrar'}</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" className="full-width" disabled={busy || model.accountStatus === 'checking'}>{busy ? 'Um instante…' : registering ? 'Criar minha conta' : 'Entrar e ir além'}<Icon name="arrow"/></Button>
      </form></motion.div></AnimatePresence>
      <div className="mt-8 pt-6"><p className="font-body-sm text-body-sm text-on-surface-variant">Prefere olhar primeiro? <button className="text-button" onClick={() => { model.enterPreview(); go('inicio'); }}>Explorar a prévia<Icon name="arrow"/></button></p></div>
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
  return <section className="panel recovery-panel"><h1>{reset ? result ? 'Acesso validado.' : 'Uma nova senha.' : 'Vamos recuperar seu acesso.'}</h1>{result ? <><p>{reset ? 'Sua senha foi atualizada. Você já pode entrar.' : 'Se existir uma conta para esse e-mail, o pedido de recuperação foi registrado. O envio por e-mail ainda não está disponível.'}</p>{!reset && result.resetUrl && <a className="text-link" href={result.resetUrl}>Link de recuperação de teste</a>}<Button onClick={() => go('login')}>Voltar à entrada<Icon name="arrow"/></Button></> : <form onSubmit={submit} aria-busy={busy}>{reset ? <><label className="auth-field">Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={200} required/></label><label className="auth-field">Repita a senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={200} required/></label></> : <label className="auth-field">E-mail<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>}{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" disabled={busy}>{busy ? 'Um instante…' : reset ? 'Salvar nova senha' : 'Solicitar recuperação'}</Button><a className="text-link" href="#login">Voltar à entrada</a></form>}</section>;
}
