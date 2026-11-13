-- Cache de Markdown extraído e insights de IA por PDF anexado, mantendo
-- library_files leve e respeitando o limite de 1 MB por linha do Cloudflare D1.
ALTER TABLE library_files ADD COLUMN status TEXT NOT NULL DEFAULT 'ready';

CREATE TABLE library_file_ai (
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  markdown TEXT,
  markdown_status TEXT NOT NULL DEFAULT 'pending',
  markdown_source TEXT,
  markdown_chars INTEGER NOT NULL DEFAULT 0,
  markdown_updated_at TEXT,
  insights_json TEXT,
  insights_model TEXT,
  insights_updated_at TEXT,
  PRIMARY KEY (user_id, file_id),
  FOREIGN KEY (user_id, file_id) REFERENCES library_files(user_id, id) ON DELETE CASCADE
);
