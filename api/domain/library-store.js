// Persistência da biblioteca no servidor. Nenhuma leitura migra documentos
// antigos: formatos incompatíveis são recusados e permanecem no banco.
import { createInitialState, restoreState, STATE_VERSION } from '../../public/domain.js';
import { splitMaterial, projectMaterial } from '../../public/material-model.js';
import { AppError } from '../errors.js';
import { reconcileSession } from '../../public/session-domain.js';

const COLLECTIONS = { progress: 'study_progress', tasks: 'study_tasks', studySessions: 'study_sessions', agenda: 'agenda_entries', subjects: 'study_subjects' };
const json = JSON.stringify;

function documentOf(state) {
  const { courses, progress, tasks, studySessions, agenda, subjects, ...document } = state;
  return document;
}

function materialStatements(userId, course, position) {
  const { material, units } = splitMaterial(course);
  return [
    ['INSERT INTO materials (user_id,id,position,data) VALUES (?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET position=excluded.position,data=excluded.data', [userId, course.id, position, json(material)]],
    ['DELETE FROM units WHERE user_id=? AND material_id=?', [userId, course.id]],
    // Uma instrução por material, não uma chamada D1 por aula. json_each evita
    // ultrapassar o limite de parâmetros de SQL com grades grandes.
    [`INSERT INTO units (user_id,material_id,id,parent_id,kind,position,selected,data)
      SELECT ?,?,json_extract(value,'$.id'),json_extract(value,'$.parentId'),json_extract(value,'$.kind'),
        json_extract(value,'$.position'),json_extract(value,'$.selected'),json_extract(value,'$.data') FROM json_each(?)`,
    [userId, course.id, json(units)]],
  ];
}

function collectionStatement(userId, field, records) {
  const table = COLLECTIONS[field];
  const progress = field === 'progress';
  return [`INSERT INTO ${table} (user_id,id,${progress ? 'material_id,unit_id,' : ''}position,data)
    SELECT ?,json_extract(value,'$.item.id'),${progress ? "json_extract(value,'$.item.materialId'),json_extract(value,'$.item.unitId')," : ''}
      json_extract(value,'$.position'),json_extract(value,'$.item') FROM json_each(?) WHERE 1
    ON CONFLICT(user_id,id) DO UPDATE SET position=excluded.position,data=excluded.data`, [userId, json(records)]];
}

export function libraryStatements(userId, previous, next) {
  const statements = [];
  const oldCourses = new Map((previous.courses || []).map((course, index) => [course.id, { course, index }]));
  next.courses.forEach((course, index) => {
    const old = oldCourses.get(course.id);
    if (!old || old.index !== index || json(old.course) !== json(course)) statements.push(...materialStatements(userId, course, index));
    oldCourses.delete(course.id);
  });
  for (const id of oldCourses.keys()) statements.push(['DELETE FROM materials WHERE user_id=? AND id=?', [userId, id]]);
  for (const [field, table] of Object.entries(COLLECTIONS)) {
    const old = new Map((previous[field] || []).map((item, index) => [item.id, { item, index }]));
    const changed = [];
    (next[field] || []).forEach((item, index) => {
      const existing = old.get(item.id);
      if (!existing || existing.index !== index || json(existing.item) !== json(item)) changed.push({ item, position: index });
      old.delete(item.id);
    });
    if (changed.length) statements.push(collectionStatement(userId, field, changed));
    if (old.size) statements.push([`DELETE FROM ${table} WHERE user_id=? AND id IN (SELECT value FROM json_each(?))`, [userId, json([...old.keys()])]]);
  }
  return statements;
}

export async function ensureLibrary(db, userId) {
  if (await db.first('SELECT user_id FROM account_documents WHERE user_id=?', [userId])) return;
  // Conta com documento antigo entra com biblioteca vazia: o conteúdo antigo não
  // é convertido, mas a linha de user_state permanece intacta como arquivo.
  const old = await db.first('SELECT revision FROM user_state WHERE user_id=?', [userId]);
  const state = createInitialState();
  const statements = [
    ['INSERT INTO library_write_guards (user_id,valid) VALUES (?,CASE WHEN COALESCE((SELECT revision FROM user_state WHERE user_id=?),0)=? THEN 1 ELSE 0 END)', [userId, userId, old?.revision || 0]],
    ['INSERT INTO account_documents (user_id,data,revision,updated_at) VALUES (?,?,1,?)', [userId, json(documentOf(state)), new Date().toISOString()]],
    ...libraryStatements(userId, { courses: [] }, state),
    ["INSERT INTO progress_accounts (user_id,mode,updated_at) VALUES (?,'commands',?) ON CONFLICT(user_id) DO UPDATE SET mode='commands',updated_at=excluded.updated_at", [userId, new Date().toISOString()]],
    ['DELETE FROM library_write_guards WHERE user_id=?', [userId]],
  ];
  try { await db.batch(statements); }
  catch (error) {
    // Outra requisição pode ter inicializado a conta; o batch impede que uma
    // segunda inicialização sobrescreva qualquer material já editado.
    if (await db.first('SELECT user_id FROM account_documents WHERE user_id=?', [userId])) return;
    throw error;
  }
}

