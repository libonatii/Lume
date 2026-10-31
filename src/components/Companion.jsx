import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Button, Heading } from './ui.jsx';
import { api, apiError } from '../lib/api.js';
import { copyText, selectText } from '../lib/clipboard.js';
import { formatPairCode, presenceState } from '../../public/companion-domain.js';

// Página do app de desktop: baixar o programa e conectar a presença local.
// O programa é o Lume inteiro (janela com o site); este painel cuida da
// instalação e do pareamento do dispositivo.

const RELEASES_URL = 'https://github.com/libonatii/Lume/releases/latest';
const DOWNLOAD_URL = `${RELEASES_URL}/download/Lume-setup.exe`;

function InstallApp() {
  return <div className="companion-install">
    <div>
      <strong>Lume para Windows</strong>
      <p className="muted-text small">O Lume inteiro em uma janela, com bandeja, presença local, aulas restantes e roteiro. A conta é a mesma do navegador.</p>
    </div>
    <a className="button primary full-width" href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
      <Icon name="cloud"/>Instalar aplicativo
    </a>
    <p className="quiet-note">Windows 10/11 · o instalador ainda não tem assinatura digital, então o Windows pode pedir confirmação. Versões e notas em <a className="text-link" href={RELEASES_URL} target="_blank" rel="noopener noreferrer">Releases<Icon name="external"/></a>.</p>
  </div>;
}

function relativeSeen(value) {
  if (!value) return 'nunca';
  const diff = Date.now() - Date.parse(value);
  if (!Number.isFinite(diff)) return 'nunca';
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function Companion({ account, notify, go }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pairing, setPairing] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async (signal) => {
    if (!account) return;
    const result = await api('/api/companion', { signal });
    if (!alive.current) return;
    if (!result.ok) { setError(apiError(result)); return; }
    setError('');
    setData(result.data);
  }, [account]);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    load(controller.signal).catch(() => {});
    const timer = setInterval(() => { load(controller.signal).catch(() => {}); }, 20000);
    return () => { alive.current = false; controller.abort(); clearInterval(timer); };
  }, [load]);

  async function connect() {
    setBusy(true); setError('');
    try {
      const result = await api('/api/companion/pair', { method: 'POST', body: {} });
      if (!result.ok) throw new Error(apiError(result));
      setPairing(result.data);
      await load();
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  async function copyCode() {
    if (!pairing) return;
    if (await copyText(formatPairCode(pairing.code))) {
      notify('Código copiado. Cole no programa em até 10 minutos.');
      return;
    }
    selectText('.companion-code > code');
    notify('Não foi possível copiar automaticamente. O código está selecionado: use Ctrl+C.');
  }

  async function revoke(device) {
    setBusy(true); setError('');
    try {
      const result = await api(`/api/companion/devices/${encodeURIComponent(device.id)}`, { method: 'DELETE' });
      if (!result.ok) throw new Error(apiError(result));
      notify(`${device.name} foi desconectado. Se ele ainda estiver aberto, pare o programa.`);
      await load();
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  // Tela própria: a instalação e a conexão não ficam mais dentro de Configurações.
  const page = (content) => <div className="personal-root">
    <Heading eyebrow="Lume no seu computador" title="Instalar aplicativo">
      O Lume completo em uma janela, com presença local, aulas restantes e roteiro. Presença não gera XP.
    </Heading>
    {content}
  </div>;

  if (!account) {
    return page(<section className="card-surface settings-panel companion-panel">
      <div className="panel-title"><span className="pace-icon"><Icon name="lock"/></span><div><h2 className="title">Lume no desktop</h2><p className="muted-text">O programa que abre o Lume e acompanha sua atividade local.</p></div></div>
      <InstallApp/>
      <p className="muted-text">Conectar o programa exige uma conta: é ela que autoriza o dispositivo e guarda a lista dos seus computadores.</p>
      <Button secondary onClick={() => go('login')}>Entrar para conectar<Icon name="arrow"/></Button>
    </section>);
  }

  const active = (data?.active || []).map((device) => ({ device, state: presenceState(device.presence) }));

  return page(<section className="card-surface settings-panel companion-panel">
    <div className="panel-title"><span className="pace-icon"><Icon name="cloud"/></span><div><h2 className="title">Presença no desktop</h2><p className="muted-text">Presença local, opcional e sem XP.</p></div></div>
    <InstallApp/>
    <p className="muted-text">Depois de instalar, gere um código aqui nesta tela e cole no programa. Ele informa qual aplicativo da sua lista está aberto. O Lume lê apenas nomes de processo — nunca títulos de janela, tela, teclado ou arquivos.</p>

    {!data && <p className="quiet-note">Verificando dispositivos…</p>}
    {data && data.devices.length === 0 && <p className="inline-note"><Icon name="help"/><span>Nenhum programa conectado ainda.</span></p>}

    {active.length > 0 && <div className="companion-presence" role="status">
      {active.map(({ device, state }) => <div className="companion-presence-row" key={device.id}>
        <span className="companion-dot" aria-hidden="true"/>
        <div>
          <strong>{state.app}</strong>
          <small>{state.categoryLabel} · há {state.elapsed} · {device.name}</small>
        </div>
        <span className="companion-tag">observado localmente</span>
      </div>)}
      <p className="quiet-note">Isto descreve um aplicativo aberto, não estudo comprovado. Não gera XP e não entra no seu histórico.</p>
    </div>}

    {data && data.devices.length > 0 && <ul className="companion-devices">
      {data.devices.map((device) => <li key={device.id}>
        <span className="companion-device-icon"><Icon name="cloud"/></span>
        <span className="companion-device-copy">
          <strong>{device.name}</strong>
          <small>Conectado em {new Date(device.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · visto {relativeSeen(device.lastSeenAt)}</small>
        </span>
        <button className="text-button" onClick={() => revoke(device)} disabled={busy} aria-label={`Desconectar ${device.name}`}>Desconectar</button>
      </li>)}
    </ul>}

    {pairing && <div className="companion-code" aria-live="polite">
      <span className="eyebrow">Código de conexão</span>
      <code>{formatPairCode(pairing.code)}</code>
      <p className="quiet-note">Vale por 10 minutos e só pode ser usado uma vez.</p>
      <div className="action-row">
        <Button secondary onClick={copyCode}>Copiar código</Button>
        <button className="text-button" onClick={() => setPairing(null)}>Fechar</button>
      </div>
      <div className="companion-steps">
        <p>Abra o <strong>Lume</strong> (ícone na bandeja do Windows), escolha <strong>Presença e pareamento</strong> e cole o código.</p>
        <details>
          <summary>Rodando pelo projeto (desenvolvimento)</summary>
          <code className="companion-command">npm run companion:pair -- {formatPairCode(pairing.code)} --name "Meu computador"</code>
          <code className="companion-command">npm run companion</code>
          <p className="quiet-note">Testando localmente, acrescente <code>--api http://127.0.0.1:4173</code>. Sem esse parâmetro, o programa usa o endereço publicado.</p>
        </details>
      </div>
    </div>}

    <div className="action-row">
      <Button onClick={connect} disabled={busy || (data && data.devices.length >= data.maxDevices)}><Icon name="plus"/>Conectar um programa</Button>
      {pairing && <Button secondary onClick={() => load()}>Atualizar status</Button>}
    </div>
    <p className="quiet-note">Cada computador recebe um acesso próprio, que você pode remover a qualquer momento. Amigos e grupos ainda não existem: por enquanto, a presença aparece só para você.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>);
}
