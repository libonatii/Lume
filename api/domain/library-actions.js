import { restoreState } from '../../public/domain.js';
import { materialSteps } from '../../public/material-model.js';
import { recordCompletion } from '../../public/progress-domain.js';
import { ACCOUNT_FIELDS } from '../../public/library-actions.js';
import { validateAgenda } from '../../public/agenda-domain.js';
import { AppError } from '../errors.js';
import { readLibrary, commitLibrary } from './library-store.js';
import { ensureXpSettings } from './xp.js';
import { timeStatements } from './library-time.js';
import { RULES } from './rewards.js';
import { XP_POLICY_VERSION, localDay } from '../../public/xp-policy.js';
import { normalizePdfMeta } from '../../public/pdf-domain.js';
import { deleteObjects } from './library-files.js';

const COLLECTIONS = { material: 'courses', task: 'tasks', session: 'studySessions', progress: 'progress', appointment: 'agenda', subject: 'subjects' };
const fail = (message) => { throw new AppError(message, 'invalid_library_action', 400); };

// Recompensas e progresso são gravados no mesmo batch. INSERT OR IGNORE guarda
// a idempotência; a conquista usa o evento realmente persistido pelo banco.
function rewardStatements(userId, state, changed, settings, now) {
  const grants = [];
  const since = Date.parse(settings.eligible_since);
  const at = new Date(now).toISOString();
  const day = localDay(settings.time_zone, new Date(now));
  const keys = new Set();
  for (const course of state.courses) {
    const completions = new Map();
    for (const event of state.progress) {
      if (event.materialId !== course.id || event.type !== 'completion' || event.revertedAt) continue;
      const eligible = !event.historical && ['manual', 'integration'].includes(event.origin);
      const time = eligible && Number.isFinite(Date.parse(event.at)) ? Date.parse(event.at) : -Infinity;
      completions.set(event.unitId, Math.max(completions.get(event.unitId) ?? -Infinity, time));
    }
    const contexts = materialSteps(course).filter((step) => changed.units.has(JSON.stringify([course.id, step.id]))).map((step) => ({ on: 'unit.completed', course, step, completions, since }));
    if (changed.decks.has(course.id)) contexts.push({ on: 'deck.completed', course, since });
    for (const context of contexts) for (const rule of RULES) {
      if (rule.on !== context.on) continue;
      const result = rule.grant(context);
      if (!result.grant || keys.has(result.grant.key)) continue;
      const grant = result.grant;
      keys.add(grant.key);
      grants.push({ ...grant, id: crypto.randomUUID(), achievementId: crypto.randomUUID() });
    }
  }
  if (!grants.length) return [];
  const payload = JSON.stringify(grants);
  return [
    [`INSERT OR IGNORE INTO xp_events (id,user_id,event_key,kind,xp,material_id,material_title,step_id,step_title,session_id,origin,policy_version,local_day,granted_at,meta)
      SELECT json_extract(value,'$.id'),?,json_extract(value,'$.key'),json_extract(value,'$.kind'),json_extract(value,'$.xp'),
        json_extract(value,'$.materialId'),json_extract(value,'$.materialTitle'),json_extract(value,'$.stepId'),json_extract(value,'$.stepTitle'),
        '','manual',?,?,?,json_extract(value,'$.meta') FROM json_each(?)`, [userId, XP_POLICY_VERSION, day, at, payload]],
    [`INSERT OR IGNORE INTO user_achievements (id,user_id,event_id,kind,material_id,material_title,criterion,policy_version,origin,visibility,earned_at)
      SELECT json_extract(g.value,'$.achievementId'),e.user_id,e.id,json_extract(g.value,'$.achievement.kind'),e.material_id,
        json_extract(g.value,'$.achievement.title'),json_extract(g.value,'$.achievement.criterion'),e.policy_version,e.origin,'friends',e.granted_at
      FROM json_each(?) g JOIN xp_events e ON e.user_id=? AND e.event_key=json_extract(g.value,'$.key')
      WHERE json_extract(g.value,'$.achievement') IS NOT NULL`, [payload, userId]],
  ];
}

