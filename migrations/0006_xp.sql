-- Política de XP v1: livro de eventos por conta, acumulador de tempo,
-- configurações de participação no ranking e conquistas personalizadas.
--
-- O saldo legado do protótipo continua apenas no documento de estado do
-- navegador e nunca é copiado para cá. A ausência de uma linha em xp_events é
-- o que mantém o histórico antigo fora do nível novo e do ranking.

CREATE TABLE IF NOT EXISTS xp_settings (
  user_id TEXT PRIMARY KEY,
  -- Marco inicial: conclusões anteriores permanecem legado e não são
  -- convertidas automaticamente.
  eligible_since TEXT NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  -- Segundos elegíveis já consumidos em blocos fechados (recompensados ou
  -- descartados pelo teto diário). O resto inferior a 30 minutos continua no
  -- acumulador entre sessões.
  consumed_seconds INTEGER NOT NULL DEFAULT 0,
  ranking_opt_in INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS xp_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  -- Chave estável: repetir a requisição, recarregar ou sincronizar de outro
  -- dispositivo não cria uma segunda recompensa.
  event_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  xp INTEGER NOT NULL,
  material_id TEXT,
  material_title TEXT,
  step_id TEXT,
  step_title TEXT,
  session_id TEXT,
  origin TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  local_day TEXT,
  granted_at TEXT NOT NULL,
  meta TEXT,
  UNIQUE (user_id, event_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS xp_events_user_day ON xp_events(user_id, local_day);
CREATE INDEX IF NOT EXISTS xp_events_user_time ON xp_events(user_id, granted_at);
CREATE INDEX IF NOT EXISTS xp_events_user_kind ON xp_events(user_id, kind);

-- Uma linha por sessão declarada já apresentada ao servidor. O intervalo é
-- usado para descontar sobreposição entre abas/dispositivos.
CREATE TABLE IF NOT EXISTS xp_time_sessions (
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  declared_seconds INTEGER NOT NULL,
  effective_seconds INTEGER NOT NULL,
  -- Base do acumulador no momento da inserção: permite repetir a operação
  -- depois de uma falha sem somar os mesmos segundos duas vezes.
  base_consumed_seconds INTEGER NOT NULL,
  blocks INTEGER NOT NULL DEFAULT 0,
  granted_xp INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, session_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  material_id TEXT NOT NULL,
  material_title TEXT NOT NULL,
  criterion TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  origin TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'friends',
  earned_at TEXT NOT NULL,
  UNIQUE (user_id, event_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_achievements_user ON user_achievements(user_id, earned_at);
