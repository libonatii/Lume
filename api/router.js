// Tabela de rotas: cada rota declara método, caminho e o que exige, em vez de
// repetir checagens em cada handler. `:nome` captura um segmento decodificado.

function compile(path) {
  const names = [];
  const source = path
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\?:([a-zA-Z]+)/g, (_, name) => {
      names.push(name);
      return '([^/]+)';
    })
    .replace(/\\\*$/, '(.*)');
  return { pattern: new RegExp(`^${source}$`), names };
}

export function createRouter() {
  const routes = [];
  const router = {
    add(methods, path, options, handler) {
      if (typeof options === 'function') {
        handler = options;
        options = {};
      }
      routes.push({ methods: [].concat(methods), path, options, handler, ...compile(path) });
      return router;
    },
    // → { route, params } | { allowed: [...] } | null
    match(method, pathname) {
      const allowed = new Set();
      for (const route of routes) {
        const found = route.pattern.exec(pathname);
        if (!found) continue;
        if (!route.methods.includes(method)) {
          route.methods.forEach((item) => allowed.add(item));
          continue;
        }
        const params = {};
        route.names.forEach((name, index) => {
          params[name] = decodeURIComponent(found[index + 1]);
        });
        if (route.path.endsWith('*')) params.rest = found[route.names.length + 1];
        return { route, params };
      }
      return allowed.size ? { allowed: [...allowed] } : null;
    },
    routes,
  };
  return router;
}
