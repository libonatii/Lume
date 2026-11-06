import { useEffect, useState } from 'react';
import Icon from '../../ui/Icon.jsx';

// Botão discreto de atualização da janela do app. Fica no topo, ao lado das
// preferências: verifica, baixa e abre o instalador sem sair do Lume.
const LABEL = {
  idle: 'Verificar atualização',
  checking: 'Procurando atualização…',
  current: 'Você está na versão mais recente',
  available: 'Atualização disponível — clique para baixar',
  downloading: 'Baixando atualização…',
  ready: 'Instalador pronto — clique para abrir',
  installing: 'Instalador aberto',
  error: 'Não foi possível verificar agora — clique para tentar de novo',
};

export default function DesktopUpdate() {
  const api = typeof window === 'undefined' ? null : window.lumeWindow?.update;
  const [info, setInfo] = useState({ status: 'idle', currentVersion: '', latest: null, progress: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!api) return undefined;
    let alive = true;
    api.status?.().then((value) => { if (alive && value) setInfo(value); }).catch(() => {});
    const off = api.onStatus?.((value) => { if (alive && value) setInfo(value); });
    // Verificação silenciosa: o ponto aparece sozinho quando há versão nova.
    const timer = setTimeout(() => { api.check?.().catch(() => {}); }, 5000);
    return () => { alive = false; clearTimeout(timer); off?.(); };
  }, [api]);

  if (!api) return null;

  const status = info.status || 'idle';
  const available = status === 'available';
  const progress = status === 'downloading' && info.progress ? ` ${info.progress}%` : '';
  const base = LABEL[status] || LABEL.idle;
  const label = `${base}${progress}${info.currentVersion ? ` (versão ${info.currentVersion})` : ''}`;

  async function activate() {
    if (busy) return;
    setBusy(true);
    try {
      if (status === 'available') {
        const after = await api.download();
        if (after?.status === 'ready') await api.install();
      } else if (status === 'ready' || status === 'installing') {
        await api.install();
      } else {
        await api.check();
      }
    } catch { /* o estado do app já mostra o erro no título. */ }
    finally { setBusy(false); }
  }

  return <button
    type="button"
    className={`icon-button desktop-update${available ? ' is-available' : ''}`}
    onClick={activate}
    disabled={busy || status === 'checking' || status === 'downloading'}
    aria-label={label}
    title={label}
  >
    <Icon name="cloud"/>
    {available && <span className="desktop-update-dot" aria-hidden="true"/>}
  </button>;
}
