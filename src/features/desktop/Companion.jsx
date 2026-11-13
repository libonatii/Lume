import { useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { Button, Heading, Skeleton } from '../../ui/ui.jsx';
import { api, apiError } from '../../lib/api.js';
import { useResource } from '../../lib/resources.js';
import { copyText, selectText } from '../../lib/clipboard.js';
import { desktopPlatform, isDesktopApp } from '../../lib/desktop.js';
import { formatPairCode, presenceState } from '../../../public/companion-domain.js';

// Página do app de desktop: baixar o programa e conectar a presença local.
// O programa é o Lume inteiro (janela com o site); este painel cuida da
// instalação e do pareamento do dispositivo.

const RELEASES_URL = 'https://github.com/libonatii/Lume/releases/latest';
const WINDOWS_URL = `${RELEASES_URL}/download/Lume-setup.exe`;
const LINUX_APPIMAGE_URL = `${RELEASES_URL}/download/Lume.AppImage`;
const LINUX_DEB_URL = `${RELEASES_URL}/download/Lume.deb`;

const desktop = isDesktopApp();

function InstallApp() {
  const os = desktopPlatform();
  // Dentro do programa não faz sentido oferecer o download do próprio programa.
  if (desktop) {
    return <div className="companion-install">
      <div>
        <strong>Você já está no Lume para {os === 'linux' ? 'Linux' : 'Windows'}</strong>
        <p className="muted-text small">Esta janela é o próprio programa. A atualização é feita pelo painel de presença, na bandeja.</p>
      </div>
    </div>;
  }
  if (os === 'linux') {
    return <div className="companion-install">
      <div>
        <strong>Lume para Linux</strong>
        <p className="muted-text small">O Lume inteiro em uma janela, com bandeja, presença local, aulas restantes e roteiro. A conta é a mesma do navegador.</p>
      </div>
      <div className="action-row">
        <a className="button primary" href={LINUX_APPIMAGE_URL} target="_blank" rel="noopener noreferrer">
          <Icon name="cloud"/>Baixar AppImage
        </a>
        <a className="button secondary" href={LINUX_DEB_URL} target="_blank" rel="noopener noreferrer">
          Pacote .deb
        </a>
      </div>
      <p className="quiet-note">Linux x64 (.AppImage universal ou .deb para Ubuntu/Debian) · também disponível para <a className="text-link" href={WINDOWS_URL} target="_blank" rel="noopener noreferrer">Windows</a>. Versões e notas em <a className="text-link" href={RELEASES_URL} target="_blank" rel="noopener noreferrer">Releases<Icon name="external"/></a>.</p>
    </div>;
  }
  return <div className="companion-install">
    <div>
      <strong>Lume para Windows</strong>
      <p className="muted-text small">O Lume inteiro em uma janela, com bandeja, presença local, aulas restantes e roteiro. A conta é a mesma do navegador.</p>
    </div>
    <a className="button primary full-width" href={WINDOWS_URL} target="_blank" rel="noopener noreferrer">
      <Icon name="cloud"/>Instalar aplicativo
    </a>
    <p className="quiet-note">Windows 10/11 · o instalador ainda não tem assinatura digital, então o Windows pode pedir confirmação. Também disponível para Linux (<a className="text-link" href={LINUX_APPIMAGE_URL} target="_blank" rel="noopener noreferrer">AppImage</a> e <a className="text-link" href={LINUX_DEB_URL} target="_blank" rel="noopener noreferrer">.deb</a>) · <a className="text-link" href={RELEASES_URL} target="_blank" rel="noopener noreferrer">Releases<Icon name="external"/></a>.</p>
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
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState('');
  const [pairing, setPairing] = useState(null);
  // Dispositivos e presença se atualizam a cada 20 s enquanto a tela está aberta.
  const companion = useResource('/api/companion', { interval: 20000, enabled: Boolean(account) });
  const data = companion.data ?? null;
  const error = actionError || companion.error;
  const load = companion.refresh;

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

    {!data && <Skeleton label="Verificando dispositivos…" rows={2}/>}
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
        <p>Abra o <strong>Lume</strong> (ícone na bandeja do sistema), escolha <strong>Presença e pareamento</strong> e cole o código.</p>
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
    <p className="quiet-note">Cada computador recebe um acesso próprio, que você pode remover a qualquer momento. Amigos e mensagens diretas já funcionam no site; a presença entre amigos ainda não existe, então por enquanto ela aparece só para você.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>);
}
