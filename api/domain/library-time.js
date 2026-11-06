// Planeja o XP de tempo para o mesmo batch da biblioteca. A revisão da conta
// serializa sessões concorrentes; nenhuma concessão acontece depois do commit.
import { DAILY_TIME_XP_CAP, TIME_BLOCK_SECONDS, TIME_BLOCK_XP, XP_POLICY_VERSION, localDay, timeEventKey } from '../../public/xp-policy.js';
import { MAX_SESSION_MS } from '../../public/session-domain.js';

export async function timeStatements(db, userId, state, settings, now) {
  const rows = await db.all('SELECT * FROM xp_time_sessions WHERE user_id=?', [userId]);
  const known = new Set(rows.map((row) => row.session_id));
  const day = localDay(settings.time_zone, new Date(now));
  const today = await db.first("SELECT COALESCE(SUM(xp),0) AS xp FROM xp_events WHERE user_id=? AND kind='time_block' AND local_day=?", [userId, day]);
  let dailyXp = Number(today.xp);
  let total = rows.reduce((sum, row) => sum + Number(row.effective_seconds), 0);
  let consumed = Math.floor(Number(settings.consumed_seconds || 0) / TIME_BLOCK_SECONDS) * TIME_BLOCK_SECONDS;
  const statements = [];
  const at = new Date(now).toISOString();
  for (const session of state.studySessions) {
    if (known.has(session.id)) continue;
    const start = Date.parse(session.startedAt);
    const end = Date.parse(session.endedAt);
    const declared = Math.round(session.durationMs / 1000);
    const wall = Math.floor((end - start) / 1000);
    // Arquivos históricos continuam legíveis, mas não criam tempo elegível.
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(session.id) || !Number.isFinite(start) || !Number.isFinite(end)
      || end > now || end <= start || end < Date.parse(settings.eligible_since)
      || declared <= 0 || declared > wall + 5) continue;
    const intervals = rows.map((row) => [Math.max(start, Date.parse(row.started_at)), Math.min(end, Date.parse(row.ended_at))])
      .filter(([from, to]) => to > from).sort((a, b) => a[0] - b[0]);
    let overlap = 0;
    let through = start;
    for (const [from, to] of intervals) {
      overlap += Math.max(0, to - Math.max(from, through));
      through = Math.max(through, to);
    }
    const duration = Math.min(declared, wall, MAX_SESSION_MS / 1000);
    const effective = Math.max(0, duration - Math.ceil(overlap / 1000));
    total += effective;
    const blocks = Math.max(0, Math.floor((total - consumed) / TIME_BLOCK_SECONDS));
    const rewarded = Math.min(blocks, Math.max(0, Math.floor((DAILY_TIME_XP_CAP - dailyXp) / TIME_BLOCK_XP)));
    const course = state.courses.find((item) => item.id === session.courseId);
    for (let index = 0; index < rewarded; index += 1) statements.push([
      `INSERT INTO xp_events (id,user_id,event_key,kind,xp,material_id,material_title,step_id,step_title,session_id,origin,policy_version,local_day,granted_at)
       VALUES (?,?,?,'time_block',?,?,?,'','',?,'manual',?,?,?)`,
      [crypto.randomUUID(), userId, timeEventKey(session.id, index), TIME_BLOCK_XP, session.courseId || '', course ? `Bloco de estudo — ${course.title}` : 'Bloco de estudo', session.id, XP_POLICY_VERSION, day, at],
    ]);
    statements.push([
      `INSERT INTO xp_time_sessions (user_id,session_id,started_at,ended_at,declared_seconds,effective_seconds,base_consumed_seconds,blocks,granted_xp,processed,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,1,?)`,
      [userId, session.id, session.startedAt, session.endedAt, duration, effective, consumed, blocks, rewarded * TIME_BLOCK_XP, at],
    ]);
    consumed += blocks * TIME_BLOCK_SECONDS;
    dailyXp += rewarded * TIME_BLOCK_XP;
    known.add(session.id);
    rows.push({ session_id: session.id, started_at: session.startedAt, ended_at: session.endedAt, effective_seconds: effective });
  }
  // Mantém os segundos totais no acumulador: o módulo do bloco é a sobra que
  // xpSummary apresenta, inclusive depois de atingir o teto diário.
  if (statements.length) statements.push(['UPDATE xp_settings SET consumed_seconds=?,updated_at=? WHERE user_id=?', [total, at, userId]]);
  return statements;
}
