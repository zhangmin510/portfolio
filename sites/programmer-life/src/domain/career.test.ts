import { describe, expect, it } from 'vitest';
import { exportGame, importGame } from '../persistence/storage';
import { getCareer, hasGraduated } from './career';
import { createGame, transition } from './engine';
import type { Command, GameState } from './types';

function firstDay(): GameState {
  return createGame({ name: '小栈', background: 'graduate', traits: ['focused', 'steady'], wish: 'balance' });
}

function afterFirstDay() {
  return transition({ ...firstDay(), minute: 1080 }, { id: 'sleep', kind: 'action', targetId: 'sleep', expectedRevision: 0 });
}

function choose(state: GameState, targetId: string) {
  return transition(state, { id: `career-${state.revision}`, expectedRevision: state.revision, kind: 'career', targetId });
}

function follow(state: GameState, choices: string[]) {
  return choices.reduce(choose, state);
}

const FIRST_YEAR_CHOICES = [
  ['首次项目上线', 'launch-canary'], ['618 大促', '618-drill'], ['紧急线上事故', 'incident-degrade'],
  ['事故复盘', 'review-owner'], ['双十一大促', '1111-full'], ['年终总结', 'year-evidence'],
  ['绩效公布', 'rating-plan'], ['公司年会', 'party-connect'],
];

describe('首日之后的职业历程', () => {
  it('经过三年关键事件，在最终选择后毕业并保留首日回顾', () => {
    const original = afterFirstDay();
    let state = original;
    const choices = [
      ...FIRST_YEAR_CHOICES,
      ['第二年的职责选择', 'year-two-lead'], ['组织调整与交接', 'year-three-handoff'], ['从字节花园毕业', 'graduation-job'],
    ];
    for (const [title, optionId] of choices) {
      expect(getCareer(state).current?.title).toBe(title);
      expect(hasGraduated(state)).toBe(false);
      state = choose(state, optionId);
    }
    const career = getCareer(state);
    expect(career.current).toBeNull();
    expect(career.history).toHaveLength(11);
    expect(career.graduated).toBe(true);
    expect(career.history.at(-1)?.result).toContain('经理引荐的面试邀请');
    expect(career.history.every(entry => entry.result.length > 0)).toBe(true);
    expect(career.rating).toBe('A · 超出预期');
    expect(state.summary).toEqual(original.summary);
    expect(state.journal).toEqual(original.journal);
    expect(state.minute).toBe(original.minute);
    expect(state.phase).toBe('complete');
    expect(state.revision).toBe(original.revision + choices.length);
    expect(() => choose(state, 'party-connect')).toThrow('职业事件已经结束');
  });

  it('复盘是否修复重试问题，影响同一个双十一全量选择的结果', () => {
    const beforeReview = follow(afterFirstDay(), ['launch-canary', '618-drill', 'incident-degrade']);
    const remediated = choose(beforeReview, 'review-owner');
    const deferred = choose(beforeReview, 'review-brief');
    expect(getCareer(remediated).current?.description).toContain('重试治理已验收');
    expect(getCareer(deferred).current?.description).toContain('重试治理还没排上');

    const good = getCareer(choose(remediated, '1111-full'));
    const bad = getCareer(choose(deferred, '1111-full'));
    expect(good.history.at(-1)?.result).toContain('撑过了峰值');
    expect(bad.history.at(-1)?.result).toContain('回滚变更');
    expect(good.metrics.credit).toBeGreaterThan(bad.metrics.credit);
  });

  it('高风险路线可以拿到较低绩效，年会选择不改写已公布结果', () => {
    const reviewed = follow(afterFirstDay(), ['launch-wide', '618-feature', 'incident-hotfix', 'review-brief', '1111-full', 'year-delivery']);
    expect(getCareer(reviewed).rating).toBeNull();
    const published = choose(reviewed, 'rating-reflect');
    expect(getCareer(published).rating).toBe('C · 需要改进');
    expect(getCareer(choose(published, 'party-rest')).rating).toBe('C · 需要改进');
  });

  it('主管面谈的回应影响压力与第二年的做法，已公布的绩效相同', () => {
    const beforeMeeting = follow(afterFirstDay(), FIRST_YEAR_CHOICES.slice(0, 6).map(([, id]) => id));
    const event = getCareer(beforeMeeting).current;
    expect(event?.description).toContain('别的同事半夜都在线');
    expect(event?.description).toContain('先反省自己的态度');

    const documented = getCareer(follow(beforeMeeting, ['rating-plan', 'party-connect']));
    const consulted = getCareer(follow(beforeMeeting, ['rating-peer', 'party-connect']));
    const rested = getCareer(follow(beforeMeeting, ['rating-reflect', 'party-connect']));
    expect(documented.rating).toBe(consulted.rating);
    expect(documented.rating).toBe(rested.rating);
    expect(rested.metrics.pressure).toBeLessThan(documented.metrics.pressure);
    expect(documented.current?.description).toContain('面谈的记录');
    expect(consulted.current?.description).toContain('林工和你一起把值班范围');
    expect(rested.current?.description).toContain('自己的晚间安排');
  });

  it('原有八个事件的存档从第二年继续，毕业去向可保存并恢复', () => {
    const oldEnding = follow(afterFirstDay(), FIRST_YEAR_CHOICES.map(([, id]) => id));
    const saved = importGame(exportGame(oldEnding));
    expect(getCareer(saved).current?.date).toContain('第 2 年');
    expect(getCareer(saved).graduated).toBe(false);
    expect(() => choose(saved, 'graduation-rest')).toThrow('当前职业事件');

    const beforeGraduation = follow(saved, ['year-two-depth', 'year-three-prepare']);
    expect(getCareer(beforeGraduation).current?.date).toContain('第 3 年');
    const independent = choose(beforeGraduation, 'graduation-independent');
    const rested = choose(beforeGraduation, 'graduation-rest');
    expect(getCareer(independent).history.at(-1)?.result).toContain('两位朋友试玩');
    expect(getCareer(rested).history.at(-1)?.result).toContain('交还了门禁卡');
    expect(getCareer(rested).metrics.pressure).toBeLessThan(getCareer(independent).metrics.pressure);
    expect(getCareer(importGame(exportGame(independent)))).toEqual(getCareer(independent));
  });

  it('按阶段、版本和当前选项校验命令，重试同一命令只写一次', () => {
    expect(() => choose(firstDay(), 'launch-canary')).toThrow('先结束');
    const ready = afterFirstDay();
    expect(() => choose(ready, '618-drill')).toThrow('当前职业事件');

    const command: Command = { id: 'launch', kind: 'career', targetId: 'launch-canary', expectedRevision: ready.revision };
    const next = transition(ready, command);
    expect(transition(next, command)).toBe(next);
    expect(() => transition(next, { ...command, id: 'stale' })).toThrow('过期');
    expect(() => choose(next, 'launch-wide')).toThrow('当前职业事件');
  });

  it('旧存档可以开始职业历程，导入会拒绝越序选择', () => {
    const legacy = importGame(JSON.stringify(afterFirstDay()));
    expect(legacy.careerChoices).toBeUndefined();
    expect(getCareer(legacy).current?.id).toBe('launch');

    const next = choose(legacy, 'launch-canary');
    expect(importGame(exportGame(next))).toEqual(next);
    expect(() => importGame(JSON.stringify({ ...next, careerChoices: ['618-drill'] }))).toThrow('职业事件选择顺序不正确');
    expect(() => importGame(JSON.stringify({ ...firstDay(), careerChoices: ['launch-canary'] }))).toThrow('首日结束后');
  });
});
