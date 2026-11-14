import { motion } from 'motion/react';
import Atropos from 'atropos/react';
import { achievements, levelInfo } from '../../../public/domain.js';
import { levelProgress } from '../../../public/xp-policy.js';
import Icon from '../../ui/Icon.jsx';
import { AnimatedNumber, Empty, Heading, Progress, Ring, stagger } from '../../ui/ui.jsx';

export function Achievements({ state, account, xp }) {
  const legacy = achievements(state);
  const summary = account ? xp?.summary : null;
  const level = summary
    ? levelProgress(summary.totalXP)
    : levelInfo(state);
  const validated = account && xp?.achievements?.length ? xp.achievements : null;
  const all = validated
    ? validated.map((item) => ({
      id: item.id,
      title: item.title,
      text: item.criterion,
      icon: item.kind === 'project' ? 'flag' : item.kind === 'slide' ? 'book' : item.kind === 'exercise' ? 'steps' : 'trophy',
      unlocked: true,
      current: 1,
      target: 1,
      earnedAt: item.earnedAt,
    }))
    : legacy;
  const unlockedCount = all.filter(item => item.unlocked).length;
  return <div className="personal-root">
    <Heading eyebrow="Marcos permanentes" title="Sua vitrine de conquistas">
      Memórias do caminho que você percorreu.
    </Heading>
    {state.preferences.gamification ? <>
      <section className="achievement-summary crest-card">
        <div className="achievement-summary-body">
          <div className="trophy-emblem"><Icon name="trophy"/></div>
          <div className="achievement-summary-copy">
            <span className="metric-label">{account ? 'XP confirmado pelo servidor' : 'Prévia local'}</span>
            <h2 className="headline">{unlockedCount} de {all.length} conquistas</h2>
            <p className="muted-text">Nível {level.level} · <AnimatedNumber value={level.total}/> XP {account ? 'elegível' : 'de prévia'}{account && !xp ? ' · sincronizando…' : ''}</p>
          </div>
          <Ring value={unlockedCount} max={Math.max(all.length, 1)} size={82} stroke={7} label="Conquistas desbloqueadas">
            <strong>{unlockedCount}/{all.length}</strong>
          </Ring>
        </div>
      </section>
      {validated && !validated.length && <Empty icon="trophy" title="Sua vitrine personalizada começa na primeira conclusão.">Concluir um curso, uma leitura, uma lista de exercícios ou uma apresentação cria uma memória com o nome do material.</Empty>}
      <div className="achievement-grid">
        {all.map((item, index) => {
          const card = <article className={`achievement-card ${item.unlocked ? 'unlocked' : ''}`}>
            <div className="achievement-card-top">
              <div className="achievement-icon"><Icon name={item.icon}/></div>
              <span className="achievement-status">{item.unlocked ? 'CONQUISTADA' : 'UMA POSSIBILIDADE'}</span>
            </div>
            <h2 className="title">{item.title}</h2>
            <p className="muted-text">{item.text}</p>
            {item.earnedAt && <small className="muted-text">{new Date(item.earnedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</small>}
            <div className="achievement-progress">
              <div className="course-progress-label"><span>Progresso</span><strong>{item.current} / {item.target}</strong></div>
              <Progress value={item.current} max={item.target} tone={item.unlocked ? 'lume' : 'mint'} label={`Progresso da conquista ${item.title}`}/>
            </div>
          </article>;
          return <motion.div key={item.id} {...stagger(index)}>
            {item.unlocked ? <Atropos className="achievement-atropos" activeOffset={14} shadow={false} rotateXMax={5} rotateYMax={5}>{card}</Atropos> : card}
          </motion.div>;
        })}
      </div>
    </> : <Empty icon="history" title="Um caminho sem pontuação.">Você ocultou os indicadores. Seu histórico continua guardado.</Empty>}
  </div>;
}
