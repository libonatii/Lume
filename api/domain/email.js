// Envio de e-mail transacional da recuperação de senha.
//
// Provider suportado: Resend (HTTP, funciona no Worker e no Node).
// Sem configuração, o servidor continua no modo de desenvolvimento: o link
// aparece no log e, apenas quando SHOW_RESET_LINK não é "false", na resposta.
// Nenhuma senha, cookie ou token de sessão é enviado ao provider.

import { AppError } from '../errors.js';

export class EmailError extends AppError {
  constructor(message, code = 'email_error', status = 502, detail = '') {
    super(message, code, status, { detail });
    this.name = 'EmailError';
  }
}

export function emailConfig(env = {}) {
  const provider = String(env.LUME_EMAIL_PROVIDER || (env.RESEND_API_KEY ? 'resend' : '')).trim().toLowerCase();
  const apiKey = String(env.RESEND_API_KEY || env.LUME_EMAIL_API_KEY || '').trim();
  const from = String(env.LUME_EMAIL_FROM || '').trim();
  const replyTo = String(env.LUME_EMAIL_REPLY_TO || '').trim();
  if (provider === 'resend' && apiKey && from) return { provider: 'resend', apiKey, from, replyTo };
  return { provider: 'none', reason: 'not_configured' };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function siteOrigin(link) {
  try { return new URL(link).origin; } catch { return ''; }
}

// Cores da identidade Norte (src/styles/00-tokens.css). E-mail não aceita
// variáveis CSS nem SVG inline, então os valores ficam escritos aqui. As fontes do
// Lume não são carregadas em clientes de e-mail; ficam como primeira opção.
const MAIL = { bg: '#0c111b', card: '#141b2a', border: '#2a3550', text: '#eef2f7', muted: '#c3ccda', subtle: '#9aa7ba', action: '#f6c165', actionInk: '#1f1503', accent: '#9ec5ff' };
const FONT = "'Atkinson Hyperlegible Next','Atkinson Hyperlegible',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,Consolas,Menlo,monospace";

export function passwordResetMessage({ link, name = '' }) {
  const greeting = name ? `Olá, ${name}.` : 'Olá.';
  const origin = siteOrigin(link);
  const safeLink = escapeHtml(link);
  const logo = origin
    ? `<img src="${escapeHtml(origin)}/assets/email-logo.png" width="48" height="48" alt="Lume" style="display:block;border:0;border-radius:12px">`
    : '';
  return {
    subject: 'Recuperar acesso ao Lume',
    text: `${greeting}

Recebemos um pedido para redefinir a senha da sua conta no Lume.

Abra este link para criar uma nova senha (vale por 30 minutos e só pode ser usado uma vez):
${link}

Se não foi você, ignore esta mensagem. Sua senha atual continua valendo.`,
    html: `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>Recuperar acesso ao Lume</title></head>
<body style="margin:0;padding:0;background:${MAIL.bg};font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${MAIL.bg}">Crie uma nova senha para entrar no Lume. O link vale por 30 minutos.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MAIL.bg}"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
    <tr><td style="padding:0 4px 20px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle">${logo}</td>
        <td style="vertical-align:middle;padding-left:12px;font-family:${FONT};font-size:22px;font-weight:700;letter-spacing:-.01em;color:${MAIL.text}">Lume</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:${MAIL.card};border:1px solid ${MAIL.border};border-radius:20px;padding:36px 32px;font-family:${FONT}">
      <p style="margin:0 0 8px;font-family:${MONO};font-size:13px;color:${MAIL.accent}">recuperação de acesso</p>
      <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;font-weight:700;color:${MAIL.text}">Crie uma nova senha</h1>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.65;color:${MAIL.text}">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:${MAIL.muted}">Recebemos um pedido para redefinir a senha da sua conta no Lume. Use o botão abaixo para escolher uma nova.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px"><tr><td align="center" bgcolor="${MAIL.action}" style="border-radius:12px;background:${MAIL.action}">
        <a href="${safeLink}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:${MAIL.actionInk};text-decoration:none;border-radius:12px">Criar uma nova senha</a>
      </td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px"><tr><td style="background:${MAIL.bg};border:1px solid ${MAIL.border};border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.6;color:${MAIL.muted}">
        O link vale por <strong style="font-family:${MONO};color:${MAIL.text}">30 min</strong> e só pode ser usado uma vez.
      </td></tr></table>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${MAIL.subtle}">Se o botão não abrir, copie este endereço e cole no navegador:</p>
      <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all"><a href="${safeLink}" style="color:${MAIL.accent};text-decoration:underline">${safeLink}</a></p>
    </td></tr>
    <tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MAIL.subtle};text-align:center">
      Se não foi você, ignore esta mensagem. Sua senha atual continua valendo.<br>
      Lume · provas, trabalhos e entregas em dia
    </td></tr>
  </table>
</td></tr></table>
</body></html>`,
  };
}

export async function sendPasswordResetEmail({ to, link, name = '' }, { env = {}, fetchImpl = fetch } = {}) {
  const config = emailConfig(env);
  if (config.provider === 'none') return { sent: false, reason: 'not_configured' };
  const message = passwordResetMessage({ link, name });
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new EmailError(`O provedor de e-mail recusou o envio (${response.status}).`, 'provider_error', 502, detail);
  }
  return { sent: true, provider: config.provider };
}
