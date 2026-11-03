// Modelo persistido único: materiais e unidades hierárquicas. A projeção para
// as telas antigas deriva steps/structure; essas listas não são armazenadas.
export function splitMaterial(course) {
  const { steps = [], structure, selection: _selection, ...material } = course;
  const selected = new Set(steps.map((step) => step.id));
  const units = [];
  const seen = new Set();
  const add = (value, parentId, kind, position) => {
    if (seen.has(value.id)) return;
    seen.add(value.id);
    units.push({ id: value.id, parentId, kind, position, selected: selected.has(value.id), data: value });
  };
  if (Array.isArray(structure)) {
    structure.forEach(({ modules = [], ...discipline }, d) => {
      add(discipline, null, 'discipline', d);
      modules.forEach(({ lessons = [], ...module }, m) => {
        add(module, discipline.id, 'module', m);
        lessons.forEach((lesson, l) => add(lesson, module.id, 'lesson', l));
      });
    });
  }
  steps.forEach((step, index) => { if (!seen.has(step.id)) add(step, null, 'step', index); });
  return { material, units };
}

export function projectMaterial(material, units) {
  const children = (parentId) => units.filter((unit) => unit.parentId === parentId).sort((a, b) => a.position - b.position);
  const roots = children(null);
  const structure = roots.filter((unit) => unit.kind === 'discipline').map((discipline) => ({
    ...discipline.data,
    modules: children(discipline.id).map((module) => ({
      ...module.data, lessons: children(module.id).map((lesson) => lesson.data),
    })),
  }));
  const steps = [];
  for (const discipline of structure) for (const module of discipline.modules) for (const lesson of module.lessons) {
    if (units.find((unit) => unit.id === lesson.id)?.selected) steps.push({ id: lesson.id, title: lesson.title, discipline: discipline.title, module: module.title, removedFromSource: lesson.removedFromSource === true });
  }
  steps.push(...roots.filter((unit) => unit.kind === 'step' && unit.selected).map((unit) => unit.data));
  return { ...material, steps, ...(structure.length ? { structure, selection: { lessonIds: steps.map((step) => step.id) } } : {}) };
}

// Única leitura da árvore nas telas. Aceita o documento de compatibilidade e
// registros normalizados, sem manter uma segunda lista de unidades editável.
const views = new WeakMap();
export function materialView(course) {
  if (!course || typeof course !== 'object') return { steps: [], structure: [] };
  if (!views.has(course)) {
    const { units: storedUnits, ...metadata } = course;
    const { material, units } = Array.isArray(storedUnits)
      ? { material: metadata, units: storedUnits }
      : splitMaterial(course);
    views.set(course, projectMaterial(material, units));
  }
  return views.get(course);
}

export function materialSteps(course) { return materialView(course).steps; }
export function materialStructure(course) { return materialView(course).structure || []; }
export function materialLesson(course, id) {
  for (const discipline of materialStructure(course)) for (const module of discipline.modules) {
    const lesson = module.lessons.find((item) => item.id === id);
    if (lesson) return { ...lesson, discipline: discipline.title, module: module.title };
  }
  return materialSteps(course).find((step) => step.id === id) || null;
}
