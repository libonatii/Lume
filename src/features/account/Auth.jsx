import { useState } from 'react';
import { motion } from 'motion/react';
import Icon from '../../ui/Icon.jsx';
import { Button, Logo, enter } from '../../ui/ui.jsx';
import { api, apiError } from '../../lib/api.js';

// Força da senha só como orientação visual; a regra de verdade é a do servidor
// (8 a 72 bytes). Não bloqueia o envio.
function passwordStrength(value) {
  const text = String(value || '');
  const checks = [text.length >= 8, text.length >= 12, /[a-zà-ú]/.test(text) && /[A-ZÀ-Ú]/.test(text), /\d/.test(text) && /[^\p{L}\d]/u.test(text)];
  const score = text ? checks.filter(Boolean).length : 0;
  return { score, label: ['Digite uma senha', 'Fraca', 'Razoável', 'Boa', 'Forte'][score] };
}

const trust = [
  ['leaf', 'Pausas sem punição'],
  ['lock', 'Senha guardada só como hash'],
  ['users', 'Amigos e ranking opcionais'],
];

export function Login({ model, mode, setMode, go, notify }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
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
  const strength = passwordStrength(password);
  return <div className="auth-stage">
    <header className="auth-intro">
      <span className="auth-emblem"><Logo size={56}/></span>
      <span className="soft-badge tone-mint"><span className="soft-dot" aria-hidden="true"/>{registering ? 'Um novo espaço de estudos' : 'Seu espaço de estudos'}</span>
      <h1 id="welcome-title" className="display">{registering ? 'Comece sua jornada no Lume' : 'Entre no Lume'}</h1>
      <p className="lead">{registering ? 'Crie seu espaço de aprendizado, sem distrações, no seu próprio ritmo.' : 'Retome seu ritmo, suas sessões de foco e seus materiais exatamente onde parou.'}</p>
    </header>
    <section className="auth-card crest-card" aria-labelledby="login-title">
      <div className="auth-card-top"><div className="segmented" role="group" aria-label="Entrar ou criar conta">{[['login', 'Entrar'], ['register', 'Criar conta']].map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => { setMode(id); setError(''); }}>{mode === id && <motion.span layoutId="auth-selection" className="segmented-highlight" transition={{ duration: .3, ease: [.22, 1, .36, 1] }}/>}<span>{label}</span></button>)}</div><span className={`session-state state-${model.accountStatus}`}><span className="dot"/>{model.accountStatus === 'checking' ? 'Verificando sessão…' : model.accountStatus === 'offline' ? 'Servidor indisponível' : 'Sessão protegida'}</span></div>
      <motion.div key={mode} {...enter}>
        <div className="auth-title"><h2 id="login-title" className="headline">{registering ? 'Vamos criar seu espaço.' : 'Bem-vindo de volta ao Lume.'}</h2><p>{registering ? 'Seu nome, um e-mail e uma senha.' : 'Seu próximo aprendizado está esperando por você.'}</p></div>
        <form id="auth-form" className="form-stack" onSubmit={submit} aria-busy={busy}>
          {registering && <label className="field">Seu nome<span className="input-icon"><Icon name="user"/><input name="name" autoComplete="name" required minLength={2} maxLength={60} placeholder="Como você quer ser chamada"/></span></label>}
          <label className="field">E-mail<span className="input-icon"><Icon name="mail"/><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="nome@exemplo.com"/></span></label>
          <div className="field"><span className="field-row"><label htmlFor="auth-password">Senha</label>{!registering && <a className="text-link" href="#recuperar">Esqueci minha senha</a>}</span><span className="password-field input-icon"><Icon name="lock"/><input id="auth-password" name="password" type={visible ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={8} maxLength={registering ? 72 : 200} placeholder={registering ? 'Pelo menos 8 caracteres' : 'Sua senha'} value={password} onChange={(event) => setPassword(event.target.value)}/><button type="button" className="icon-button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon name={visible ? 'eye-off' : 'eye'}/></button></span>
            {registering && <span className="strength" aria-live="polite"><span className="strength-bars" aria-hidden="true">{[1, 2, 3, 4].map((step) => <span key={step} className={strength.score >= step ? 'is-on' : ''}/>)}</span><small>{strength.label}{strength.score ? ` · ${strength.score}/4 sugestões` : ''}</small></span>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" className="full-width large" disabled={busy || model.accountStatus === 'checking'}>{busy ? 'Um instante…' : registering ? 'Criar minha conta' : 'Entrar e ir além'}<Icon name="arrow"/></Button>
        </form>
      </motion.div>
      <div className="auth-preview"><span className="divider-label">ou</span><p>Prefere olhar primeiro? <button className="text-button accent" onClick={() => { model.enterPreview(); go('inicio'); }}>Explorar a prévia<Icon name="arrow"/></button></p><small>A prévia é temporária: recarregar ou fechar a página descarta as alterações.</small></div>
    </section>
    <ul className="auth-trust">{trust.map(([icon, label]) => <li key={label}><Icon name={icon}/>{label}</li>)}</ul>
    <p className="auth-quote">Feito com cuidado por e para mentes curiosas e neurodivergentes. <a className="text-link" href="#conheca">Conheça o Lume</a></p>
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
  return <section className="recovery-card crest-card">
    <span className={`dialog-emblem ${result ? 'tone-mint' : ''}`}><Icon name={result ? 'shield' : reset ? 'lock' : 'mail'}/></span>
    <h1 className="headline">{reset ? result ? 'Acesso validado.' : 'Uma nova senha.' : 'Vamos recuperar seu acesso.'}</h1>
    {result ? <>
      <p className="muted-text">{reset ? 'Sua senha foi atualizada. Você já pode entrar.' : 'Se existir uma conta para esse e-mail, enviamos um link de recuperação. Ele vale por 30 minutos; confira também a caixa de spam.'}</p>
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
