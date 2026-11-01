// Leitor de curso do Lume.
//
// Roda na página que a pessoa abriu com a própria conta, só quando ela clica no
// ícone da extensão (permissão activeTab). Lê o que está na tela: título do
// curso, grupos (módulos/seções), nomes das aulas, durações e quais aparecem
// marcadas como concluídas. Não lê cookies, tokens, mídia nem o conteúdo das
// aulas, e não usa a API da plataforma.
//
// Script clássico (sem import), para poder ser injetado em qualquer página.
// O formato devolvido é validado de novo pelo Lume (`normalizePayload`).
(() => {
  if (globalThis.LumeCapture) return;

  const PROVIDER_HOSTS = [
    ['grancursosonline.com.br', 'grancursos'],
    ['estrategiaconcursos.com.br', 'estrategia'],
    ['alura.com.br', 'alura'],
    ['rocketseat.com.br', 'rocketseat'],
    ['udemy.com', 'udemy'],
    ['coursera.org', 'coursera'],
    ['dio.me', 'dio'],
    ['hotmart.com', 'hotmart'],
  ];

  // Segmentos de rota que indicam uma aula (ou outro item do currículo).
  const LESSON_SEGMENT = /^(lectures?|lessons?|aulas?|tasks?|videos?|watch|class(?:es)?|atividades?|conteudos?|content|supplement|quiz|exam|assignment|ungradedLti|epis[oó]dios?|modules?)$/i;
  // Gran: /aluno/curso/video/codigo/<código>/v/<vídeo>. O código identifica o
  // curso (hipótese a confirmar com mais de um curso); sem esta regra o corte no
  // segmento "video" deixaria todos os cursos com o mesmo endereço.
  const COURSE_PATHS = [/^(\/course\/[^/]+)/i, /^(\/learn\/[^/]+)/i];
  // Painel do curso e página da aula usam o mesmo código; os dois viram um endereço só.
  const GRAN_PATH = /^\/aluno\/curso\/(?:video\/)?codigo\/([^/]+)/i;
  const PLATFORM_NAME = /^(udemy|coursera|alura|rocketseat|gran cursos( online)?|estrat[eé]gia( concursos)?|dio|hotmart)$/i;

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

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  // Texto visível com um espaço entre os pedaços: "Aula 1<span>4 min</span>" não
  // pode virar "Aula 14 min". Ícones (svg) não são texto de aula.
  function textOf(element) {
    const parts = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest('svg, script, style, noscript, [role="tooltip"]')) continue;
      parts.push(node.nodeValue);
    }
    return clean(parts.join(' '));
  }
  const attributeOf = (element, name) => element?.getAttribute?.(name) || '';

  function toSeconds(text) {
    const value = clean(text).toLowerCase();
    const clock = value.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
    if (clock) return Number(clock[1] || 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
    const hours = value.match(/^(\d+)\s*h(?:\s*(\d+)\s*(?:min|m))?$/);
    if (hours) return Number(hours[1]) * 3600 + Number(hours[2] || 0) * 60;
    const minutes = value.match(/^(\d+)\s*(?:min|mins|minutos?)$/);
    return minutes ? Number(minutes[1]) * 60 : null;
  }

  function providerFor(host) {
    const name = host.toLowerCase().replace(/^www\./, '');
    const found = PROVIDER_HOSTS.find(([known]) => name === known || name.endsWith(`.${known}`));
    return found ? found[1] : 'unknown';
  }

  // Endereço do curso, não da aula aberta: é ele que identifica o curso na
  // reimportação e evita duplicata.
  function courseUrlFor(pageUrl) {
    let url;
    try { url = new URL(pageUrl); } catch { return ''; }
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    url.search = '';
    for (const rule of COURSE_PATHS) {
      const found = rule.exec(url.pathname);
      if (found) { url.pathname = found[1]; return url.href; }
    }
    const gran = GRAN_PATH.exec(url.pathname);
    if (gran) { url.pathname = `/aluno/curso/video/codigo/${gran[1]}`; return url.href; }
    const parts = url.pathname.split('/').filter(Boolean);
    const cut = parts.findIndex((part) => LESSON_SEGMENT.test(part));
    if (cut > 0) url.pathname = `/${parts.slice(0, cut).join('/')}`;
    return url.href;
  }

  // "(Código: 204594)" fica ao lado do nome do curso em algumas plataformas.
  const COURSE_CODE = /\s*\(\s*c[óo]digo\s*:\s*([\w-]+)\s*\)\s*$/i;

  // Nome do curso e, quando a página mostra, o código dele na plataforma.
  function courseIdentity(fallback) {
    const isTop = globalThis.window === globalThis.top;
    // Título do cabeçalho vale como está: travessões fazem parte do nome.
    const exact = [];
    // Título da aba costuma ter "Curso | Plataforma": só o nome da plataforma sai.
    const tabbed = [];
    if (isTop) {
      const heading = document.querySelector('h1, [role="heading"][aria-level="1"]');
      if (heading) exact.push(textOf(heading));
      tabbed.push(attributeOf(document.querySelector('meta[property="og:title"]'), 'content'));
    }
    tabbed.push(fallback);
    if (isTop) tabbed.push(document.title);

    let title = '';
    let code = '';
    for (const candidate of exact) {
      const text = clean(candidate);
      const found = COURSE_CODE.exec(text);
      const name = text.replace(COURSE_CODE, '');
      if (name.length >= 3 && !PLATFORM_NAME.test(name)) { title = name; code = found?.[1] || ''; break; }
    }
    if (!title) {
      for (const candidate of tabbed) {
        const parts = clean(candidate).split(/\s+[|–—-]\s+/);
        while (parts.length > 1 && PLATFORM_NAME.test(parts[parts.length - 1])) parts.pop();
        const name = parts.join(' – ');
        if (name.length >= 3) { title = name; break; }
      }
    }
    return { title: title.slice(0, 160), code };
  }

  // ---------- Aulas ----------

  function lessonHref(element) {
    if (element.tagName !== 'A') return '';
    const href = element.getAttribute('href') || '';
    if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) return '';
    let url;
    try { url = new URL(href, location.href); } catch { return ''; }
    if (url.origin !== location.origin) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.some((part) => LESSON_SEGMENT.test(part)) ? url.href : '';
  }

  const ROW_SELECTOR = 'li, [role="treeitem"], [role="listitem"]';

  const lessonLinkCount = (container) => [...container.querySelectorAll('a[href]')].filter((link) => lessonHref(link)).length;

  // Painel em aba que não está à mostra (ou cópia escondida do mesmo conteúdo).
  function inHiddenPanel(element) {
    for (let panel = element.closest('[role="tabpanel"]'); panel; panel = panel.parentElement?.closest('[role="tabpanel"]')) {
      if (panel.hidden || panel.getAttribute('aria-hidden') === 'true' || panel.classList.contains('hidden')) return true;
      if (typeof panel.checkVisibility === 'function' && !panel.checkVisibility()) return true;
    }
    return false;
  }

  function rowFor(element) {
    if (element.matches(ITEM_DATA)) return element;
    const row = element.closest(ROW_SELECTOR);
    if (row && lessonLinkCount(row) <= 1) return row;
    // Sem <li>: sobe enquanto o contêiner ainda tem só esta aula. Marca de
    // concluída, duração e botões costumam ficar ao lado do link, não dentro dele.
    let current = element;
    for (let level = 0; level < 4; level += 1) {
      const parent = current.parentElement;
      if (!parent || parent === document.body || lessonLinkCount(parent) > 1) break;
      // Um título de seção dentro do contêiner significa que já subimos demais.
      if (parent.querySelector('[aria-expanded], h1, h2, h3, h4, h5, h6, [role="heading"]')) break;
      current = parent;
    }
    return current;
  }

  function findRows(root) {
    const rows = new Set();
    for (const element of root.querySelectorAll('a[href]')) {
      if (lessonHref(element) && !inHiddenPanel(element)) rows.add(rowFor(element));
    }
    for (const element of root.querySelectorAll(ITEM_DATA)) rows.add(element);
    // Plano B: itens de lista com duração, quando a rota da aula não ajuda.
    if (rows.size < 3) {
      for (const element of root.querySelectorAll(ROW_SELECTOR)) {
        if (DURATION.test(textOf(element)) && textOf(element).length <= 220) rows.add(element);
      }
    }
    // Só o item mais interno: um contêiner de lista não é uma aula.
    return [...rows].filter((row) => ![...rows].some((other) => other !== row && row.contains(other)));
  }

  function commonAncestor(elements) {
    let node = elements[0];
    while (node && !elements.every((element) => node.contains(element))) node = node.parentElement;
    return node || document.body;
  }

  function signature(row) {
    const purpose = attributeOf(row, 'data-purpose').replace(/[\d-]+$/, '').slice(0, 30);
    const firstClass = attributeOf(row, 'class').split(/\s+/)[0].replace(/\d+/g, '');
    return `${row.tagName}|${purpose}|${firstClass}`;
  }

  // O grupo dominante de itens parecidos é a lista de aulas; menus e listas de
  // outros cursos têm outra assinatura e ficam de fora.
  function lessonRegion(rows, known = null) {
    const bySignature = new Map();
    for (const row of rows) {
      const key = signature(row);
      bySignature.set(key, [...(bySignature.get(key) || []), row]);
    }
    const dominant = [...bySignature.values()].sort((a, b) => b.length - a.length)[0] || [];
    // Uma disciplina com poucas aulas, lida depois de outras, tem menos de três
    // itens; vale se o formato já foi reconhecido antes na mesma leitura.
    const recognised = dominant.length > 0 && known?.has(signature(dominant[0]));
    if (dominant.length < 3 && !recognised) return null;
    known?.add(signature(dominant[0]));
    const region = commonAncestor(dominant);
    return { region, rows: rows.filter((row) => region.contains(row)) };
  }

  // "Marcar como concluída" é o botão que ainda vai concluir: não é estado.
  // "Desmarcar como concluída" só existe quando a aula já está concluída.
  function labelSaysDone(value) {
    const label = clean(value);
    if (!label) return false;
    if (/\b(desmarcar|unmark|mark as (?:in|un)complete)\b/i.test(label)) return true;
    if (/\b(marcar|mark|definir|set)\b/i.test(label)) return false;
    return DONE_TEXT.test(label) && !NOT_DONE_TEXT.test(label);
  }

  function isDone(row) {
    if (row.querySelector('input[type="checkbox"]:checked')) return true;
    const flagged = [row, ...row.querySelectorAll('*')].slice(0, 60);
    for (const element of flagged) {
      if (element.getAttribute?.('aria-checked') === 'true') return true;
      if (['data-completed', 'data-done', 'data-complete'].some((name) => element.getAttribute?.(name) === 'true')) return true;
      for (const name of ['data-status', 'data-state', 'data-progress']) {
        const value = attributeOf(element, name);
        if (/^(completed?|done|finished|checked|concluid[ao])$/i.test(value)) return true;
      }
      if (labelSaysDone(`${attributeOf(element, 'aria-label')} ${attributeOf(element, 'title')}`)) return true;
      const classes = attributeOf(element, 'class');
      if (classes && DONE_CLASS.test(classes) && !NOT_DONE_CLASS.test(classes)) return true;
    }
    // Ícone com <title>: "Concluído".
    for (const title of row.querySelectorAll('svg title')) {
      if (labelSaysDone(title.textContent)) return true;
    }
    // Font Awesome: o círculo vazio é "far fa-circle"; o marcado é "circle-check".
    return Boolean(row.querySelector('svg[data-icon*="check"]'));
  }

  function rowTitle(row) {
    const preferred = row.querySelector('[data-purpose*="title" i], [class*="title" i], [class*="titulo" i]');
    const link = row.tagName === 'A' ? row : row.querySelector('a[href]');
    // Dentro do link, o nome da aula costuma ser o parágrafo/título; o resto é dica ou professor.
    const inner = link?.querySelector('p, h1, h2, h3, h4, h5, h6');
    const source = (preferred && textOf(preferred).length >= 3 ? preferred
      : inner && textOf(inner).length >= 3 ? inner
        : link && textOf(link).length >= 3 ? link : row);
    let text = textOf(source);
    const durationMatch = DURATION.exec(` ${text} `);
    if (durationMatch) text = clean(text.replace(durationMatch[1], ' '));
    // Texto de leitor de tela misturado ao título: "Concluído", "Em andamento".
    text = clean(text.replace(/\b(conclu[ií]d[ao]s?|not completed|completed|em andamento|n[ãa]o iniciad[ao])\b/gi, ' '));
    return text.replace(/^[\s·•|:-]+|[\s·•|:-]+$/g, '').slice(0, 200);
  }

  function rowDuration(row) {
    const match = DURATION.exec(` ${textOf(row)} `);
    return match ? toSeconds(match[1]) : null;
  }

  // ---------- Grupos ----------

  function headerText(element) {
    const visible = (element.innerText || '').split('\n').map(clean).find(Boolean) || textOf(element);
    return clean(visible)
      .replace(/\s*\d+\s*\/\s*\d+.*$/, '')
      .replace(/\s*\d+\s*(aulas?|lessons?|lectures?|itens?|items?|v[ií]deos?)\b.*$/i, '')
      .replace(/\s*·.*$/, '')
      .slice(0, 150);
  }

  // Selo "Concluído" no título do grupo (sem porcentagem nem contagem, que são
  // progresso parcial e não conclusão).
  function headerDone(element) {
    const full = textOf(element);
    if (!/\bconclu[ií]d[oa]\b|\bcompleted\b/i.test(full)) return false;
    return !/\d+\s*%|\d+\s*\/\s*\d+|n[ãa]o\s+conclu|incomplete/i.test(full);
  }

  // Nível 0 = disciplina, 1 = módulo/aula/seção. Plataformas que rotulam o botão
  // ("Disciplina X - 8% concluído", "Aula 2 - Y") dão o nome sem ruído.
  function headerInfo(element) {
    const label = clean(attributeOf(element, 'aria-label'));
    const discipline = /^Disciplina\s+(.+?)(?:\s+-\s+\d+\s*%.*)?$/i.exec(label);
    if (discipline) return { level: 0, text: discipline[1].slice(0, 150), done: false };
    const lesson = /^Aula\s+(\d+)\s+-\s+(.+)$/i.exec(label);
    if (lesson) return { level: 1, text: `Aula ${lesson[1]} - ${lesson[2]}`.slice(0, 150), done: headerDone(element) };
    return { level: 1, text: headerText(element), done: headerDone(element) };
  }

  function findHeaders(region, rows, titleToSkip) {
    // Com uma só disciplina aberta, o botão dela fica fora da região das aulas:
    // procuramos um pouco acima, mas só aceitamos ali cabeçalhos de disciplina.
    let root = region;
    for (let level = 0; level < 8 && root.parentElement && root.parentElement !== document.body; level += 1) root = root.parentElement;
    const headers = [];
    for (const element of root.querySelectorAll(HEADER_SELECTOR)) {
      if (element.tagName === 'H1') continue;
      if (element.closest('footer')) continue;
      if (rows.some((row) => row.contains(element) || element.contains(row))) continue;
      if (element.hasAttribute('aria-haspopup') || inHiddenPanel(element)) continue;
      const info = headerInfo(element);
      if (!region.contains(element) && info.level !== 0) continue;
      if (info.text.length < 3 || NOISE_WORD.test(info.text) || NOISE_START.test(info.text) || info.text === titleToSkip) continue;
      if (element.hasAttribute('aria-expanded') && NOT_A_MENU.test(`${info.text} ${attributeOf(element, 'aria-label')}`)) continue;
      headers.push({ element, ...info, expandable: element.hasAttribute('aria-expanded') });
    }
    // O título dentro de um botão de seção ("Tópico 1") é parte do mesmo cabeçalho.
    return headers.filter((header) => !headers.some((other) => other !== header && other.element.contains(header.element)));
  }

  const inOrder = (a, b) => (a === b ? 0 : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  // Disciplinas → módulos → aulas. Plataformas com um nível só ficam numa
  // disciplina "Conteúdo do curso".
  function buildGroups(region, rows, titleToSkip) {
    const headers = findHeaders(region, rows, titleToSkip);
    const sequence = [
      ...headers.map((header) => ({ type: 'header', element: header.element, info: header })),
      ...rows.map((row) => ({ type: 'row', element: row })),
    ].sort((a, b) => inOrder(a.element, b.element));

    const disciplines = [];
    let discipline = null;
    let module = null;
    const seen = new Set();
    const ensureDiscipline = () => {
      if (!discipline) { discipline = { title: 'Conteúdo do curso', modules: [] }; disciplines.push(discipline); }
      return discipline;
    };
    for (const item of sequence) {
      if (item.type === 'header') {
        const { level, text, done, expandable } = item.info;
        if (level === 0) {
          const empty = discipline && !discipline.modules.some((candidate) => candidate.lessons.length);
          if (empty) { discipline.title = text; discipline.modules = []; } else { discipline = { title: text, modules: [] }; disciplines.push(discipline); }
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
      const anchor = item.element.tagName === 'A' ? item.element : item.element.querySelector('a[href]');
      const url = anchor ? lessonHref(anchor) : '';
      if (!module) { module = { title: 'Conteúdo', lessons: [], done: false }; ensureDiscipline().modules.push(module); }
      // A mesma aula pode aparecer duas vezes (cópia móvel/desktop, aba escondida).
      const key = url || `${disciplines.length}|${discipline.modules.length}|${title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      module.lessons.push({ title, url, duration: rowDuration(item.element), completed: isDone(item.element) });
    }
    for (const candidate of disciplines) {
      for (const entry of candidate.modules) {
        if (entry.done) for (const lesson of entry.lessons) lesson.completed = true;
        // Seção que não abriu: os vídeos não vieram, mas o nome e o selo de
        // concluída vieram. Entra como um item só, marcado, para a contagem e o
        // progresso não sumirem; quando os vídeos forem lidos, ele sai.
        if (!entry.lessons.length && entry.expandable) {
          entry.lessons.push({ title: entry.title, url: '', duration: null, completed: entry.done, pending: true });
        }
      }
      candidate.modules = candidate.modules.filter((entry) => entry.lessons.length);
    }
    return disciplines.filter((entry) => entry.modules.length);
  }

  // ---------- Seções fechadas ----------

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const MAX_CLICKS = 600;
  const OVERALL_MS = 240000;

  // Espera a página parar de mudar: os vídeos de uma seção costumam chegar por
  // rede depois do clique. `cap` impede esperar para sempre por uma animação.
  function settle({ quiet = 350, min = 150, cap = 7000, until = null } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      let last = start;
      const observer = new MutationObserver(() => { last = Date.now(); });
      observer.observe(document.body, { childList: true, subtree: true });
      const tick = () => {
        const now = Date.now();
        if ((now - start >= min && now - last >= quiet && (!until || until())) || now - start >= cap) { observer.disconnect(); resolve(); } else setTimeout(tick, 60);
      };
      setTimeout(tick, 60);
    });
  }

  async function waitFor(condition, cap) {
    const start = Date.now();
    while (Date.now() - start < cap) {
      if (condition()) return true;
      await wait(100);
    }
    return condition();
  }

  const linkCount = () => lessonLinkCount(document.body);
  const textLength = () => (document.body.innerText || '').length;

  function collapsedToggles() {
    return [...document.querySelectorAll('[aria-expanded="false"]')].filter((element) => {
      if (element.tagName === 'A' || element.closest('nav, header, footer, [role="menu"], [role="menubar"], [role="dialog"]')) return false;
      if (element.hasAttribute('aria-haspopup') || inHiddenPanel(element)) return false;
      const text = clean(`${element.textContent} ${attributeOf(element, 'aria-label')}`);
      return text.length > 0 && text.length <= 300 && !NOT_A_MENU.test(text);
    });
  }

  // ---------- Acúmulo entre leituras parciais ----------
  // Alguns sites (o Gran, por exemplo) fecham as outras seções ao abrir uma. Por
  // isso lemos depois de cada seção e juntamos tudo aqui.

  function mergeDisciplines(accumulated, found) {
    for (const discipline of found) {
      let target = accumulated.find((entry) => entry.title === discipline.title);
      if (!target) { target = { title: discipline.title, modules: [] }; accumulated.push(target); }
      for (const entry of discipline.modules) {
        let module = target.modules.find((item) => item.title === entry.title);
        if (!module) { module = { title: entry.title, lessons: [], pending: null }; target.modules.push(module); }
        for (const lesson of entry.lessons) {
          if (lesson.pending) { module.pending = module.pending || lesson; continue; }
          const key = lesson.url || lesson.title;
          const same = module.lessons.find((item) => (item.url || item.title) === key);
          if (!same) module.lessons.push(lesson);
          else if (lesson.completed) same.completed = true;
        }
      }
    }
  }

  // Seção que nunca abriu vira um item dela mesma, mas num módulo só por
  // disciplina, para a lista não repetir "Aula 2" como módulo e como aula.
  function finalizeDisciplines(accumulated) {
    const result = [];
    for (const discipline of accumulated) {
      const modules = [];
      const unread = [];
      for (const module of discipline.modules) {
        if (module.lessons.length) modules.push({ title: module.title, lessons: module.lessons });
        else if (module.pending) unread.push({ ...module.pending, title: module.title });
      }
      if (unread.length) modules.push({ title: 'Aulas cujos vídeos não foram lidos', lessons: unread });
      if (modules.length) result.push({ title: discipline.title, modules });
    }
    return result;
  }

  // Abre as seções, uma disciplina por vez quando o site fecha as outras, lê
  // depois de cada uma e devolve a página ao estado em que estava.
  async function sweep(skipTitle, report) {
    const accumulated = [];
    const knownSignatures = new Set();
    const harvest = () => {
      const found = lessonRegion(findRows(document.body), knownSignatures);
      if (found) mergeDisciplines(accumulated, buildGroups(found.region, found.rows, skipTitle));
    };
    const initiallyOpen = [...document.querySelectorAll('[aria-expanded="true"]')];
    const opened = new Set();
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
    // Seções dentro da seção que acabou de abrir (aulas dentro da disciplina). O
    // conteúdo pode chegar por rede, então espera aparecer antes de desistir.
    const openInside = async (scope, baseline) => {
      await waitFor(() => linkCount() > baseline || innerToggles(scope).length > 0, 3500);
      for (let round = 0; round < 3 && Date.now() < deadline; round += 1) {
        const inner = innerToggles(scope);
        if (!inner.length) return;
        const before = linkCount();
        for (const element of inner) open(element);
        await settle({ until: () => linkCount() > before, cap: 6000 });
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
        report?.(`Lendo a seção ${index} de ${toggles.length}…`);
        await settle({ until: () => textLength() !== text || linkCount() !== baseline, cap: 4000 });
        await openInside(element.parentElement || element, baseline);
        harvest();
        // Se abrir esta seção fechou a anterior, o site é exclusivo: uma por vez.
        if (exclusive === null && previous?.isConnected) exclusive = previous.getAttribute('aria-expanded') !== 'true';
        previous = element;
        if (exclusive === false) {
          // Seções independentes: abre as restantes de uma vez e lê no fim.
          const before = linkCount();
          for (; index < toggles.length; index += 1) open(toggles[index]);
          await settle({ until: () => linkCount() > before, cap: 7000 });
          await openInside(document.body, before);
          harvest();
          break;
        }
      }
    }

    // Devolve a página como estava: fecha o que abrimos e reabre o que estava aberto.
    const restore = async () => {
      for (const element of [...opened].reverse()) {
        if (element.isConnected && element.getAttribute('aria-expanded') === 'true' && !initiallyOpen.includes(element)) element.click();
      }
      await wait(100);
      for (const element of initiallyOpen) {
        if (element.isConnected && element.getAttribute('aria-expanded') === 'false') element.click();
      }
    };
    return { disciplines: finalizeDisciplines(accumulated), restore, clicks };
  }

  // ---------- Entrada ----------

  const report = (text) => { try { chrome.runtime.sendMessage({ type: 'lume-progress', text }); } catch { /* fora da extensão */ } };

  async function run({ pageUrl = location.href, pageTitle = '', expand = true } = {}) {
    let restore = async () => {};
    try {
      const { title, code } = courseIdentity(pageTitle);
      let disciplines;
      if (expand) {
        const result = await sweep(title, report);
        restore = result.restore;
        disciplines = result.disciplines;
      } else {
        const found = lessonRegion(findRows(document.body));
        if (!found) return { ok: false, reason: 'no_lessons' };
        const accumulated = [];
        mergeDisciplines(accumulated, buildGroups(found.region, found.rows, title));
        disciplines = finalizeDisciplines(accumulated);
      }
      if (!disciplines.length) return { ok: false, reason: 'no_lessons' };

      let truncated = false;
      if (disciplines.length > MAX_DISCIPLINES) { disciplines = disciplines.slice(0, MAX_DISCIPLINES); truncated = true; }
      let budget = MAX_LESSONS;
      disciplines = disciplines.map((discipline) => {
        let modules = discipline.modules;
        if (modules.length > MAX_GROUPS) { modules = modules.slice(0, MAX_GROUPS); truncated = true; }
        modules = modules.map((entry) => {
          if (entry.lessons.length > budget) truncated = true;
          const lessons = entry.lessons.slice(0, Math.max(budget, 0));
          budget -= lessons.length;
          return { ...entry, lessons };
        }).filter((entry) => entry.lessons.length);
        return { ...discipline, modules };
      }).filter((discipline) => discipline.modules.length);

      const all = disciplines.flatMap((discipline) => discipline.modules.flatMap((entry) => entry.lessons));
      if (all.length < 3) return { ok: false, reason: 'no_lessons' };
      const pending = all.filter((lesson) => lesson.pending).length;
      const groupCount = disciplines.reduce((total, discipline) => total + discipline.modules.length, 0);

      const sourceUrl = courseUrlFor(pageUrl);
      let host = '';
      try { host = new URL(pageUrl).hostname; } catch { host = location.hostname; }
      const notes = ['Lido pela extensão do Lume na página aberta com a sua conta. Confira se todos os itens são aulas.'];
      const warnings = ['A leitura mostra só o que a página tinha na tela. Aulas de seções que não abriram, ou carregadas depois, podem faltar.'];
      if (pending) warnings.push(`${pending} ${pending === 1 ? 'seção não abriu' : 'seções não abriram'}: ${pending === 1 ? 'entrou' : 'entraram'} como um item só, sem os vídeos. Leia a página de novo para tentar abrir.`);
      if (truncated) warnings.push(`A leitura passou do limite do Lume (${MAX_LESSONS} aulas, ${MAX_DISCIPLINES} disciplinas) e foi cortada. Importe por partes.`);

      return {
        ok: true,
        stats: { lessons: all.length, groups: groupCount, disciplines: disciplines.length, completed: all.filter((lesson) => lesson.completed).length, pending, truncated },
        payload: {
          title: title || 'Curso importado',
          provider: { id: providerFor(host) },
          sourceUrl,
          externalId: code,
          completionSource: 'lesson-flags',
          disciplines: disciplines.map((discipline) => ({
            title: discipline.title,
            modules: discipline.modules.map((entry) => ({
              title: entry.title,
              lessons: entry.lessons.map((lesson) => ({
                title: lesson.title,
                url: lesson.url,
                duration: lesson.duration,
                completed: lesson.completed,
              })),
            })),
          })),
          extraction: { kind: 'extension-capture', confidence: 'medium', notes },
          completeness: 'partial',
          warnings,
          analyzedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return { ok: false, reason: 'error', message: String(error?.message || error).slice(0, 200) };
    } finally {
      try { await restore(); } catch { /* a página mudou; nada a restaurar */ }
    }
  }

  globalThis.LumeCapture = { run, courseUrlFor, toSeconds, isDone };
})();
