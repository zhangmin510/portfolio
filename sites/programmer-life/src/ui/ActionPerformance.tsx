import { ACTION_SCENES } from '../content/actionScenes';
import type { ActionId } from '../domain/types';
import { Icon } from './Icon';
import '../styles/action-performance.css';

export function ActionPerformance({ id, stage, title, onSkip, onPauseAutoplay }: {
  id: ActionId;
  stage: number;
  title: string;
  onSkip: () => void;
  onPauseAutoplay?: () => void;
}) {
  const stages = ACTION_SCENES[id];
  const current = stages[stage];
  return <section className="action-performance" aria-label={title}>
    <div className="action-performance-progress" aria-hidden="true">{stages.map((item, index) => <span className={index <= stage ? 'is-current' : ''} key={item.label} />)}</div>
    <div className="action-performance-state" role="status">
      <strong>{current.label}</strong>
      {current.screen && <div className="action-performance-screen">
        <span>{id === 'ai' ? 'Codex · 游戏内模拟' : '工作区'}</span>
        <pre>{current.screen}</pre>
      </div>}
      {current.dialogue && <p className="action-performance-dialogue"><b>{current.dialogue.speaker}</b> {current.dialogue.text}</p>}
    </div>
    <div className="action-performance-controls">
      {onPauseAutoplay && <button type="button" onClick={onPauseAutoplay}><Icon name="pause" size={15} />暂停自动玩耍</button>}
      <button type="button" onClick={onSkip}>跳过动作 <Icon name="chevron" size={15} /></button>
    </div>
  </section>;
}
