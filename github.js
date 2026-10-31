// Leitura pública de um repositório GitHub escolhido pela pessoa.
//
// Esta primeira versão não conecta a conta nem guarda token do usuário: lê
// apenas repositórios públicos pela API do GitHub. Por isso a interface diz
// "leitura pública", não "conexão verificada". Issues e milestones viram
// sugestões de entrega; nada é marcado como concluído automaticamente e nenhum
// comentário, issue ou código é alterado.

export class GitHubError extends Error {
  constructor(message, code = 'github_error', status = 422) {
    super(message);
    this.name = 'GitHubError';
    this.code = code;
    this.status = status;
  }
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

export function parseGitHubRepoUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    throw new GitHubError('Cole o endereço de um repositório público do GitHub.', 'invalid_url', 400);
  }
  if (url.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) {
    throw new GitHubError('Use um link https://github.com/dono/repositorio.', 'invalid_host', 400);
  }
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length < 2) throw new GitHubError('O link precisa incluir o dono e o repositório.', 'invalid_repo', 400);
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!OWNER.test(owner) || !REPO.test(repo) || ['.', '..'].includes(repo)) {
    throw new GitHubError('Dono ou repositório inválido.', 'invalid_repo', 400);
  }
  return { owner, repo, url: `https://github.com/${owner}/${repo}` };
}

function apiHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Lume',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function trimText(value, limit) {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function readmeSummary(markdown) {
  const text = String(markdown ?? '').replace(/\r\n/g, '\n');
  const headings = text.split('\n')
    .filter((line) => /^#{1,3}\s+\S/.test(line))
    .map((line) => line.replace(/^#{1,3}\s+/, '').trim())
    .slice(0, 8);
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { headings, excerpt: trimText(plain, 900) };
}

export function deliverySuggestions({ issues = [], milestones = [] }) {
  const suggestions = [];
  for (const milestone of milestones.slice(0, 8)) {
    if (!milestone?.title) continue;
    suggestions.push({
      id: `milestone-${milestone.number}`,
      title: trimText(milestone.title, 140),
      reason: 'Marco aberto no repositório',
      source: 'milestone',
      number: milestone.number,
      dueOn: milestone.due_on || null,
    });
  }
  for (const issue of issues.slice(0, 20)) {
    if (!issue?.title || issue.pull_request) continue;
    suggestions.push({
      id: `issue-${issue.number}`,
      title: trimText(issue.title, 140),
      reason: 'Issue aberta no repositório',
      source: 'issue',
      number: issue.number,
      labels: Array.isArray(issue.labels) ? issue.labels.map((label) => label?.name).filter(Boolean).slice(0, 5) : [],
    });
  }
  return suggestions.slice(0, 12);
}

async function githubFetch(fetchImpl, url, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetchImpl(url, { headers: apiHeaders(token), signal: controller.signal });
    if (response.status === 404) throw new GitHubError('Este repositório não é público ou não existe.', 'repo_not_public', 404);
    if (response.status === 403) {
      const remaining = response.headers?.get?.('x-ratelimit-remaining');
      throw new GitHubError(remaining === '0'
        ? 'O limite público do GitHub foi atingido agora. Tente mais tarde.'
        : 'O GitHub recusou a leitura deste repositório.', 'github_forbidden', 429);
    }
    if (!response.ok) throw new GitHubError(`O GitHub respondeu com erro ${response.status}.`, 'github_error', 502);
    return response;
  } catch (error) {
    if (error instanceof GitHubError) throw error;
    if (error.name === 'AbortError') throw new GitHubError('O GitHub demorou para responder. Tente de novo.', 'timeout', 504);
    throw new GitHubError('Não foi possível falar com o GitHub agora.', 'network_error', 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeRepository(value, { fetchImpl = fetch, token = '', now = Date.now() } = {}) {
  const repo = parseGitHubRepoUrl(value);
  const metaResponse = await githubFetch(fetchImpl, `https://api.github.com/repos/${repo.owner}/${repo.repo}`, token);
  const meta = await metaResponse.json();
  if (!meta || meta.private === true) throw new GitHubError('Este repositório não é público.', 'repo_not_public', 403);

  const readmeResponse = await fetchImpl(`https://api.github.com/repos/${repo.owner}/${repo.repo}/readme`, {
    headers: { ...apiHeaders(token), Accept: 'application/vnd.github.raw+json' },
  }).catch(() => null);
  const readmeText = readmeResponse?.ok ? await readmeResponse.text().catch(() => '') : '';
  const [issuesResponse, milestonesResponse] = await Promise.all([
    githubFetch(fetchImpl, `https://api.github.com/repos/${repo.owner}/${repo.repo}/issues?state=open&sort=updated&per_page=30`, token),
    githubFetch(fetchImpl, `https://api.github.com/repos/${repo.owner}/${repo.repo}/milestones?state=open&sort=due_on&direction=asc&per_page=20`, token),
  ]);
  const issues = await issuesResponse.json();
  const milestones = await milestonesResponse.json();
  const summary = readmeSummary(readmeText);

  return {
    repository: {
      owner: repo.owner,
      name: meta.name || repo.repo,
      fullName: meta.full_name || `${repo.owner}/${repo.repo}`,
      url: meta.html_url || repo.url,
      description: trimText(meta.description || '', 400),
      private: false,
      language: meta.language || '',
      stars: Number(meta.stargazers_count || 0),
      defaultBranch: meta.default_branch || '',
      updatedAt: meta.updated_at || null,
    },
    readme: summary,
    issues: (Array.isArray(issues) ? issues : []).filter((issue) => !issue.pull_request).slice(0, 20).map((issue) => ({
      number: issue.number,
      title: trimText(issue.title, 180),
      labels: (issue.labels || []).map((label) => label?.name).filter(Boolean).slice(0, 5),
      milestone: issue.milestone?.title || '',
      updatedAt: issue.updated_at || null,
      url: issue.html_url || '',
    })),
    milestones: (Array.isArray(milestones) ? milestones : []).slice(0, 12).map((milestone) => ({
      number: milestone.number,
      title: trimText(milestone.title, 180),
      dueOn: milestone.due_on || null,
      openIssues: Number(milestone.open_issues || 0),
      closedIssues: Number(milestone.closed_issues || 0),
    })),
    suggestions: deliverySuggestions({ issues: Array.isArray(issues) ? issues : [], milestones: Array.isArray(milestones) ? milestones : [] }),
    capabilities: {
      account: false,
      readPosition: false,
      observeCompletion: false,
      write: false,
      label: 'Leitura pública; nenhuma ação é feita no GitHub',
    },
    analyzedAt: new Date(now).toISOString(),
    warnings: [
      'Issues e milestones são sugestões, não provas de aprendizado ou de conclusão.',
      'O Lume não comenta, abre issues, altera código nem recebe acesso ao repositório.',
    ],
  };
}
