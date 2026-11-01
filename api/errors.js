// Erro de domínio com status HTTP. Os módulos (xp.js, messages.js…) estendem
// esta classe; o app converte qualquer AppError em resposta JSON num só lugar.

export class AppError extends Error {
  constructor(message, code = 'error', status = 400, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    Object.assign(this, extra);
  }
}

// Corpo de resposta padrão: `{ error, code }`, mais `field` em erro de formulário.
export function errorBody(error) {
  const body = { error: error.message };
  if (error.code && error.code !== 'validation') body.code = error.code;
  if (error.field) body.field = error.field;
  return body;
}
