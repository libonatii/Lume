import { useEffect, useId, useState } from 'react';
import { api } from '../../lib/api.js';

// Campo de @usuário com conferência de disponibilidade enquanto a pessoa digita.
// Usado no cadastro e em Configurações. `current` é o @usuário que já é dela.
export function cleanHandle(value) {
  return String(value ?? '').replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24);
}

export default function HandleField({ value, onChange, current = '', onStatus, disabled = false, id }) {
  const fallbackId = useId();
  const fieldId = id || fallbackId;
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  useEffect(() => {
    let live = true;
    const handle = cleanHandle(value);
    const publish = (next) => { if (live) { setStatus(next); onStatus?.(next.state === 'ok'); } };
    if (!handle) { publish({ state: 'idle', message: '' }); return undefined; }
    if (current && handle === current) { publish({ state: 'ok', message: 'Este é o seu @usuário atual.' }); return undefined; }
    if (handle.length < 3) { publish({ state: 'idle', message: 'Use pelo menos 3 caracteres.' }); return undefined; }
    setStatus({ state: 'checking', message: 'Conferindo disponibilidade…' });
    onStatus?.(false);
    const timer = setTimeout(async () => {
      try {
        const result = await api(`/api/handle/check?handle=${encodeURIComponent(handle)}`);
        if (!result.ok) throw new Error('indisponível');
        publish(result.data.available ? { state: 'ok', message: `@${handle} está disponível.` } : { state: 'bad', message: result.data.message });
      } catch {
        publish({ state: 'idle', message: 'Não foi possível conferir agora. Tente de novo em instantes.' });
      }
    }, 400);
    return () => { live = false; clearTimeout(timer); };
  }, [value, current]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>
    <span className="input-icon handle-input">
      <span className="handle-at" aria-hidden="true">@</span>
      <input id={fieldId} name="handle" value={value} onChange={(event) => onChange(cleanHandle(event.target.value))} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={25}
        placeholder="seu.usuario" disabled={disabled} aria-describedby={`${fieldId}-status`} aria-invalid={status.state === 'bad'}/>
    </span>
    <span id={`${fieldId}-status`} className={`handle-status ${status.state}`} aria-live="polite">{status.message || 'De 3 a 24 letras minúsculas, números, ponto ou sublinhado.'}</span>
  </>;
}
