// Gerado por scripts/build-extension.mjs a partir de extension/src/capture.js. Não edite: rode npm run extension:build.
(() => {
  // public/providers/alura.js
  function identify() {
    return null;
  }
  var alura_default = {
    id: "alura",
    label: "Alura",
    aliases: [],
    hosts: ["alura.com.br"],
    structure: "cursos, módulos e aulas",
    art: "code",
    syllabus: "structured",
    note: "Cursos avulsos e formações publicam parte da ementa na página. Trilhas fechadas podem aparecer incompletas.",
    capabilities: { syllabus: "partial", progress: "lesson-flags", resume: false, requiresLogin: false },
    identify,
    readers: {}
  };

  // public/providers/coursera.js
  function identify2(url) {
    const found = /^(\/learn\/[^/]+)/i.exec(url.pathname);
    if (!found) return null;
    return { courseExternalId: found[1].split("/").pop(), canonicalUrl: `${url.origin}${found[1]}` };
  }
  var coursera_default = {
    id: "coursera",
    label: "Coursera",
    aliases: [],
    hosts: ["coursera.org"],
    structure: "semanas e aulas",
    art: "language",
    syllabus: "structured",
    note: "Parte do programa é publicada na página do curso. A duração real pode variar por turma.",
    capabilities: { syllabus: "partial", progress: "lesson-flags", resume: false, requiresLogin: false },
    identify: identify2,
    readers: {}
  };

  // public/providers/dio.js
  function identify3() {
    return null;
  }
  var dio_default = {
    id: "dio",
    label: "DIO",
    aliases: [],
    hosts: ["dio.me"],
    structure: "bootcamps e módulos",
    art: "code",
    syllabus: "page",
    note: "Bootcamps públicos listam módulos; o detalhe das aulas pode exigir cadastro.",
    capabilities: { syllabus: "partial", progress: "lesson-flags", resume: false, requiresLogin: false },
    identify: identify3,
    readers: {}
  };

  // public/providers/estrategia.js
  function identify4() {
    return null;
  }
  var estrategia_default = {
    id: "estrategia",
    label: "Estratégia Concursos",
    aliases: ["Estratégia", "Estrategia"],
    hosts: ["estrategiaconcursos.com.br"],
    structure: "disciplinas e assuntos",
    art: "nature",
    syllabus: "page",
    note: "O Lume lê apenas a página pública do curso. A grade completa costuma exigir acesso à conta: abra o curso logado e use a extensão do Lume, ou copie a página e cole.",
    capabilities: { syllabus: "partial", progress: "lesson-flags", resume: false, requiresLogin: true },
    identify: identify4,
    readers: {}
  };

  // public/providers/kit.js
  var clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  function toSeconds(text) {
    const value = clean(text).toLowerCase();
    const clock = value.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
    if (clock) return Number(clock[1] || 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
    const hours = value.match(/^(\d+)\s*h(?:\s*(\d+)\s*(?:min|m))?$/);
    if (hours) return Number(hours[1]) * 3600 + Number(hours[2] || 0) * 60;
    const minutes = value.match(/^(\d+)\s*(?:min|mins|minutos?)$/);
    return minutes ? Number(minutes[1]) * 60 : null;
  }
  async function mapLimited(items, limit, task) {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await task(items[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }
  function hostMatches(hostname, hosts) {
    const name = String(hostname || "").toLowerCase().replace(/^www\./, "");
    return hosts.some((known) => name === known || name.endsWith(`.${known}`));
  }

  // public/providers/grancursos.js
  var COURSE_PATH = /^\/aluno\/curso\/(?:video\/)?codigo\/([^/]+)/i;
  var CONCURRENCY = 6;
  function identify5(url) {
    const code = COURSE_PATH.exec(url.pathname)?.[1];
    if (!code) return null;
    return { courseExternalId: code, canonicalUrl: `${url.origin}/aluno/curso/video/codigo/${code}` };
  }
  var seconds = (video) => Number(video?._tempo_duracao) || toSeconds(video?.st_tempo_duracao) || 0;
  async function readPage({ pageUrl, origin, fetchJson, report = () => {
  }, limits = {} }) {
    let url;
    try {
      url = new URL(pageUrl);
    } catch {
      return null;
    }
    if (url.origin !== origin) return null;
    const course = identify5(url);
    if (!course) return null;
    const maxDisciplines = limits.disciplines || 40;
    const base = `/aluno/curso/listar-conteudo-aula/codigo/${course.courseExternalId}/tipo/video`;
    const query = "?audiobooks=true";
    const subjects = await fetchJson(`${base}${query}`);
    if (!Array.isArray(subjects) || !subjects.length) return null;
    const truncated = subjects.length > maxDisciplines;
    const disciplines = [];
    let unread = 0;
    for (const [index, subject] of subjects.slice(0, maxDisciplines).entries()) {
      const name = clean(subject?.nome).slice(0, 150);
      if (!name || subject?.id == null) continue;
      report(`Lendo a disciplina ${index + 1} de ${Math.min(subjects.length, maxDisciplines)}…`);
      const path = `${base}/disciplina/${encodeURIComponent(subject.id)}`;
      const items = await fetchJson(`${path}${query}`);
      if (!Array.isArray(items) || !items.length) continue;
      const videoLists = await mapLimited(items, CONCURRENCY, (item) => fetchJson(`${path}/conteudo/${encodeURIComponent(item.id)}${query}`).catch(() => null));
      const lessons = items.map((item, position) => {
        const videos = Array.isArray(videoLists[position]) ? videoLists[position].filter((video) => video?.id_video) : null;
        const progress = item?.progressoConteudo;
        const title = clean(`Aula ${item?.index ?? position + 1}${clean(item?.desc) ? ` - ${clean(item.desc)}` : ""}`).slice(0, 200);
        const externalId = item?.id != null ? `${subject.id}/${item.id}` : "";
        if (!videos?.length) {
          unread += 1;
          return { title, externalId, url: "", duration: null, completed: Number(progress?.qtdAulas) > 0 && Number(progress?.qtdAulasAssistidas) >= Number(progress?.qtdAulas) };
        }
        const total = videos.reduce((sum, video) => sum + seconds(video), 0);
        return {
          title,
          externalId,
          url: `${origin}/aluno/curso/video/codigo/${course.courseExternalId}/v/${encodeURIComponent(videos[0].id_video)}`,
          duration: total || null,
          completed: videos.every((video) => video.visualizado === true)
        };
      });
      disciplines.push({ title: name, externalId: String(subject.id), modules: [{ title: "Aulas", lessons }] });
    }
    if (!disciplines.length) return null;
    return {
      disciplines,
      truncated,
      unread,
      externalId: course.courseExternalId,
      notes: ["Lido pela extensão do Lume na grade que o Gran entrega à página aberta com a sua conta. Cada aula do Gran entra como uma aula; ela conta como concluída quando todos os vídeos dela aparecem como assistidos."],
      warnings: unread ? [`${unread} ${unread === 1 ? "aula veio" : "aulas vieram"} sem a lista de vídeos: a conclusão segue a contagem do Gran e o link ficou vazio.`] : []
    };
  }
  var grancursos_default = {
    id: "grancursos",
    label: "Gran Cursos Online",
    aliases: ["Gran Cursos", "Gran"],
    hosts: ["grancursosonline.com.br"],
    structure: "disciplinas e assuntos",
    art: "nature",
    syllabus: "page",
    note: "A página pública costuma mostrar as disciplinas do pacote. Módulos e aulas detalhados normalmente ficam na área autenticada: abra o curso logado e use a extensão do Lume, ou copie a página e cole, ou envie o texto.",
    capabilities: { syllabus: "full", progress: "lesson-flags", resume: false, requiresLogin: true },
    identify: identify5,
    readers: { page: readPage }
  };

  // public/providers/hotmart.js
  function identify6() {
    return null;
  }
  var hotmart_default = {
    id: "hotmart",
    label: "Hotmart",
    aliases: [],
    hosts: ["hotmart.com"],
    structure: "módulos e aulas",
    art: "design",
    syllabus: "manual",
    note: "Páginas de produto raramente publicam a grade. Prefira colar a ementa ou enviar um arquivo.",
    capabilities: { syllabus: "none", progress: "lesson-flags", resume: false, requiresLogin: true },
    identify: identify6,
    readers: {}
  };

  // public/providers/rocketseat.js
  function identify7() {
    return null;
  }
  var rocketseat_default = {
    id: "rocketseat",
    label: "Rocketseat",
    aliases: [],
    hosts: ["rocketseat.com.br"],
    structure: "trilhas, módulos e projetos",
    art: "code",
    syllabus: "page",
    note: "A trilha pública lista módulos e aulas; o conteúdo em vídeo exige acesso próprio.",
    capabilities: { syllabus: "partial", progress: "lesson-flags", resume: false, requiresLogin: false },
    identify: identify7,
    readers: {}
  };

  // public/providers/udemy.js
  function identify8(url) {
    const found = /^(\/course\/[^/]+)/i.exec(url.pathname);
    if (!found) return null;
    return { courseExternalId: found[1].split("/").pop(), canonicalUrl: `${url.origin}${found[1]}` };
  }
  var udemy_default = {
    id: "udemy",
    label: "Udemy",
    aliases: [],
    hosts: ["udemy.com"],
    structure: "seções e aulas",
    art: "design",
    syllabus: "structured",
    note: "O catálogo publica título e parte do currículo em dados estruturados. Aulas pagas não são acessíveis ao Lume.",
    capabilities: { syllabus: "partial", progress: "lesson-flags", resume: false, requiresLogin: false },
    identify: identify8,
    readers: {}
  };

  // public/providers/registry.js
  var PROVIDERS = Object.freeze([grancursos_default, estrategia_default, alura_default, rocketseat_default, udemy_default, coursera_default, dio_default, hotmart_default]);
  var UNKNOWN_PROVIDER = Object.freeze({
    id: "unknown",
    label: "Fonte não reconhecida",
    aliases: [],
    hosts: [],
    structure: "conteúdo",
    art: "nature",
    syllabus: "page",
    note: "Fonte sem adaptador próprio. O Lume tenta ler dados estruturados e a estrutura visível da página, sem ler o que já foi concluído; se não bastar, use texto ou arquivo.",
    capabilities: Object.freeze({ syllabus: "partial", progress: "none", resume: false, requiresLogin: false }),
    identify: () => null,
    readers: Object.freeze({})
  });
  function providerForHost(hostname) {
    return PROVIDERS.find((item) => hostMatches(hostname, item.hosts)) || UNKNOWN_PROVIDER;
  }
  function platformNames() {
    return PROVIDERS.flatMap((item) => [item.label, ...item.aliases || []]);
  }
  function isPlatformName(text) {
    const value = String(text || "").trim().toLowerCase();
    return platformNames().some((name) => name.toLowerCase() === value);
  }
  function readsCompletion(provider) {
    return provider?.capabilities?.progress && provider.capabilities.progress !== "none";
  }

  // extension/src/capture.js
  if (!globalThis.LumeCapture) {
    let textOf = function(element) {
      const parts = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest('svg, script, style, noscript, [role="tooltip"]')) continue;
        parts.push(node.nodeValue);
      }
      return clean(parts.join(" "));
    }, courseUrlFor = function(pageUrl) {
      let url;
      try {
        url = new URL(pageUrl);
      } catch {
        return "";
      }
      if (!["http:", "https:"].includes(url.protocol)) return "";
      url.hash = "";
      url.search = "";
      const known = providerForHost(url.hostname).identify(url);
      if (known?.canonicalUrl) return known.canonicalUrl;
      const parts = url.pathname.split("/").filter(Boolean);
      const cut = parts.findIndex((part) => LESSON_SEGMENT.test(part));
      if (cut > 0) url.pathname = `/${parts.slice(0, cut).join("/")}`;
      return url.href;
    }, courseIdentity = function(fallback) {
      const isTop = globalThis.window === globalThis.top;
      const exact = [];
      const tabbed = [];
      if (isTop) {
        const heading = document.querySelector('h1, [role="heading"][aria-level="1"]');
        if (heading) exact.push(textOf(heading));
        tabbed.push(attributeOf(document.querySelector('meta[property="og:title"]'), "content"));
      }
      tabbed.push(fallback);
      if (isTop) tabbed.push(document.title);
      let title = "";
      let code = "";
      for (const candidate of exact) {
        const text = clean(candidate);
        const found = COURSE_CODE.exec(text);
        const name = text.replace(COURSE_CODE, "");
        if (name.length >= 3 && !isPlatformName(name)) {
          title = name;
          code = found?.[1] || "";
          break;
        }
      }
      if (!title) {
        for (const candidate of tabbed) {
          const parts = clean(candidate).split(/\s+[|–—-]\s+/);
          while (parts.length > 1 && isPlatformName(parts[parts.length - 1])) parts.pop();
          const name = parts.join(" – ");
          if (name.length >= 3) {
            title = name;
            break;
          }
        }
      }
      return { title: title.slice(0, 160), code };
    }, lessonHref = function(element) {
      if (element.tagName !== "A") return "";
      const href = element.getAttribute("href") || "";
      if (!href || href.startsWith("#") || /^(javascript|mailto|tel):/i.test(href)) return "";
      let url;
      try {
        url = new URL(href, location.href);
      } catch {
        return "";
      }
      if (url.origin !== location.origin) return "";
      const parts = url.pathname.split("/").filter(Boolean);
      return parts.some((part) => LESSON_SEGMENT.test(part)) ? url.href : "";
    }, inHiddenPanel = function(element) {
      for (let panel = element.closest('[role="tabpanel"]'); panel; panel = panel.parentElement?.closest('[role="tabpanel"]')) {
        if (panel.hidden || panel.getAttribute("aria-hidden") === "true" || panel.classList.contains("hidden")) return true;
        if (typeof panel.checkVisibility === "function" && !panel.checkVisibility()) return true;
      }
      return false;
    }, rowFor = function(element) {
      if (element.matches(ITEM_DATA)) return element;
      const row = element.closest(ROW_SELECTOR);
      if (row && lessonLinkCount(row) <= 1) return row;
      let current = element;
      for (let level = 0; level < 4; level += 1) {
        const parent = current.parentElement;
        if (!parent || parent === document.body || lessonLinkCount(parent) > 1) break;
        if (parent.querySelector('[aria-expanded], h1, h2, h3, h4, h5, h6, [role="heading"]')) break;
        current = parent;
      }
      return current;
    }, findRows = function(root) {
      const rows = /* @__PURE__ */ new Set();
      for (const element of root.querySelectorAll("a[href]")) {
        if (lessonHref(element) && !inHiddenPanel(element)) rows.add(rowFor(element));
      }
      for (const element of root.querySelectorAll(ITEM_DATA)) rows.add(element);
      if (rows.size < 3) {
        for (const element of root.querySelectorAll(ROW_SELECTOR)) {
          if (DURATION.test(textOf(element)) && textOf(element).length <= 220) rows.add(element);
        }
      }
      return [...rows].filter((row) => ![...rows].some((other) => other !== row && row.contains(other)));
    }, commonAncestor = function(elements) {
      let node = elements[0];
      while (node && !elements.every((element) => node.contains(element))) node = node.parentElement;
      return node || document.body;
    }, signature = function(row) {
      const purpose = attributeOf(row, "data-purpose").replace(/[\d-]+$/, "").slice(0, 30);
      const firstClass = attributeOf(row, "class").split(/\s+/)[0].replace(/\d+/g, "");
      return `${row.tagName}|${purpose}|${firstClass}`;
    }, lessonRegion = function(rows, known = null) {
      const bySignature = /* @__PURE__ */ new Map();
      for (const row of rows) {
        const key = signature(row);
        bySignature.set(key, [...bySignature.get(key) || [], row]);
      }
      const dominant = [...bySignature.values()].sort((a, b) => b.length - a.length)[0] || [];
      const recognised = dominant.length > 0 && known?.has(signature(dominant[0]));
      if (dominant.length < 3 && !recognised) return null;
      known?.add(signature(dominant[0]));
      const region = commonAncestor(dominant);
      return { region, rows: rows.filter((row) => region.contains(row)) };
    }, labelSaysDone = function(value) {
      const label = clean(value);
      if (!label) return false;
      if (/\b(desmarcar|unmark|mark as (?:in|un)complete)\b/i.test(label)) return true;
      if (/\b(marcar|mark|definir|set)\b/i.test(label)) return false;
      return DONE_TEXT.test(label) && !NOT_DONE_TEXT.test(label);
    }, isDone = function(row) {
      if (row.querySelector('input[type="checkbox"]:checked')) return true;
      const flagged = [row, ...row.querySelectorAll("*")].slice(0, 60);
      for (const element of flagged) {
        if (element.getAttribute?.("aria-checked") === "true") return true;
        if (["data-completed", "data-done", "data-complete"].some((name) => element.getAttribute?.(name) === "true")) return true;
        for (const name of ["data-status", "data-state", "data-progress"]) {
          const value = attributeOf(element, name);
          if (/^(completed?|done|finished|checked|concluid[ao])$/i.test(value)) return true;
        }
        if (labelSaysDone(`${attributeOf(element, "aria-label")} ${attributeOf(element, "title")}`)) return true;
        const classes = attributeOf(element, "class");
        if (classes && DONE_CLASS.test(classes) && !NOT_DONE_CLASS.test(classes)) return true;
      }
      for (const title of row.querySelectorAll("svg title")) {
        if (labelSaysDone(title.textContent)) return true;
      }
      return Boolean(row.querySelector('svg[data-icon*="check"]'));
    }, rowTitle = function(row) {
      const preferred = row.querySelector('[data-purpose*="title" i], [class*="title" i], [class*="titulo" i]');
      const link = row.tagName === "A" ? row : row.querySelector("a[href]");
      const inner = link?.querySelector("p, h1, h2, h3, h4, h5, h6");
      const source = preferred && textOf(preferred).length >= 3 ? preferred : inner && textOf(inner).length >= 3 ? inner : link && textOf(link).length >= 3 ? link : row;
      let text = textOf(source);
      const durationMatch = DURATION.exec(` ${text} `);
      if (durationMatch) text = clean(text.replace(durationMatch[1], " "));
      text = clean(text.replace(/\b(conclu[ií]d[ao]s?|not completed|completed|em andamento|n[ãa]o iniciad[ao])\b/gi, " "));
      return text.replace(/^[\s·•|:-]+|[\s·•|:-]+$/g, "").slice(0, 200);
    }, rowDuration = function(row) {
      const match = DURATION.exec(` ${textOf(row)} `);
      return match ? toSeconds(match[1]) : null;
    }, headerText = function(element) {
      const visible = (element.innerText || "").split("\n").map(clean).find(Boolean) || textOf(element);
      return clean(visible).replace(/\s*\d+\s*\/\s*\d+.*$/, "").replace(/\s*\d+\s*(aulas?|lessons?|lectures?|itens?|items?|v[ií]deos?)\b.*$/i, "").replace(/\s*·.*$/, "").slice(0, 150);
    }, headerDone = function(element) {
      const full = textOf(element);
      if (!/\bconclu[ií]d[oa]\b|\bcompleted\b/i.test(full)) return false;
      return !/\d+\s*%|\d+\s*\/\s*\d+|n[ãa]o\s+conclu|incomplete/i.test(full);
    }, headerInfo = function(element) {
      const label = clean(attributeOf(element, "aria-label"));
      const discipline = /^Disciplina\s+(.+?)(?:\s+-\s+\d+\s*%.*)?$/i.exec(label);
      if (discipline) return { level: 0, text: discipline[1].slice(0, 150), done: false };
      const lesson = /^Aula\s+(\d+)\s+-\s+(.+)$/i.exec(label);
      if (lesson) return { level: 1, text: `Aula ${lesson[1]} - ${lesson[2]}`.slice(0, 150), done: headerDone(element) };
      return { level: 1, text: headerText(element), done: headerDone(element) };
    }, findHeaders = function(region, rows, titleToSkip) {
      let root = region;
      for (let level = 0; level < 8 && root.parentElement && root.parentElement !== document.body; level += 1) root = root.parentElement;
      const headers = [];
      for (const element of root.querySelectorAll(HEADER_SELECTOR)) {
        if (element.tagName === "H1") continue;
        if (element.closest("footer")) continue;
        if (rows.some((row) => row.contains(element) || element.contains(row))) continue;
        if (element.hasAttribute("aria-haspopup") || inHiddenPanel(element)) continue;
        const info = headerInfo(element);
        if (!region.contains(element) && info.level !== 0) continue;
        if (info.text.length < 3 || NOISE_WORD.test(info.text) || NOISE_START.test(info.text) || info.text === titleToSkip) continue;
        if (element.hasAttribute("aria-expanded") && NOT_A_MENU.test(`${info.text} ${attributeOf(element, "aria-label")}`)) continue;
        headers.push({ element, ...info, expandable: element.hasAttribute("aria-expanded") });
      }
      return headers.filter((header) => !headers.some((other) => other !== header && other.element.contains(header.element)));
    }, buildGroups = function(region, rows, titleToSkip) {
      const headers = findHeaders(region, rows, titleToSkip);
      const sequence = [
        ...headers.map((header) => ({ type: "header", element: header.element, info: header })),
        ...rows.map((row) => ({ type: "row", element: row }))
      ].sort((a, b) => inOrder(a.element, b.element));
      const disciplines = [];
      let discipline = null;
      let module = null;
      const seen = /* @__PURE__ */ new Set();
      const ensureDiscipline = () => {
        if (!discipline) {
          discipline = { title: "Conteúdo do curso", modules: [] };
          disciplines.push(discipline);
        }
        return discipline;
      };
      for (const item of sequence) {
        if (item.type === "header") {
          const { level, text, done, expandable } = item.info;
          if (level === 0) {
            const empty = discipline && !discipline.modules.some((candidate) => candidate.lessons.length);
            if (empty) {
              discipline.title = text;
              discipline.modules = [];
            } else {
              discipline = { title: text, modules: [] };
              disciplines.push(discipline);
            }
            module = null;
          } else if (module && !module.lessons.length && !module.expandable) {
            module.title = text;
            module.done = done;
            module.expandable = expandable;
          } else {
            module = { title: text, lessons: [], done, expandable };
            ensureDiscipline().modules.push(module);
          }
          continue;
        }
        const title = rowTitle(item.element);
        if (title.length < 3 || NOISE_WORD.test(title) || NOISE_START.test(title)) continue;
        const anchor = item.element.tagName === "A" ? item.element : item.element.querySelector("a[href]");
        const url = anchor ? lessonHref(anchor) : "";
        if (!module) {
          module = { title: "Conteúdo", lessons: [], done: false };
          ensureDiscipline().modules.push(module);
        }
        const key = url || `${disciplines.length}|${discipline.modules.length}|${title.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        module.lessons.push({ title, url, duration: rowDuration(item.element), completed: isDone(item.element) });
      }
      for (const candidate of disciplines) {
        for (const entry of candidate.modules) {
          if (entry.done) for (const lesson of entry.lessons) lesson.completed = true;
          if (!entry.lessons.length && entry.expandable) {
            entry.lessons.push({ title: entry.title, url: "", duration: null, completed: entry.done, pending: true });
          }
        }
        candidate.modules = candidate.modules.filter((entry) => entry.lessons.length);
      }
      return disciplines.filter((entry) => entry.modules.length);
    }, settle = function({ quiet = 350, min = 150, cap = 7e3, until = null } = {}) {
      return new Promise((resolve) => {
        const start = Date.now();
        let last = start;
        const observer = new MutationObserver(() => {
          last = Date.now();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        const tick = () => {
          const now = Date.now();
          if (now - start >= min && now - last >= quiet && (!until || until()) || now - start >= cap) {
            observer.disconnect();
            resolve();
          } else setTimeout(tick, 60);
        };
        setTimeout(tick, 60);
      });
    }, collapsedToggles = function() {
      return [...document.querySelectorAll('[aria-expanded="false"]')].filter((element) => {
        if (element.tagName === "A" || element.closest('nav, header, footer, [role="menu"], [role="menubar"], [role="dialog"]')) return false;
        if (element.hasAttribute("aria-haspopup") || inHiddenPanel(element)) return false;
        const text = clean(`${element.textContent} ${attributeOf(element, "aria-label")}`);
        return text.length > 0 && text.length <= 300 && !NOT_A_MENU.test(text);
      });
    }, mergeDisciplines = function(accumulated, found) {
      for (const discipline of found) {
        let target = accumulated.find((entry) => entry.title === discipline.title);
        if (!target) {
          target = { title: discipline.title, modules: [] };
          accumulated.push(target);
        }
        for (const entry of discipline.modules) {
          let module = target.modules.find((item) => item.title === entry.title);
          if (!module) {
            module = { title: entry.title, lessons: [], pending: null };
            target.modules.push(module);
          }
          for (const lesson of entry.lessons) {
            if (lesson.pending) {
              module.pending = module.pending || lesson;
              continue;
            }
            const key = lesson.url || lesson.title;
            const same = module.lessons.find((item) => (item.url || item.title) === key);
            if (!same) module.lessons.push(lesson);
            else if (lesson.completed) same.completed = true;
          }
        }
      }
    }, finalizeDisciplines = function(accumulated) {
      const result = [];
      for (const discipline of accumulated) {
        const modules = [];
        const unread = [];
        for (const module of discipline.modules) {
          if (module.lessons.length) modules.push({ title: module.title, lessons: module.lessons });
          else if (module.pending) unread.push({ ...module.pending, title: module.title });
        }
        if (unread.length) modules.push({ title: "Aulas cujos vídeos não foram lidos", lessons: unread });
        if (modules.length) result.push({ title: discipline.title, modules });
      }
      return result;
    };
    const LESSON_SEGMENT = /^(lectures?|lessons?|aulas?|tasks?|videos?|watch|class(?:es)?|atividades?|conteudos?|content|supplement|quiz|exam|assignment|ungradedLti|epis[oó]dios?|modules?)$/i;
    const ITEM_DATA = '[data-purpose^="curriculum-item"], [data-testid*="lesson" i], [data-testid*="lecture" i], [data-testid*="aula" i], [role="treeitem"]';
    const HEADER_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"], summary, [aria-expanded], [data-purpose*="section-heading"], [data-testid*="module" i], [data-testid*="section" i], [data-testid*="week" i]';
    const NOISE_WORD = /^(entrar|login|cadastr\w*|inscrev\w*|carrinho|menu|in[ií]cio|home|perfil|minha conta|configura\w*|ajuda|suporte|buscar|pesquis\w*|search|sair|logout|voltar|compartilh\w*|favorit\w*|vis[aã]o geral|overview|resumo|notas?|anota[cç][õo]es|perguntas|d[úu]vidas|avalia[cç][õo]es|certificado|download|baixar|idioma|notifica[cç][õo]es|conte[úu]do( do curso)?|course content|retomar|continuar|assistir|iniciar|come[cç]ar|ver aula|pr[óo]xima aula)$/i;
    const NOISE_START = /^(pr[óo]xim\w*|anterior|next|previous|continuar assistindo)\b/i;
    const NOT_A_MENU = /\b(menu|perfil|conta|idioma|language|notifica|busca|search|carrinho|cart|usu[aá]rio|user)\b/i;
    const DONE_TEXT = /\b(conclu[ií]d[ao]s?|completed?|complete|done|finished|assistid[ao]s?|watched|vist[ao])\b/i;
    const NOT_DONE_TEXT = /\b(n[ãa]o|not|in|un|sem)[-\s]?(conclu|complet|finish|assist|watch|vist)/i;
    const DONE_CLASS = /(^|[-_\s])(completed|complete|done|finished|concluid[ao]|watched|assistid[ao]|visto|is-done|isdone|checked)([-_\s]|$)/i;
    const NOT_DONE_CLASS = /(in|un|not|nao|não|sem)[-_]?(completed|complete|done|finished|concluid[ao]|checked)/i;
    const DURATION = /(?:^|[\s(·•|-])((?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*h(?:\s*\d+\s*(?:min|m)\b)?|\d+\s*(?:min|mins|minutos?)\b)(?=$|[\s)·•|,.-])/i;
    const MAX_LESSONS = 600;
    const MAX_GROUPS = 60;
    const MAX_DISCIPLINES = 40;
    const attributeOf = (element, name) => element?.getAttribute?.(name) || "";
    const COURSE_CODE = /\s*\(\s*c[óo]digo\s*:\s*([\w-]+)\s*\)\s*$/i;
    const ROW_SELECTOR = 'li, [role="treeitem"], [role="listitem"]';
    const lessonLinkCount = (container) => [...container.querySelectorAll("a[href]")].filter((link) => lessonHref(link)).length;
    const inOrder = (a, b) => a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const MAX_CLICKS = 600;
    const OVERALL_MS = 24e4;
    async function waitFor(condition, cap) {
      const start = Date.now();
      while (Date.now() - start < cap) {
        if (condition()) return true;
        await wait(100);
      }
      return condition();
    }
    const linkCount = () => lessonLinkCount(document.body);
    const textLength = () => (document.body.innerText || "").length;
    async function sweep(skipTitle, report2) {
      const accumulated = [];
      const knownSignatures = /* @__PURE__ */ new Set();
      const harvest = () => {
        const found = lessonRegion(findRows(document.body), knownSignatures);
        if (found) mergeDisciplines(accumulated, buildGroups(found.region, found.rows, skipTitle));
      };
      const initiallyOpen = [...document.querySelectorAll('[aria-expanded="true"]')];
      const opened = /* @__PURE__ */ new Set();
      const deadline = Date.now() + OVERALL_MS;
      let clicks = 0;
      const open = (element) => {
        if (opened.has(element) || clicks >= MAX_CLICKS || !element.isConnected) return false;
        opened.add(element);
        clicks += 1;
        element.click();
        return true;
      };
      const innerToggles = (scope) => collapsedToggles().filter((element) => scope.contains(element) && !opened.has(element));
      const openInside = async (scope, baseline) => {
        await waitFor(() => linkCount() > baseline || innerToggles(scope).length > 0, 3500);
        for (let round = 0; round < 3 && Date.now() < deadline; round += 1) {
          const inner = innerToggles(scope);
          if (!inner.length) return;
          const before = linkCount();
          for (const element of inner) open(element);
          await settle({ until: () => linkCount() > before, cap: 6e3 });
        }
      };
      harvest();
      let exclusive = null;
      let previous = null;
      for (let round = 0; round < 3 && Date.now() < deadline; round += 1) {
        const toggles = collapsedToggles().filter((element) => !opened.has(element));
        if (!toggles.length) break;
        let index = 0;
        while (index < toggles.length && Date.now() < deadline && clicks < MAX_CLICKS) {
          const element = toggles[index];
          index += 1;
          const baseline = linkCount();
          const text = textLength();
          if (!open(element)) continue;
          report2?.(`Lendo a seção ${index} de ${toggles.length}…`);
          await settle({ until: () => textLength() !== text || linkCount() !== baseline, cap: 4e3 });
          await openInside(element.parentElement || element, baseline);
          harvest();
          if (exclusive === null && previous?.isConnected) exclusive = previous.getAttribute("aria-expanded") !== "true";
          previous = element;
          if (exclusive === false) {
            const before = linkCount();
            for (; index < toggles.length; index += 1) open(toggles[index]);
            await settle({ until: () => linkCount() > before, cap: 7e3 });
            await openInside(document.body, before);
            harvest();
            break;
          }
        }
      }
      const restore = async () => {
        for (const element of [...opened].reverse()) {
          if (element.isConnected && element.getAttribute("aria-expanded") === "true" && !initiallyOpen.includes(element)) element.click();
        }
        await wait(100);
        for (const element of initiallyOpen) {
          if (element.isConnected && element.getAttribute("aria-expanded") === "false") element.click();
        }
      };
      return { disciplines: finalizeDisciplines(accumulated), restore, clicks };
    }
    async function fetchJson(path) {
      const response = await fetch(path, { credentials: "same-origin", headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" } });
      if (!response.ok) throw new Error(`provider_${response.status}`);
      return response.json();
    }
    async function readWithProvider(provider, pageUrl, report2) {
      const reader = provider.readers?.page;
      if (!reader || globalThis.window !== globalThis.top) return null;
      return reader({ pageUrl, origin: location.origin, fetchJson, report: report2, limits: { disciplines: MAX_DISCIPLINES } });
    }
    const report = (text) => {
      try {
        chrome.runtime.sendMessage({ type: "lume-progress", text });
      } catch {
      }
    };
    async function run({ pageUrl = location.href, pageTitle = "", expand = true, api = true } = {}) {
      let restore = async () => {
      };
      try {
        const { title, code } = courseIdentity(pageTitle);
        let host = "";
        try {
          host = new URL(pageUrl).hostname;
        } catch {
          host = location.hostname;
        }
        const provider = providerForHost(host);
        let disciplines;
        const fromApi = api ? await readWithProvider(provider, pageUrl, report).catch(() => null) : null;
        if (fromApi) {
          disciplines = fromApi.disciplines;
        } else if (expand) {
          const result = await sweep(title, report);
          restore = result.restore;
          disciplines = result.disciplines;
        } else {
          const found = lessonRegion(findRows(document.body));
          if (!found) return { ok: false, reason: "no_lessons" };
          const accumulated = [];
          mergeDisciplines(accumulated, buildGroups(found.region, found.rows, title));
          disciplines = finalizeDisciplines(accumulated);
        }
        if (!disciplines.length) return { ok: false, reason: "no_lessons" };
        let truncated = Boolean(fromApi?.truncated);
        if (disciplines.length > MAX_DISCIPLINES) {
          disciplines = disciplines.slice(0, MAX_DISCIPLINES);
          truncated = true;
        }
        let budget = MAX_LESSONS;
        disciplines = disciplines.map((discipline) => {
          let modules = discipline.modules;
          if (modules.length > MAX_GROUPS) {
            modules = modules.slice(0, MAX_GROUPS);
            truncated = true;
          }
          modules = modules.map((entry) => {
            if (entry.lessons.length > budget) truncated = true;
            const lessons = entry.lessons.slice(0, Math.max(budget, 0));
            budget -= lessons.length;
            return { ...entry, lessons };
          }).filter((entry) => entry.lessons.length);
          return { ...discipline, modules };
        }).filter((discipline) => discipline.modules.length);
        const all = disciplines.flatMap((discipline) => discipline.modules.flatMap((entry) => entry.lessons));
        if (all.length < 3) return { ok: false, reason: "no_lessons" };
        const pending = all.filter((lesson) => lesson.pending).length;
        const groupCount = disciplines.reduce((total, discipline) => total + discipline.modules.length, 0);
        const sourceUrl = courseUrlFor(pageUrl);
        const notes = fromApi?.notes?.length ? fromApi.notes : ["Lido pela extensão do Lume na página aberta com a sua conta. Confira se todos os itens são aulas."];
        const warnings = fromApi ? [...fromApi.warnings || []] : ["A leitura mostra só o que a página tinha na tela. Aulas de seções que não abriram, ou carregadas depois, podem faltar."];
        if (!readsCompletion(provider)) warnings.push("Plataforma sem adaptador no Lume: as marcas de concluído não são lidas.");
        if (pending) warnings.push(`${pending} ${pending === 1 ? "seção não abriu" : "seções não abriram"}: ${pending === 1 ? "entrou" : "entraram"} como um item só, sem os vídeos. Leia a página de novo para tentar abrir.`);
        if (truncated) warnings.push(`A leitura passou do limite do Lume (${MAX_LESSONS} aulas, ${MAX_DISCIPLINES} disciplinas) e foi cortada. Importe por partes.`);
        return {
          ok: true,
          stats: { lessons: all.length, groups: groupCount, disciplines: disciplines.length, completed: all.filter((lesson) => lesson.completed).length, pending, truncated },
          payload: {
            title: title || "Curso importado",
            provider: { id: provider.id },
            sourceUrl,
            externalId: code || fromApi?.externalId || "",
            completionSource: "lesson-flags",
            disciplines: disciplines.map((discipline) => ({
              title: discipline.title,
              ...discipline.externalId ? { externalId: discipline.externalId } : {},
              modules: discipline.modules.map((entry) => ({
                title: entry.title,
                lessons: entry.lessons.map((lesson) => ({
                  title: lesson.title,
                  ...lesson.externalId ? { externalId: lesson.externalId } : {},
                  url: lesson.url,
                  duration: lesson.duration,
                  completed: lesson.completed
                }))
              }))
            })),
            extraction: { kind: "extension-capture", confidence: fromApi ? "high" : "medium", notes },
            completeness: fromApi && !truncated && !fromApi.unread ? "complete" : "partial",
            warnings,
            analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        };
      } catch (error) {
        return { ok: false, reason: "error", message: String(error?.message || error).slice(0, 200) };
      } finally {
        try {
          await restore();
        } catch {
        }
      }
    }
    globalThis.LumeCapture = { run, courseUrlFor, toSeconds, isDone };
  }
})();
