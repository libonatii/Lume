-- Correção assistida de XP: a conquista pode ser revogada, mas o evento
-- original permanece no livro. A correção é um evento de ajuste negativo com
-- motivo, vinculado ao evento corrigido.

ALTER TABLE user_achievements ADD COLUMN revoked_at TEXT;
