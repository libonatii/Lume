import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api, apiError } from '../../lib/api.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Empty, Heading, Progress, stagger } from '../../ui/ui.jsx';
import { useResource } from '../../lib/resources.js';

const TABS = [
  { id: 'level', label: 'Nível', hint: 'Maior nível e, depois, maior XP elegível acumulado.' },
  { id: 'courses', label: 'Cursos concluídos', hint: 'Cursos distintos com todas as unidades obrigatórias concluídas.' },
  { id: 'effort', label: 'Empenho', hint: 'XP elegível no período, com minutos e conclusões como contexto.' },
];

function dateLabel(day) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(new Date(`${day}T12:00:00Z`));
}

function periodText(period) {
  if (!period?.startDay) return '';
  const end = new Date(`${period.endDay}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  const endDay = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
  return `${period.kind === 'month' ? 'Mês' : 'Semana'} de ${dateLabel(period.startDay)} a ${dateLabel(endDay)} · fuso ${period.timeZone}`;
}

function metric(entry, tab) {
  if (tab === 'courses') return `${entry.coursesCompleted} ${entry.coursesCompleted === 1 ? 'curso concluído' : 'cursos concluídos'} · Nível ${entry.level}`;
  if (tab === 'effort') {
    const context = [entry.minutes ? `${entry.minutes} min` : null, entry.lessons ? `${entry.lessons} aulas` : null, entry.readings ? `${entry.readings} leituras` : null, entry.deliveries ? `${entry.deliveries} entregas` : null].filter(Boolean).join(' · ');
    return `${entry.periodXP} XP no período${context ? ` · ${context}` : ''}`;
  }
  return `Nível ${entry.level} · ${entry.totalXP} XP elegível`;
}

function proportion(entry, entries, tab) {
  const values = entries.map((item) => tab === 'courses' ? item.coursesCompleted : tab === 'effort' ? item.periodXP : item.totalXP);
  return Math.max(...values, 1);
}

export default function Ranking({ account, xp, refreshXP, notify, go }) {
  const [tab, setTab] = useState('level');
  const [period, setPeriod] = useState('week');
  const timeZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();
  const resource = useResource(`/api/ranking?tab=${tab}&period=${period}&timeZone=${encodeURIComponent(timeZone)}`, { enabled: Boolean(account) });
  const data = resource.data;
  const [actionError, setError] = useState('');
  const error = actionError || resource.error;
  const [busy, setBusy] = useState(false);
  const loading = resource.loading;

  const load = useCallback(async () => {
    if (!account) return;
    setError('');
    const result = await resource.refresh();
    if (!result.ok) setError(apiError(result));
  }, [account, resource.refresh]);

  useEffect(() => { load(); }, [load]);

  async function join(optIn) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/xp/settings', { method: 'PATCH', body: { rankingOptIn: optIn } });
      if (!result.ok) throw new Error(apiError(result));
      notify(optIn ? 'Você entrou no ranking de amigos. Só suas amizades veem.' : 'Você saiu do ranking. Seu XP e suas conquistas continuam guardados.');
      await refreshXP?.();
      await load();
    } catch (exception) {
      setError(exception.message);
    } finally {
      setBusy(false);
    }
  }

  if (!account) return <div className="personal-root">
    <Heading eyebrow="Comparação opcional entre amigos" title="Ranking">O ranking precisa de uma conta e de amizades. Na prévia, você pode explorar o resto do Lume.</Heading>
    <Empty title="Entre para participar.">O convite por link é o caminho para formar sua lista de amigos.</Empty>
    <Button onClick={() => go('login')}><Icon name="lock"/>Entrar na minha conta</Button>
  </div>;

  const entries = data?.entries || [];
  const self = data?.self;
  const max = proportion(self || { totalXP: 0, coursesCompleted: 0, periodXP: 0 }, entries, tab);

  return <div className="personal-root ranking-root">
    <Heading eyebrow="Comparação opcional · só entre amigos" title="Ranking">
      Nível, cursos concluídos e empenho no período. O ranking usa apenas XP confirmado pelo servidor; saldo legado, tarefas de prova e presença não entram.
    </Heading>

    <section className={`card-surface ranking-optin ${self?.optedIn ? 'is-in' : ''}`} aria-labelledby="ranking-optin-title">
      <div className="ranking-optin-copy">
        <span className="pace-icon"><Icon name="podium"/></span>
        <div>
          <h2 id="ranking-optin-title" className="title">{self?.optedIn ? 'Você está no ranking de amigos.' : 'Você ainda não aparece no ranking.'}</h2>
          <p className="muted-text">{self?.optedIn
            ? 'Só quem está na sua lista de amigos vê esta classificação. Sair não apaga XP, nível nem conquistas.'
            : 'A participação é opcional e reversível. Sem entrar, seu XP continua privado e você pode estudar normalmente.'}</p>
        </div>
      </div>
      <Button secondary onClick={() => join(!self?.optedIn)} disabled={busy || loading}>
        <Icon name={self?.optedIn ? 'lock' : 'users'}/>{busy ? 'Atualizando…' : self?.optedIn ? 'Sair do ranking' : 'Participar do ranking'}
      </Button>
    </section>

    <div className="ranking-toolbar">
      <div className="filter-tabs" role="tablist" aria-label="Classificação do ranking">
        {TABS.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} className="filter-btn" onClick={() => setTab(item.id)}>
          {tab === item.id && <motion.span className="selection-highlight" layoutId="ranking-tab" transition={{ duration: .26, ease: [.22, 1, .36, 1] }}/>}
          <span>{item.label}</span>
        </button>)}
      </div>
      {tab === 'effort' && <label className="field ranking-period">Período
        <select value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="week">Semana atual</option>
          <option value="month">Mês atual</option>
        </select>
      </label>}
    </div>

    <p className="quiet-note">{TABS.find((item) => item.id === tab)?.hint} {periodText(data?.period)}</p>
    {error && <p className="form-error" role="alert">{error}</p>}

    {loading && !data && <p className="muted-text">Carregando o ranking…</p>}
    {!loading && data && entries.length === 0 && <Empty title="Ninguém participando ainda.">Convide amigos e combine de entrar no ranking. Quem não entrar não aparece, e isso não muda o XP de ninguém.</Empty>}

    {entries.length > 0 && <ol className="ranking-list" aria-label={`Ranking por ${TABS.find((item) => item.id === tab)?.label}`}>
      {entries.map((entry, index) => <motion.li key={entry.id} className={`ranking-row ${entry.isSelf ? 'is-self' : ''}`} {...stagger(index)}>
        <span className={`ranking-position ${entry.position <= 3 ? `top-${entry.position}` : ''}`} aria-label={`Posição ${entry.position}`}>{entry.position}º</span>
        <span className="ranking-avatar" aria-hidden="true">{String(entry.name || '?').slice(0, 1).toUpperCase()}</span>
        <span className="ranking-copy">
          <strong>{entry.name}{entry.isSelf ? ' · você' : ''}</strong>
          <small>{metric(entry, tab)}</small>
          <Progress value={tab === 'courses' ? entry.coursesCompleted : tab === 'effort' ? entry.periodXP : entry.totalXP} max={max} tone={entry.isSelf ? 'lume' : 'mint'} label={`Desempenho de ${entry.name}`}/>
        </span>
        <span className="ranking-metric">{tab === 'courses' ? entry.coursesCompleted : tab === 'effort' ? entry.periodXP : entry.totalXP}</span>
      </motion.li>)}
    </ol>}

    <section className="card-surface ranking-rules" aria-labelledby="ranking-rules-title">
      <h2 id="ranking-rules-title" className="title">Como as posições funcionam</h2>
      <ul className="ranking-rule-list">
        <li><strong>Nível:</strong> maior nível; empate vai para quem tem mais XP elegível acumulado.</li>
        <li><strong>Cursos:</strong> quantidade de cursos distintos com todas as unidades obrigatórias concluídas; repetir o mesmo curso não conta duas vezes.</li>
        <li><strong>Empenho:</strong> XP elegível obtido no período. Minutos, aulas, leituras e entregas aparecem como contexto, não como um índice opaco.</li>
        <li>Empates nos critérios compartilham a posição. Não há desempate por cliques, mensagens ou presença.</li>
        <li>O saldo legado do protótipo (preparações, etapas antigas e tarefas de prova) fica fora de todas as classificações.</li>
      </ul>
    </section>
  </div>;
}
