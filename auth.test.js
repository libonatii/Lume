import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError, normalizeEmail, validateName, validateEmail, validatePassword,
  hashPassword, verifyPassword, createSessionToken, hashSessionToken,
  sessionCookie, clearedSessionCookie, parseCookies,
  DEFAULT_ITERATIONS,
} from './auth.js';

const fast = { iterations: 1000 };

test('novas senhas usam o padrão de 100.000 iterações', async () => {
  assert.equal(DEFAULT_ITERATIONS, 100000);
  const stored = await hashPassword('senha-padrao-de-teste');
  assert.match(stored, /^pbkdf2\$sha256\$100000\$/);
  assert.equal(await verifyPassword('senha-padrao-de-teste', stored), true);
  assert.equal(await verifyPassword('senha-errada', stored), false);
});

test('hash de 600.000 iterações anterior à redução continua aceitando a senha original', async () => {
  // Fixture criada pela implementação anterior, sem dados de uma conta real.
  const stored = 'pbkdf2$sha256$600000$6P0lUqPcwSKKssyCQkx+QA==$ExWGYnzoAxu6SErtrcuOUCi5G7WiEZnrrc5dc1pxjAk=';
  assert.equal(await verifyPassword('senha-legada-de-teste', stored), true);
  assert.equal(await verifyPassword('senha-errada', stored), false);
});

test('e-mail é normalizado sem espaços e sem diferenciar maiúsculas', () => {
  assert.equal(normalizeEmail('  Ana@Exemplo.COM '), 'ana@exemplo.com');
  assert.equal(validateEmail(' Ana@Exemplo.COM '), 'ana@exemplo.com');
});

test('cadastro recusa nome, e-mail e senha inválidos', () => {
  assert.throws(() => validateName(' '), ValidationError);
  assert.throws(() => validateName('a'), ValidationError);
  assert.throws(() => validateName('x'.repeat(61)), ValidationError);
  assert.throws(() => validateEmail('sem-arroba'), ValidationError);
  assert.throws(() => validateEmail('ana@exemplo'), ValidationError);
  assert.throws(() => validateEmail(''), ValidationError);
  assert.throws(() => validatePassword('1234567'), ValidationError);
  assert.throws(() => validatePassword('x'.repeat(201)), ValidationError);
  assert.throws(() => validatePassword(undefined), ValidationError);
  assert.equal(validatePassword('12345678'), '12345678');
  assert.equal(validateName('  Ana   Clara '), 'Ana Clara');
});

test('senha é guardada com salt próprio e nunca em texto puro', async () => {
  const first = await hashPassword('senha-segura-1', 1000);
  const second = await hashPassword('senha-segura-1', 1000);
  assert.notEqual(first, second);
  assert.match(first, /^pbkdf2\$sha256\$1000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.doesNotMatch(first, /senha-segura-1/);
});

test('verificação aceita a senha certa e recusa a errada', async () => {
  const stored = await hashPassword('minha-senha-123', 1000);
  assert.equal(await verifyPassword('minha-senha-123', stored), true);
  assert.equal(await verifyPassword('minha-senha-124', stored), false);
  assert.equal(await verifyPassword('', stored), false);
  assert.equal(await verifyPassword('minha-senha-123', 'formato-invalido'), false);
  assert.equal(await verifyPassword('minha-senha-123', 'pbkdf2$sha256$0$AA==$AA=='), false);
  assert.equal(await verifyPassword('minha-senha-123', undefined), false);
});

test('token de sessão é aleatório e só o resumo é guardado', async () => {
  const first = await createSessionToken();
  const second = await createSessionToken();
  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, await hashSessionToken(first.token));
  assert.equal(first.tokenHash.length, 64);
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.tokenHash, first.token);
});

test('cookie de sessão é HttpOnly, SameSite=Strict e Secure em produção', () => {
  const local = sessionCookie('abc123', { secure: false });
  assert.match(local, /HttpOnly/);
  assert.match(local, /SameSite=Strict/);
  assert.match(local, /Max-Age=604800/);
  assert.doesNotMatch(local, /Secure/);

  const production = sessionCookie('abc123');
  assert.match(production, /Secure/);

  assert.match(clearedSessionCookie(), /Max-Age=0/);
  assert.match(clearedSessionCookie(), /Secure/);
  assert.equal(parseCookies('lume_session=xyz; tema=dark').lume_session, 'xyz');
  assert.deepEqual(parseCookies(''), {});
  assert.deepEqual(parseCookies(undefined), {});
});

test('o parâmetro de iterações é registrado no hash e usado na verificação', async () => {
  const stored = await hashPassword('outra-senha-1', 2048);
  assert.match(stored, /^pbkdf2\$sha256\$2048\$/);
  assert.equal(await verifyPassword('outra-senha-1', stored), true);
  assert.equal(await verifyPassword('outra-senha-2', stored), false);
});

test('derivação acima do teto por bloco continua verificando corretamente', async () => {
  // 250.000 exige três blocos encadeados (100.000 + 100.000 + 50.000).
  const stored = await hashPassword('senha-em-blocos-1', 250000);
  assert.match(stored, /^pbkdf2\$sha256\$250000\$/);
  assert.equal(await verifyPassword('senha-em-blocos-1', stored), true);
  assert.equal(await verifyPassword('senha-em-blocos-2', stored), false);
});
