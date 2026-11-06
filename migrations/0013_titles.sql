-- Títulos de progressão: não concedem permissões nem XP.
CREATE TABLE IF NOT EXISTS user_titles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  criterion TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
