-- Estado de estudo por conta. Guarda o documento completo do progresso
-- (cursos, etapas concluídas, histórico, preferências) como JSON.
-- A atribuição de XP continua no navegador; esta tabela resolve a persistência
-- por pessoa, não a autoridade do placar.

CREATE TABLE IF NOT EXISTS user_state (
  user_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
