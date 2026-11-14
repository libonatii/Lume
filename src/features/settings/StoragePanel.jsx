import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatBytes } from '../../../public/pdf-domain.js';
import { api, apiError } from '../../lib/api.js';
import Icon from '../../ui/Icon.jsx';
import { Button } from '../../ui/ui.jsx';

function formatDate(iso) {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  return new Date(ts).toLocaleDateString('pt-BR');
}

export default function StoragePanel({ state, account, libraryActions, confirmSave, notify, open, go }) {
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('size');
  const [query, setQuery] = useState('');
  const [confirmItem, setConfirmItem] = useState(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError('');
    try {
      const result = await api('/api/storage');
      if (!result.ok) throw new Error(apiError(result));
      setStorage(result.data);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os dados de armazenamento.');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  const subjectMap = useMemo(
    () => new Map((state?.subjects || []).map((item) => [item.id, item.title])),
    [state?.subjects],
  );

  const items = useMemo(() => {
    const list = storage?.items || [];
    const term = query.trim().toLowerCase();
    const filtered = list.filter((item) => {
      if (filter !== 'all' && item.kind !== filter) return false;
      if (term && !String(item.name || '').toLowerCase().includes(term) && !String(item.fileName || '').toLowerCase().includes(term)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => (
      sort === 'recent'
        ? String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        : (b.size - a.size) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    ));
  }, [storage?.items, filter, query, sort]);

  if (!account) {
    return <div className="cfg-stack">
      <p className="inline-note"><Icon name="lock"/><span>Entre na sua conta para acompanhar o uso de armazenamento e gerenciar seus anexos. Na prévia local nenhum arquivo é enviado ao servidor.</span></p>
      <div><Button onClick={() => go('login')}>Entrar ou criar conta<Icon name="arrow"/></Button></div>
    </div>;
  }

  async function removeItem(item) {
    if (busyId) return;
    setBusyId(item.id);
    setError('');
    try {
      const inLibrary = item.kind === 'library'
        && item.materialId
        && (state?.courses || []).some((course) => course.id === item.materialId);
      if (inLibrary) {
        const applied = libraryActions.deleteMaterial(item.materialId);
        if (!applied) throw new Error('Não foi possível remover o material da biblioteca agora.');
        await confirmSave?.();
        await load();
      } else {
        const result = await api(`/api/storage/items/${item.kind}/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
        if (!result.ok) throw new Error(apiError(result));
        if (result.data?.storage) setStorage(result.data.storage);
        else await load();
      }
      setConfirmItem(null);
      notify(`Anexo excluído. ${formatBytes(item.size)} liberados.`);
    } catch (err) {
      setError(err.message || 'Não foi possível excluir este anexo.');
    } finally {
      setBusyId('');
    }
  }

  const limit = storage?.accountBytes || 0;
  const used = storage?.used || 0;
  const libBytes = storage?.breakdown?.libraryBytes || 0;
  const socialBytes = storage?.breakdown?.socialBytes || 0;
  const libPct = limit > 0 ? Math.min(100, (libBytes / limit) * 100) : 0;
  const socialPct = limit > 0 ? Math.min(Math.max(0, 100 - libPct), (socialBytes / limit) * 100) : 0;
  const totalCount = storage?.items?.length || 0;
  const libCount = storage?.breakdown?.libraryFiles || 0;
  const socialCount = storage?.breakdown?.socialFiles || 0;

  return <div className="cfg-stack">
    {loading && !storage && <p className="quiet-note">Carregando uso de armazenamento…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}

    {storage && <>
      <div className="cfg-storage-summary">
        <div className="cfg-storage-top">
          <div>
            <p className="cfg-storage-headline">
              <span className="mono">{formatBytes(used)}</span> de <span className="mono">{formatBytes(limit)}</span> usados{' '}
              <span className="mono cfg-storage-pct">({storage.percent}%)</span>
            </p>
            {storage.overLimit && <p className="cfg-storage-alert is-over">Você ultrapassou o limite da faixa atual. Novos envios estão bloqueados até liberar espaço.</p>}
            {!storage.overLimit && storage.nearLimit && <p className="cfg-storage-alert">Você está perto do limite de armazenamento. Exclua anexos antigos para liberar espaço.</p>}
          </div>
          <span className="soft-badge mono">Faixa atual: {storage.label}</span>
        </div>

        <div className={`cfg-storage-bar ${storage.overLimit || storage.nearLimit ? 'is-warning' : ''}`} role="img" aria-label={`Uso de armazenamento: ${formatBytes(used)} de ${formatBytes(limit)}`}>
          {libPct > 0 && <span className="cfg-storage-seg is-library" style={{ width: `${libPct}%` }}/>}
          {socialPct > 0 && <span className="cfg-storage-seg is-social" style={{ width: `${socialPct}%` }}/>}
        </div>

        <div className="cfg-storage-legend">
          <span><i className="cfg-dot is-library"/>PDFs da Biblioteca: <strong className="mono">{formatBytes(libBytes)}</strong> ({libCount})</span>
          <span><i className="cfg-dot is-social"/>Anexos do Social: <strong className="mono">{formatBytes(socialBytes)}</strong> ({socialCount})</span>
        </div>
      </div>

      <div className="cfg-block">
        <div className="cfg-storage-controls">
          <div className="cfg-filter-row" role="tablist" aria-label="Filtrar anexos por origem">
            <button type="button" role="tab" aria-selected={filter === 'all'} className={`filter-btn ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>Todos ({totalCount})</button>
            <button type="button" role="tab" aria-selected={filter === 'library'} className={`filter-btn ${filter === 'library' ? 'is-active' : ''}`} onClick={() => setFilter('library')}>PDFs da Biblioteca ({libCount})</button>
            <button type="button" role="tab" aria-selected={filter === 'social'} className={`filter-btn ${filter === 'social' ? 'is-active' : ''}`} onClick={() => setFilter('social')}>Anexos do Social ({socialCount})</button>
          </div>
          <div className="cfg-storage-search">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar anexo…" aria-label="Buscar anexo por nome"/>
            <select className="cfg-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar anexos">
              <option value="size">Maior primeiro</option>
              <option value="recent">Mais recentes</option>
            </select>
          </div>
        </div>

        {items.length === 0
          ? <p className="quiet-note">{totalCount === 0 ? 'Nenhum anexo guardado na sua conta até agora.' : 'Nenhum anexo encontrado com este filtro.'}</p>
          : <ul className="cfg-storage-list">
              {items.map((item) => {
                const subjectName = item.subjectId ? subjectMap.get(item.subjectId) : '';
                const meta = item.kind === 'library'
                  ? ['Biblioteca', subjectName, formatDate(item.createdAt)].filter(Boolean).join(' · ')
                  : ['Social', formatDate(item.createdAt) ? `Publicação de ${formatDate(item.createdAt)}` : 'Publicação'].join(' · ');
                const confirming = confirmItem?.id === item.id && confirmItem?.kind === item.kind;
                return <li key={`${item.kind}-${item.id}`} className="cfg-storage-item">
                  <div className="cfg-storage-item-main">
                    <div className="cfg-storage-item-info">
                      <strong>{item.name}</strong>
                      <span>{meta}</span>
                    </div>
                    <span className="mono cfg-storage-size">{formatBytes(item.size)}</span>
                    <div className="cfg-storage-actions">
                      {item.kind === 'library' && item.materialId && <Button secondary onClick={() => open({ type: 'pdf', id: item.materialId })}>Abrir</Button>}
                      {item.kind === 'social' && <Button secondary onClick={() => go('amigos')}>Ver no Social</Button>}
                      <Button secondary className="is-danger-outline" disabled={Boolean(busyId)} onClick={() => setConfirmItem(confirming ? null : item)}>Excluir</Button>
                    </div>
                  </div>
                  {confirming && <div className="cfg-storage-confirm" role="region" aria-label="Confirmar exclusão">
                    <p>
                      Excluir <strong>{item.name}</strong> libera <span className="mono">{formatBytes(item.size)}</span>.{' '}
                      {item.kind === 'library' ? 'O material PDF será removido da sua Biblioteca.' : 'A publicação com este anexo será removida do Social.'}
                    </p>
                    <div className="cfg-storage-actions">
                      <Button className="is-danger-fill" disabled={busyId === item.id} onClick={() => removeItem(item)}>
                        {busyId === item.id ? 'Excluindo…' : 'Confirmar exclusão'}
                      </Button>
                      <Button ghost disabled={busyId === item.id} onClick={() => setConfirmItem(null)}>Cancelar</Button>
                    </div>
                  </div>}
                </li>;
              })}
            </ul>}

        <p className="quiet-note">Excluir um PDF por aqui remove também o material correspondente da sua Biblioteca e libera espaço imediatamente.</p>
      </div>
    </>}
  </div>;
}
