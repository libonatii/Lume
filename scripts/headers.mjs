import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Autoriza somente os scripts/estilos inline exatos emitidos pelo Astro.
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const hash = value => `'sha256-${createHash('sha256').update(value).digest('base64')}'`;
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(match => !/\bsrc=/.test(match[1])).map(match => hash(match[2]));
const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => hash(match[1]));
const csp = `default-src 'self'; script-src 'self' ${[...new Set(scripts)].join(' ')}; style-src 'self' ${[...new Set(styles)].join(' ')}; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
writeFileSync(new URL('../dist/_headers', import.meta.url), `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Cache-Control: no-store\n`);