// Leitura compartilhada. Documentos só são lidos se já estiverem no contrato
// atual; não há conversão nem fallback sobre uma biblioteca existente.
export async function readStoredLibrary(db, userId) {
  if (await db.first('SELECT user_id FROM account_documents WHERE user_id=?', [userId])) return readLibrary(db, userId);
  const row = await db.first('SELECT state,revision,updated_at FROM user_state WHERE user_id=?', [userId]);
  if (!row?.state) return { state: null, revision: 0, updatedAt: null };
  const state = JSON.parse(row.state);
  if (state.version !== STATE_VERSION) return { state: null, revision: 0, updatedAt: null };
  return { state: restoreState(state), revision: row.revision, updatedAt: row.updated_at };
}

export async function readLibrary(db, userId) {
  // Se uma escrita ocorrer durante a leitura, refaz a projeção. Não devolve
  // metade de uma revisão junto com metade da seguinte.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let document = await db.first('SELECT * FROM account_documents WHERE user_id=?', [userId]);
    if (!document) {
      await ensureLibrary(db, userId);
      document = await db.first('SELECT * FROM account_documents WHERE user_id=?', [userId]);
    }
    if (JSON.parse(document.data).version !== STATE_VERSION) throw new AppError('Formato de biblioteca incompatível. Os dados existentes foram preservados.', 'library_format_unsupported', 409);
    // Cada consulta ao D1 é uma ida e volta à rede: as independentes rodam juntas.
    const [materials, units, ...collections] = await Promise.all([
      db.all('SELECT * FROM materials WHERE user_id=? ORDER BY position', [userId]),
      db.all('SELECT * FROM units WHERE user_id=? ORDER BY position', [userId]),
      ...Object.values(COLLECTIONS).map((table) => db.all(`SELECT data FROM ${table} WHERE user_id=? ORDER BY position`, [userId])),
    ]);
    const state = { ...createInitialState(), ...JSON.parse(document.data), courses: materials.map((row) => projectMaterial(JSON.parse(row.data), units.filter((unit) => unit.material_id === row.id).map((unit) => ({ id: unit.id, parentId: unit.parent_id, kind: unit.kind, position: unit.position, selected: Boolean(unit.selected), data: JSON.parse(unit.data) })))) };
    Object.keys(COLLECTIONS).forEach((field, index) => { state[field] = collections[index].map((row) => JSON.parse(row.data)); });
    const latest = await db.first('SELECT revision FROM account_documents WHERE user_id=?', [userId]);
    if (latest.revision === document.revision) return { state: reconcileSession(state), revision: document.revision, updatedAt: document.updated_at };
  }
  throw new AppError('A biblioteca mudou durante a leitura. Tente novamente.', 'library_busy', 409);
}

export async function commitLibrary(db, userId, previous, next, { revision, operationId, extra = [], now = Date.now() }) {
  const updatedAt = new Date(now).toISOString();
  const statements = [
    ['INSERT INTO library_write_guards (user_id,valid) SELECT ?, CASE WHEN revision=? THEN 1 ELSE 0 END FROM account_documents WHERE user_id=?', [userId, revision, userId]],
    ...libraryStatements(userId, previous, next),
    ...extra,
    ['UPDATE account_documents SET data=?,revision=revision+1,updated_at=? WHERE user_id=?', [json(documentOf(next)), updatedAt, userId]],
    ['INSERT INTO library_operations (user_id,id,revision) VALUES (?,?,?)', [userId, operationId, revision + 1]],
    ['DELETE FROM library_write_guards WHERE user_id=?', [userId]],
  ];
  try { await db.batch(statements); }
  catch (error) {
    const duplicate = await db.first('SELECT revision FROM library_operations WHERE user_id=? AND id=?', [userId, operationId]);
    if (duplicate) return { revision: duplicate.revision, duplicate: true };
    const current = await db.first('SELECT revision FROM account_documents WHERE user_id=?', [userId]);
    if (current?.revision !== revision) throw new AppError('A biblioteca mudou. Recarregue os dados antes de repetir a ação.', 'library_conflict', 409);
    throw error;
  }
  return { revision: revision + 1, updatedAt };
}
