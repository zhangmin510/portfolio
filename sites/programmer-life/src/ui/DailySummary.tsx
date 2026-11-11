import type { GameState } from '../domain/types';
import { Icon } from './Icon';

export function DailySummary({ game, day, disabled, onClose, onExport, onRestart, onNextDay, onAutoplayNextDay, onCareer }: {
  game: GameState;
  day: number;
  disabled: boolean;
  onClose: () => void;
  onExport: () => void;
  onRestart: () => void;
  onNextDay: () => void;
  onAutoplayNextDay?: () => void;
  onCareer: () => void;
}) {
  const summary = game.summary;
  if (!summary) return null;
  return <div className="modal-backdrop"><section className="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title" tabIndex={-1}>
    <button className="icon-button modal-close" aria-label="关闭回顾" onClick={onClose}><Icon name="close" /></button>
    <div className="summary-illustration"><Icon name="sun" size={44} /><span>第 {day + 1} 天 · 07:00</span></div>
    <div className="eyebrow">第 {day} 天回顾</div>
    <h2 id="summary-title">{summary.title}</h2><p className="summary-description">{summary.description}</p>
    <div className="summary-tags">{summary.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
    <div className="summary-metrics"><div><small>工作投入</small><strong>{Math.round(summary.workMinutes / 60 * 10) / 10}<em>小时</em></strong></div><div><small>需求进度</small><strong>{Math.round(summary.progress)}<em>%</em></strong></div><div><small>今日花费</small><strong><em>¥</em>{(summary.spent / 100).toFixed(0)}</strong></div></div>
    {!!summary.earned && <p className="quiet-note">今日工作收入 ¥{(summary.earned / 100).toLocaleString('zh-CN')}</p>}
    <div className="summary-highlights"><h3>这一天，留下了这些小事</h3>{summary.highlights.map((highlight, index) => <p key={index}><span>{String(index + 1).padStart(2, '0')}</span>{highlight}</p>)}</div>
    <div className="summary-buttons">
      <button className="primary-button" disabled={disabled} onClick={onNextDay}>开始下一天 <Icon name="arrow" size={18} /></button>
      <button className="secondary-button" disabled={disabled || !onAutoplayNextDay} onClick={onAutoplayNextDay}><Icon name="play" size={17} />自动玩下一天</button>
      <button className="secondary-button" onClick={onCareer}><Icon name="calendar" size={17} /> 职业日历</button>
      <button className="secondary-button" onClick={onClose}><Icon name="journal" size={17} /> 回看这一天</button>
      <button className="secondary-button" onClick={onExport}><Icon name="download" size={17} /> 导出存档</button>
    </div>
    <button className="text-button" disabled={disabled} onClick={onRestart}>重新开始一段生活 <Icon name="reset" size={14} /></button>
  </section></div>;
}
