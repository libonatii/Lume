// Traduz uma edição da tela em operações por entidade. Não há fila persistida,
// documento remoto substituído nem reconciliação: cada edição exige resposta.
const COLLECTIONS = { courses: 'material', tasks: 'task', studySessions: 'session', progress: 'progress', agenda: 'appointment' };
export const ACCOUNT_FIELDS = ['onboarded', 'onboarding', 'habit', 'challenges', 'supports', 'profile', 'preferences', 'plan', 'activeSession', 'selectedCourseId', 'focusTaskId', 'imports'];

export function libraryActions(previous, next) {
  const actions = [];
  for (const [field, entity] of Object.entries(COLLECTIONS)) {
    const old = new Map((previous[field] || []).map((item) => [item.id, item]));
    for (const item of next[field] || []) {
      if (JSON.stringify(old.get(item.id)) !== JSON.stringify(item)) actions.push({ type: `${entity}.put`, value: item });
      old.delete(item.id);
    }
    for (const id of old.keys()) actions.push({ type: `${entity}.delete`, id });
    const ids = (next[field] || []).map((item) => item.id);
    if (JSON.stringify(ids) !== JSON.stringify((previous[field] || []).map((item) => item.id))) actions.push({ type: `${entity}.order`, ids });
  }
  const patch = {};
  for (const field of ACCOUNT_FIELDS) if (JSON.stringify(previous[field]) !== JSON.stringify(next[field])) patch[field] = next[field];
  if (Object.keys(patch).length) actions.push({ type: 'account.update', value: patch });
  return actions;
}
