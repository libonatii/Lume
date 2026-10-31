import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  categoryLabel, describeElapsed, formatPairCode, generatePairCode, matchAllowlist,
  normalizeCategory, normalizePairCode, normalizeProcessName, parseTasklist, presenceState,
} from './public/companion-domain.js';
import { CompanionError, redeemPairCode } from './companion.js';
import { addAllowlistEntry, configPath, readConfig, removeAllowlistEntry, setPaused } from './companion/core.mjs';
import { hashSessionToken } from './auth.js';

const TASKLIST = [
  '"System Idle Process","0","Services","0","8 K"',
  '"chrome.exe","7421","Console","1","210.000 K"',
  '"Code.exe","9981","Console","1","180.000 K"',
  '"Anki.exe","1204","Console","1","90.000 K"',
  'INFO: Nenhuma tarefa em execução.',
].join('\r\n');

test('lê a saída do tasklist e normaliza nomes de processo', () => {
  const processes = parseTasklist(TASKLIST);
  assert.equal(processes.length, 4);
  assert.deepEqual(processes[1], { process: 'chrome', pid: 7421 });
  assert.equal(normalizeProcessName('C:\\Program Files\\Anki\\Anki.EXE'), 'anki');
  assert.equal(normalizeProcessName('  CODE.exe '), 'code');
  assert.equal(normalizeProcessName(''), '');
});

test('a allowlist decide a atividade pela ordem escolhida', () => {
  const processes = parseTasklist(TASKLIST);
  const allowlist = [
    { process: 'anki.exe', label: 'Anki', category: 'study' },
    { process: 'code', label: 'VS Code', category: 'project' },
  ];
  const match = matchAllowlist(processes, allowlist);
  assert.equal(match.label, 'Anki');
  assert.equal(match.category, 'study');
  assert.equal(match.process, 'anki');

  // Fora da lista: nada é reportado, mesmo com o processo aberto.
  assert.equal(matchAllowlist(processes, [{ process: 'obsidian', label: 'Obsidian' }]), null);
  assert.equal(matchAllowlist([], allowlist), null);
  assert.equal(matchAllowlist(processes, [{ process: '', label: 'vazio' }]), null);
});

test('nome exibido e categoria são saneados', () => {
  const match = matchAllowlist([{ process: 'anki' }], [{ process: 'anki', label: '  Anki\n  Mobile  ', category: 'inexistente' }]);
  assert.equal(match.label, 'Anki Mobile');
  assert.equal(match.category, 'other');
  assert.equal(normalizeCategory('game'), 'game');
  assert.equal(categoryLabel('study'), 'Estudo');
});

test('código de conexão é curto, legível e normalizado', () => {
  const code = generatePairCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
  assert.equal(code.length, 8);
  assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(formatPairCode('abcd efgh'), 'ABCD-EFGH');
  assert.equal(normalizePairCode('ab-cd efgh'), 'ABCDEFGH');
  assert.equal(formatPairCode('abc'), 'ABC');
});

test('presença expira sem batimento e mostra o tempo decorrido', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  const active = presenceState({ app: 'Anki', category: 'study', since: '2026-10-31T11:30:00Z', updatedAt: '2026-10-31T11:59:40Z' }, now);
  assert.equal(active.active, true);
  assert.equal(active.app, 'Anki');
  assert.equal(active.categoryLabel, 'Estudo');
  assert.equal(active.elapsed, '30 min');

  const stale = presenceState({ app: 'Anki', category: 'study', since: '2026-10-31T11:30:00Z', updatedAt: '2026-10-31T11:57:00Z' }, now);
  assert.equal(stale.active, false);
  assert.deepEqual(presenceState(null), { active: false });
  assert.equal(describeElapsed(0), 'agora há pouco');
  assert.equal(describeElapsed(90 * 60 * 1000), '1 h 30 min');
  assert.equal(describeElapsed(2 * 60 * 60 * 1000), '2 h');
});

