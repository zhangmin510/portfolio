import { useState } from 'react';
import type { BackgroundId, CharacterOptions, TraitId, WishId } from '../domain/types';
import { TRAITS, WISHES } from '../content/game';
import { WorldScene } from './WorldScene';
import { Icon } from './Icon';
import { GuestFeedback } from './GuestFeedback';
import '../styles/creation.css';

const backgrounds: { id: BackgroundId; name: string; cash: string; description: string; icon: string }[] = [
  { id: 'graduate', name: '应届新人', cash: '¥3,000', description: '刚出校园，工程基础更扎实', icon: 'leaf' },
  { id: 'switcher', name: '转行新人', cash: '¥5,000', description: '换条跑道，积蓄多一点缓冲', icon: 'spark' },
];

export function CharacterCreation({ onStart, readOnly }: { onStart: (options: CharacterOptions) => void; readOnly: boolean }) {
  const [name, setName] = useState('小栈');
  const [background, setBackground] = useState<BackgroundId>('graduate');
  const [traits, setTraits] = useState<TraitId[]>(['focused', 'steady']);
  const [wish, setWish] = useState<WishId>('balance');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toggleTrait(id: TraitId) {
    setTraits(previous => previous.includes(id)
      ? previous.filter(item => item !== id)
      : previous.length < 2 ? [...previous, id] : [previous[1], id]);
  }

  return <div className="creation-screen">
    <div className="creation-world" aria-hidden="true" inert>
      <WorldScene mode="city" name={name.trim() || '你'} minute={480} locationId="home" activity={null} revision={0} onAction={() => undefined} onLocation={() => undefined} reduceMotion={reduceMotion} />
    </div>
    <div className="creation-shade" aria-hidden="true" />
    <header className="creation-topbar">
      <div className="creation-brand" aria-label="栈城日常 Programmer Life">
        <span className="creation-brand-mark"><Icon name="code" size={24} /></span>
        <span><strong>栈城日常</strong><small>PROGRAMMER LIFE</small></span>
      </div>
      <GuestFeedback className="creation-edition" />
    </header>
    <main className="creation-layout">
      <div className="creation-place-note" aria-hidden="true">
        <span className="creation-place-icon"><Icon name="map" size={20} /></span>
        <div><small>栈城</small><strong>梧桐里</strong><p>第 1 天 · 08:00 · 晴</p></div>
      </div>
      <form className="creation-panel" onSubmit={event => {
        event.preventDefault();
        if (name.trim() && traits.length === 2 && !readOnly) onStart({ name: name.trim(), background, traits, wish });
      }}>
        <div className="creation-panel-heading">
          <span className="creation-step"><span>01</span> 创建你的角色</span>
          <h1>开始新生活</h1>
          <p>创建角色，开始你在栈城的第一天。</p>
        </div>
        <div className="creation-form-fields">
        <label className="creation-field-label" htmlFor="character-name">怎么称呼你？</label>
        <div className="creation-name-field">
          <input id="character-name" name="name" value={name} maxLength={12} onChange={event => setName(event.target.value)} placeholder="给自己取个名字" autoComplete="off" required />
          <span aria-hidden="true">{name.length}/12</span>
        </div>
        <fieldset>
          <legend>选择你的起点</legend>
          <div className="creation-background-options">
            {backgrounds.map(item => <button type="button" key={item.id} className={`creation-background-option ${background === item.id ? 'is-selected' : ''}`} aria-pressed={background === item.id} onClick={() => setBackground(item.id)}>
              <div className="creation-background-title"><Icon name={item.icon} size={18} /><strong>{item.name}</strong><span className="creation-selection-dot">{background === item.id && <Icon name="check" size={11} />}</span></div>
              <span className="creation-starting-cash">{item.cash}<small>初始积蓄</small></span>
              <span className="creation-background-description">{item.description}</span>
            </button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>带上两点自己的性格 <span>已选 {traits.length}/2</span></legend>
          <div className="creation-trait-options">
            {(Object.entries(TRAITS) as [TraitId, { name: string; description: string }][]).map(([id, trait]) => <button type="button" key={id} title={trait.description} className={traits.includes(id) ? 'is-selected' : ''} aria-pressed={traits.includes(id)} onClick={() => toggleTrait(id)}><span>{traits.includes(id) && <Icon name="check" size={11} />}</span>{trait.name}</button>)}
          </div>
          <div className="creation-trait-notes" aria-live="polite">
            {traits.length ? traits.map(id => <p key={id}><span />{TRAITS[id].description}</p>) : <p>选两项，看看它们会给生活带来什么。</p>}
          </div>
        </fieldset>
        <fieldset>
          <legend>这个月，你最想……</legend>
          <div className="creation-wish-options">
            {(Object.entries(WISHES) as [WishId, { name: string; description: string }][]).map(([id, item]) => <button type="button" key={id} title={item.description} className={wish === id ? 'is-selected' : ''} aria-pressed={wish === id} onClick={() => setWish(id)}>{item.name}</button>)}
          </div>
        </fieldset>
        </div>
        <button type="submit" className="creation-start-button" disabled={!name.trim() || traits.length !== 2 || readOnly}>搬进栈城，开始第一天 <Icon name="arrow" size={20} /></button>
        <p className={`creation-footnote ${readOnly ? 'is-warning' : ''}`}>{readOnly ? <Icon name="info" size={14} /> : <Icon name="save" size={14} />}{readOnly ? '另一个标签页正在进行游戏，关闭它后即可继续。' : '进度保存在本机 · 离开时，生活会为你暂停'}</p>
      </form>
    </main>
  </div>;
}
