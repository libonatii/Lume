// Gera public/news-generated.js com as novidades do sino a partir do histórico
// do Git: todo commit com uma linha "Novidade: Título | Texto | #rota | área" (área: site, desktop ou extensao); linhas "Detalhe: texto" no mesmo corpo viram a lista detalhada da página de novidades no corpo
// vira um aviso (data = data do commit). Sem Git disponível, o arquivo atual
// é mantido. Roda no `npm run build`.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const FILE = new URL('../public/news-generated.js', import.meta.url);
let raw;
try {
  raw = execFileSync('git', ['log', '-n', '60', '--format=%H%x1f%cI%x1f%B%x1e'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch {
  console.log('news: Git indisponível; mantendo public/news-generated.js');
  process.exit(0);
}

const items = [];
for (const record of raw.split('\x1e')) {
  const [hash, at, body] = record.trim().split('\x1f');
  const lines = body?.split('\n').map((l) => l.trim()) || [];
  const line = lines.find((l) => /^Novidade:/i.test(l));
  const details = lines.filter((l) => /^Detalhe:/i.test(l)).map((l) => l.replace(/^Detalhe:\s*/i, '')).filter(Boolean);
  if (!hash || !line) continue;
  const [title, text = '', href = '#hoje', area = 'site'] = line.replace(/^\s*Novidade:/i, '').split('|').map((s) => s.trim());
  if (!title) continue;
  items.push({ id: `news-${hash.slice(0, 8)}`, at: new Date(at).toISOString(), title, body: text, href: href.startsWith('#') ? href : '#hoje', area: area.toLowerCase(), ...(details.length && { details }) });
}

const out = `// GERADO por scripts/build-news.mjs a partir de commits com "Novidade:". Não edite.\nexport const GENERATED_NEWS = ${JSON.stringify(items, null, 2)};\n`;
writeFileSync(FILE, out);
console.log(`news: ${items.length} novidade(s)`);
