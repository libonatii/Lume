// Motor de recompensas (refatoração F4).
//
// Cada regra diz a que evento responde (`on`), quando vale (`grant`) e o que
// concede: chave idempotente, tipo, XP e, quando houver, conquista. Valores e
// marcos vêm de public/xp-policy.js; as conclusões vêm do registro de progresso
// do servidor (progress.js), nunca de uma lista que o navegador escreveu.
// Uma regra nova é uma entrada em RULES com teste — sem rota nova e sem código
// no cliente.

import {
  XP_VALUES, bonusEventKey, bonusKindForCourse, completionKindForCourse, courseGradeIsComplete,
  isEligibleCourse, isImportedCourse, localDay, slideEventKey, slideProgressSnapshot, stepEventKey,
} from '../../public/xp-policy.js';
import { XpError, ensureXpSettings, findEvent, insertAchievement, insertEvent, serializeEvent } from './xp.js';
import { accountMode, eligibleCompletions, loadLibrary, syncFromDocument } from './progress.js';
import { materialSteps } from '../../public/material-model.js';

function iso(value) {
  return new Date(value).toISOString();
}

function refuse(code, message) {
  return { refusal: { code, message } };
}

function unitTitle(course, step) {
  return materialSteps(course).length === 1 ? course.title : `${step.title} — ${course.title}`;
}

