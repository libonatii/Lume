-- Marco de leitura do sino de notificações: o que chegou depois dele conta como novo.
CREATE TABLE IF NOT EXISTS notification_reads (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  seen_at TEXT NOT NULL
);
