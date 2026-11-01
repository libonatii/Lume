const button = document.getElementById('read');
const status = document.getElementById('status');
const target = document.getElementById('target');

const say = (text) => { status.textContent = text; };

// O pacote da loja não tem a escolha de destino: vale sempre o Lume publicado.
if (target) {
  chrome.storage.local.get('lumeTarget').then(({ lumeTarget }) => { if (lumeTarget) target.value = lumeTarget; });
  target.addEventListener('change', () => chrome.storage.local.set({ lumeTarget: target.value }));
}

const REASONS = {
  no_lessons: 'Não achei uma lista de aulas nesta página. Abra a tela com o índice do curso (módulos e aulas) e tente de novo.',
  no_bridge: 'Não consegui falar com o Lume. Abra o Lume no navegador, entre na sua conta e tente de novo.',
  not_found: 'O Lume não achou esta aula nos seus cursos. Leia o curso primeiro, com o botão acima.',
  timeout: 'O Lume não respondeu. Confira se ele está aberto e com a sua conta ativa.',
  not_signed_in: 'Entre na sua conta do Lume e envie de novo.',
};

async function read() {
  button.disabled = true;
  say('Lendo a página…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/i.test(tab.url || '')) { say('Abra a página de um curso para ler.'); return; }

    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['capture.js'] });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: (options) => globalThis.LumeCapture.run(options),
      args: [{ pageUrl: tab.url, pageTitle: tab.title || '' }],
    });
    // O índice pode estar num quadro interno: vale o resultado com mais aulas.
    const best = results
      .map((entry) => entry.result)
      .filter((result) => result?.ok)
      .sort((a, b) => b.stats.lessons - a.stats.lessons)[0];
    if (!best) { say(REASONS.no_lessons); return; }

    say(`Encontrei ${best.stats.lessons} aulas, ${best.stats.completed} concluídas. Enviando ao Lume…`);
    const answer = await chrome.runtime.sendMessage({ type: 'deliver', payload: best.payload });
    if (answer?.ok) say('Enviado. Revise o curso na janela do Lume.');
    else say(REASONS[answer?.reason] || 'Não consegui entregar ao Lume. Tente de novo.');
  } catch {
    say('Não consegui ler esta página. Ela pode bloquear extensões; use a opção de colar a grade no Lume.');
  } finally {
    button.disabled = false;
  }
}

const completeButton = document.getElementById('complete');

// Avisa o Lume de que esta aula acabou. Quem registra a conclusão é a pessoa, na
// tela de confirmação que o Lume abre; a extensão só aponta a aula pelo endereço.
async function complete() {
  completeButton.disabled = true;
  say('Procurando esta aula no Lume…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !/^https?:/i.test(tab.url)) { say('Abra a página da aula para concluir.'); return; }
    const answer = await chrome.runtime.sendMessage({ type: 'deliver', kind: 'complete', payload: { url: tab.url, title: tab.title || '' } });
    if (answer?.ok) say('Confirme a conclusão na janela do Lume.');
    else say(REASONS[answer?.reason] || 'Não consegui avisar o Lume. Tente de novo.');
  } catch {
    say('Não consegui avisar o Lume. Tente de novo.');
  } finally {
    completeButton.disabled = false;
  }
}

// A leitura de um curso grande leva um ou dois minutos: mostra onde está.
chrome.runtime.onMessage.addListener((message) => { if (message?.type === 'lume-progress' && button.disabled) say(message.text); });

button.addEventListener('click', read);
completeButton.addEventListener('click', complete);
