import { earnedTitles } from '../../public/title-policy.js';
import { levelForXP } from '../../public/xp-policy.js';

export async function readTitles(db, userId, { now = Date.now(), recalculate = false } = {}) {
  const rows = await db.all('SELECT * FROM xp_events WHERE user_id=?', [userId]);
  const corrected = new Set(rows.filter((row) => row.kind === 'adjustment').map((row) => row.event_key.slice('adjust|'.length)));
  const active = rows.filter((row) => row.kind !== 'adjustment' && !corrected.has(row.id));
  const count = (kind) => active.filter((row) => row.kind === kind).length;
  const existing = await db.all('SELECT * FROM user_titles WHERE user_id=? ORDER BY earned_at,id', [userId]);
  const friend = await db.first('SELECT friend_id FROM friendships WHERE user_id=? LIMIT 1', [userId]);
  const areas = {};
  for (const row of active.filter((row) => row.kind === 'lesson')) {
    let area;
    try { area = JSON.parse(row.meta || '{}').area; } catch { continue; }
    if (typeof area === 'string' && area.trim()) areas[area] = (areas[area] || 0) + 1;
  }
  const completedProjects = active.filter((row) => row.kind === 'project_bonus');
  const titles = earnedTitles({
    level: levelForXP(rows.reduce((total, row) => total + Number(row.xp), 0)),
    lessons: count('lesson'), readings: count('reading'),
    materials: new Set(active.filter((row) => ['course_bonus', 'project_bonus', 'reading', 'exercise', 'slide'].includes(row.kind)).map((row) => row.material_id)).size,
    disciplines: count('discipline_bonus'), courses: count('course_bonus'),
    hasFriend: Boolean(friend) || existing.some((row) => row.id === 'partner'),
    builtProject: completedProjects.some((project) => active.filter((row) => row.kind === 'delivery' && row.material_id === project.material_id).length >= 3),
    areas,
  });
  const statements = [];
  if (recalculate) statements.push(['DELETE FROM user_titles WHERE user_id=? AND id NOT IN (SELECT value FROM json_each(?))', [userId, JSON.stringify(titles.map((title) => title.id))]]);
  for (const title of titles) statements.push(['INSERT OR IGNORE INTO user_titles(user_id,id,title,criterion,earned_at) VALUES (?,?,?,?,?)', [userId, title.id, title.title, title.criterion, new Date(now).toISOString()]]);
  await db.batch(statements);
  return (await db.all('SELECT * FROM user_titles WHERE user_id=? ORDER BY earned_at,id', [userId])).map((row) => ({ id: row.id, title: row.title, criterion: row.criterion, earnedAt: row.earned_at }));
}
