import { describe, expect, it } from 'vitest';
import { exportGame, importGame, validateSave } from '../persistence/storage';
import { CAREER_EVENT_COUNT, getCareer } from './career';
import { createGame, getActions, transition } from './engine';
import { getDaySchedule } from './routine';
import type { ActionId, GameState, LocationId, TravelMode } from './types';

function fresh() {
  return createGame({ name: '小栈', background: 'graduate', traits: ['focused', 'steady'], wish: 'balance', seed: 42 });
}

function act(state: GameState, targetId: ActionId) {
  return transition(state, { id: `action-${state.revision}`, expectedRevision: state.revision, kind: 'action', targetId });
}

function travel(state: GameState, targetId: LocationId, mode: TravelMode = 'walk') {
  return transition(state, { id: `travel-${state.revision}`, expectedRevision: state.revision, kind: 'travel', targetId, mode });
}

function sleep(state: GameState) {
  let evening = state.locationId === 'home' ? state : travel(state, 'home');
  while (evening.minute < 18 * 60) evening = act(evening, 'rest');
  return act(evening, 'sleep');
}

function nextDay(state: GameState) {
  return transition(state, { id: `next-${state.revision}`, expectedRevision: state.revision, kind: 'next-day' });
}

function dayAt(day: number, minute: number, locationId: LocationId): GameState {
  return { ...nextDay(sleep(fresh())), routineDay: day, minute, locationId };
}

