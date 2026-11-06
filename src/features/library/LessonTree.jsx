import { useState } from 'react';
import { materialSteps, materialStructure } from '../../../public/material-model.js';
import { formatDuration, lessonOrigin } from '../../../public/import-domain.js';
import { isCompleted } from '../../../public/progress-domain.js';
import Icon from '../../ui/Icon.jsx';

const ORIGINS = { manual: 'registro manual', integration: 'integração', import: 'progresso importado da fonte' };

export default function LessonTree({ course, state, disciplines, onComplete, onRevert }) {
  const [expanded, setExpanded] = useState(() => new Set(disciplines.slice(0, 2).map((item) => item.id)));
  const selected = new Set(materialSteps(course).map((step) => step.id));
  const structures = new Map(materialStructure(course).map((item) => [item.id, item]));
  function toggle(id) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  return <div className="import-tree compact">{disciplines.map((discipline) => {
    const structure = structures.get(discipline.id);
    const isOpen = expanded.has(discipline.id);
    return <div className={`import-discipline ${isOpen ? 'is-open' : ''}`} key={discipline.id}>
      <button className="import-discipline-toggle" aria-expanded={isOpen} onClick={() => toggle(discipline.id)}>
        <span className="import-discipline-title">{discipline.title}</span><small>{discipline.done}/{discipline.total} aulas</small>
        <Icon name={isOpen ? 'chevron-up' : 'chevron-down'}/>
      </button>
      {isOpen && <div className="import-modules">{structure.modules.map((module) => <div className="import-module" key={module.id}>
        <div className="import-module-head"><strong>{module.title}</strong></div>
        <ul className="import-lessons">{module.lessons.filter((lesson) => selected.has(lesson.id)).map((lesson) => {
          const done = isCompleted(state, lesson.id);
          const origin = lessonOrigin(state, lesson.id);
          return <li key={lesson.id} className={done ? 'is-done' : ''}>
            <button className="import-check small" role="checkbox" aria-checked={done ? 'true' : 'false'} aria-label={`${done ? 'Desmarcar' : 'Marcar'} a aula ${lesson.title}`} onClick={() => done ? onRevert(lesson.id) : onComplete(lesson.id)}><Icon name={done ? 'check' : 'plus'}/></button>
            <span className="import-lesson-title">{lesson.title}{lesson.removedFromSource && <small className="import-flag">removida da fonte</small>}</span>
            {lesson.duration ? <small className="import-lesson-time">{formatDuration(lesson.duration)}</small> : null}
            {done && <small className="import-origin">{ORIGINS[origin] || 'manual'}</small>}
          </li>;
        })}</ul>
      </div>)}</div>}
    </div>;
  })}</div>;
}
