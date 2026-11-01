// Configuração lida do ambiente com os mesmos nomes no Node e no Worker.
// Os nomes antigos do servidor local (LUME_*) continuam aceitos como apelidos.

import { bcryptRounds } from './domain/auth.js';
import { MAX_MEDIA_BYTES } from './domain/media.js';

export const LIMITS = Object.freeze({
  body: 16 * 1024,
  small: 8 * 1024,
  tiny: 4 * 1024,
  state: 320 * 1024,
  import: 3 * 1024 * 1024,
  media: MAX_MEDIA_BYTES,
});

export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
export const ATTEMPT_CLEANUP_MS = 24 * 60 * 60 * 1000;

function pick(env, ...names) {
  for (const name of names) {
    if (env[name] !== undefined && env[name] !== '') return env[name];
  }
  return undefined;
}

export function readConfig(env = {}) {
  const attempts = Number(pick(env, 'ATTEMPT_LIMIT', 'LUME_ATTEMPT_LIMIT'));
  return {
    attemptLimit: Number.isFinite(attempts) && attempts > 0 ? Math.min(Math.floor(attempts), 1000) : 10,
    bcryptRounds: bcryptRounds(pick(env, 'BCRYPT_ROUNDS')),
    // Sem e-mail configurado, o link de redefinição volta na resposta, salvo
    // quando SHOW_RESET_LINK=false (produção).
    showResetLink: pick(env, 'SHOW_RESET_LINK', 'LUME_SHOW_RESET_LINK') !== 'false',
    githubToken: pick(env, 'GITHUB_TOKEN') || '',
  };
}
