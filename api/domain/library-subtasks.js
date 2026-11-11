// Planeja o XP de subtarefas para o mesmo batch da biblioteca (decisão de
// 11/11/2026). Vale a passagem de "aberta" para "concluída" dentro do batch;
// a chave por tarefa e subtarefa impede repetir ao desmarcar, marcar de novo
// ou renomear. O teto diário limita o que o texto livre permite acumular.
import { DAILY_SUBTASK_XP_CAP, XP_POLICY_VERSION, XP_VALUES, localDay, subtaskEventKey } from '../../public/xp-policy.js';

export async function subtaskStatements(db, userId, before, after, settings, now) {
  if (now < Date.parse(settings.eligible_since)) return [];
  const wasDone = new Set();
  for (const task of before.tasks || []) {
    for (const item of task.subtasks || []) if (item.done) wasDone.add(subtaskEventKey(task.id, item.id));
  }
  const candidates = [];
  for (const task of after.tasks || []) {
    for (const item of task.subtasks || []) {
      const key = subtaskEventKey(task.id, item.id);
      if (item.done && !wasDone.has(key)) candidates.push({ task, item, key });
    }
  }
  if (!candidates.length) return [];
  const keys = JSON.stringify(candidates.map((candidate) => candidate.key));
  const granted = new Set((await db.all('SELECT event_key FROM xp_events WHERE user_id=? AND event_key IN (SELECT value FROM json_each(?))', [userId, keys])).map((row) => row.event_key));
  const day = localDay(settings.time_zone, new Date(now));
  const today = await db.first("SELECT COALESCE(SUM(xp),0) AS xp FROM xp_events WHERE user_id=? AND kind='subtask' AND local_day=?", [userId, day]);
  let room = Math.max(0, Math.floor((DAILY_SUBTASK_XP_CAP - Number(today.xp)) / XP_VALUES.subtask));
  const at = new Date(now).toISOString();
  const statements = [];
  for (const { task, item, key } of candidates) {
    if (!room) break;
    if (granted.has(key)) continue;
    room -= 1;
    statements.push([
      `INSERT OR IGNORE INTO xp_events (id,user_id,event_key,kind,xp,material_id,material_title,step_id,step_title,session_id,origin,policy_version,local_day,granted_at)
       VALUES (?,?,?,'subtask',?,?,?,?,?,'','manual',?,?,?)`,
      [crypto.randomUUID(), userId, key, XP_VALUES.subtask, task.courseId || '', task.title, item.id, item.title, XP_POLICY_VERSION, day, at],
    ]);
  }
  return statements;
}
