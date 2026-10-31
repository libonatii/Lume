-- Amizades e convites.
-- O convite é um código de uso único e curta duração. Não há busca por e-mail:
-- assim ninguém descobre quem tem conta no Lume. A amizade é registrada nos
-- dois sentidos e não dá acesso à biblioteca ou ao progresso de ninguém.

CREATE TABLE IF NOT EXISTS friendships (
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, friend_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS friendships_user ON friendships(user_id);

CREATE TABLE IF NOT EXISTS friend_invites (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS friend_invites_user ON friend_invites(user_id);
