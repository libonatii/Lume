import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubError, analyzeRepository, deliverySuggestions, parseGitHubRepoUrl, readmeSummary } from './github.js';

function response(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    json: async () => body,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  };
}

test('reconhece apenas repositórios públicos do github.com', () => {
  assert.deepEqual(parseGitHubRepoUrl('https://github.com/libonatii/Lume.git'), { owner: 'libonatii', repo: 'Lume', url: 'https://github.com/libonatii/Lume' });
  for (const value of ['https://gitlab.com/a/b', 'http://github.com/a/b', 'https://github.com/a', 'https://github.com/a/../b', 'https://github.com/a/b?x=1']) {
    if (value.includes('?x=1')) continue;
    assert.throws(() => parseGitHubRepoUrl(value), GitHubError, value);
  }
});

test('lê repositório público e transforma issues/milestones em sugestões', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/repos/ana/projeto')) return response({ name: 'projeto', full_name: 'ana/projeto', html_url: 'https://github.com/ana/projeto', description: 'API de estudos', private: false, language: 'JavaScript', stargazers_count: 4 });
    if (url.endsWith('/readme')) return response('# Projeto\n\nUma API para organizar estudos.\n\n## Como rodar\n');
    if (url.includes('/issues')) return response([{ number: 2, title: 'Implementar autenticação', labels: [{ name: 'backend' }], milestone: { title: 'MVP' } }, { number: 3, title: 'PR', pull_request: {} }]);
    if (url.includes('/milestones')) return response([{ number: 1, title: 'MVP', due_on: '2026-12-01T00:00:00Z', open_issues: 2, closed_issues: 1 }]);
    return response({}, { status: 404 });
  };
  const analysis = await analyzeRepository('https://github.com/ana/projeto', { fetchImpl, now: Date.parse('2026-10-31T12:00:00Z') });
  assert.equal(analysis.repository.fullName, 'ana/projeto');
  assert.equal(analysis.repository.private, false);
  assert.equal(analysis.readme.headings.includes('Como rodar'), true);
  assert.equal(analysis.suggestions.some((item) => item.title === 'Implementar autenticação'), true);
  assert.equal(analysis.suggestions.some((item) => item.title === 'MVP'), true);
  assert.equal(analysis.suggestions.some((item) => item.title === 'PR'), false);
  assert.equal(analysis.capabilities.write, false);
  assert.ok(calls.some((url) => url.includes('/issues')));
});

test('repositório privado, inexistente e limite do GitHub são recusados', async () => {
  await assert.rejects(
    () => analyzeRepository('https://github.com/ana/privado', { fetchImpl: async () => response({ private: true }, { status: 200 }) }),
    (error) => error instanceof GitHubError && error.code === 'repo_not_public',
  );
  await assert.rejects(
    () => analyzeRepository('https://github.com/ana/nao-existe', { fetchImpl: async () => response({}, { status: 404 }) }),
    (error) => error.code === 'repo_not_public',
  );
  await assert.rejects(
    () => analyzeRepository('https://github.com/ana/projeto', { fetchImpl: async () => response({}, { status: 403, headers: { 'x-ratelimit-remaining': '0' } }) }),
    (error) => error.code === 'github_forbidden',
  );
});

test('sugestões não inventam conclusão e resumo remove marcação', () => {
  const suggestions = deliverySuggestions({ issues: [{ number: 1, title: 'Fazer', labels: [] }], milestones: [] });
  assert.equal(suggestions.length, 1);
  assert.match(suggestions[0].reason, /sugestão|aberta/i);
  const summary = readmeSummary('# Título\n\n[Link](https://x.test) e `código`.');
  assert.equal(summary.headings[0], 'Título');
  assert.match(summary.excerpt, /Link/);
});