function fakeDb({ codeRow = null, deviceCount = 0, consume = 1 } = {}) {
  const saved = { devices: [], codes: [], presence: [] };
  return {
    saved,
    async run(sql, params) {
      if (sql.includes('DELETE FROM companion_pair_codes')) return 0;
      if (sql.includes('INSERT INTO companion_pair_codes')) { saved.codes.push({ hash: params[0], userId: params[1] }); return 1; }
      if (sql.includes('UPDATE companion_pair_codes')) return consume;
      if (sql.includes('INSERT INTO companion_devices')) { saved.devices.push({ id: params[0], userId: params[1], name: params[2], tokenHash: params[3] }); return 1; }
      return 0;
    },
    async first(sql) {
      if (sql.includes('FROM companion_pair_codes')) return codeRow;
      if (sql.includes('COUNT(*)')) return { total: deviceCount };
      if (sql.includes('FROM companion_devices')) return null;
      return null;
    },
    async all() { return []; },
  };
}

test('pareamento aceita o código uma única vez e valida nome e limite', async () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  const code = 'ABCDEFGH';
  const codeHash = await hashSessionToken(code);
  const validRow = { user_id: 'user_1', expires_at: '2026-10-31T12:10:00Z', used_at: null };

  const db = fakeDb({ codeRow: validRow });
  const result = await redeemPairCode(db, { code: 'abcd efgh', deviceName: 'PC da Ana' }, now);
  assert.ok(result.token.length >= 32);
  assert.equal(result.device.name, 'PC da Ana');
  assert.equal(db.saved.devices[0].userId, 'user_1');
  assert.ok(db.saved.devices[0].tokenHash !== result.token, 'o token não é guardado em claro');

  await assert.rejects(
    () => redeemPairCode(fakeDb({ codeRow: validRow, consume: 0 }), { code, deviceName: 'PC' }, now),
    (error) => error instanceof CompanionError && error.code === 'used_code',
  );
  await assert.rejects(
    () => redeemPairCode(fakeDb({ codeRow: { ...validRow, used_at: '2026-10-31T11:59:00Z' } }), { code, deviceName: 'PC' }, now),
    (error) => error.code === 'used_code',
  );
  await assert.rejects(
    () => redeemPairCode(fakeDb({ codeRow: { ...validRow, expires_at: '2026-10-31T11:00:00Z' } }), { code, deviceName: 'PC' }, now),
    (error) => error.code === 'expired_code',
  );
  await assert.rejects(
    () => redeemPairCode(fakeDb({ codeRow: validRow, deviceCount: 5 }), { code, deviceName: 'PC' }, now),
    (error) => error.code === 'device_limit',
  );
  await assert.rejects(
    () => redeemPairCode(fakeDb({ codeRow: null }), { code, deviceName: 'PC' }, now),
    (error) => error.code === 'invalid_code',
  );
  await assert.rejects(
    () => redeemPairCode(fakeDb({ codeRow: validRow }), { code: 'ABC', deviceName: 'PC' }, now),
    (error) => error.code === 'invalid_code',
  );
  await assert.rejects(
    () => redeemPairCode(fakeDb({ codeRow: validRow }), { code, deviceName: '   ' }, now),
    (error) => error.code === 'missing_device_name',
  );
  assert.ok(codeHash, 'hash disponível para consulta');
});

test('configuração local cria padrões, evita duplicata e respeita pausa', { skip: process.platform !== 'win32' }, () => {
  const directory = mkdtempSync(join(tmpdir(), 'lume-companion-'));
  const previous = process.env.APPDATA;
  process.env.APPDATA = directory;
  try {
    const initial = readConfig();
    assert.ok(initial.allowlist.length > 0);
    assert.equal(initial.paused, false);
    assert.ok(configPath().startsWith(directory), 'não escreve fora do APPDATA de teste');

    assert.equal(addAllowlistEntry('C:\\Apps\\Obsidian.exe', { label: 'Obsidian', category: 'study' }).added, true);
    assert.equal(addAllowlistEntry('obsidian', { label: 'Outro nome' }).added, false, 'duplicata normalizada');
    assert.equal(readConfig().allowlist.at(-1).label, 'Obsidian');

    setPaused(true);
    assert.equal(readConfig().paused, true);
    setPaused(false);
    assert.equal(readConfig().paused, false);

    removeAllowlistEntry('obsidian');
    assert.equal(readConfig().allowlist.some((entry) => entry.process === 'obsidian'), false);
  } finally {
    if (previous === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
