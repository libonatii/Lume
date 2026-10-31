-- Reconciliação entre dispositivos: cada gravação incrementa uma revisão.
-- O cliente envia a revisão em que se baseou; se ela não for a atual, recebe
-- o estado mais novo para mesclar em vez de sobrescrever silenciosamente.

ALTER TABLE user_state ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
