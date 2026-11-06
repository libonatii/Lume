import { dueReminders, reminderKey } from '../../public/agenda-domain.js';
import { readLibrary } from './library-store.js';
import { AppError } from '../errors.js';

// Revalida a revisão no mesmo batch da reivindicação. Uma aba/dispositivo só
// recebe cada lembrete; editar ou cancelar antes do batch invalida a leitura.
export async function claimReminders(db, userId, { now = Date.now() } = {}) {
  const current = await readLibrary(db, userId);
  const due = dueReminders(current.state, now);
  if (!due.length) return [];
  const statements = [
    ['INSERT INTO library_write_guards(user_id,valid) SELECT ?,CASE WHEN revision=? THEN 1 ELSE 0 END FROM account_documents WHERE user_id=?', [userId, current.revision, userId]],
    ...due.map((item) => ['INSERT OR IGNORE INTO agenda_reminders(user_id,reminder_key,claimed_at) VALUES (?,?,?)', [userId, reminderKey(item), new Date(now).toISOString()]]),
    ['DELETE FROM library_write_guards WHERE user_id=?', [userId]],
  ];
  try {
    const changes = await db.batch(statements);
    return due.filter((_, index) => changes[index + 1] === 1).map((item) => ({ id: item.id, key: reminderKey(item), title: item.title, date: item.date, start: item.start, timeZone: item.timeZone }));
  } catch (error) {
    if ((await db.first('SELECT revision FROM account_documents WHERE user_id=?', [userId]))?.revision !== current.revision) throw new AppError('A Agenda mudou. O lembrete será conferido novamente.', 'agenda_conflict', 409);
    throw error;
  }
}
