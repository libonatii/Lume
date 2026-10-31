-- Convite reaproveitável: o mesmo código pode ser aceito por várias pessoas
-- enquanto estiver dentro dos 7 dias. Cada aceite é registrado uma vez por
-- pessoa, para contar quantos entraram pelo convite sem perder o histórico.
-- O prazo continua sendo o limite: ao expirar, o código deixa de valer.

CREATE TABLE IF NOT EXISTS friend_invite_uses (
  code_hash TEXT NOT NULL,
  user_id TEXT NOT NULL,
  used_at TEXT NOT NULL,
  PRIMARY KEY (code_hash, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS friend_invite_uses_code ON friend_invite_uses(code_hash);

-- Convites antigos, de uso único, viram um uso registrado.
INSERT OR IGNORE INTO friend_invite_uses (code_hash, user_id, used_at)
SELECT code_hash, used_by, COALESCE(used_at, created_at)
  FROM friend_invites
 WHERE used_by IS NOT NULL;