export const RULES = [
  {
    id: 'unit-completion',
    on: 'unit.completed',
    // Aula, leitura, exercício ou entrega concluída depois do marco da política.
    grant({ course, step, completions, since }) {
      if (!isEligibleCourse(course)) return refuse('material_not_eligible', 'Este material não participa da política de XP.');
      const at = completions.get(step.id);
      if (at === undefined) return refuse('step_not_completed', 'Conclua a etapa antes de registrar o XP.');
      if (at < since) return refuse('legacy_progress', 'Este progresso é anterior à política atual e permanece como saldo legado.');
      const kind = completionKindForCourse(course);
      const achievement = kind === 'reading'
        ? { kind: 'reading', title: unitTitle(course, step), criterion: 'Leitura delimitada concluída' }
        : kind === 'exercise'
          ? { kind: 'exercise', title: unitTitle(course, step), criterion: 'Lista de exercícios concluída' }
          : null;
      return {
        grant: {
          key: stepEventKey(kind, course.id, step.id), kind, xp: XP_VALUES[kind],
          materialId: course.id, materialTitle: course.title, stepId: step.id, stepTitle: step.title,
          meta: JSON.stringify({ area: step.discipline || course.category || '' }),
          achievement,
        },
      };
    },
  },
  {
    id: 'material-completion',
    on: 'unit.completed',
    // Bônus de contêiner: todas as unidades obrigatórias concluídas depois do
    // marco. Grade parcial não conclui o curso; material de uma etapa não tem bônus.
    grant({ course, completions, since }) {
      if (!isEligibleCourse(course)) return refuse('material_not_eligible', 'Este material não participa da política de XP.');
      if (!courseGradeIsComplete(course)) return refuse('partial_grade', 'Uma grade parcial não conclui o curso inteiro.');
      if (!materialSteps(course).every((item) => completions.has(item.id))) return refuse('course_not_complete', 'Ainda há unidades obrigatórias em aberto.');
      const minimum = course.type === 'project' ? 1 : 2;
      if (!isImportedCourse(course) && materialSteps(course).length < minimum) return refuse('too_short', 'Um material de uma única etapa não recebe bônus de conclusão.');
      if (materialSteps(course).some((item) => completions.get(item.id) < since)) {
        return refuse('legacy_progress', 'A conclusão inclui etapas anteriores à política atual; o bônus não é retroativo.');
      }
      const kind = bonusKindForCourse(course);
      return {
        grant: {
          key: bonusEventKey(kind, course.id), kind, xp: XP_VALUES[kind],
          materialId: course.id, materialTitle: course.title, stepId: '', stepTitle: '',
          achievement: kind === 'project_bonus'
            ? { kind: 'project', title: course.title, criterion: 'Todas as entregas obrigatórias concluídas' }
            : { kind: 'course', title: course.title, criterion: 'Todas as unidades obrigatórias concluídas' },
        },
      };
    },
  },
  {
    id: 'discipline-completion',
    on: 'unit.completed',
    grant({ course, step, completions, since }) {
      if (!isEligibleCourse(course) || !step) return refuse('material_not_eligible', 'Disciplina indisponível.');
      const unit = course.units.find((item) => item.id === step.id && item.kind === 'lesson');
      const module = course.units.find((item) => item.id === unit?.parentId);
      const discipline = course.units.find((item) => item.id === module?.parentId && item.kind === 'discipline');
      if (!discipline || discipline.data.removedFromSource) return refuse('discipline_missing', 'Disciplina indisponível.');
      if ((discipline.data.completeness || course.source?.completeness) !== 'complete') return refuse('partial_grade', 'A grade da disciplina é parcial.');
      const modules = new Set(course.units.filter((item) => item.parentId === discipline.id).map((item) => item.id));
      const lessons = course.units.filter((item) => item.kind === 'lesson' && modules.has(item.parentId) && !item.data.removedFromSource);
      if (!lessons.length || lessons.some((item) => !item.selected || !completions.has(item.id) || completions.get(item.id) < since)) return refuse('discipline_not_complete', 'Conclua todas as aulas elegíveis da disciplina.');
      return { grant: {
        key: `discipline|${course.id}|${discipline.id}`, kind: 'discipline_bonus', xp: XP_VALUES.discipline_bonus,
        materialId: course.id, materialTitle: course.title, stepId: discipline.id, stepTitle: discipline.data.title,
        achievement: { kind: 'discipline', title: `${discipline.data.title} — ${course.title}`, criterion: 'Todas as aulas da disciplina completa concluídas' },
      } };
    },
  },
  {
    id: 'deck-completion',
    on: 'deck.completed',
    // Apresentação: pelo menos 80% dos slides vistos, último slide aberto e
    // conclusão confirmada depois do marco.
    grant({ course, since }) {
      if (!isEligibleCourse(course)) return refuse('material_not_eligible', 'Este material não participa da política de XP.');
      const deck = slideProgressSnapshot(course);
      if (!deck.total) return refuse('slides_missing', 'Este material ainda não tem slides.');
      if (!deck.nearEnd || !deck.lastSeen || !deck.completedAt) {
        return refuse('deck_not_complete', 'Conclua a apresentação com pelo menos 80% dos slides vistos e o último slide aberto.');
      }
      if (Date.parse(deck.completedAt) < since) {
        return refuse('legacy_progress', 'Esta apresentação foi concluída antes da política atual e permanece como histórico legado.');
      }
      return {
        grant: {
          key: slideEventKey(course.id), kind: 'slide', xp: XP_VALUES.slide,
          materialId: course.id, materialTitle: course.title, stepId: '', stepTitle: '',
          achievement: { kind: 'slide', title: course.title, criterion: 'Apresentação concluída com cobertura do deck' },
        },
      };
    },
  },
];

