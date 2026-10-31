// Envio de e-mail transacional da recuperação de senha.
//
// Provider suportado: Resend (HTTP, funciona no Worker e no Node).
// Sem configuração, o servidor continua no modo de desenvolvimento: o link
// aparece no log e, apenas quando SHOW_RESET_LINK não é "false", na resposta.
// Nenhuma senha, cookie ou token de sessão é enviado ao provider.

export class EmailError extends Error {
  constructor(message, code = 'email_error', status = 502) {
    super(message);
    this.name = 'EmailError';
    this.code = code;
    this.status = status;
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

export function passwordResetMessage({ link, name = '' }) {
  const greeting = name ? `Olá, ${name}.` : 'Olá.';
  return {
    subject: 'Recuperar acesso ao Lume',
    text: `${greeting}\n\nRecebemos um pedido para redefinir a senha da sua conta no Lume.\n\nAbra este link para criar uma nova senha (vale por 30 minutos e só pode ser usado uma vez):\n${link}\n\nSe não foi você, ignore esta mensagem. Sua senha atual continua valendo.`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0d1b2e;max-width:34rem;margin:auto">
      <h1 style="font-size:1.4rem">Recuperar acesso ao Lume</h1>
      <p>${escapeHtml(greeting)}</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta no Lume.</p>
      <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:.7rem 1rem;border-radius:.6rem;background:#2563eb;color:#fff;text-decoration:none">Criar uma nova senha</a></p>
      <p>O link vale por 30 minutos e só pode ser usado uma vez.</p>
      <p>Se não foi você, ignore esta mensagem. Sua senha atual continua valendo.</p>
    </div>`,
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
