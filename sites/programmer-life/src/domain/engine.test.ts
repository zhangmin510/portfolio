import { describe, expect, it } from 'vitest';
import { createGame, getActions, getTravelOptions, transition } from './engine';
import type { ActionId, ChoiceId, Command, GameState, LocationId, TravelMode } from './types';

const options = { name: '小栈', background: 'graduate', traits: ['focused', 'steady'], wish: 'balance', seed: 42, runId: 'test' } as const;
function fresh() { return createGame({ ...options, traits: [...options.traits] }); }
function act(state: GameState, targetId: ActionId) { return transition(state, { id: `a${state.revision}`, expectedRevision: state.revision, kind: 'action', targetId }); }
function travel(state: GameState, targetId: LocationId, mode: TravelMode = 'transit') { return transition(state, { id: `a${state.revision}`, expectedRevision: state.revision, kind: 'travel', targetId, mode }); }
function choose(state: GameState, targetId: ChoiceId) { return transition(state, { id: `a${state.revision}`, expectedRevision: state.revision, kind: 'choice', targetId }); }
function reachEvent() { return act(act(travel(act(fresh(), 'breakfast'), 'office'), 'focus'), 'focus'); }

describe('首日规则引擎', () => {
  it('相同输入确定性创建，且各局状态没有共享引用', () => {
    const first = fresh(); const second = fresh(); expect(first).toEqual(second);
    first.player.energy = 0; first.player.traits.pop(); expect(second.player.energy).toBe(82); expect(second.player.traits).toHaveLength(2);
  });
  it('拒绝重复或不足两项的性格', () => {
    expect(() => createGame({ ...options, traits: ['focused', 'focused'] })).toThrow();
    expect(() => createGame({ ...options, traits: [] })).toThrow();
  });
  it('只查询状态和行动不会推进现实时间', () => {
    const state = fresh(); const saved = structuredClone(state);
    getActions(state); getTravelOptions(state, 'office'); expect(state).toEqual(saved);
    expect(state.minute).toBe(480);
  });
  it('转移不修改输入，并为重复命令去重，旧版本新命令拒绝', () => {
    const state = fresh(); const command: Command = { id: 'breakfast', expectedRevision: 0, kind: 'action', targetId: 'breakfast' };
    const next = transition(state, command);
    expect(state.player.cash).toBe(300000); expect(state.minute).toBe(480);
    expect(transition(next, command)).toBe(next);
    expect(() => transition(next, { ...command, id: 'stale' })).toThrow('过期');
    expect(() => act(next, 'breakfast')).toThrow('已经吃过');
  });
  it('地点、工作时段与余额被规则层校验', () => {
    expect(() => act(fresh(), 'focus')).toThrow('地点');
    const poor = fresh(); poor.player.cash = 0;
    expect(() => act(poor, 'breakfast')).toThrow('余额不足');
    expect(getTravelOptions(poor, 'office').find(item => item.mode === 'walk')?.disabledReason).toBeUndefined();
    expect(() => act(travel(fresh(), 'office'), 'focus')).toThrow('09:00');
  });
  it('开车通勤耗时 35 分钟、花费 ¥12，重复提交不重复结算', () => {
    const state = fresh();
    const preview = getTravelOptions(state, 'office').find(option => option.mode === 'drive');
    expect(preview).toEqual({ mode: 'drive', duration: 35, cost: 1200, disabledReason: undefined });

    const command: Command = { id: 'drive-to-work', expectedRevision: 0, kind: 'travel', targetId: 'office', mode: 'drive' };
    const arrived = transition(state, command);
    expect(arrived.minute).toBe(state.minute + 35);
    expect(arrived.player.cash).toBe(state.player.cash - 1200);
    expect(arrived.locationId).toBe('office');
    expect(arrived.journal.at(-1)?.detail).toContain('开车 35 分钟');
    expect(transition(arrived, command)).toBe(arrived);

    const returnTrip = getTravelOptions(arrived, 'home').find(option => option.mode === 'drive');
    expect(returnTrip).toMatchObject({ duration: 35, cost: 1200 });
  });
  it('开车去其他地点按距离耗时，花费 ¥6', () => {
    const state = fresh();
    const arrived = travel(state, 'park', 'drive');
    expect(arrived.minute).toBe(state.minute + 14);
    expect(arrived.player.cash).toBe(state.player.cash - 600);
    expect(arrived.locationId).toBe('park');
  });
  it('余额不足时禁止开车，仍可选公交或步行', () => {
    const state = fresh();
    state.player.cash = 1199;
    const options = getTravelOptions(state, 'office');
    expect(options.find(option => option.mode === 'drive')?.disabledReason).toContain('余额不足');
    expect(options.filter(option => !option.disabledReason).map(option => option.mode)).toEqual(['transit', 'walk']);
    expect(() => travel(state, 'office', 'drive')).toThrow('余额不足');
    expect(state.player.cash).toBe(1199);
  });
  it('两次工作触发需求事件，回应前不能继续行动或出行', () => {
    const state = reachEvent(); expect(state.work.minutes).toBe(240); expect(state.phase).toBe('event');
    expect(state.pendingEvent).toBe('scope-change');
    expect(() => act(state, 'test')).toThrow('先回应');
    expect(() => travel(state, 'home')).toThrow('先回应');
    const next = choose(state, 'negotiate'); expect(next.phase).toBe('playing'); expect(next.flags.scopeResolved).toBe(true);
    expect(next.eventChoice).toBe('negotiate'); expect(next.player.credit).toBe(55);
    expect(act(next, 'test').pendingEvent).toBeNull();
  });
  it('三个事件选项产生不同代价，读档后再选结果可复现', () => {
    const event = reachEvent(); const loaded = JSON.parse(JSON.stringify(event)) as GameState;
    const negotiated = choose(event, 'negotiate'); const promised = choose(event, 'promise'); const help = choose(event, 'ask-help');
    expect(choose(loaded, 'ask-help')).toEqual(help);
    expect(help.minute - event.minute).toBe(45); expect(promised.minute).toBe(event.minute);
    expect(promised.work.debt).toBeGreaterThan(negotiated.work.debt); expect(help.relationships.mentor).toBeGreaterThan(negotiated.relationships.mentor);
  });
  it('纯聊天或测试不会触发做到一半的需求变更，需先有两次实现', () => {
    let state = travel(act(fresh(), 'breakfast'), 'office');
    state = act(state, 'test'); state = act(state, 'test'); state = act(state, 'test');
    expect(state.work.minutes).toBe(270); expect(state.work.progress).toBe(0);
    expect(state.flags.workSessions).toBe(0); expect(state.phase).toBe('playing');
    state = act(state, 'focus'); expect(state.phase).toBe('playing');
    state = act(state, 'focus'); expect(state.phase).toBe('event'); expect(state.flags.workSessions).toBe(2);
  });
  it('完整首日：生活、通勤、工作事件、晚间个人项目与睡眠回顾', () => {
    let state = choose(reachEvent(), 'ask-help');
    state = act(state, 'lunch'); state = act(state, 'rest'); state = act(state, 'test'); state = act(state, 'focus');
    state = travel(state, 'home'); state = act(state, 'cook'); state = act(state, 'personal');
    expect(state.minute).toBeGreaterThanOrEqual(1080);
    state = act(state, 'sleep');
    expect(state.phase).toBe('complete'); expect(state.minute).toBe(1860); expect(state.flags.slept).toBe(true);
    expect(state.summary?.workMinutes).toBe(450); expect(state.summary?.personalProgress).toBe(18);
    expect(state.summary?.highlights).toHaveLength(3); expect(state.summary?.spent).toBe(6400);
    expect(state.player.cash).toBe(293600); expect(state.player.energy).toBe(96);
    expect(() => act(state, 'rest')).toThrow('结束');
  });
  it('不工作也可完成首日，并提供不同回顾', () => {
    let state = fresh();
    while (state.minute < 1080) state = act(state, 'rest');
    state = act(state, 'sleep'); expect(state.summary?.workMinutes).toBe(0); expect(state.summary?.title).toContain('新的开始');
  });
  it('极低精力仍可休息，午夜在外也可免费回家，不会锁死', () => {
    const state = fresh(); state.locationId = 'office'; state.minute = 1430; state.player.energy = 0; state.player.cash = 0;
    expect(getTravelOptions(state, 'home').find(item => item.mode === 'walk')?.disabledReason).toBeUndefined();
    const home = travel(state, 'home', 'walk'); expect(home.minute).toBe(1500);
    const ended = act(home, 'sleep'); expect(ended.phase).toBe('complete'); expect(ended.minute).toBe(1860);
    const tired = fresh(); tired.player.energy = 0; expect(act(tired, 'rest').player.energy).toBeGreaterThan(0);
  });
  it('睡眠按实际时长恢复，不会用临近早晨的短睡获得完整精力', () => {
    const short = fresh(); short.minute = 1850; short.player.energy = 15;
    const result = act(short, 'sleep');
    expect(result.minute).toBe(1860); expect(result.player.energy).toBe(17);
    expect(result.phase).toBe('complete');
    const long = fresh(); long.minute = 1260; long.player.energy = 15;
    expect(act(long, 'sleep').player.energy).toBe(96);
  });
  it('重复免费行动不会超过属性边界，短行动不会产生工资与房租', () => {
    let state = fresh();
    for (let i = 0; i < 20; i++) state = act(state, 'rest');
    for (const key of ['energy', 'hunger', 'mood', 'social', 'stress', 'skill', 'credit'] as const) { expect(state.player[key]).toBeGreaterThanOrEqual(0); expect(state.player[key]).toBeLessThanOrEqual(100); }
    expect(state.player.cash).toBe(300000);
  });
});
