// Cargos reconhecem marcos; nenhuma funcionalidade depende deles.
export function earnedTitles({ level = 1, lessons = 0, readings = 0, materials = 0, disciplines = 0, courses = 0, hasFriend = false, builtProject = false, areas = {} }) {
  const titles = [
    ['beginner', 'Iniciante', 'Conta criada', true],
    ['student', 'Estudante', 'Nível 3 e 5 aulas ou leituras concluídas', level >= 3 && lessons + readings >= 5],
    ['dedicated', 'Pessoa dedicada aos estudos', 'Nível 5 e 1 disciplina ou material concluído', level >= 5 && disciplines + materials >= 1],
    ['curator', 'Pessoa curadora', 'Nível 8 e 2 materiais concluídos', level >= 8 && materials >= 2],
    ['partner', 'Pessoa parceira de estudo', 'Nível 10, amizade aceita e 20 aulas concluídas', level >= 10 && hasFriend && lessons >= 20],
    ['builder', 'Pessoa construtora', 'Projeto concluído com pelo menos 3 entregas', builtProject],
    ['reference', 'Referência', 'Nível 15 e 2 cursos concluídos', level >= 15 && courses >= 2],
  ].filter(([, , , earned]) => earned).map(([id, title, criterion]) => ({ id, title, criterion }));
  for (const [area, count] of Object.entries(areas)) {
    if (count >= 30) titles.push({ id: `specialist:${area}`, title: `Especialista em ${area}`, criterion: '30 aulas concluídas na mesma área' });
  }
  return titles;
}
