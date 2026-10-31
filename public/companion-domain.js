// Regras do Lume Companion — programa local que informa qual aplicativo está
// aberto. Usado pelo agente (Node), pelo servidor, pelo Worker e pelos testes.
//
// Limites de produto que este módulo respeita:
// - presença observada não é estudo e nunca gera XP;
// - o agente lê nomes de processo da allowlist escolhida pela pessoa;
// - nunca lê título de janela, tela, teclado ou arquivos;
// - sem batimento recente, a presença expira sozinha.

export const PRESENCE_TTL_MS = 90 * 1000;
export const PAIR_TTL_MS = 10 * 60 * 1000;
export const MAX_DEVICES = 5;
export const MAX_ALLOWLIST = 20;
export const PAIR_CODE_LENGTH = 8;

export const COMPANION_CATEGORIES = [
  { id: 'study', label: 'Estudo' },
  { id: 'project', label: 'Projeto' },
  { id: 'reading', label: 'Leitura' },
  { id: 'break', label: 'Pausa' },
  { id: 'game', label: 'Jogo' },
  { id: 'other', label: 'Outra atividade' },
];

const CATEGORY_IDS = new Set(COMPANION_CATEGORIES.map((item) => item.id));
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeCategory(value) {
  return CATEGORY_IDS.has(value) ? value : 'other';
}

export function categoryLabel(value) {
  return COMPANION_CATEGORIES.find((item) => item.id === normalizeCategory(value))?.label || 'Outra atividade';
}

export function cleanAppLabel(value, maxLength = 60) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// "C:\Program Files\App\Code.exe", "code.exe" e "Code" comparam igual.
export function normalizeProcessName(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '';
  const base = text.split(/[\\/]/).pop();
  return base.replace(/\.exe$/i, '');
}

export function normalizePairCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatPairCode(code) {
  const clean = normalizePairCode(code).slice(0, PAIR_CODE_LENGTH);
  return clean.length === PAIR_CODE_LENGTH ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function generatePairCode(randomValues = crypto.getRandomValues(new Uint8Array(PAIR_CODE_LENGTH))) {
  let code = '';
  for (const byte of randomValues) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

// Saída de `tasklist /fo csv /nh`: "chrome.exe","1234","Console","1","120.000 K"
export function parseTasklist(output) {
  const processes = [];
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const match = line.match(/^"([^"]{1,120})"\s*,\s*"?(\d+)"?/);
    if (!match) continue;
    const process = normalizeProcessName(match[1]);
    if (process) processes.push({ process, pid: Number(match[2]) });
  }
  return processes;
}

// A allowlist é ordenada: a primeira entrada encontrada define a atividade.
export function matchAllowlist(processes, allowlist) {
  const running = new Set((processes || []).map((item) => normalizeProcessName(item?.process ?? item)).filter(Boolean));
  for (const entry of (Array.isArray(allowlist) ? allowlist : []).slice(0, MAX_ALLOWLIST)) {
    const process = normalizeProcessName(entry?.process);
    if (!process || !running.has(process)) continue;
    return {
      process,
      label: cleanAppLabel(entry.label) || process,
      category: normalizeCategory(entry.category),
    };
  }
  return null;
}

export function describeElapsed(milliseconds) {
  const seconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  if (seconds < 60) return 'agora há pouco';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function presenceState(presence, now = Date.now()) {
  if (!presence) return { active: false };
  const updated = Date.parse(presence.updatedAt || presence.updated_at);
  const since = Date.parse(presence.since);
  if (!Number.isFinite(updated)) return { active: false };
  const elapsedMs = Number.isFinite(since) ? Math.max(0, now - since) : 0;
  return {
    active: now - updated < PRESENCE_TTL_MS,
    app: cleanAppLabel(presence.app),
    category: normalizeCategory(presence.category),
    categoryLabel: categoryLabel(presence.category),
    since: Number.isFinite(since) ? new Date(since).toISOString() : null,
    updatedAt: new Date(updated).toISOString(),
    elapsedMs,
    elapsed: describeElapsed(elapsedMs),
  };
}
