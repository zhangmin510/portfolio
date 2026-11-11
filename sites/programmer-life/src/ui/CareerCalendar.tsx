import { useState } from 'react';
import { getPostmortemDiscussion } from '../content/postmortem';
import { CAREER_EVENT_COUNT, getCareer } from '../domain/career';
import type { GameState } from '../domain/types';
import { Icon } from './Icon';
import { PostmortemMeeting } from './PostmortemMeeting';
import '../styles/career.css';

export function CareerCalendar({ game, disabled, reduceMotion, onChoice, onClose }: {
  game: GameState;
  disabled: boolean;
  reduceMotion: boolean;
  onChoice: (id: string) => void;
  onClose: () => void;
}) {
  const { current, history, metrics, rating, graduated } = getCareer(game);
  const [turn, setTurn] = useState(0);
  const latest = history.at(-1);
  const complete = history.length === CAREER_EVENT_COUNT;
  const discussion = current?.id === 'postmortem' ? getPostmortemDiscussion(game) : [];
  const dialogue = discussion[turn];
  const lastTurn = turn >= discussion.length - 1;
  const seats = { facilitator: 'lead', engineer: 'engineer', player: 'player' } as const;
  const speakers = { facilitator: '林可', engineer: '林工', player: game.player.name };

  return <div className="modal-backdrop"><section className="event-modal career-calendar" role="dialog" aria-modal="true" aria-labelledby="career-title">
    <button className="icon-button modal-close" aria-label="关闭职业日历" onClick={onClose}><Icon name="close" /></button>
    <div className="career-heading"><Icon name="calendar" size={25} /><div><h2 id="career-title">职业日历</h2><span>已完成 {history.length} / {CAREER_EVENT_COUNT} 个节点</span></div></div>
    {!dialogue && <dl className="career-metrics">
      <div><dt>稳定性</dt><dd>{metrics.stability}</dd></div>
      <div><dt>职业信用</dt><dd>{metrics.credit}</dd></div>
      <div><dt>压力</dt><dd>{metrics.pressure}</dd></div>
    </dl>}
    {latest && !dialogue && <div className="career-result" role="status"><strong><Icon name="check" size={17} />{latest.event.title}</strong><p>{latest.result}</p></div>}
    {current && <div className="career-current">
      <time>{current.date}</time>
      <h3>{current.title}</h3>
      {current.id === 'performance' && <div className="career-meeting-discussion">
        <PostmortemMeeting
          stage={0} speaker="lead" speakerName="主管" playerName={game.player.name} reduceMotion={reduceMotion}
          participantNames={{ lead: '主管' }} boardTitle="年度绩效面谈" boardRows={['交付与故障治理', '约定的值班范围', '下一季度目标']}
        />
      </div>}
      {!dialogue && <p>{current.description}</p>}
      {dialogue && <div className="career-meeting-discussion">
        <PostmortemMeeting stage={turn} speaker={seats[dialogue.speaker]} speakerName={speakers[dialogue.speaker]} playerName={game.player.name} reduceMotion={reduceMotion} />
        <div className="career-meeting-dialogue" role="status"><strong>{speakers[dialogue.speaker]}</strong><p>{dialogue.text}</p></div>
        <div className="career-meeting-controls">
          {turn > 0 && <button type="button" className="text-button" onClick={() => setTurn(turn - 1)}>回听上一句</button>}
          {!lastTurn && <button type="button" className="text-button" onClick={() => setTurn(turn + 1)}>继续讨论 <Icon name="arrow" size={16} /></button>}
        </div>
      </div>}
      {lastTurn && <div className="event-choices">{current.options.map(option => <button key={option.id} disabled={disabled} onClick={() => onChoice(option.id)}>
        <strong>{option.title}<Icon name="chevron" size={17} /></strong>
        <p>{option.description}</p>
        <small>{option.effects.join(' · ')}</small>
      </button>)}</div>}
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
