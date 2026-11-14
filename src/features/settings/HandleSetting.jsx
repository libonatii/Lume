import { useEffect, useState } from 'react';
import { api, apiError } from '../../lib/api.js';
import { Button } from '../../ui/ui.jsx';
import HandleField from '../account/HandleField.jsx';
import { invalidateResources } from '../../lib/resources.js';

// @usuário em Configurações: mostra o atual, confere a disponibilidade de um novo
// e só então grava. É por ele que amigos encontram a pessoa na aba Amigos.
export default function HandleSetting({ notify }) {
  const [current, setCurrent] = useState(null);
  const [value, setValue] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api('/api/friends/handle').then((result) => {
      if (!live) return;
      if (!result.ok) { setError(apiError(result)); setCurrent(''); return; }
      setCurrent(result.data.handle || '');
      setValue(result.data.handle || '');
    }).catch(() => { if (live) { setError('Não foi possível carregar seu @usuário.'); setCurrent(''); } });
    return () => { live = false; };
  }, []);

  async function save(event) {
    event.preventDefault();
    if (busy || !ok || value === current) return;
    setBusy(true); setError('');
    try {
      const result = await api('/api/friends/handle', { method: 'PUT', body: { handle: value } });
      if (!result.ok) throw new Error(apiError(result));
      setCurrent(result.data.handle);
      setValue(result.data.handle);
      invalidateResources('/api/friends');
      notify(`Seu @usuário agora é @${result.data.handle}.`);
    } catch (exception) { setError(exception.message); } finally { setBusy(false); }
  }

  return <form className="cfg-block" onSubmit={save}>
    <h3>Seu @usuário</h3>
    <p className="cfg-sub">É por ele que seus amigos encontram você na aba Amigos. {current === '' ? 'Você ainda não escolheu um.' : 'Você pode trocar quando quiser; o antigo fica livre para outras pessoas.'}</p>
    {current !== null && <>
      <label className="field" htmlFor="cfg-handle"><span className="sr-only">@usuário</span>
        <HandleField id="cfg-handle" value={value} onChange={setValue} current={current || ''} onStatus={setOk} disabled={busy}/>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" secondary disabled={busy || !ok || value === current}>{current ? 'Salvar novo @usuário' : 'Salvar @usuário'}</Button>
    </>}
  </form>;
}
