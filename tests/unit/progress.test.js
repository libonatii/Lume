import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { applyMigrations, sqliteAdapter } from '../../api/adapters/sqlite.js';
import { addCourse, completeMission, createInitialState } from '../../public/domain.js';
import { ensureXpSettings, getXpSnapshot } from '../../api/domain/xp.js';
import { applyProgressCommands } from '../../api/domain/commands.js';
import { grantStep } from '../../api/domain/rewards.js';
import { RULES } from '../../api/domain/rewards.js';

const NOW = Date.parse('2026-11-01T12:00:00Z');

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  applyMigrations(sqlite, fileURLToPath(new URL('../../migrations/', import.meta.url)));
  const db = sqliteAdapter(sqlite);
  sqlite.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('u1', 'Ana', 'ana@example.test', 'x', new Date(NOW).toISOString());
  return db;
}

async function saveLibrary(db, state) {
  await db.run(
    `INSERT INTO user_state (user_id, state, updated_at, revision) VALUES ('u1', ?, ?, 1)
     ON CONFLICT(user_id) DO UPDATE SET state = excluded.state`,
    [JSON.stringify(state), new Date(NOW).toISOString()],
  );
}

function library() {
  return addCourse({ ...createInitialState(), onboarded: true }, { title: 'Curso de comandos', steps: ['Aula 1', 'Aula 2'] }, 'c1');
}

const complete = (unitId, extra = {}) => ({ id: `step:${unitId}`, type: 'complete', materialId: 'c1', unitId, origin: 'manual', at: new Date(NOW).toISOString(), ...extra });

test('conclusão por comando concede XP na mesma resposta, uma vez só', async () => {
  const db = makeDb();
  await ensureXpSettings(db, 'u1', { now: NOW - 1000 });
  await saveLibrary(db, library());
  const first = await applyProgressCommands(db, 'u1', { commands: [complete('c1-0')] }, { now: NOW });
  assert.deepEqual(first.results, [{ id: 'step:c1-0', status: 'recorded' }]);
  assert.equal(first.xp.length, 1);
  assert.equal(first.xp[0].kind, 'lesson');
  const again = await applyProgressCommands(db, 'u1', { commands: [complete('c1-0')] }, { now: NOW + 1000 });
  assert.equal(again.results[0].status, 'duplicate');
  assert.equal(again.xp.length, 0);

  // Última aula: a regra de bônus responde ao mesmo gatilho.
  const last = await applyProgressCommands(db, 'u1', { commands: [complete('c1-1')] }, { now: NOW + 2000 });
  assert.deepEqual(last.xp.map((event) => event.kind).sort(), ['course_bonus', 'lesson']);
  assert.equal((await getXpSnapshot(db, 'u1', { now: NOW + 3000 })).summary.totalXP, 700);
});

test('a data declarada só pode atrasar a conclusão, nunca adiantar', async () => {
  const db = makeDb();
  await ensureXpSettings(db, 'u1', { now: NOW - 1000 });
  await saveLibrary(db, library());
  // Data anterior ao marco: vira legado, mesmo chegando agora.
  const old = await applyProgressCommands(db, 'u1', { commands: [complete('c1-0', { at: '2026-01-01T00:00:00Z' })] }, { now: NOW });
  assert.equal(old.results[0].status, 'recorded');
  assert.equal(old.xp.length, 0);
  // Data futura: vale o relógio do servidor.
  const future = await applyProgressCommands(db, 'u1', { commands: [complete('c1-1', { at: '2030-01-01T00:00:00Z' })] }, { now: NOW });
  assert.equal(future.xp.length, 1);
  assert.equal(future.xp[0].at, new Date(NOW).toISOString());
});

test('com comandos, o documento sozinho não concede XP', async () => {
  const db = makeDb();
  await ensureXpSettings(db, 'u1', { now: NOW - 1000 });
  let state = library();
  await saveLibrary(db, state);
  await applyProgressCommands(db, 'u1', { commands: [complete('c1-0')] }, { now: NOW });
  // O navegador escreve uma conclusão no documento sem mandar o comando.
  state = completeMission(state, 'c1', 'c1-1', { now: new Date(NOW).toISOString() }).state;
  await saveLibrary(db, state);
  await assert.rejects(
    () => grantStep(db, 'u1', { courseId: 'c1', stepId: 'c1-1' }, { now: NOW + 1000 }),
    (error) => error.code === 'step_not_completed',
  );
});

test('importação é histórico sem XP; desfazer vale só para registro manual', async () => {
  const db = makeDb();
  await ensureXpSettings(db, 'u1', { now: NOW - 1000 });
  await saveLibrary(db, library());
  const imported = await applyProgressCommands(db, 'u1', { commands: [complete('c1-0', { id: 'import:c1-0', origin: 'import' })] }, { now: NOW });
  assert.equal(imported.xp.length, 0);
  const refused = await applyProgressCommands(db, 'u1', { commands: [{ id: 'import:c1-0', type: 'revert' }] }, { now: NOW });
  assert.equal(refused.results[0].status, 'rejected');
  assert.equal(refused.results[0].code, 'not_revertible');

  await applyProgressCommands(db, 'u1', { commands: [complete('c1-1')] }, { now: NOW });
  const reverted = await applyProgressCommands(db, 'u1', { commands: [{ id: 'step:c1-1', type: 'revert' }] }, { now: NOW + 1000 });
  assert.equal(reverted.results[0].status, 'reverted');
});

test('aula fora da biblioteca e lote vazio são recusados', async () => {
  const db = makeDb();
  await saveLibrary(db, library());
  const missing = await applyProgressCommands(db, 'u1', { commands: [complete('nao-existe')] }, { now: NOW });
  assert.equal(missing.results[0].status, 'rejected');
  assert.equal(missing.results[0].code, 'unit_not_found');
  await assert.rejects(() => applyProgressCommands(db, 'u1', { commands: [] }), (error) => error.code === 'empty_commands');
});

test('preparação não concede XP e as regras declaram gatilho e identidade', async () => {
  const db = makeDb();
  await ensureXpSettings(db, 'u1', { now: NOW - 1000 });
  await saveLibrary(db, library());
  const prepared = await applyProgressCommands(db, 'u1', { commands: [{ id: 'prepare:c1-0', type: 'prepare', materialId: 'c1', unitId: 'c1-0' }] }, { now: NOW });
  assert.equal(prepared.results[0].status, 'recorded');
  assert.equal(prepared.xp.length, 0);
  assert.deepEqual(RULES.map((rule) => `${rule.on}:${rule.id}`), [
    'unit.completed:unit-completion', 'unit.completed:material-completion', 'deck.completed:deck-completion',
  ]);
});
