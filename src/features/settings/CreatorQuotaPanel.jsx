import { useCallback, useEffect, useState } from 'react';
import { STORAGE_TIERS, formatBytes } from '../../../public/pdf-domain.js';
import { api, apiError } from '../../lib/api.js';

export default function CreatorQuotaPanel({ account, notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [busyUser, setBusyUser] = useState('');

  const load = useCallback(async (search = query, activeFilter = filter) => {
    if (!account?.isCreator) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (activeFilter !== 'all') params.set('filter', activeFilter);
      const result = await api(`/api/admin/storage?${params.toString()}`);
      if (!result.ok) throw new Error(apiError(result));
      setData(result.data);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as contas.');
    } finally {
      setLoading(false);
    }
  }, [account?.isCreator, query, filter]);

  useEffect(() => {
    const timer = setTimeout(() => { load(query, filter); }, 150);
    return () => clearTimeout(timer);
  }, [load, query, filter]);

  async function selectTier(user, tier) {
    if (busyUser || user.isCreator || user.plan === tier.id) return;
    setBusyUser(user.id);
    setError('');
    try {
      const result = await api(`/api/admin/storage/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        body: { plan: tier.id },
      });
      if (!result.ok) throw new Error(apiError(result));
      notify(`Cota de ${user.name} ajustada para ${tier.label}.`);
      await load(query, filter);
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar a cota.');
    } finally {
      setBusyUser('');
    }
  }

  const accounts = data?.accounts || [];
  const counts = data?.counts || { all: 0, near: 0, over: 0 };

  return <div className="cfg-stack">
    <div className="cfg-quota-intro">
      <p className="cfg-sub">Ajuste o limite de armazenamento das contas sem precisar de IDs. Apenas sua conta tem acesso a esta área.</p>
      <span className="soft-badge is-reward mono">Sua cota: 1 GB (Criadora)</span>
    </div>

    <div className="cfg-storage-controls">
      <div className="cfg-filter-row" role="tablist" aria-label="Filtrar contas">
        <button type="button" role="tab" aria-selected={filter === 'all'} className={`filter-btn ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>Todas ({counts.all})</button>
        <button type="button" role="tab" aria-selected={filter === 'near'} className={`filter-btn ${filter === 'near' ? 'is-active' : ''}`} onClick={() => setFilter('near')}>Perto do limite ({counts.near})</button>
        <button type="button" role="tab" aria-selected={filter === 'over'} className={`filter-btn ${filter === 'over' ? 'is-active' : ''}`} onClick={() => setFilter('over')}>Acima do limite ({counts.over})</button>
      </div>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail…" aria-label="Buscar conta por nome ou e-mail"/>
    </div>

    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && !data && <p className="quiet-note">Carregando contas…</p>}

    {data && (accounts.length === 0
      ? <p className="quiet-note">Nenhuma conta encontrada com este filtro.</p>
      : <ul className="cfg-quota-list">
          {accounts.map((item) => <li key={item.id} className="cfg-quota-row">
            <div className="cfg-quota-user">
              <div className="cfg-quota-identity">
                <strong>{item.name}</strong>
                <span>{item.email}</span>
              </div>
              <div className="cfg-quota-usage">
                <span className="mono">{formatBytes(item.used)} / {item.label}</span>
                {item.overLimit && <span className="cfg-quota-flag">Acima do limite</span>}
              </div>
              <div className="cfg-quota-bar">
                <span className={item.isCreator ? 'is-creator' : item.overLimit || item.nearLimit ? 'is-warning' : ''} style={{ width: `${item.percent}%` }}/>
              </div>
            </div>
            <div className="cfg-quota-tiers" role="group" aria-label={`Cota de ${item.name}`}>
              {item.isCreator
                ? <span className="soft-badge is-reward mono">1 GB · Criadora</span>
                : STORAGE_TIERS.map((tier) => <button
                    key={tier.id}
                    type="button"
                    disabled={busyUser === item.id}
                    className={`filter-btn mono ${item.plan === tier.id ? 'is-active-tier' : ''}`}
                    aria-pressed={item.plan === tier.id}
                    onClick={() => selectTier(item, tier)}
                  >
                    {tier.label}
                  </button>)}
            </div>
          </li>)}
        </ul>)}

    <p className="quiet-note">Reduzir o limite de uma conta não apaga arquivos já enviados; apenas bloqueia novos uploads até liberar espaço.</p>
  </div>;
}