describe('多日生活循环', () => {
  it('睡觉后开启新的一天，保存首日和职业记录并重置当天经历', () => {
    let first = travel(act(fresh(), 'breakfast'), 'office', 'drive');
    expect(() => nextDay(first)).toThrow('先回家睡觉');
    first = act(act(first, 'focus'), 'focus');
    first = transition(first, { id: 'scope-choice', expectedRevision: first.revision, kind: 'choice', targetId: 'negotiate' });
    first = sleep(first);
    first = transition(first, { id: 'career-choice', expectedRevision: first.revision, kind: 'career', targetId: 'launch-canary' });

    const command = { id: 'next-day', expectedRevision: first.revision, kind: 'next-day' } as const;
    const second = transition(first, command);
    expect(second).toMatchObject({ routineDay: 2, minute: 420, phase: 'playing', locationId: 'home', summary: null, eventChoice: 'negotiate' });
    expect(second.flags).toMatchObject({ breakfast: false, commuted: false, workSessions: 0, scopeResolved: true, slept: false });
    expect(second.work).toEqual({ ...first.work, minutes: 0 });
    expect(second.player).toEqual(first.player);
    expect(second.relationships).toEqual(first.relationships);
    expect(second.firstDaySummary).toEqual(first.summary);
    expect(second.careerChoices).toEqual(first.careerChoices);
    expect(second.journal).toHaveLength(1);
    expect(transition(second, command)).toBe(second);
    expect(importGame(exportGame(second))).toEqual(second);
    expect(() => validateSave({ ...second, firstDaySummary: undefined })).toThrow('首日回顾');

    const finishedSecond = importGame(exportGame(sleep(act(second, 'breakfast'))));
    expect(finishedSecond.summary?.workMinutes).toBe(0);
    expect(getCareer(finishedSecond).metrics).toEqual(getCareer(first).metrics);
    expect(getCareer(finishedSecond).history).toEqual(getCareer(first).history);
  });

  it('工作日有午饭和午休，睡觉时结算当日工时收入', () => {
    let day = nextDay(sleep(fresh()));
    const openingCash = day.player.cash;
    day = travel(act(day, 'breakfast'), 'office', 'drive');
    day = act(act(day, 'rest'), 'rest');
    day = act(day, 'focus');
    expect(day.minute).toBe(11 * 60 + 5);
    expect(() => act(day, 'focus')).toThrow('午饭和午休');
    expect(() => act(day, 'lunch-break')).toThrow('11:30');

    day = act(day, 'rest');
    day = act(day, 'lunch');
    day = act(day, 'lunch-break');
    expect(day.flags).toMatchObject({ lunch: true, lunchBreak: true });
    expect(() => act(day, 'lunch-break')).toThrow('已经午休');
    day = act(day, 'rest');
    expect(getActions(day).find(action => action.id === 'focus')?.disabledReason).toBeUndefined();

    const complete = sleep(day);
    expect(complete.summary).toMatchObject({ workMinutes: 120, spent: 4600, earned: 12000 });
    expect(complete.player.cash).toBe(openingCash - 4600 + 12000);
    expect(validateSave(complete)).toEqual(complete);
    const third = nextDay(complete);
    expect(third.firstDaySummary).toEqual(complete.firstDaySummary);
    expect(third.dayStartCash).toBe(complete.player.cash);
    expect(third.flags).toMatchObject({ lunch: false, lunchBreak: false });
  });

  it('周三下班后有公园活动，周五十六点结束工作', () => {
    let wednesday = dayAt(3, 16 * 60 + 45, 'park');
    expect(() => act(wednesday, 'midweek-walk')).toThrow('17:00');
    wednesday = act(wednesday, 'rest');
    const afterWalk = act(wednesday, 'midweek-walk');
    expect(afterWalk.flags).toMatchObject({ walked: true, eveningActivity: true });
    expect(afterWalk.relationships.friend).toBe(wednesday.relationships.friend + 3);

    let friday = dayAt(5, 14 * 60, 'office');
    friday.player.hunger = 80;
    friday = act(friday, 'focus');
    expect(friday.minute).toBe(16 * 60);
    expect(() => act(friday, 'test')).toThrow('16:00');
  });

  it('临时班须主动接受，平常周末休息', () => {
    let saturday = dayAt(6, 10 * 60, 'office');
    expect(() => act(saturday, 'focus')).toThrow('自愿接下');
    expect(getDaySchedule({ routineDay: 13 }).kind).toBe('weekend');
    expect(getDaySchedule({ routineDay: 20 }).kind).toBe('overtime');
    expect(() => act({ ...saturday, routineDay: 7 }, 'focus')).toThrow('公司今天休息');
    saturday = act(saturday, 'lunch');
    const accepted = act(saturday, 'overtime');
    expect(accepted.minute).toBe(saturday.minute);
    expect(accepted.flags.overtimeAccepted).toBe(true);
    const finishedShift = act(act(accepted, 'focus'), 'test');
    expect(finishedShift.minute).toBe(14 * 60);
    expect(() => act(finishedShift, 'talk')).toThrow('14:00');
    const complete = sleep(finishedShift);
    expect(complete.summary).toMatchObject({ workMinutes: 210, earned: 31500 });
    expect(nextDay(complete).flags.overtimeAccepted).toBe(false);
  });

  it('三年毕业后关闭公司工作，生活仍可继续', () => {
    let state = sleep(fresh());
    for (let index = 0; index < CAREER_EVENT_COUNT; index++) {
      const event = getCareer(state).current;
      expect(event).not.toBeNull();
      state = transition(state, { id: `career-${index}`, expectedRevision: state.revision, kind: 'career', targetId: event!.options[0].id });
    }
    expect(getCareer(state).graduated).toBe(true);
    state = nextDay(state);
    expect(getDaySchedule(state)).toMatchObject({ kind: 'graduated', workStart: null, workEnd: null, lunchStart: null });
    state = travel(state, 'office');
    expect(() => act(state, 'focus')).toThrow('已经离开公司');
    expect(() => act(state, 'overtime')).toThrow('没有临时班');
    state = act(travel(state, 'park'), 'walk');
    expect(state.flags.walked).toBe(true);
    const complete = sleep(state);
    expect(complete.summary).toMatchObject({ workMinutes: 0, earned: 0 });
    expect(nextDay(complete).routineDay).toBe(3);
  });

  it('长时间游玩后保存近期命令，过期命令仍不能重放', () => {
    const state = dayAt(100, 8 * 60, 'home');
    state.revision = 4_000;
    state.processedCommandIds = Array.from({ length: 2_000 }, (_, index) => `past-${index}`);
    const saved = importGame(exportGame(act(state, 'rest')));
    expect(saved.processedCommandIds).toHaveLength(2_000);
    expect(saved.processedCommandIds).not.toContain('past-0');
    expect(saved.processedCommandIds).toContain('action-4000');
    expect(() => transition(saved, { id: 'past-0', expectedRevision: 2_000, kind: 'action', targetId: 'rest' })).toThrow('过期');
  });
});
