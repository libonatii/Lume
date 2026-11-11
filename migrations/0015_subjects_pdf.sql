-- Disciplinas da biblioteca e PDFs anexados à conta. Nenhum dado existente é
-- convertido ou removido.
CREATE TABLE study_subjects (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
-- O arquivo fica no armazenamento de objetos (R2 ou data/media); aqui só o
-- tamanho, para a cota, e o vínculo com a conta.
CREATE TABLE library_files (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  size INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
-- Plano de armazenamento. Sem linha, vale o gratuito; não há cobrança nem
-- tela de assinatura nesta etapa.
CREATE TABLE storage_plans (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK(plan IN ('free', 'plus')),
  updated_at TEXT NOT NULL
);
