import { useEffect, useMemo, useState } from 'react';
import { LUME_NEWS, NEWS_AREAS } from '../../../public/notifications-domain.js';
import Icon from '../../ui/Icon.jsx';
import { Heading } from '../../ui/ui.jsx';

const AREA_ICON = { site: 'home', desktop: 'layers', extensao: 'external' };
const month = (at) => new Date(at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const day = (at) => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

// Histórico de novidades do Lume: texto completo, onde mudou (site, aplicativo
// de desktop ou extensão) e atalho para a tela afetada. Lê a mesma lista do sino.
export default function News({ go, focusId = '' }) {
  const [area, setArea] = useState('todas');
  const items = useMemo(() => LUME_NEWS.filter((item) => area === 'todas' || item.area === area), [area]);
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const key = month(item.at);
      map.set(key, [...(map.get(key) || []), item]);
    }
    return [...map];
  }, [items]);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`novidade-${focusId}`)?.scrollIntoView({ block: 'center' });
  }, [focusId]);

  return <div className="news-root">
    <Heading eyebrow="novidades" title="O que mudou no Lume">
      Melhorias no site, no aplicativo de desktop e na extensão, da mais recente para a mais antiga.
    </Heading>
    <div className="news-filters" role="group" aria-label="Filtrar por onde mudou">
      {[['todas', 'Tudo'], ...Object.entries(NEWS_AREAS)].map(([id, label]) => <button key={id} type="button" className={`filter-btn ${area === id ? 'active' : ''}`} aria-pressed={area === id} onClick={() => setArea(id)}>{label}</button>)}
    </div>
    {!groups.length && <p className="muted-text">Nenhuma novidade nesta categoria ainda.</p>}
    {groups.map(([label, list]) => <section key={label} className="news-month" aria-label={label}>
      <h2 className="metric-label">{label}</h2>
      <ul className="news-list">
        {list.map((item) => <li key={item.id} id={`novidade-${item.id}`} className={`news-item ${item.id === focusId ? 'is-focus' : ''}`}>
          <span className="news-icon" aria-hidden="true"><Icon name={AREA_ICON[item.area] || 'spark'}/></span>
          <div className="news-copy">
            <div className="news-meta"><span className="soft-badge">{NEWS_AREAS[item.area]}</span><time className="mono" dateTime={item.at}>{day(item.at)}</time></div>
            <h3 className="title">{item.title}</h3>
            {item.body && <p className="muted-text">{item.body}</p>}
            {item.details?.length > 0 && <ul className="news-details">{item.details.map((line) => <li key={line}>{line}</li>)}</ul>}
            {item.href && <button type="button" className="text-button news-go" onClick={() => go(item.href.replace(/^#/, ''))}>Abrir <Icon name="arrow"/></button>}
          </div>
        </li>)}
      </ul>
    </section>)}
  </div>;
}