// Avalia as regras de um gatilho e grava o que for concedido. A chave única de
// xp_events é a proteção contra repetição, inclusive entre dois dispositivos.
// → [{ rule, added, duplicate, event } | { rule, refusal }]
export async function runRules(db, userId, on, context, { now = Date.now(), only = null } = {}) {
  const settings = context.settings || await ensureXpSettings(db, userId, { now });
  const since = Date.parse(settings.eligible_since);
  const outcomes = [];
  for (const rule of RULES) {
    if (rule.on !== on || (only && rule.id !== only)) continue;
    const result = rule.grant({ ...context, since });
    if (result.refusal) {
      outcomes.push({ rule: rule.id, refusal: result.refusal });
      continue;
    }
    const { achievement, ...grant } = result.grant;
    const existing = await findEvent(db, userId, grant.key);
    if (existing) {
      outcomes.push({ rule: rule.id, added: false, duplicate: true, event: serializeEvent(existing) });
      continue;
    }
    const event = await insertEvent(db, userId, { ...grant, origin: 'manual', day: localDay(settings.time_zone, new Date(now)), at: iso(now) });
    if (achievement) await insertAchievement(db, userId, { event, ...achievement });
    outcomes.push({ rule: rule.id, added: true, duplicate: false, event: serializeEvent(event) });
  }
  return outcomes;
}

// Contexto de uma unidade: biblioteca (documento) + conclusões do servidor.
async function unitContext(db, userId, courseId, { now }) {
  const settings = await ensureXpSettings(db, userId, { now });
  const state = await loadLibrary(db, userId).catch((error) => {
    if (error.code === 'state_missing') throw new XpError('Salve seu progresso na conta antes de registrar XP.', 'state_missing', 409);
    throw error;
  });
  // Conta que ainda não enviou comandos (cliente antigo): o registro do
  // documento é copiado com a confiança de antes.
  if (await accountMode(db, userId) === 'document') await syncFromDocument(db, userId, state, now);
  const course = (state.courses || []).find((item) => item.id === courseId) || null;
  const completions = course ? await eligibleCompletions(db, userId, { materialId: course.id }) : new Map();
  return { settings, state, course, completions };
}

function settle(outcome) {
  if (outcome.refusal) throw new XpError(outcome.refusal.message, outcome.refusal.code, outcome.refusal.code === 'step_not_found' ? 404 : 409);
  return { added: outcome.added, duplicate: outcome.duplicate, event: outcome.event };
}

function requireMaterial(courseId) {
  if (typeof courseId !== 'string' || !courseId || courseId.length > 120) throw new XpError('Material inválido.', 'invalid_material', 400);
}

// Rotas de compatibilidade (/api/xp/complete, /bonus, /slides): o cliente atual
// envia comandos de progresso e recebe o XP na mesma resposta; estas rotas
// continuam para clientes antigos e para reprocessar uma regra específica.
export async function grantStep(db, userId, { courseId, stepId }, { now = Date.now() } = {}) {
  requireMaterial(courseId);
  if (typeof stepId !== 'string' || !stepId || stepId.length > 160) throw new XpError('Etapa inválida.', 'invalid_step', 400);
  const context = await unitContext(db, userId, courseId, { now });
  if (!context.course || !isEligibleCourse(context.course)) throw new XpError('Este material não participa da política de XP.', 'material_not_eligible', 409);
   const step = materialSteps(context.course).find((item) => item.id === stepId);
  if (!step) throw new XpError('Etapa não encontrada.', 'step_not_found', 404);
  const [outcome] = await runRules(db, userId, 'unit.completed', { ...context, step }, { now, only: 'unit-completion' });
  return settle(outcome);
}

export async function grantBonus(db, userId, { courseId }, { now = Date.now() } = {}) {
  requireMaterial(courseId);
  const context = await unitContext(db, userId, courseId, { now });
  if (!context.course) throw new XpError('Este material não participa da política de XP.', 'material_not_eligible', 409);
  const [outcome] = await runRules(db, userId, 'unit.completed', context, { now, only: 'material-completion' });
  return settle(outcome);
}

export async function grantSlide(db, userId, { courseId }, { now = Date.now() } = {}) {
  requireMaterial(courseId);
  const context = await unitContext(db, userId, courseId, { now });
  if (!context.course) throw new XpError('Este material não participa da política de XP.', 'material_not_eligible', 409);
  const [outcome] = await runRules(db, userId, 'deck.completed', context, { now });
  return settle(outcome);
}
