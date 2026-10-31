-- Lume Companion: pareamento de dispositivos e presença observada localmente.
-- Presença não é progresso nem XP: é uma informação temporária, com expiração
-- por falta de batimento. O token do dispositivo é guardado apenas como hash.

CREATE TABLE IF NOT EXISTS companion_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS companion_devices_user ON companion_devices(user_id);

-- Código curto, de uso único e curta duração, para conectar o programa.
CREATE TABLE IF NOT EXISTS companion_pair_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS companion_pair_user ON companion_pair_codes(user_id);

-- Uma linha por dispositivo: a presença atual (ou ausente) de cada um.
CREATE TABLE IF NOT EXISTS companion_presence (
  device_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  app TEXT NOT NULL,
  category TEXT NOT NULL,
  since TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (device_id) REFERENCES companion_devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS companion_presence_user ON companion_presence(user_id);