// PDFs referenciados pelos materiais. Cada arquivo pertence a um material só.
function pdfFiles(state) {
  const ids = new Set();
  for (const course of state.courses) {
    if (!course.pdf) continue;
    if (ids.has(course.pdf.fileId)) fail('Cada PDF pertence a um único material.');
    ids.add(course.pdf.fileId);
  }
  return ids;
}

export async function applyLibraryActions(db, userId, input, { now = Date.now(), media = null } = {}) {
  if (typeof input?.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(input.id)) fail('Operação sem identificador válido.');
  const duplicate = await db.first('SELECT revision FROM library_operations WHERE user_id=? AND id=?', [userId, input.id]);
  if (duplicate) {
    const current = await readLibrary(db, userId);
    return { ...current, duplicate: true };
  }
  if (!Array.isArray(input.actions) || !input.actions.length || input.actions.length > 2000) fail('Envie de 1 a 2000 operações por vez.');
  const current = await readLibrary(db, userId);
  if (input.revision !== current.revision) throw new AppError('A biblioteca mudou. Recarregue os dados antes de repetir a ação.', 'library_conflict', 409);
  let state = structuredClone(current.state);
  const changed = { units: new Set(), decks: new Set() };
  const removedProgress = [];
  for (const action of input.actions) {
    if (action?.type === 'account.update') {
      if (!action.value || typeof action.value !== 'object' || Array.isArray(action.value)) fail('Preferências inválidas.');
      for (const [key, value] of Object.entries(action.value)) {
        if (!ACCOUNT_FIELDS.includes(key)) fail('Campo da conta desconhecido.');
        state[key] = value;
      }
      continue;
    }
    const [entity, verb] = String(action?.type || '').split('.');
    const field = COLLECTIONS[entity];
    if (!field || !['put', 'delete', 'order'].includes(verb) || action.type !== `${entity}.${verb}`) fail('Operação desconhecida.');
    if (verb === 'order') {
      const byId = new Map(state[field].map((item) => [item.id, item]));
      if (!Array.isArray(action.ids) || action.ids.length !== byId.size || new Set(action.ids).size !== byId.size || action.ids.some((id) => !byId.has(id))) fail('Ordem de registros inválida.');
      state[field] = action.ids.map((id) => byId.get(id));
      continue;
    }
    const id = verb === 'put' ? action.value?.id : action.id;
    if (typeof id !== 'string' || !id || id.length > 200) fail('Identificador inválido.');
    const index = state[field].findIndex((item) => item.id === id);
    if (verb === 'delete') {
      if (entity === 'progress' && index >= 0) removedProgress.push(state[field][index]);
      // Remoção de material limpa a projeção, mas nunca apaga o livro de XP.
      state[field] = state[field].filter((item) => item.id !== id);
      continue;
    }
    const value = structuredClone(action.value);
    if (entity === 'material' && (value.type === 'pdf' || value.pdf !== undefined)) {
      const pdf = normalizePdfMeta(value.pdf);
      if (!pdf || value.type !== 'pdf') fail('O PDF do material é inválido.');
      const previousFile = state[field][index]?.pdf?.fileId;
      if (previousFile && previousFile !== pdf.fileId) fail('O arquivo de um PDF não pode ser trocado.');
    }
    if (entity === 'material' && value.slideProgress?.completedAt !== state[field][index]?.slideProgress?.completedAt) {
      if (Number.isFinite(Date.parse(value.slideProgress?.completedAt))) value.slideProgress.completedAt = new Date(Math.min(Date.parse(value.slideProgress.completedAt), now)).toISOString();
      changed.decks.add(id);
    }
    if (entity === 'progress') {
      const old = state[field][index];
      if (old) {
        // Eventos já aceitos são imutáveis, exceto o desfazer manual.
        if (value.revertedAt && !old.revertedAt) {
          if (old.origin !== 'manual') fail('Só uma conclusão manual pode ser desfeita.');
          state[field][index] = { ...old, revertedAt: new Date(now).toISOString() };
        }
        continue;
      }
      delete value.legacyXp;
      value.historical = value.historical === true || ['import', 'legacy'].includes(value.origin);
      value.at = new Date(Number.isFinite(Date.parse(value.at)) ? Math.min(Date.parse(value.at), now) : now).toISOString();
      if (value.type === 'completion') changed.units.add(JSON.stringify([value.materialId, value.unitId]));
    }
    if (index < 0) state[field].push(value); else state[field][index] = value;
  }
  // A conclusão vinculada é aplicada também no servidor: enviar só task.put
  // deve produzir exatamente o mesmo evento de aula que a interface.
  for (const task of state.tasks) {
    const previous = current.state.tasks.find((item) => item.id === task.id);
    if (!task.done || !previous || previous.done || !task.lessonId) continue;
    const course = state.courses.find((item) => item.id === task.courseId);
    const lesson = materialSteps(course).find((item) => item.id === task.lessonId);
    if (!lesson) fail('A aula vinculada não pertence ao material informado.');
    const at = new Date(Math.min(Date.parse(task.completedAt) || now, now)).toISOString();
    const result = recordCompletion(state, { materialId: course.id, unitId: lesson.id, origin: 'manual', at, title: lesson.title, materialTitle: course.title });
    state = result.state;
    if (result.added) changed.units.add(JSON.stringify([course.id, lesson.id]));
  }
  const subjectIds = new Set((state.subjects || []).map((subject) => subject.id));
  if (state.courses.some((course) => course.subjectId && !subjectIds.has(course.subjectId))) fail('A disciplina vinculada não existe.');
  try { validateAgenda(state); } catch (error) { fail(error.message); }
  const normalized = restoreState(state);
  // A leitura de backup tolera itens quebrados; a API não pode confirmar uma
  // edição que descartou aulas silenciosamente ou vinculou progresso a outro curso.
  const owners = new Map();
  for (const course of state.courses) {
    const restored = normalized.courses.find((item) => item.id === course.id);
    if (!restored || restored.units.length !== course.units.length) fail('O material contém aulas inválidas.');
    for (const step of materialSteps(restored)) {
      if (owners.has(step.id)) fail('Cada aula precisa de um identificador único.');
      owners.set(step.id, course.id);
    }
  }
  const existingEvents = new Set(current.state.progress.map((event) => event.id));
  for (const event of normalized.progress) {
    // Um vínculo antigo inconsistente permanece como arquivo histórico; não
    // bloqueia edições alheias nem autoriza criar outro registro inconsistente.
    if (!existingEvents.has(event.id) && owners.get(event.unitId) !== event.materialId) fail('A aula não pertence ao material informado.');
  }
  for (const event of removedProgress) {
    const material = normalized.courses.find((course) => course.id === event.materialId);
    if (materialSteps(material).some((step) => step.id === event.unitId)) fail('Use desfazer para uma conclusão existente; o histórico não pode ser apagado.');
  }
  // A restauração tolerante é adequada para arquivos antigos, mas uma mutação
  // inválida deve ser recusada, não aceita depois de descartar seu conteúdo.
  for (const field of Object.values(COLLECTIONS)) {
    if (normalized[field].length !== state[field].length) fail('A operação contém registros inválidos ou referências ausentes.');
  }
  // Um material novo só aponta para um PDF que esta conta enviou; excluir o
  // material libera o arquivo e a cota no mesmo batch.
  const filesBefore = pdfFiles(current.state);
  const filesAfter = pdfFiles(normalized);
  const added = [...filesAfter].filter((id) => !filesBefore.has(id));
  if (added.length) {
    const known = new Set((await db.all('SELECT id FROM library_files WHERE user_id=?', [userId])).map((row) => row.id));
    if (added.some((id) => !known.has(id))) fail('O PDF não foi encontrado. Envie o arquivo de novo.');
  }
  const removed = [...filesBefore].filter((id) => !filesAfter.has(id));
  const fileStatements = removed.length ? [['DELETE FROM library_files WHERE user_id=? AND id IN (SELECT value FROM json_each(?))', [userId, JSON.stringify(removed)]]] : [];
  const settings = await ensureXpSettings(db, userId, { now });
  const committed = await commitLibrary(db, userId, current.state, normalized, {
    revision: current.revision, operationId: input.id, now,
    extra: [...rewardStatements(userId, normalized, changed, settings, now), ...await timeStatements(db, userId, normalized, settings, now), ...fileStatements],
  });
  if (removed.length && !committed.duplicate) await deleteObjects(media, userId, removed);
  return readLibrary(db, userId);
}
