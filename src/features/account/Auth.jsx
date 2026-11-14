import { useState } from 'react';
import { motion } from 'motion/react';
import Icon from '../../ui/Icon.jsx';
import { Button, Logo, enter } from '../../ui/ui.jsx';
import { api, apiError } from '../../lib/api.js';
import { STUDY_GOALS } from '../../../public/domain.js';

// Força da senha só como orientação visual; a regra de verdade é a do servidor
// (8 a 72 bytes). Não bloqueia o envio.
function passwordStrength(value) {
  const text = String(value || '');
  const checks = [text.length >= 8, text.length >= 12, /[a-zà-ú]/.test(text) && /[A-ZÀ-Ú]/.test(text), /\d/.test(text) && /[^\p{L}\d]/u.test(text)];
  const score = text ? checks.filter(Boolean).length : 0;
  return { score, label: ['Digite uma senha', 'Fraca', 'Razoável', 'Boa', 'Forte e protegida'][score] };
}

// Um objetivo por id de STUDY_GOALS (public/domain.js): outro id some ao recarregar.
const OBJECTIVE_COPY = {
  college: ['book', 'Faculdade & Graduação', 'Aulas, provas e TCC', 'mint'],
  exams: ['gavel', 'Concursos Públicos', 'Editais e rendimento', 'lume'],
  research: ['science', 'Pós & Pesquisa', 'Mestrado e artigos', 'lilac'],
  personal: ['compass', 'Desenvolvimento Pessoal', 'Leituras e idiomas', 'reward'],
};
const OBJECTIVES = STUDY_GOALS.map((id) => [id, ...OBJECTIVE_COPY[id]]);

const TRUST_LOGIN = [
  ['calendar', 'Provas e entregas em dia'],
  ['lock', 'Senha guardada só como hash'],
  ['users', 'Amigos e ranking opcionais'],
];

const TRUST_REGISTER = [
  ['shield', '100% gratuito para começar'],
  ['lock', 'Dados privados e protegidos'],
  ['pause', 'Pausar não tira XP'],
];

