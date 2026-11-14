import { useRef, useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { Button, Logo } from '../../ui/ui.jsx';

// Apresentação pública do Lume. Só descreve o que existe hoje; o painel de
// exemplo é ilustrativo e diz isso. Sem depoimentos nem números de usuários.
const PILLARS = [
  ['timer', 'Sessão de foco', 'Ciclos de 10 minutos a 1 hora, ou do tamanho que você quiser, com som de fundo opcional gerado no próprio aparelho.', 'Pausar não apaga nada', 'lume'],
  ['book', 'Biblioteca com PDFs', 'Cursos importados por link, materiais próprios e PDFs com leitor embutido que lembra a página onde você parou.', 'Retomada sem procurar', 'mint'],
  ['calendar', 'Plano e Agenda', 'Cronograma montado pelo tempo que você tem em cada dia, compromissos com lembrete e sessões agendadas.', 'Recalculado pelo que você concluiu', 'reward'],
  ['users', 'Amigos e ranking', 'Amigos por convite, mensagens diretas e ranking por nível, cursos concluídos e empenho. Participar é escolha sua.', 'Sem grupos nem feed', 'lume'],
];

const CONTRAST = {
  tired: [
    ['flag', 'Sequência que zera', 'Um dia sem estudo apaga semanas de avanço e atrapalha a volta.'],
    ['bell', 'Avisos que pressionam', 'Notificações insistentes no fim do dia, sem relação com o que você planejou.'],
    ['list', 'Atraso em vermelho', 'Aulas acumuladas viram uma pilha que paralisa em vez de orientar.'],
  ],
  lume: [
    ['pause', 'Pausas sem punição', 'Ficar sem estudar não tira nível, XP nem conquistas. A próxima ação continua esperando.'],
    ['clock', 'Lembretes que você marca', 'Só existem os lembretes dos compromissos que você criou, na antecedência que escolheu.'],
    ['steps', 'Um próximo passo claro', 'A tela Início mostra a próxima aula ou página, com o tempo a reservar e o motivo da sugestão.'],
  ],
};

function formatMMSS(seconds) {
  const safe = Math.max(300, Math.min(3600, seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Landing({ go, setAuthMode, signedIn }) {
  const preview = useRef(null);
  const [sampleSeconds, setSampleSeconds] = useState(25 * 60);
  const [samplePaused, setSamplePaused] = useState(false);

  function register() {
    if (signedIn) { go('hoje'); return; }
    setAuthMode('register');
    go('login');
  }

  function login() {
    if (signedIn) { go('hoje'); return; }
    setAuthMode('login');
    go('login');
  }

  return <div className="stitch-landing">
    <header className="stitch-landing-header">
      <div className="stitch-landing-header-inner">
        <a className="brand" href="#conheca" aria-label="Lume — início">
          <Logo size={24}/>
          <span className="brand-name">Lume</span>
        </a>
        <div className="stitch-landing-nav-actions">
          <button type="button" className="text-button" onClick={login}>
            {signedIn ? 'Voltar ao Lume' : 'Entrar'}
          </button>
          <button type="button" className="stitch-mint-cta" onClick={register}>
            <span>{signedIn ? 'Ir para o Início' : 'Começar grátis'}</span>
          </button>
        </div>
      </div>
    </header>

    <div className="landing-root stitch-landing-main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <span className="soft-badge">para faculdade, provas e concursos</span>
        <h1 id="landing-title" className="landing-title">Provas, trabalhos e entregas. <span>Em dia, uma disciplina por vez.</span></h1>
        <p className="lead">O Lume mostra de onde você parou, quanto falta pra fechar cada módulo e o que vence nos próximos dias. Sessão de foco, biblioteca com PDFs, agenda e amigos no mesmo lugar.</p>
        <div className="landing-actions">
          <button type="button" className="stitch-mint-cta large" onClick={register}>
            <span>{signedIn ? 'Ir para o Início' : 'Começar grátis'}</span>
            <Icon name="arrow"/>
          </button>
          <Button className="large" secondary onClick={() => preview.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <Icon name="play"/>Ver o Lume por dentro
          </Button>
        </div>
        <p className="landing-trust">
          <span className="soft-dot tone-mint-text" aria-hidden="true"/>
          Cadastro grátis com e-mail e senha · prévia sem conta · pausar não tira XP
        </p>
      </section>

      <figure className="landing-preview" ref={preview} aria-label="Exemplo ilustrativo de uma sessão de foco no Lume">
        <div className="landing-preview-bar">
          <span className="landing-dots" aria-hidden="true"><span/><span/><span/></span>
          <span className="metric-label">Exemplo ilustrativo · Sessão de foco</span>
          <span className="soft-badge tone-mint"><span className="soft-dot" aria-hidden="true"/>{samplePaused ? 'Em pausa' : 'Em foco'}</span>
        </div>
        <div className="landing-preview-grid">
          <div className="landing-preview-timer">
            <div className="landing-preview-head">
              <strong><Icon name="book"/>Direito Constitucional · Módulo 3</strong>
              <span className="soft-badge">ciclo de 25 min</span>
            </div>
            <div className="landing-dial">
              <svg viewBox="0 0 160 160" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="landing-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--mint)"/>
                    <stop offset="100%" stopColor="var(--lume)"/>
                  </linearGradient>
                </defs>
                <circle cx="80" cy="80" r="70" className="focus-dial-track"/>
                <circle cx="80" cy="80" r="70" className="focus-dial-progress" stroke="url(#landing-gradient)" strokeDasharray="440" strokeDashoffset={Math.round(440 * (1 - sampleSeconds / 3600))}/>
              </svg>
              <span>
                <strong>{formatMMSS(sampleSeconds)}</strong>
                <small>{samplePaused ? 'Pausado' : 'Aula 14 de 22'}</small>
              </span>
            </div>
            <div className="landing-preview-controls" role="group" aria-label="Controles ilustrativos do ciclo">
              <button type="button" className="landing-circle-btn" aria-label="Diminuir 5 minutos no exemplo" onClick={() => setSampleSeconds(s => Math.max(300, s - 300))}>
                <Icon name="replay5"/>
              </button>
              <button type="button" className="landing-pause-btn" onClick={() => setSamplePaused(p => !p)}>
                <Icon name={samplePaused ? 'play' : 'pause'}/>
                <span>{samplePaused ? 'Retomar no exemplo' : 'Pausar no exemplo'}</span>
              </button>
              <button type="button" className="landing-circle-btn" aria-label="Adicionar 10 minutos no exemplo" onClick={() => setSampleSeconds(s => Math.min(3600, s + 600))}>
                <Icon name="forward10"/>
              </button>
            </div>
            <div className="landing-sound-row">
              <p className="landing-sound"><Icon name="rain"/>Som de chuva · volume 40% · gerado no navegador</p>
              <span className={`landing-eq ${samplePaused ? 'is-paused' : ''}`} aria-hidden="true">
                <span/><span/><span/>
              </span>
            </div>
          </div>
          <div className="landing-preview-side">
            <div className="landing-plan">
              <div className="landing-preview-head">
                <strong>Plano do dia</strong>
                <small className="tone-mint-text">2 de 3 concluídos</small>
              </div>
              <p className="is-done"><Icon name="check"/>Revisar o artigo 5º da CF</p>
              <p className="is-done"><Icon name="check"/>Resolver 15 questões</p>
              <p className="is-now"><Icon name="focus"/>Controle de constitucionalidade</p>
            </div>
            <div className="landing-note">
              <Icon name="moon"/>
              <span>
                <strong>Ontem ficou apagado</strong>
                <small>Dia sem estudo não tira XP nem nível. A próxima aula continua no mesmo lugar.</small>
              </span>
            </div>
          </div>
        </div>
      </figure>

      <section className="landing-section landing-contrast" aria-labelledby="landing-contrast-title">
        <header>
          <span className="metric-label">a diferença</span>
          <h2 id="landing-contrast-title" className="headline">Incentivo pra continuar, não punição por parar.</h2>
          <p className="muted-text">O Lume conta o que você avançou. O que ficou para depois continua no lugar.</p>
        </header>
        <div className="contrast-grid">
          <div className="card-surface contrast-card">
            <h3 className="title"><span className="contrast-mark is-tired" aria-hidden="true"><Icon name="close"/></span>O ciclo que cansa</h3>
            <ul>{CONTRAST.tired.map(([icon, title, text]) => <li key={title}><Icon name={icon}/><span><strong>{title}</strong><small>{text}</small></span></li>)}</ul>
          </div>
          <div className="card-surface contrast-card is-lume">
            <h3 className="title"><span className="contrast-mark" aria-hidden="true"><Icon name="check"/></span>O jeito do Lume</h3>
            <ul>{CONTRAST.lume.map(([icon, title, text]) => <li key={title}><Icon name={icon}/><span><strong>{title}</strong><small>{text}</small></span></li>)}</ul>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="landing-pillars-title">
        <header>
          <span className="metric-label">o que já funciona</span>
          <h2 id="landing-pillars-title" className="headline">Quatro partes para ficar em dia.</h2>
        </header>
        <div className="pillar-grid">{PILLARS.map(([icon, title, text, foot, tone]) => <article key={title} className={`card-surface pillar-card tone-${tone}`}>
          <span className="pillar-icon"><Icon name={icon}/></span>
          <h3 className="title">{title}</h3>
          <p className="muted-text">{text}</p>
          <small className="pillar-foot">{foot}</small>
        </article>)}</div>
      </section>

      <section className="landing-section landing-xp" aria-labelledby="landing-xp-title">
        <div className="card-surface landing-xp-card">
          <span className="pillar-icon tone-reward"><Icon name="trophy"/></span>
          <div>
            <h2 id="landing-xp-title" className="title">XP por avanço real, não por clique</h2>
            <p className="muted-text">Concluir uma aula, terminar a leitura de um PDF, fechar um curso ou entregar um projeto gera XP validado pelo servidor. Abrir o site, cadastrar material ou mandar mensagem não gera. O registro mostra continuidade, não mede inteligência.</p>
          </div>
        </div>
      </section>

      <section className="landing-final card-surface" aria-labelledby="landing-final-title">
        <span className="pillar-icon tone-mint"><Icon name="spark"/></span>
        <h2 id="landing-final-title" className="headline">Comece pela disciplina que vence primeiro.</h2>
        <p className="muted-text">Crie a conta com e-mail e senha, ou explore a prévia antes. Seu progresso fica guardado na conta.</p>
        <div className="landing-actions">
          <button type="button" className="stitch-mint-cta large" onClick={register}>
            <span>{signedIn ? 'Ir para o Início' : 'Criar minha conta gratuita'}</span>
            <Icon name="arrow"/>
          </button>
          {!signedIn && <Button className="large" ghost onClick={login}>Já tenho conta</Button>}
        </div>
      </section>
    </div>

    <footer className="stitch-landing-footer">
      <div className="stitch-landing-footer-inner">
        <div className="stitch-landing-footer-top">
          <div className="stitch-landing-footer-brand">
            <div className="stitch-footer-logo-row">
              <Logo size={22}/>
              <strong>Lume</strong>
            </div>
            <p>Plataforma social de estudos: disciplinas, provas e entregas em dia, com amigos e ranking opcionais.</p>
          </div>
          <div className="stitch-landing-footer-cols">
            <div>
              <strong>Plataforma</strong>
              <a href="#conheca" onClick={e => { e.preventDefault(); preview.current?.scrollIntoView({ behavior: 'smooth' }); }}>Sessão de foco</a>
              <a href="#login" onClick={e => { e.preventDefault(); register(); }}>Criar conta</a>
              <a href="#login" onClick={e => { e.preventDefault(); login(); }}>Entrar</a>
            </div>
            <div>
              <strong>Recursos</strong>
              <a href="#biblioteca" onClick={e => { if (!signedIn) { e.preventDefault(); login(); } }}>Biblioteca e PDFs</a>
              <a href="#plano" onClick={e => { if (!signedIn) { e.preventDefault(); login(); } }}>Plano e Agenda</a>
              <a href="#amigos" onClick={e => { if (!signedIn) { e.preventDefault(); login(); } }}>Amigos e ranking</a>
            </div>
            <div>
              <strong>Acesso</strong>
              <a href="#recuperar">Recuperar acesso</a>
              <a href="#aplicativo">Aplicativo desktop</a>
            </div>
          </div>
        </div>
        <div className="stitch-landing-footer-bottom">
          <span>Lume · Cadastro com e-mail e senha · Prévia temporária disponível</span>
          
        </div>
      </div>
    </footer>
  </div>;
}
