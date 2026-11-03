-- Biblioteca da conta: fonte persistente no servidor. user_state é preservado
-- como arquivo da versão anterior, sem migração do armazenamento do navegador.
CREATE TABLE account_documents (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE materials (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE units (
  user_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  id TEXT NOT NULL,
  parent_id TEXT,
  kind TEXT NOT NULL,
  position INTEGER NOT NULL,
  selected INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  PRIMARY KEY(user_id, material_id, id),
  FOREIGN KEY(user_id, material_id) REFERENCES materials(user_id, id) ON DELETE CASCADE
);
CREATE INDEX units_parent ON units(user_id, material_id, parent_id, position);
CREATE TABLE study_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE INDEX study_progress_material ON study_progress(user_id, material_id, unit_id);
CREATE TABLE study_tasks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE study_sessions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE library_operations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  PRIMARY KEY(user_id, id)
);
-- Guarda transacional de concorrência: um conflito aborta o batch inteiro,
-- tanto no SQLite como no D1, sem mesclagem de documentos no navegador.
CREATE TABLE library_write_guards (
  user_id TEXT PRIMARY KEY,
  valid INTEGER NOT NULL CHECK(valid = 1)
);
