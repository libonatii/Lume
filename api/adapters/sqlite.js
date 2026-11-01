// Banco local: node:sqlite exposto com o mesmo contrato do adaptador D1.
// `batch` grava tudo ou nada, como o batch do D1.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function sqliteAdapter(database) {
  return {
    async run(sql, params = []) {
      return Number(database.prepare(sql).run(...params).changes ?? 0);
    },
    async first(sql, params = []) {
      return database.prepare(sql).get(...params) ?? null;
    },
    async all(sql, params = []) {
      return database.prepare(sql).all(...params);
    },
    async batch(statements) {
      database.exec('BEGIN');
      try {
        const results = statements.map(([sql, params = []]) => Number(database.prepare(sql).run(...params).changes ?? 0));
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

// Aplica migrations/*.sql em ordem alfabética, uma vez cada. Uma instalação
// interrompida depois de um ALTER pode já ter a coluna: nesse caso a migração
// é considerada aplicada em vez de impedir o boot.
export function applyMigrations(database, directory, { only = null } = {}) {
  database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const find = database.prepare('SELECT 1 AS applied FROM schema_migrations WHERE name = ?');
  const mark = database.prepare('INSERT OR IGNORE INTO schema_migrations (name, applied_at) VALUES (?, ?)');
  const files = readdirSync(directory).filter((name) => name.endsWith('.sql') && (!only || only.test(name))).sort();
  for (const file of files) {
    if (find.get(file)) continue;
    try {
      database.exec(readFileSync(join(directory, file), 'utf8'));
    } catch (error) {
      if (!/duplicate column name/i.test(String(error.message))) throw error;
    }
    mark.run(file, new Date().toISOString());
  }
}
