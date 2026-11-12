import { useRef } from 'react';
import Icon from '../../ui/Icon.jsx';
import { Button } from '../../ui/ui.jsx';

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
    ['flag', 'Sequência que zera', 'Um dia difícil apaga semanas de esforço e a culpa atrapalha a volta.'],
    ['bell', 'Avisos que pressionam', 'Notificações insistentes no fim do dia, sem relação com o que você planejou.'],
    ['list', 'Atraso em vermelho', 'Aulas acumuladas viram uma pilha que paralisa em vez de orientar.'],
  ],
  lume: [
    ['leaf', 'Pausas sem punição', 'Ficar sem estudar não tira nível, XP nem conquistas. A próxima ação continua esperando.'],
    ['clock', 'Lembretes que você marca', 'Só existem os lembretes dos compromissos que você criou, na antecedência que escolheu.'],
    ['steps', 'Um próximo passo claro', 'A tela Hoje mostra a próxima aula ou página, com o tempo a reservar e o motivo da sugestão.'],
  ],
};

export default function Landing({ go, setAuthMode, signedIn }) {
  const preview = useRef(null);
  function register() {
    if (signedIn) { go('hoje'); return; }
    setAuthMode('register');
    go('login');
  }
  return <div className="landing-root">
    <section className="landing-hero" aria-labelledby="landing-title">
      <span className="soft-badge tone-mint"><Icon name="spark"/>Plataforma social de estudos, sem cobrança punitiva</span>
      <h1 id="landing-title" className="landing-title">Estude com profundidade, <span>sem a culpa</span> de não dar conta de tudo.</h1>
      <p className="lead">O Lume guarda o que você estuda, mostra onde parou e reconhece avanços reais com XP e conquistas, no seu ritmo, com espaço para pausar e amigos por perto se você quiser.</p>
      <div className="landing-actions">
        <Button className="large" onClick={register}>{signedIn ? 'Ir para Hoje' : 'Criar conta gratuita'}<Icon name="arrow"/></Button>
        <Button className="large" secondary onClick={() => preview.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Icon name="play"/>Ver o Lume por dentro</Button>
      </div>
      <p className="landing-trust"><span className="soft-dot tone-mint-text" aria-hidden="true"/>Cadastro com e-mail e senha · prévia sem conta disponível · pausas sem punição</p>
    </section>

    <figure className="landing-preview" ref={preview} aria-label="Exemplo ilustrativo de uma sessão de foco no Lume">
      <div className="landing-preview-bar"><span className="landing-dots" aria-hidden="true"><span/><span/><span/></span><span className="metric-label">Exemplo ilustrativo</span><span className="soft-badge tone-mint"><span className="soft-dot" aria-hidden="true"/>Sessão em foco</span></div>
      <div className="landing-preview-grid">
        <div className="landing-preview-timer">
          <div className="landing-preview-head"><strong><Icon name="leaf"/>Direito Constitucional · Módulo 3</strong><span className="soft-badge">Ciclo clássico</span></div>
          <div className="landing-dial">
            <svg viewBox="0 0 160 160" aria-hidden="true" focusable="false"><defs><linearGradient id="landing-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--mint)"/><stop offset="100%" stopColor="var(--lume)"/></linearGradient></defs><circle cx="80" cy="80" r="70" className="focus-dial-track"/><circle cx="80" cy="80" r="70" className="focus-dial-progress" stroke="url(#landing-gradient)" strokeDasharray="440" strokeDashoffset="110"/></svg>
            <span><strong>22:30</strong><small>restantes no ciclo</small></span>
          </div>
          <p className="landing-sound"><Icon name="rain"/>Chuva suave · volume 40%</p>
        </div>
        <div className="landing-preview-side">
          <div className="landing-plan">
            <div className="landing-preview-head"><strong>Plano do dia</strong><small className="tone-mint-text">2 de 3</small></div>
            <p className="is-done"><Icon name="check"/>Revisar o artigo 5º</p>
            <p className="is-done"><Icon name="check"/>Resolver 15 questões</p>
            <p className="is-now"><Icon name="focus"/>Controle de constitucionalidade</p>
          </div>
          <div className="landing-note"><Icon name="moon"/><span><strong>Sem atraso, só vida</strong><small>Ontem foi dia de descanso. A próxima aula continua no mesmo lugar, sem pilha acumulada.</small></span></div>
        </div>
      </div>
    </figure>

    <section className="landing-section landing-contrast" aria-labelledby="landing-contrast-title">
      <header><span className="metric-label tone-mint-text">O contraste</span><h2 id="landing-contrast-title" className="headline">Estudar não deveria parecer uma corrida contra punições.</h2></header>
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
      <header><span className="metric-label">O que já funciona</span><h2 id="landing-pillars-title" className="headline">Quatro partes pensadas para proteger sua energia.</h2></header>
      <div className="pillar-grid">{PILLARS.map(([icon, title, text, foot, tone]) => <article key={title} className={`card-surface pillar-card tone-${tone}`}>
        <span className="pillar-icon"><Icon name={icon}/></span>
        <h3 className="title">{title}</h3>
        <p className="muted-text">{text}</p>
        <small className="pillar-foot">{foot}</small>
      </article>)}</div>
    </section>

    <section className="landing-section landing-xp" aria-labelledby="landing-xp-title">
      <div className="card-surface landing-xp-card crest-card">
        <span className="pillar-icon tone-reward"><Icon name="trophy"/></span>
        <div>
          <h2 id="landing-xp-title" className="title">XP por avanço real, não por clique</h2>
          <p className="muted-text">Concluir uma aula, terminar a leitura de um PDF, fechar um curso ou entregar um projeto gera XP validado pelo servidor. Abrir o site, cadastrar material ou mandar mensagem não gera. O registro mostra continuidade, não mede inteligência.</p>
        </div>
      </div>
    </section>

    <section className="landing-final card-surface" aria-labelledby="landing-final-title">
      <span className="pillar-icon tone-mint"><Icon name="sprout"/></span>
      <h2 id="landing-final-title" className="headline">Pronto para estudar no seu ritmo?</h2>
      <p className="muted-text">Crie a conta com e-mail e senha, ou explore a prévia antes. Leva poucos minutos.</p>
      <div className="landing-actions">
        <Button className="large" onClick={register}>{signedIn ? 'Ir para Hoje' : 'Criar minha conta'}<Icon name="arrow"/></Button>
        {!signedIn && <Button className="large" ghost onClick={() => go('login')}>Já tenho conta</Button>}
      </div>
    </section>
  </div>;
}
