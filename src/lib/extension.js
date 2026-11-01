// Recebe mensagens da extensão do Lume.
//
// A mensagem vem do script de ponte da extensão, que roda na mesma origem. Ela é
// tratada como dado: a leitura de curso passa por `normalizePayload` e a pessoa
// revisa antes de adicionar; o aviso "concluí esta aula" só abre a tela de
// confirmação da aula, que a pessoa confirma. Nada chega daqui já registrado.
const delivered = new Set();

// Cada tratador devolve true (aceito), false ou um texto com o motivo da recusa.
export function listenForExtension(handlers) {
  function handle(event) {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== 'lume-extension' || typeof data.id !== 'string') return;
    const handler = handlers[data.type];
    if (!handler) return;
    const reply = (accepted, reason = null) => window.postMessage({ source: 'lume', type: 'capture-ack', id: data.id, accepted, reason }, location.origin);
    // A ponte repete a mensagem até receber a confirmação.
    if (delivered.has(data.id)) { reply(true); return; }
    const result = handler(data.payload);
    if (result === true) { delivered.add(data.id); reply(true); return; }
    reply(false, typeof result === 'string' ? result : 'not_signed_in');
  }
  window.addEventListener('message', handle);
  return () => window.removeEventListener('message', handle);
}
