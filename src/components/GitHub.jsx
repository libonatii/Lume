import { useState } from 'react';
import { addMaterial } from '../../public/domain.js';
import { api, apiError } from '../lib/api.js';
import Icon from './Icon.jsx';
import { Button, Empty, Heading } from './ui.jsx';

export default function GitHub({ state, update, account, notify, go }) {
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function analyze(event) {
    event.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError('');
    setAnalysis(null);
    try {
      const result = await api('/api/github/analyze', { method: 'POST', body: { url: url.trim() } });
      if (!result.ok) throw new Error(apiError(result));
      setAnalysis(result.data);
      setSelected(new Set((result.data.suggestions || []).slice(0, 6).map((item) => item.id)));
    } catch (exception) {
      setError(exception.message);
    } finally {
      setBusy(false);
    }
  }

  function toggle(id) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function createProject() {
    if (!analysis) return;
    const chosen = (analysis.suggestions || []).filter((item) => selected.has(item.id));
    if (!chosen.length) { setError('Escolha pelo menos uma sugestão de entrega.'); return; }
    try {
      const next = addMaterial(state, {
        title: analysis.repository.name,
        url: analysis.repository.url,
        type: 'project',
        steps: chosen.map((item) => item.title),
        planning: false,
      }, 'manual');
      const courseId = next.selectedCourseId;
      const withGithub = {
        ...next,
        courses: next.courses.map((course) => course.id === courseId ? {
          ...course,
          github: {
            owner: analysis.repository.owner,
            name: analysis.repository.name,
            fullName: analysis.repository.fullName,
            url: analysis.repository.url,
            analyzedAt: analysis.analyzedAt,
            suggestions: chosen.map((item) => ({ id: item.id, title: item.title, source: item.source })),
          },
        } : course),
      };
      update(withGithub);
      notify('Projeto criado com as entregas escolhidas. Analisar e cadastrar não gera XP.');
      go('biblioteca');
    } catch (exception) {
      setError(exception.message);
    }
  }

  if (!account) return <div className="personal-root">
    <Heading eyebrow="Leitura pública, sem token" title="GitHub">A análise pública exige uma conta para guardar o projeto na sua biblioteca.</Heading>
    <Empty title="Entre para usar o GitHub.">O Lume não pede seu token nem acessa repositórios privados nesta etapa.</Empty>
    <Button onClick={() => go('login')}><Icon name="lock"/>Entrar na minha conta</Button>
  </div>;

  return <div className="personal-root github-root">
    <Heading eyebrow="Integrações · leitura pública" title="GitHub">
      Cole um repositório público. O Lume lê README, issues e milestones abertos e sugere entregas; não comenta, não altera código e não recebe acesso à sua conta.
    </Heading>
    <p className="inline-note"><Icon name="shield"/><span>Esta é uma leitura pública, não uma conexão OAuth. Repositórios privados não são acessados. Issues e milestones são sugestões, nunca prova de conclusão ou de aprendizado.</span></p>

    <form className="card-surface github-form" onSubmit={analyze}>
      <label className="field">Link do repositório público
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/dono/repositorio" inputMode="url" maxLength={2000} autoComplete="off"/>
      </label>
      <Button type="submit" disabled={busy || !url.trim()}><Icon name="search"/>{busy ? 'Lendo o GitHub…' : 'Analisar repositório'}</Button>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}

    {analysis && <div className="github-result">
      <section className="card-surface github-repo-card">
        <span className="eyebrow">Repositório público</span>
        <h2 className="title">{analysis.repository.fullName}</h2>
        <p className="muted-text">{analysis.repository.description || 'Sem descrição publicada.'}</p>
        <div className="github-meta">
          <span><Icon name="code"/>{analysis.repository.language || 'Linguagem não informada'}</span>
          <span><Icon name="spark"/>{analysis.repository.stars} estrelas</span>
          <a className="text-link" href={analysis.repository.url} target="_blank" rel="noopener noreferrer">Abrir no GitHub<Icon name="external"/></a>
        </div>
        {analysis.readme.headings.length > 0 && <p className="quiet-note">Tópicos do README: {analysis.readme.headings.join(' · ')}</p>}
      </section>

      <section className="card-surface settings-panel">
        <div className="panel-title"><span className="pace-icon"><Icon name="flag"/></span><div><h2 className="title">Sugestões de entrega</h2><p className="muted-text">Escolha o que quer acompanhar. Você define o que significa concluir cada entrega; o GitHub não faz isso por você.</p></div></div>
        {analysis.suggestions.length === 0 && <p className="inline-note"><Icon name="help"/><span>Nenhuma issue ou milestone aberto encontrado. Você pode criar um projeto manual na Biblioteca.</span></p>}
        {analysis.suggestions.length > 0 && <ul className="github-suggestion-list">
          {analysis.suggestions.map((item) => <li key={item.id}>
            <label className="github-suggestion">
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)}/>
              <span>
                <strong>{item.title}</strong>
                <small>{item.reason}{item.labels?.length ? ` · ${item.labels.join(', ')}` : ''}{item.dueOn ? ` · prazo ${new Date(item.dueOn).toLocaleDateString('pt-BR')}` : ''}</small>
              </span>
            </label>
          </li>)}
        </ul>}
        <Button onClick={createProject} disabled={!selected.size}><Icon name="plus"/>Criar projeto com {selected.size} {selected.size === 1 ? 'entrega' : 'entregas'}</Button>
        <p className="quiet-note">Criar o projeto não gera XP. Concluir uma entrega elegível vale 150 XP, uma única vez, validado no servidor.</p>
      </section>

      <details className="legacy-details">
        <summary>O que esta leitura não faz</summary>
        <ul className="ranking-rule-list">
          {analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          <li>Não lê código, commits ou quantidade de linhas como prova de estudo.</li>
          <li>Não acessa repositórios privados, issues fechadas ou dados de outros repositórios.</li>
        </ul>
      </details>
    </div>}
  </div>;
}
