// Cloudflare D1 com o contrato { run, first, all, batch } usado pelos módulos.

export function d1Adapter(database) {
  const statement = (sql, params = []) => database.prepare(sql).bind(...params);
  return {
    async run(sql, params) {
      const result = await statement(sql, params).run();
      return Number(result?.meta?.changes ?? 0);
    },
    async first(sql, params) {
      return statement(sql, params).first();
    },
    async all(sql, params) {
      return (await statement(sql, params).all()).results ?? [];
    },
    async batch(statements) {
      const results = await database.batch(statements.map(([sql, params]) => statement(sql, params)));
      return results.map((result) => Number(result?.meta?.changes ?? 0));
    },
  };
}
