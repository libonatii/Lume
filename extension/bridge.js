// Ponte entre a extensão e a página do Lume. Só roda nas origens do Lume
// listadas no manifesto. Repassa a leitura para a página e espera a confirmação
// dela; a página valida tudo de novo e a pessoa revisa antes de adicionar.
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type !== 'lume-capture') return false;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tries = 0;
  let timer = 0;

  const finish = (result) => {
    clearInterval(timer);
    window.removeEventListener('message', onAck);
    reply(result);
  };
  const onAck = (event) => {
    const data = event.data;
    if (event.source !== window || data?.source !== 'lume' || data.type !== 'capture-ack' || data.id !== id) return;
    finish({ ok: data.accepted !== false, reason: data.reason || null });
  };
  const type = message.kind === 'complete' ? 'complete' : 'capture';
  const send = () => window.postMessage({ source: 'lume-extension', type, id, payload: message.payload }, location.origin);

  window.addEventListener('message', onAck);
  send();
  // A página pode ainda estar carregando: repete até ela confirmar.
  timer = setInterval(() => {
    tries += 1;
    if (tries > 30) finish({ ok: false, reason: 'timeout' });
    else send();
  }, 500);
  return true;
});
