-- Presença temporária de navegador para exibir amigos ativos agora.
CREATE TABLE IF NOT EXISTS user_presence (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS user_presence_seen ON user_presence(last_seen_at);
