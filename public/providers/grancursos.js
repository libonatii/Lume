// Gran Cursos Online.
//
// A grade detalhada só existe na área logada. O painel do curso busca a grade em
// JSON, na mesma origem e com o cookie da sessão: disciplinas → aulas → vídeos,
// e cada vídeo diz se foi visualizado. O leitor `page` roda na extensão, na
// página aberta pela pessoa, e pede as mesmas rotas só com GET; o cookie quem
// envia é o navegador, o Lume não o lê. Formato conferido em 01/11/2026 com uma
// conta real (31 disciplinas, 427 aulas). Cada aula do Gran vira uma aula do Lume.

import { clean, mapLimited, toSeconds } from './kit.js';

const COURSE_PATH = /^\/aluno\/curso\/(?:video\/)?codigo\/([^/]+)/i;
const CONCURRENCY = 6;

function identify(url) {
  const code = COURSE_PATH.exec(url.pathname)?.[1];
  if (!code) return null;
  return { courseExternalId: code, canonicalUrl: `${url.origin}/aluno/curso/video/codigo/${code}` };
}

const seconds = (video) => Number(video?._tempo_duracao) || toSeconds(video?.st_tempo_duracao) || 0;

// ctx: { pageUrl, origin, fetchJson(path), report(texto), limits: { disciplines } }
async function readPage({ pageUrl, origin, fetchJson, report = () => {}, limits = {} }) {
  let url;
  try { url = new URL(pageUrl); } catch { return null; }
  if (url.origin !== origin) return null;
  const course = identify(url);
  if (!course) return null;
  const maxDisciplines = limits.disciplines || 40;
  const base = `/aluno/curso/listar-conteudo-aula/codigo/${course.courseExternalId}/tipo/video`;
  const query = '?audiobooks=true';

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
      const title = clean(`Aula ${item?.index ?? position + 1}${clean(item?.desc) ? ` - ${clean(item.desc)}` : ''}`).slice(0, 200);
      // O id da aula no Gran é a identidade estável: o título pode mudar.
      const externalId = item?.id != null ? `${subject.id}/${item.id}` : '';
      if (!videos?.length) {
        // Sem a lista de vídeos, a conclusão vem da contagem que o próprio Gran mostra.
        unread += 1;
        return { title, externalId, url: '', duration: null, completed: Number(progress?.qtdAulas) > 0 && Number(progress?.qtdAulasAssistidas) >= Number(progress?.qtdAulas) };
      }
      const total = videos.reduce((sum, video) => sum + seconds(video), 0);
      return {
        title,
        externalId,
        url: `${origin}/aluno/curso/video/codigo/${course.courseExternalId}/v/${encodeURIComponent(videos[0].id_video)}`,
        duration: total || null,
        completed: videos.every((video) => video.visualizado === true),
      };
    });
    disciplines.push({ title: name, externalId: String(subject.id), modules: [{ title: 'Aulas', lessons }] });
  }
  if (!disciplines.length) return null;
  return {
    disciplines,
    truncated,
    unread,
    externalId: course.courseExternalId,
    notes: ['Lido pela extensão do Lume na grade que o Gran entrega à página aberta com a sua conta. Cada aula do Gran entra como uma aula; ela conta como concluída quando todos os vídeos dela aparecem como assistidos.'],
    warnings: unread ? [`${unread} ${unread === 1 ? 'aula veio' : 'aulas vieram'} sem a lista de vídeos: a conclusão segue a contagem do Gran e o link ficou vazio.`] : [],
  };
}

export default {
  id: 'grancursos',
  label: 'Gran Cursos Online',
  aliases: ['Gran Cursos', 'Gran'],
  hosts: ['grancursosonline.com.br'],
  structure: 'disciplinas e assuntos',
  art: 'nature',
  syllabus: 'page',
  note: 'A página pública costuma mostrar as disciplinas do pacote. Módulos e aulas detalhados normalmente ficam na área autenticada: abra o curso logado e use a extensão do Lume, ou copie a página e cole, ou envie o texto.',
  capabilities: { syllabus: 'full', progress: 'lesson-flags', resume: false, requiresLogin: true },
  identify,
  readers: { page: readPage },
};
