import { STUDY_TYPES, SESSION_MINUTES, CONTINUITY_OBSTACLES, TRACKING_PREFERENCES } from '../../../public/domain.js';
import Icon from '../../ui/Icon.jsx';

const FIELDS = {
  subject: ['Assunto', 'Ex.: fundamentos de redes'],
  outcome: ['Resultado esperado', 'Ex.: concluir a primeira aula'],
  studying: ['Materiais em andamento', 'Um por linha\nEx.: Curso de estatística\nArtigo sobre amostragem', 4],
  resume: ['Onde você parou?', 'Ex.: aula 3, página 42'],
  areas: ['Áreas e trilhas', 'Uma por linha\nEx.: programação\nidiomas', 3],
  routine: ['Rotina ou meta atual', 'Ex.: 3 noites por semana, 40 minutos'],
  ongoing: ['Em andamento', 'Um por linha\nEx.: curso de algoritmos\nprojeto de API', 4],
};

function MultipleChoice({ field, label, options, answers, setAnswers }) {
  const selected = answers[field] || [];
  return <fieldset className="option-grid two-col">
    <legend className="sr-only">{label}</legend>
    {options.map((item) => <label key={item.id} className={`pace-card row ${selected.includes(item.id) ? 'selected' : ''}`}>
      <input type="checkbox" className="sr-only" checked={selected.includes(item.id)} onChange={(event) => {
        const checked = event.target.checked;
        setAnswers((previous) => ({ ...previous, [field]: checked ? [...(previous[field] || []), item.id] : (previous[field] || []).filter((id) => id !== item.id) }));
      }}/>
      <span className="card-indicator square">{selected.includes(item.id) && <Icon name="check"/>}</span><span>{item.title}</span>
    </label>)}
    {field === 'tracking' && <p className="quiet-note span-two">As integrações automáticas por área ainda não estão disponíveis; o acompanhamento é por registro manual.</p>}
  </fieldset>;
}

export default function OnboardingFields({ journey, stepKey, answers, setAnswers }) {
  const change = (field, value) => setAnswers((previous) => ({ ...previous, [field]: value }));
  const field = FIELDS[stepKey];
  if (field) {
    const [label, placeholder, rows] = field;
    const props = { id: `onb-${stepKey}`, className: 'auth-input', value: answers[stepKey] ?? '', placeholder, onChange: (event) => change(stepKey, event.target.value) };
    return <label className="field" htmlFor={props.id}>{label}{rows ? <textarea {...props} rows={rows}/> : <input {...props} autoFocus={stepKey === 'subject'}/>}</label>;
  }
  if (stepKey === 'obstacles') return <MultipleChoice field="obstacles" label="Dificuldades" options={CONTINUITY_OBSTACLES} answers={answers} setAnswers={setAnswers}/>;
  if (stepKey === 'tracking') return <MultipleChoice field="tracking" label="O que acompanhar" options={TRACKING_PREFERENCES} answers={answers} setAnswers={setAnswers}/>;
  if (journey === 'sometimes' && stepKey === 'priority') {
    const options = String(answers.studying ?? '').split('\n').map((item) => item.trim()).filter(Boolean);
    if (!options.length) return <p className="muted-text">Volte e escreva ao menos um material para escolher a prioridade.</p>;
    return <fieldset className="option-stack"><legend className="sr-only">Prioridade</legend>{options.map((option) => <label key={option} className={`pace-card row ${answers.priority === option ? 'selected' : ''}`}>
      <input className="sr-only" type="radio" name="priority" checked={answers.priority === option} onChange={() => change('priority', option)}/>
      <span className="card-indicator">{answers.priority === option && <Icon name="check"/>}</span><span>{option}</span>
    </label>)}</fieldset>;
  }
  if (journey === 'starting' && stepKey === 'time') return <div className="pill-group" role="group" aria-label="Tempo por sessão">{[...SESSION_MINUTES, null].map((minutes) => {
    const selected = String(answers.sessionMinutes ?? '') === String(minutes ?? '');
    return <button key={String(minutes)} type="button" className={`filter-btn ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => change('sessionMinutes', minutes)}>{minutes ? `${minutes} minutos` : 'Ainda não sei'}</button>;
  })}</div>;
  if (journey !== 'starting' || stepKey !== 'material') return null;
  return <div className="form-stack">
    <fieldset className="option-grid two-col"><legend className="sr-only">Você já tem material?</legend>
      {[['yes', 'A. Já tenho um material', 'Cadastro o link e o tipo agora.'], ['no', 'B. Ainda não escolhi', 'Definimos o assunto e o que procurar, sem inventar links.']].map(([value, title, hint]) => <label key={value} className={`pace-card compact ${answers.hasMaterial === value ? 'selected' : ''}`}>
        <input className="sr-only" type="radio" name="hasMaterial" checked={answers.hasMaterial === value} onChange={() => change('hasMaterial', value)}/><strong>{title}</strong><small className="muted-text">{hint}</small>
      </label>)}
    </fieldset>
    {answers.hasMaterial === 'yes' && <div className="option-grid two-col">
      <label className="field">Nome do material<input className="auth-input" value={answers.materialTitle ?? ''} onChange={(event) => change('materialTitle', event.target.value)} placeholder="Ex.: Curso de redes — módulo 1"/></label>
      <label className="field">Link (opcional)<input className="auth-input" type="url" value={answers.materialUrl ?? ''} onChange={(event) => change('materialUrl', event.target.value)} placeholder="https://…"/></label>
      <label className="field">Tipo<select className="auth-input" value={answers.materialType ?? 'lesson'} onChange={(event) => change('materialType', event.target.value)}>{STUDY_TYPES.map((type) => <option key={type.id} value={type.id}>{type.title}</option>)}</select></label>
      <label className="field">Primeira atividade<input className="auth-input" value={answers.firstActivity ?? ''} onChange={(event) => change('firstActivity', event.target.value)} placeholder="Ex.: assistir à aula completa"/></label>
    </div>}
    {answers.hasMaterial === 'no' && <p className="card-surface muted-text">Vamos registrar <strong>{answers.subject || 'seu assunto'}</strong> e a primeira coisa a procurar: um material introdutório. Nenhum curso ou link é inventado pelo Lume.</p>}
  </div>;
}
