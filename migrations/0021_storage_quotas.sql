-- Escalas de armazenamento ("planos" de cota sem monetização) e registro de ajuste pela criadora.
CREATE TABLE storage_plans_new (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK(plan IN ('starter', 'basic', 'standard', 'extended', 'creator')),
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT INTO storage_plans_new (user_id, plan, updated_at, updated_by)
SELECT
  user_id,
  CASE plan WHEN 'plus' THEN 'creator' ELSE 'starter' END,
  updated_at,
  NULL
FROM storage_plans;

DROP TABLE storage_plans;
ALTER TABLE storage_plans_new RENAME TO storage_plans;