export function Login({ model, mode, setMode, go, notify }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [studyGoal, setStudyGoal] = useState('college');
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [termsOpen, setTermsOpen] = useState(false);

  const registering = mode === 'register';

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (registering && !acceptedTerms) {
      setError('Confirme que leu o compromisso de privacidade e uso para criar sua conta.');
      return;
    }
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await api(registering ? '/api/register' : '/api/login', {
        method: 'POST',
        body: { name: data.get('name'), email: data.get('email'), password: data.get('password') },
      });
      if (!result.ok) throw new Error(apiError(result));
      await model.loadAccountProgress(result.data.user);
      if (registering && studyGoal) {
        model.settingsActions?.setPreference?.('studyGoal', studyGoal);
      }
      model.setAccountStatus('ready');
      setMode('login');
      go('hoje');
      notify(`Que bom ter você aqui, ${result.data.user.name.split(' ')[0]}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const strength = passwordStrength(password);
  const trust = registering ? TRUST_REGISTER : TRUST_LOGIN;

  return <div className="stitch-auth-layout">
    <header className="stitch-entry-topbar">
      <div className="stitch-entry-topbar-inner">
        <a className="brand" href="#conheca" aria-label="Lume — início">
          <Logo size={24}/>
          <span className="brand-name">Lume</span>
        </a>
        <div className="stitch-entry-topbar-actions">
          <a className="text-button" href="#conheca">Conheça o Lume</a>
          <button
            type="button"
            className="text-button accent"
            onClick={() => { setMode(registering ? 'login' : 'register'); setError(''); }}
          >
            {registering ? 'Já possui conta? Entrar' : 'Criar conta gratuita'}
          </button>
        </div>
      </div>
    </header>

    <div className="stitch-auth-main">
      <div className={`auth-stage ${registering ? 'is-register' : ''}`}>
        <section className="auth-card crest-card stitch-auth-card" aria-labelledby="welcome-title">
          <div className="stitch-auth-emblem-head">
            <span className="auth-emblem"><Logo size={48}/></span>
            <span className="soft-badge">
              {registering ? 'conta nova · grátis' : 'de volta aos estudos'}
            </span>
            <h1 id="welcome-title" className="headline stitch-auth-heading">
              {registering ? 'Crie sua conta no Lume' : 'Entre no Lume'}
            </h1>
            <p className="muted-text stitch-auth-sub">
              {registering
                ? 'Organize disciplinas, provas e entregas, e veja o quanto já avançou.'
                : 'Retome suas sessões de foco e seus materiais exatamente onde parou.'}
            </p>
          </div>

          <div className="auth-card-top">
            <div className="segmented" role="group" aria-label="Entrar ou criar conta">
              {[['login', 'Entrar'], ['register', 'Criar conta']].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mode === id}
                  onClick={() => { setMode(id); setError(''); }}
                >
                  {mode === id && <motion.span layoutId="auth-selection" className="segmented-highlight" transition={{ duration: .3, ease: [.22, 1, .36, 1] }}/>}
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <span className={`session-state state-${model.accountStatus}`}>
              <span className="dot"/>
              {model.accountStatus === 'checking' ? 'Verificando sessão…' : model.accountStatus === 'offline' ? 'Servidor indisponível' : 'Sessão protegida'}
            </span>
          </div>

          <motion.div key={mode} {...enter}>
            {/* No cadastro o título do cartão já apresenta a tela, como na versão nova do Stitch. */}
            {!registering && <div className="auth-title">
              <h2 id="login-title" className="title">Bem-vindo de volta ao Lume.</h2>
              <p>A próxima aula está onde você parou.</p>
            </div>}

            <form id="auth-form" className="form-stack stitch-auth-form" onSubmit={submit} aria-busy={busy}>
              {registering && <div className="field">
                <label htmlFor="auth-name">Seu nome</label>
                <span className="input-icon">
                  <Icon name="user"/>
                  <input
                    id="auth-name"
                    name="name"
                    autoComplete="name"
                    enterKeyHint="next"
                    required
                    minLength={2}
                    maxLength={60}
                    placeholder="Como você quer ser chamada?"
                  />
                </span>
              </div>}

              <div className="field">
                <label htmlFor="auth-email">E-mail</label>
                <span className="field-hint" id="auth-email-hint">Formato: nome@exemplo.com</span>
                <span className="input-icon">
                  <Icon name="mail"/>
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    spellCheck={false}
                    enterKeyHint="next"
                    aria-describedby="auth-email-hint"
                    required
                    maxLength={254}
                    placeholder="nome@exemplo.com"
                  />
                  <span className="field-inline-error" role="alert">Informe um e-mail válido no formato nome@exemplo.com.</span>
                </span>
              </div>

              <div className="field">
                <span className="field-row">
                  <label htmlFor="auth-password">Senha</label>
                  {registering
                    ? <span className="strength-inline-label" aria-live="polite">{strength.label}</span>
                    : <a className="text-link" href="#recuperar">Esqueci minha senha</a>}
                </span>
                <span className="password-field input-icon">
                  <Icon name="lock"/>
                  <input
                    id="auth-password"
                    name="password"
                    type={visible ? 'text' : 'password'}
                    autoComplete={registering ? 'new-password' : 'current-password'}
                    enterKeyHint="done"
                    required
                    minLength={8}
                    maxLength={registering ? 72 : 200}
                    placeholder={registering ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={visible}
                    onClick={() => setVisible(v => !v)}
                  >
                    <Icon name={visible ? 'eye-off' : 'eye'}/>
                  </button>
                </span>
                {registering && <span className="strength" aria-live="polite">
                  <span className="strength-bars" aria-hidden="true">
                    {[1, 2, 3, 4].map(step => <span key={step} className={strength.score >= step ? 'is-on' : ''}/>)}
                  </span>
                  <small>{strength.label}{strength.score ? ` · ${strength.score}/4 critérios sugeridos` : ' · 8+ caracteres, sem limites rígidos'}</small>
                </span>}
              </div>

              {registering && <div className="auth-objectives">
                <div className="auth-objectives-head">
                  <span>Qual é o seu objetivo de estudo inicial?</span>
                  <small>Personaliza seu espaço</small>
                </div>
                <div className="auth-objectives-grid" role="radiogroup" aria-label="Objetivo inicial de estudo">
                  {OBJECTIVES.map(([id, icon, label, sub, tone]) => {
                    const selected = studyGoal === id;
                    return <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`objective-card tone-${tone} ${selected ? 'is-selected' : ''}`}
                      onClick={() => setStudyGoal(id)}
                    >
                      <span className="objective-icon"><Icon name={icon}/></span>
                      <span className="objective-copy">
                        <strong>{label}</strong>
                        <small>{sub}</small>
                      </span>
                      <span className="objective-check" aria-hidden="true"><Icon name="check"/></span>
                    </button>;
                  })}
                </div>
              </div>}

              {registering && <div className="auth-terms-wrap">
                <label className="auth-check">
                  <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}/>
                  <span>
                    Concordo com o compromisso de{' '}
                    <button type="button" className="text-button inline-link" onClick={() => setTermsOpen(o => !o)}>
                      Privacidade e Uso do Lume
                    </button>.
                  </span>
                </label>
                {termsOpen && <p className="auth-terms-note">
                  Seus materiais, progresso e sessões pertencem à sua conta. Senhas ficam armazenadas apenas como hash seguro e não há anúncios ou venda de dados.
                </p>}
              </div>}

              {error && <p className="form-error" role="alert">{error}</p>}

              <Button type="submit" className="full-width large" disabled={busy || model.accountStatus === 'checking'}>
                {busy ? 'Um instante…' : registering ? 'Criar minha conta' : 'Entrar e ir além'}
                <Icon name="arrow"/>
              </Button>
            </form>
          </motion.div>

          {registering && <p className="auth-switch">Já faz parte do Lume? <button type="button" className="text-button accent" onClick={() => { setMode('login'); setError(''); }}>Entrar na sua conta</button></p>}
          <div className="auth-preview">
            <span className="divider-label">ou</span>
            <p>
              Prefere olhar primeiro?{' '}
              <button type="button" className="text-button accent" onClick={() => { model.enterPreview(); go('inicio'); }}>
                Explorar a prévia<Icon name="arrow"/>
              </button>
            </p>
            <small>A prévia é temporária: recarregar ou fechar a página descarta as alterações.</small>
          </div>
        </section>

        <ul className="auth-trust">{trust.map(([icon, label]) => <li key={label}><Icon name={icon}/>{label}</li>)}</ul>
      </div>
    </div>

    <footer className="stitch-entry-footer">
      <div className="stitch-entry-footer-inner">
        <span>Provas, trabalhos e entregas em dia. Acesso com e-mail e senha.</span>
        <nav aria-label="Links de entrada">
          <a href="#conheca">Conheça o Lume</a>
          <a href="#recuperar">Recuperar acesso</a>
          <a href="#aplicativo">Aplicativo desktop</a>
        </nav>
      </div>
    </footer>
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
      {reset ? <><label className="field">Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required/></label><label className="field">Repita a senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required/></label></> : <label className="field">E-mail<input name="email" type="email" autoComplete="username" spellCheck={false} required maxLength={254} placeholder="nome@exemplo.com"/></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" className="full-width" disabled={busy}>{busy ? 'Um instante…' : reset ? 'Salvar nova senha' : 'Solicitar recuperação'}</Button>
      <a className="text-link centered" href="#login">Voltar à entrada</a>
    </form>}
  </section>;
}
