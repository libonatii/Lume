-- Compromissos explícitos e reivindicação de lembretes por conta.
-- Nenhum dado existente é convertido ou removido.
CREATE TABLE agenda_entries (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE agenda_reminders (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_key TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY(user_id, reminder_key)
);
