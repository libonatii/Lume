// Entrega a leitura ao Lume. Fica aqui, e não no popup, porque o popup fecha
// assim que a aba do Lume ganha o foco.
const LUME_URLS = {
  published: 'https://lume.lume-prototype.workers.dev',
  local: 'http://localhost:4173',
};

async function lumeBase() {
  const { lumeTarget } = await chrome.storage.local.get('lumeTarget');
  return LUME_URLS[lumeTarget] || LUME_URLS.published;
}

async function findOrOpenLume(base) {
  const found = await chrome.tabs.query({ url: `${base}/*` });
  if (found.length) return found[0];
  return chrome.tabs.create({ url: `${base}/#biblioteca`, active: false });
}

function sendToTab(tabId, payload, kind) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'lume-capture', kind, payload }, (answer) => {
      if (chrome.runtime.lastError) resolve({ ok: false, reason: 'no_bridge' });
      else resolve(answer || { ok: false, reason: 'no_answer' });
    });
  });
}

async function deliver(payload, kind = 'capture') {
  const base = await lumeBase();
  const tab = await findOrOpenLume(base);
  // A aba recém-aberta ainda não tem a ponte: tenta de novo por alguns segundos.
  let result = { ok: false, reason: 'no_bridge' };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    result = await sendToTab(tab.id, payload, kind);
    if (result.ok || result.reason !== 'no_bridge') break;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  if (result.ok) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
  }
  return result;
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type !== 'deliver') return false;
  deliver(message.payload, message.kind).then(reply, () => reply({ ok: false, reason: 'error' }));
  return true;
});
