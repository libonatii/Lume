export async function api(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(path, {
    method, signal, credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

export function apiError(result) {
  return result.data?.error || 'Não foi possível concluir agora. Confira a conexão e tente de novo.';
}
