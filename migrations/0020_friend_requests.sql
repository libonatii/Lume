-- Solicitações de amizade e @usuário.
-- O @usuário é opcional e só existe depois que a pessoa abre "Amigos" no Social
-- (ou o escolhe): quem nunca o criou não aparece em buscas. Não há busca por
-- e-mail nem por nome. A amizade só começa quando a outra pessoa aceita.

CREATE TABLE IF NOT EXISTS user_handles (
  user_id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (from_id, to_id)
);

CREATE INDEX IF NOT EXISTS friend_requests_to ON friend_requests(to_id);
CREATE INDEX IF NOT EXISTS friend_requests_from ON friend_requests(from_id);
