-- Convites de colaboração em uma entrega específica de projeto.
-- Aceitar no Lume NÃO concede acesso ao GitHub, não copia o material para a
-- biblioteca da outra pessoa e não gera XP automático. É um acordo de ajuda.

CREATE TABLE IF NOT EXISTS delivery_invites (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_title TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_title TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  responded_at TEXT,
  UNIQUE (owner_id, friend_id, course_id, step_id),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS delivery_invites_owner ON delivery_invites(owner_id, created_at);
CREATE INDEX IF NOT EXISTS delivery_invites_friend ON delivery_invites(friend_id, status);
