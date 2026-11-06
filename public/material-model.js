// Modelo único em memória, transporte e persistência. Árvores e listas de aulas
// são visualizações derivadas; nunca são gravadas no material.
export function splitMaterial(course) {
  const { units = [], ...material } = course;
  return { material, units };
}

export function projectMaterial(material, units) {
  return { ...material, units };
}

export function stepUnits(steps) {
  return steps.map((data, position) => ({ id: data.id, parentId: null, kind: 'step', position, selected: true, data }));
}

export function unitsFromStructure(structure, selectedIds) {
  const selected = new Set(selectedIds);
  const units = [];
  for (const [position, { modules, ...data }] of structure.entries()) {
    units.push({ id: data.id, parentId: null, kind: 'discipline', position, selected: false, data });
    for (const [position, { lessons, ...module }] of modules.entries()) {
      units.push({ id: module.id, parentId: data.id, kind: 'module', position, selected: false, data: module });
      for (const [position, lesson] of lessons.entries()) {
        units.push({ id: lesson.id, parentId: module.id, kind: 'lesson', position, selected: selected.has(lesson.id), data: lesson });
      }
    }
  }
  return units;
}

const views = new WeakMap();
export function materialView(course) {
  if (!course || typeof course !== 'object') return { steps: [], structure: [] };
  if (!views.has(course)) {
    const children = new Map();
    for (const unit of course.units || []) {
      if (!children.has(unit.parentId)) children.set(unit.parentId, []);
      children.get(unit.parentId).push(unit);
    }
    for (const list of children.values()) list.sort((a, b) => a.position - b.position);
    const roots = children.get(null) || [];
    const steps = [];
    const structure = roots.filter((unit) => unit.kind === 'discipline').map((discipline) => ({
      ...discipline.data,
      modules: (children.get(discipline.id) || []).map((module) => ({
        ...module.data,
        lessons: (children.get(module.id) || []).map((lesson) => {
          if (lesson.selected) steps.push({ ...lesson.data, discipline: discipline.data.title, module: module.data.title });
          return lesson.data;
        }),
      })),
    }));
    steps.push(...roots.filter((unit) => unit.kind === 'step' && unit.selected).map((unit) => unit.data));
    views.set(course, { steps, structure });
  }
  return views.get(course);
}

export function materialSteps(course) { return materialView(course).steps; }
export function materialStructure(course) { return materialView(course).structure; }
export function materialLesson(course, id) {
  return materialSteps(course).find((step) => step.id === id) || null;
}

// Pais inexistentes, ciclos, ids duplicados e tipos em níveis errados não podem
// ser confirmados pela API.
export function normalizeMaterialUnits(units) {
  if (!Array.isArray(units)) return [];
  const byId = new Map();
  for (const unit of units) {
    if (!unit || typeof unit.id !== 'string' || !unit.id || unit.data?.id !== unit.id
      || typeof unit.data?.title !== 'string' || !unit.data.title.trim()
      || !Number.isInteger(unit.position) || unit.position < 0 || typeof unit.selected !== 'boolean'
      || byId.has(unit.id)) continue;
    byId.set(unit.id, unit);
  }
  const roots = new Set([...byId.values()].filter((unit) => ['discipline', 'step'].includes(unit.kind) && unit.parentId === null).map((unit) => unit.id));
  const modules = new Set([...byId.values()].filter((unit) => unit.kind === 'module' && roots.has(unit.parentId) && byId.get(unit.parentId).kind === 'discipline').map((unit) => unit.id));
  return [...byId.values()].filter((unit) => roots.has(unit.id) || modules.has(unit.id) || (unit.kind === 'lesson' && modules.has(unit.parentId)));
}
