// Autenticação compartilhada entre o Worker (Cloudflare) e o servidor local (Node).
// bcryptjs usa Web Crypto para salt e funciona no bundle do Worker e no Node.
import bcrypt from 'bcryptjs';
import { AppError } from '../errors.js';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;
export const MAX_PASSWORD_BYTES = 72;
export const MAX_NAME_LENGTH = 60;
export const RESET_TTL_MS = 30 * 60 * 1000;

// Compromisso com os 10 ms de CPU do Workers Free; medir em produção.
// Custo 6 é inferior ao mínimo 10 recomendado pela OWASP para bcrypt.
export const DEFAULT_BCRYPT_ROUNDS = 6;

export function bcryptRounds(value) {
  if (value === undefined || value === '') return DEFAULT_BCRYPT_ROUNDS;
  const rounds = Number(value);
  if (!Number.isInteger(rounds) || rounds < 4 || rounds > 12) {
    throw new Error('BCRYPT_ROUNDS deve ser um inteiro entre 4 e 12.');
  }
  return rounds;
}

// O runtime da Cloudflare recusa qualquer chamada de PBKDF2 acima de 100.000
// iterações ("iteration counts above 100000 are not supported").
// O encadeamento é preservado apenas para verificar hashes antigos com
// custo maior, sem invalidar senhas existentes.
// O hash guarda o total; a verificação repete a sequência original.
export const MAX_ITERATIONS_PER_ROUND = 100000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const encoder = new TextEncoder();

export class ValidationError extends AppError {
  constructor(message, field) {
    super(message, 'validation', 400, { field });
    this.name = 'ValidationError';
  }
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2) throw new ValidationError('Escreva seu nome com pelo menos 2 letras.', 'name');
  if (name.length > MAX_NAME_LENGTH) throw new ValidationError(`Use no máximo ${MAX_NAME_LENGTH} caracteres no nome.`, 'name');
  return name;
}

export function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new ValidationError('Escreva um e-mail válido, como nome@exemplo.com.', 'email');
  }
  return email;
}

export function validatePassword(value) {
  if (typeof value !== 'string') throw new ValidationError('Escreva uma senha.', 'password');
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, 'password');
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(`A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`, 'password');
  }
  if (encoder.encode(value).length > MAX_PASSWORD_BYTES) {
    throw new ValidationError('Use uma senha de até 72 bytes. Acentos e emojis ocupam mais de um byte.', 'password');
  }
  return value;
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function toBase64Url(bytes) {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function derive(password, salt, iterations) {
  const rounds = Math.ceil(iterations / MAX_ITERATIONS_PER_ROUND);
  let material = encoder.encode(password);
  for (let round = 0; round < rounds; round += 1) {
    const chunk = Math.min(MAX_ITERATIONS_PER_ROUND, iterations - round * MAX_ITERATIONS_PER_ROUND);
    // Salt distinto por bloco: sem isso, repetir a mesma entrada daria o mesmo resultado.
    const roundSalt = new Uint8Array(salt.length + 1);
    roundSalt.set(salt);
    roundSalt[salt.length] = round;
    const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: roundSalt, iterations: chunk, hash: 'SHA-256' }, key, 256);
    material = new Uint8Array(bits);
  }
  return material;
}

function constantTimeEqual(first, second) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference |= first[index] ^ second[index];
  return difference === 0;
}

// Formato padrão bcrypt: $2b$<custo>$<salt e hash>. Nunca truncar a senha.
export async function hashPassword(password, rounds = DEFAULT_BCRYPT_ROUNDS) {
  validatePassword(password);
  return bcrypt.hash(password, bcryptRounds(rounds));
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  if (/^\$2[ab]\$(0[4-9]|1[0-2])\$[./A-Za-z0-9]{53}$/.test(stored)) {
    if (encoder.encode(password).length > MAX_PASSWORD_BYTES) return false;
    return bcrypt.compare(password, stored);
  }
  // Somente leitura do formato legado. Novas senhas sempre usam bcrypt.
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1000) return false;
  let salt;
  let expected;
  try {
    salt = fromBase64(parts[3]);
    expected = fromBase64(parts[4]);
  } catch {
    return false;
  }
  if (expected.length !== 32) return false;
  const actual = await derive(password, salt, iterations);
  return constantTimeEqual(actual, expected);
}

export async function hashSessionToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return toHex(new Uint8Array(digest));
}

export async function createSessionToken() {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { token, tokenHash: await hashSessionToken(token) };
}

export function sessionCookie(token, { secure = true, maxAgeSeconds = SESSION_TTL_MS / 1000 } = {}) {
  return `lume_session=${token}; HttpOnly; SameSite=Strict; Path=/${secure ? '; Secure' : ''}; Max-Age=${maxAgeSeconds}`;
}

export function clearedSessionCookie({ secure = true } = {}) {
  return `lume_session=; HttpOnly; SameSite=Strict; Path=/${secure ? '; Secure' : ''}; Max-Age=0`;
}

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    cookies[name] = part.slice(index + 1).trim();
  }
  return cookies;
}
