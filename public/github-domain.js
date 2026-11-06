import { addMaterial } from './domain.js';

// A análise é uma sugestão: só as entregas escolhidas entram no projeto.
export function createGitHubProject(state, analysis, chosen) {
  const next = addMaterial(state, {
    title: analysis.repository.name,
    url: analysis.repository.url,
    type: 'project',
    steps: chosen.map((item) => item.title),
    planning: false,
  }, 'manual');
  return {
    ...next,
    courses: next.courses.map((course) => course.id === next.selectedCourseId ? {
      ...course,
      github: {
        owner: analysis.repository.owner,
        name: analysis.repository.name,
        fullName: analysis.repository.fullName,
        url: analysis.repository.url,
        analyzedAt: analysis.analyzedAt,
        suggestions: chosen.map((item) => ({ id: item.id, title: item.title, source: item.source })),
      },
    } : course),
  };
}
