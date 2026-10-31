import test from 'node:test';
import assert from 'node:assert/strict';
import { EmailError, emailConfig, passwordResetMessage, sendPasswordResetEmail } from './email.js';

const ENV = {
  LUME_EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_test_123',
  LUME_EMAIL_FROM: 'Lume <nao-responda@lume.example>',
  LUME_EMAIL_REPLY_TO: 'suporte@lume.example',
};

test('sem configuração, o envio não acontece e o chamador decide o fallback', async () => {
  let called = false;
  const result = await sendPasswordResetEmail({ to: 'ana@example.test', link: 'https://lume.example/#redefinir?token=x' }, {
    env: {},
    fetchImpl: async () => { called = true; return { ok: true, text: async () => '' }; },
  });
  assert.deepEqual(result, { sent: false, reason: 'not_configured' });
  assert.equal(called, false);
  assert.equal(emailConfig({}).provider, 'none');
});

test('envia a recuperação pelo Resend sem incluir senha ou token de sessão', async () => {
  let request = null;
  const result = await sendPasswordResetEmail({ to: 'ana@example.test', link: 'https://lume.example/#redefinir?token=abc', name: 'Ana' }, {
    env: ENV,
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, text: async () => '' }; },
  });
  assert.equal(result.sent, true);
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization, 'Bearer re_test_123');
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.to, ['ana@example.test']);
  assert.equal(body.from, ENV.LUME_EMAIL_FROM);
  assert.equal(body.reply_to, ENV.LUME_EMAIL_REPLY_TO);
  assert.match(body.subject, /Recuperar acesso/);
  assert.match(body.text, /token=abc/);
  assert.match(body.html, /token=abc/);
  assert.equal(JSON.stringify(body).includes('senhaAtual'), false);
});

test('html escapa o link e o nome recebido', () => {
  const message = passwordResetMessage({ link: 'https://lume.example/?a=1&b="x"', name: '<Ana>' });
  assert.match(message.html, /&lt;Ana&gt;/);
  assert.match(message.html, /a=1&amp;b=&quot;x&quot;/);
});

test('erro do provedor vira EmailError sem vazar a chave', async () => {
  await assert.rejects(
    () => sendPasswordResetEmail({ to: 'ana@example.test', link: 'https://lume.example/x' }, {
      env: ENV,
      fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'forbidden' }),
    }),
    (error) => error instanceof EmailError && error.code === 'provider_error' && !error.message.includes('re_test_123'),
  );
});
