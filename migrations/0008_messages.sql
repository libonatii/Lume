-- Mensagens diretas entre amizades, bloqueio de contato e preferência de
-- notificação. Não há grupos, canais ou conversas entre desconhecidos.
-- Mensagens não geram XP.

CREATE TABLE IF NOT EXISTS direct_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  body TEXT NOT NULL,
  reference TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS direct_messages_pair ON direct_messages(sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS direct_messages_recipient ON direct_messages(recipient_id, read_at);

CREATE TABLE IF NOT EXISTS contact_blocks (
  user_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, blocked_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS contact_blocks_target ON contact_blocks(blocked_id);

CREATE TABLE IF NOT EXISTS message_preferences (
  user_id TEXT PRIMARY KEY,
  notifications INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
