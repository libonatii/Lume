-- Progresso registrado no servidor por comando (refatoração F3).
--
-- Cada linha é um evento do registro único de progresso do documento
-- (state.progress), recebido pelo servidor. `recorded_at` é o relógio do
-- servidor; `declared_at` é o horário informado pelo cliente e só pode atrasar
-- a elegibilidade, nunca adiantá-la. A política de XP lê daqui, não do
-- documento sincronizado.

CREATE TABLE IF NOT EXISTS progress_events (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  material_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  historical INTEGER NOT NULL DEFAULT 0,
  declared_at TEXT,
  recorded_at TEXT NOT NULL,
  reverted_at TEXT,
  -- 'command': enviado pelo cliente atual; 'document': copiado do documento
  -- de uma conta que ainda não enviou comandos (cliente antigo).
  source TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS progress_events_user_unit ON progress_events(user_id, unit_id);
CREATE INDEX IF NOT EXISTS progress_events_user_material ON progress_events(user_id, material_id);

-- Modo de cada conta: 'document' enquanto só clientes antigos gravaram;
-- 'commands' a partir do primeiro comando, quando o documento deixa de ser
-- fonte de progresso para a política.
CREATE TABLE IF NOT EXISTS progress_accounts (
  user_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
