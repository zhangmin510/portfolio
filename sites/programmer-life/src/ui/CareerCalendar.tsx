import { CAREER_EVENT_COUNT, getCareer } from '../domain/career';
import type { GameState } from '../domain/types';
import { Icon } from './Icon';
import '../styles/career.css';

export function CareerCalendar({ game, disabled, onChoice, onClose }: {
  game: GameState;
  disabled: boolean;
  onChoice: (id: string) => void;
  onClose: () => void;
}) {
  const { current, history, metrics, rating, graduated } = getCareer(game);
  const latest = history.at(-1);
  const complete = history.length === CAREER_EVENT_COUNT;

  return <div className="modal-backdrop"><section className="event-modal career-calendar" role="dialog" aria-modal="true" aria-labelledby="career-title">
    <button className="icon-button modal-close" aria-label="关闭职业日历" onClick={onClose}><Icon name="close" /></button>
    <div className="career-heading"><Icon name="calendar" size={25} /><div><h2 id="career-title">职业日历</h2><span>已完成 {history.length} / {CAREER_EVENT_COUNT} 个节点</span></div></div>
    <dl className="career-metrics">
      <div><dt>稳定性</dt><dd>{metrics.stability}</dd></div>
      <div><dt>职业信用</dt><dd>{metrics.credit}</dd></div>
      <div><dt>压力</dt><dd>{metrics.pressure}</dd></div>
    </dl>
    {latest && <div className="career-result" role="status"><strong><Icon name="check" size={17} />{latest.event.title}</strong><p>{latest.result}</p></div>}
    {current && <div className="career-current">
      <time>{current.date}</time>
      <h3>{current.title}</h3>
      <p>{current.description}</p>
      <div className="event-choices">{current.options.map(option => <button key={option.id} disabled={disabled} onClick={() => onChoice(option.id)}>
        <strong>{option.title}<Icon name="chevron" size={17} /></strong>
        <p>{option.description}</p>
        <small>{option.effects.join(' · ')}</small>
      </button>)}</div>
    </div>}
    {graduated && <div className="career-current"><h3>在字节花园的三年结束了</h3>{rating && <p>首年绩效为 <strong>{rating}</strong>。下一天可以按离职后的节奏继续生活。</p>}</div>}
    {!current && !complete && <p className="career-paused">回家睡觉，结束今天后就能处理下一个职业事件。</p>}
    {history.length > 0 && <details className="career-history">
      <summary>查看职业经历</summary>
      <ol>{history.map(entry => <li key={entry.event.id}>
        <time>{entry.event.date}</time><strong>{entry.event.title}</strong>
        <p>{entry.option.title} · {entry.result}</p>
      </li>)}</ol>
    </details>}
  </section></div>;
}
