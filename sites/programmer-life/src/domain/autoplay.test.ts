import { describe, expect, it } from 'vitest';
import { getAutoplayAction } from './autoplay';
import type { AutoplayAction } from './autoplay';
import { createGame, transition } from './engine';
import type { GameState } from './types';

function firstDay() {
  return createGame({ name: '小栈', background: 'graduate', traits: ['focused', 'steady'], wish: 'balance' });
}

function playToday(start: GameState) {
  const steps: AutoplayAction[] = [];
  let state = start;
  for (let step = 0; step < 50; step += 1) {
    const action = getAutoplayAction(state);
    if (!action) return { state, steps };
    const next = transition(state, { ...action, id: `autoplay-${state.revision}`, expectedRevision: state.revision });
    expect(next.minute).toBeGreaterThan(state.minute);
    steps.push(action);
    state = next;
  }
  throw new Error('自动玩耍未在当天结束');
}

describe('自动玩耍', () => {
  it('完成首日行动和需求回应，停在回顾', () => {
    const start = firstDay();
    const { state, steps } = playToday(start);
    expect(steps).toContainEqual({ kind: 'travel', targetId: 'office', mode: 'drive' });
    expect(steps).toContainEqual({ kind: 'choice', targetId: 'negotiate' });
    expect(state.flags).toMatchObject({ breakfast: true, lunch: true, lunchBreak: true, walked: true, slept: true });
    expect(state.work.minutes).toBeGreaterThanOrEqual(240);
    expect(state.locationId).toBe('home');
    expect(state.phase).toBe('complete');
    expect(state.summary).not.toBeNull();
    expect(state.careerChoices).toBeUndefined();
    expect(getAutoplayAction(state)).toBeNull();
    expect(start.minute).toBe(480);
  });

  it('能按实际日程完成周三、周五和周末，临时班留给玩家决定', () => {
    let completed = playToday(firstDay()).state;
    for (let day = 2; day <= 7; day += 1) {
      const morning = transition(completed, { kind: 'next-day', id: `morning-${day}`, expectedRevision: completed.revision });
      const { state, steps } = playToday(morning);
      expect(state.routineDay).toBe(day);
      expect(state.phase).toBe('complete');
      expect(state.flags.walked).toBe(true);
      if (day <= 5) {
        expect(state.work.minutes).toBeGreaterThan(0);
        expect(state.flags).toMatchObject({ lunch: true, lunchBreak: true });
      } else {
        expect(state.work.minutes).toBe(0);
        expect(steps.some(step => step.kind === 'travel' && step.targetId === 'office')).toBe(false);
        expect(state.flags.overtimeAccepted).toBe(false);
      }
      if (day === 3) expect(steps).toContainEqual({ kind: 'action', targetId: 'midweek-walk' });
      completed = state;
    }
  });

  it('余额不足时换乘公交或步行，并能从深夜户外回家睡觉', () => {
    const byBus = firstDay();
    byBus.player.cash = 1100;
    expect(getAutoplayAction(byBus)).toEqual({ kind: 'travel', targetId: 'office', mode: 'transit' });
    byBus.player.cash = 0;
    expect(getAutoplayAction(byBus)).toEqual({ kind: 'travel', targetId: 'office', mode: 'walk' });
    expect(playToday(byBus).state.phase).toBe('complete');

    const late = { ...byBus, locationId: 'park', minute: 1420 } as const;
    const { state, steps } = playToday(late);
    expect(steps).toEqual([{ kind: 'travel', targetId: 'home', mode: 'walk' }, { kind: 'action', targetId: 'sleep' }]);
    expect(state.phase).toBe('complete');
  });
});
