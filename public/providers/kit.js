// Ferramentas comuns aos adaptadores de provedor. São utilitários, não um
// leitor genérico: cada provedor decide o que ler e como.

export const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// "12:34", "1:02:03", "1h 20min", "45 min" → segundos.
export function toSeconds(text) {
  const value = clean(text).toLowerCase();
  const clock = value.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1] || 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  const hours = value.match(/^(\d+)\s*h(?:\s*(\d+)\s*(?:min|m))?$/);
  if (hours) return Number(hours[1]) * 3600 + Number(hours[2] || 0) * 60;
  const minutes = value.match(/^(\d+)\s*(?:min|mins|minutos?)$/);
  return minutes ? Number(minutes[1]) * 60 : null;
}

// Aplica `task` a cada item, no máximo `limit` por vez, e devolve na ordem.
export async function mapLimited(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function hostMatches(hostname, hosts) {
  const name = String(hostname || '').toLowerCase().replace(/^www\./, '');
  return hosts.some((known) => name === known || name.endsWith(`.${known}`));
}
