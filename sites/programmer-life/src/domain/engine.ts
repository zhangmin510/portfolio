import { LOCATIONS } from '../content/game';
import { getCareer } from './career';
import { getDaySchedule, ROUTINE_MORNING } from './routine';
import type {
  ActionId, ActionPreview, CharacterOptions, ChangeRecord, ChoiceId,
  Command, DailySummary, GameState, JournalEntry, LocationId, StatKey, TravelPreview,
} from './types';

const DAY_END = 1440;
const NEXT_MORNING = 1860;
const MAX_RECORDED_COMMANDS = 2_000;
const STAT_KEYS: StatKey[] = ['energy', 'hunger', 'mood', 'social', 'stress', 'skill', 'credit'];
const LABELS: Record<StatKey, string> = { energy: '精力', hunger: '饱腹', mood: '心情', social: '社交', stress: '压力', skill: '工程能力', credit: '职业信用' };
const WORK_ACTIONS = new Set<ActionId>(['focus', 'rush', 'test', 'ai', 'talk']);
const IMPLEMENTATION_ACTIONS = new Set<ActionId>(['focus', 'rush', 'ai']);
const EVENING_ACTIONS = new Set<ActionId>(['personal', 'cook', 'coffee', 'walk', 'midweek-walk', 'groceries', 'meetup']);

type ActionRule = ActionPreview & { locations: LocationId[]; stats?: Partial<Record<StatKey, number>>; progress?: number; quality?: number; debt?: number };

const RULES: ActionRule[] = [
  { id: 'breakfast', title: '好好吃一顿早餐', description: '煎个蛋、热杯牛奶。新一天，从不空腹开始。', duration: 30, cost: 1200, effects: ['饱腹 +42', '心情 +5'], category: 'life', locations: ['home'], stats: { hunger: 42, mood: 5 } },
  { id: 'cook', title: '做一顿热饭', description: '简单的一菜一汤，比起外卖多花一点时间。', duration: 45, cost: 1800, effects: ['饱腹 +56', '心情 +7', '压力 −4'], category: 'life', locations: ['home'], stats: { hunger: 56, mood: 7, stress: -4 } },
  { id: 'rest', title: '放空一会儿', description: '离开屏幕，喝点水。不做什么也是一种安排。', duration: 30, cost: 0, effects: ['精力 +22', '压力 −5'], category: 'life', locations: ['home', 'office', 'cafe', 'store', 'park', 'makerspace'], stats: { energy: 22, stress: -5 } },
  { id: 'sleep', title: '睡个好觉', description: '把今天存好。醒来后，看看这一天过成了什么样。', duration: 0, cost: 0, effects: ['睡至次日 07:00', '恢复精力、降低压力', '生成当日回顾'], category: 'life', locations: ['home'] },
  { id: 'personal', title: '做一点自己的小项目', description: '那个稍后阅读小工具，今天终于可以有第一个界面。', duration: 60, cost: 0, effects: ['个人项目 +18', '工程能力 +2', '精力 −9'], category: 'work', locations: ['home', 'cafe', 'makerspace'], stats: { energy: -9, skill: 2, mood: 6 } },
  { id: 'focus', title: '专注实现', description: '戴上耳机，按拆好的步骤完成核心功能。', duration: 120, cost: 0, effects: ['稳定推进项目', '工程能力 +3', '精力 −13', '压力 +4'], risk: '少量技术债；精力和能力影响产出。', category: 'work', locations: ['office'], stats: { energy: -13, skill: 3, stress: 4 }, progress: 21, quality: 2, debt: 3 },
  { id: 'rush', title: '加速赶一版', description: '先让它跑起来。细节和边界条件需要之后补上。', duration: 120, cost: 0, effects: ['更快推进项目', '精力 −20', '技术债 +14', '压力 +13'], risk: '今天省下的时间，可能在维护时还回来。', category: 'work', locations: ['office'], stats: { energy: -20, skill: 2, stress: 13 }, progress: 32, quality: -3, debt: 14 },
  { id: 'test', title: '测试与代码评审', description: '把空输入、长列表和意外操作都试一遍。', duration: 90, cost: 0, effects: ['质量 +20', '技术债 −10', '工程能力 +3'], risk: '占用实现时间，但能减少后续返工。', category: 'work', locations: ['office'], stats: { energy: -8, skill: 3, stress: -2 }, quality: 20, debt: -10 },
  { id: 'ai', title: '用 AI 辅助实现', description: '让工具生成初稿。审查与测试仍需要自己安排。', duration: 90, cost: 0, effects: ['快速得到功能初稿', '工程能力 +1', '技术债 +10'], risk: '能力越低，未经验证的初稿越容易留下问题。', category: 'work', locations: ['office'], stats: { energy: -7, skill: 1, stress: 3 }, progress: 25, quality: -2, debt: 10 },
  { id: 'talk', title: '和林工聊聊', description: '问一个卡住你的问题，也听听团队踩过的坑。', duration: 30, cost: 0, effects: ['社交 +18', '林工信任 +5', '工程能力 +2'], category: 'social', locations: ['office'], stats: { social: 18, skill: 2, mood: 4, stress: -3 } },
  { id: 'overtime', title: '自愿接下周末临时班', description: '确认今天愿意接班，再选择要做的工作。实际工时按 1.5 倍结算。', duration: 0, cost: 0, effects: ['开放今天的工作行动', '临时班 10:00–14:00'], category: 'work', locations: ['office'] },
  { id: 'lunch', title: '去楼下吃碗面', description: '暂时收起需求，认真对付一碗热汤面。', duration: 30, cost: 2200, effects: ['饱腹 +58', '心情 +4'], category: 'life', locations: ['office', 'store'], stats: { hunger: 58, mood: 4 } },
  { id: 'lunch-break', title: '午休半小时', description: '吃过午饭，闭眼休息一会儿，给下午留些精力。', duration: 30, cost: 0, effects: ['精力 +24', '压力 −8'], category: 'life', locations: ['office'], stats: { energy: 24, stress: -8 } },
  { id: 'coffee', title: '喝一杯，慢半拍', description: '窗边的位置空着，给自己一小段没有截止时间的时间。', duration: 30, cost: 1800, effects: ['精力 +12', '心情 +12', '压力 −6'], category: 'life', locations: ['cafe'], stats: { energy: 12, mood: 12, stress: -6 } },
  { id: 'walk', title: '沿河散散步', description: '走到那棵树再折回来，让脑子里也通通风。', duration: 45, cost: 0, effects: ['心情 +17', '压力 −14', '精力 −3'], category: 'life', locations: ['park'], stats: { mood: 17, stress: -14, energy: -3 } },
  { id: 'midweek-walk', title: '周三小周末 · 和阿遥散步', description: '下班后和阿遥沿河走一圈，聊聊最近在做的小东西。', duration: 60, cost: 0, effects: ['心情 +24', '社交 +12', '压力 −20', '阿遥信任 +3'], category: 'social', locations: ['park'], stats: { mood: 24, social: 12, stress: -20, energy: -4 } },
  { id: 'groceries', title: '来份便利店晚餐', description: '饭团和热汤。忙了一天，也记得把自己照顾好。', duration: 20, cost: 1600, effects: ['饱腹 +45', '心情 +3'], category: 'life', locations: ['store'], stats: { hunger: 45, mood: 3 } },
  { id: 'meetup', title: '参加小作品交流', description: '听听别人在做什么，和阿遥聊聊你那个没完成的小工具。', duration: 60, cost: 0, effects: ['社交 +30', '阿遥信任 +8', '个人项目 +8'], category: 'social', locations: ['makerspace'], stats: { social: 30, mood: 12, energy: -5 } },
];

function clamp(value: number, max = 100) { return Math.max(0, Math.min(max, Math.round(value))); }
function has(state: GameState, trait: GameState['player']['traits'][number]) { return state.player.traits.includes(trait); }
function elapsedHour(state: GameState) { return state.minute % DAY_END / 60; }

function formatTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function workIncome(state: GameState) {
  if (!state.routineDay) return 0;
  const rate = getDaySchedule(state).kind === 'overtime' ? 150 : 100;
  return Math.max(0, Math.min(state.work.minutes * rate, 100_000_000 - state.player.cash));
}

function rememberCommand(state: GameState, id: string) {
  state.revision += 1;
  state.processedCommandIds = [...state.processedCommandIds.slice(1 - MAX_RECORDED_COMMANDS), id];
}

export function createGame(options: CharacterOptions): GameState {
  if (options.traits.length !== 2 || new Set(options.traits).size !== 2 || options.traits.some(trait => !['focused', 'outgoing', 'night-owl', 'steady'].includes(trait))) {
    throw new Error('请选择两项不同的性格。');
  }
  if (!['graduate', 'switcher'].includes(options.background) || !['balance', 'craft', 'sideproject'].includes(options.wish)) throw new Error('角色设定无效。');
  const seed = (options.seed ?? 20261107) >>> 0;
  const name = options.name.trim().slice(0, 12) || '小栈';
  return {
    schemaVersion: 1, rulesVersion: 'day-one-v1', runId: options.runId ?? `day-one-${seed}`, revision: 0, rngState: seed,
    minute: 480, phase: 'playing', locationId: 'home',
    player: { name, background: options.background, traits: [...options.traits], wish: options.wish, cash: options.background === 'graduate' ? 300000 : 500000, energy: 82, hunger: 50, mood: 72, social: 55, stress: 16, skill: options.background === 'graduate' ? 35 : 20, credit: 50 },
    work: { progress: 0, quality: 25, debt: 5, minutes: 0 }, personalProgress: 0,
    relationships: { pm: 25, mentor: 20, roommate: 40, friend: 25 },
    flags: { breakfast: false, commuted: false, workSessions: 0, scopeResolved: false, eveningActivity: false, slept: false },
    pendingEvent: null, eventChoice: null, processedCommandIds: [], summary: null,
    journal: [{ id: 'welcome', minute: 480, title: '你好，栈城', detail: `${name}，今天是新工作的第一天。先吃点东西，再去字节花园看看吧。`, category: 'life', changes: [] }],
  };
}

function actionDisabled(state: GameState, rule: ActionRule, schedule = getDaySchedule(state)): string | undefined {
  if (state.phase === 'complete') return '这一天已经结束，查看回顾后可以开始新一天。';
  if (state.phase === 'event') return '先回应产品经理的消息。';
  if (!rule.locations.includes(state.locationId)) return '当前地点无法进行这项行动。';
  if (state.player.cash < rule.cost) return '余额不足，先选一项免费的活动。';
  if (rule.id === 'breakfast' && state.flags.breakfast) return '今天已经吃过早餐了。';
  if (rule.id === 'sleep') return state.minute < 1080 ? '18:00 后可以睡觉结束这一天。' : undefined;
  if (state.minute + rule.duration > DAY_END) return '夜深了，回家睡觉吧。';
  if (rule.id === 'lunch-break') {
    if (state.flags.lunchBreak) return '今天已经午休过了。';
    if (schedule.lunchStart === null || schedule.lunchEnd === null) return '今天没有公司午休安排，随时可以放空一会儿。';
    if (state.minute < schedule.lunchStart || state.minute + rule.duration > schedule.lunchEnd) return '午休时段为 11:30–13:00，请留出半小时。';
  }
  if (rule.id === 'overtime') {
    if (schedule.kind !== 'overtime') return '今天没有临时班。';
    if (state.flags.overtimeAccepted) return '今天已经接班，可以选择工作了。';
    if (state.minute < 600 || state.minute + 30 > 840) return '临时班在 10:00–14:00，请至少留出半小时。';
  }
  if (rule.id === 'midweek-walk' && (schedule.kind !== 'midweek' || state.minute < 1020)) return '周三 17:00 后可以和阿遥一起散步。';
  if (WORK_ACTIONS.has(rule.id)) {
    const { workStart, workEnd, lunchStart, lunchEnd } = schedule;
    if (workStart === null || workEnd === null) return schedule.kind === 'graduated' ? '你已经离开公司，可以安排自己的生活了。' : '公司今天休息。';
    if (schedule.kind === 'overtime' && !state.flags.overtimeAccepted) return '先选择「自愿接下周末临时班」。';
    if (state.minute < workStart) return `${formatTime(workStart)} 开工，可以先休息一会儿。`;
    if (state.minute + rule.duration > workEnd) return `今天 ${formatTime(workEnd)} 下班，剩余时间不够完成这项工作。`;
    if (state.routineDay && schedule.kind !== 'overtime' && lunchStart !== null && lunchEnd !== null && state.minute < lunchEnd && state.minute + rule.duration > lunchStart) return '11:30–13:00 是午饭和午休时间，下午再做这项工作。';
    if (state.player.energy < 15) return '精力不足，先放空一会儿。';
    if (state.player.hunger < 10) return '肚子空了，先吃点东西。';
  }
  if (rule.id === 'meetup' && state.minute < 1020) return '交流会 17:00 开始。';
  if (rule.id === 'personal' && state.player.energy < 10) return '先休息，灵感也需要一点精力。';
  return undefined;
}

export function getActions(state: GameState): ActionPreview[] {
  const schedule = getDaySchedule(state);
  const availableRules = RULES.filter(rule => rule.locations.includes(state.locationId) &&
    (rule.id !== 'overtime' || schedule.kind === 'overtime') &&
    (rule.id !== 'midweek-walk' || schedule.kind === 'midweek'));
  return availableRules.map(rule => ({
    id: rule.id, title: rule.title, description: rule.description,
    duration: rule.id === 'sleep' ? Math.max(0, NEXT_MORNING - state.minute) : rule.duration,
    cost: rule.cost,
    effects: rule.id === 'sleep' && state.routineDay && state.work.minutes > 0
      ? [...rule.effects, `结算今日工作收入 ¥${(workIncome(state) / 100).toFixed(2)}`]
      : [...rule.effects],
    risk: rule.risk, category: rule.category, disabledReason: actionDisabled(state, rule, schedule),
  }));
}

const DISTANCE: Record<LocationId, number> = { home: 0, office: 3, cafe: 1, store: 0.5, park: 1.5, makerspace: 2 };

export function getTravelOptions(state: GameState, destination: LocationId): TravelPreview[] {
  if (!Object.hasOwn(LOCATIONS, destination)) return [];
  const isCommute = (state.locationId === 'home' && destination === 'office') || (state.locationId === 'office' && destination === 'home');
  const distance = Math.max(0.5, Math.abs(DISTANCE[destination] - DISTANCE[state.locationId]));
  const options: TravelPreview[] = [
    { mode: 'drive', duration: isCommute ? 35 : Math.round(8 + distance * 4), cost: isCommute ? 1200 : 600 },
    { mode: 'transit', duration: isCommute ? 45 : Math.round(10 + distance * 5), cost: isCommute ? 600 : 300 },
    { mode: 'walk', duration: isCommute ? 70 : Math.round(15 + distance * 12), cost: 0 },
  ];
  return options.map(option => {
    let disabledReason: string | undefined;
    if (state.phase === 'complete') disabledReason = '这一天已经结束。';
    else if (state.phase === 'event') disabledReason = '先回应产品经理的消息。';
    else if (destination === state.locationId) disabledReason = '你已经在这里了。';
    else if (option.cost > state.player.cash) disabledReason = '余额不足，可以步行前往。';
    else if (destination !== 'home' && state.minute + option.duration > DAY_END) disabledReason = '夜深了，先回家休息吧。';
    return { ...option, disabledReason };
  });
}

function advance(state: GameState, minutes: number, sleeping = false) {
  const hours = minutes / 60;
  let energyDrain = 3;
  if (has(state, 'night-owl')) energyDrain *= elapsedHour(state) >= 18 ? 0.65 : elapsedHour(state) < 10 ? 1.2 : 1;
  state.player.energy -= sleeping ? 0 : hours * energyDrain;
  state.player.hunger -= hours * (sleeping ? 2 : 5);
  state.player.social -= hours * (has(state, 'focused') ? 2.2 : 2);
  state.player.mood -= sleeping ? 0 : hours * (has(state, 'outgoing') ? 1.1 : 0.7);
  state.minute += minutes;
}

function addStats(state: GameState, stats: Partial<Record<StatKey, number>> = {}) {
  for (const key of STAT_KEYS) {
    let delta = stats[key] ?? 0;
    if (key === 'stress' && delta > 0 && has(state, 'steady')) delta *= 0.7;
    if (key === 'social' && delta > 0 && has(state, 'outgoing')) delta *= 1.2;
    state.player[key] += delta;
  }
}

function normalize(state: GameState) {
  for (const key of STAT_KEYS) state.player[key] = clamp(state.player[key]);
  state.work.progress = clamp(state.work.progress);
  state.work.quality = clamp(state.work.quality);
  state.work.debt = clamp(state.work.debt);
  state.personalProgress = clamp(state.personalProgress);
  for (const key of ['pm', 'mentor', 'roommate', 'friend'] as const) state.relationships[key] = clamp(state.relationships[key]);
}

function changes(before: GameState, after: GameState): ChangeRecord[] {
  const list: ChangeRecord[] = [];
  const cash = after.player.cash - before.player.cash;
  if (cash) list.push({ label: '现金', value: cash / 100, unit: '元' });
  for (const key of STAT_KEYS) {
    const delta = after.player[key] - before.player[key];
    if (delta) list.push({ label: LABELS[key], value: delta });
  }
  for (const [key, label] of [['progress', '项目进度'], ['quality', '代码质量'], ['debt', '技术债']] as const) {
    const delta = after.work[key] - before.work[key];
    if (delta) list.push({ label, value: delta });
  }
  if (after.personalProgress !== before.personalProgress) list.push({ label: '个人项目', value: after.personalProgress - before.personalProgress });
  return list;
}

function makeSummary(state: GameState, earned: number): DailySummary {
  const tags: string[] = [];
  if (state.work.minutes >= 300 && state.work.quality >= 45) tags.push(state.routineDay ? '踏实工作' : '可靠的第一步');
  else if (state.work.minutes >= 240) tags.push('进入工作节奏');
  if (state.personalProgress > 0) tags.push('给自己留了时间');
  if (state.flags.eveningActivity) tags.push('生活也有进度');
  if (state.flags.lunch && state.flags.lunchBreak) tags.push('记得午饭和午休');
  if (state.flags.walked) tags.push('出门散了步');
  if (state.work.debt >= 25) tags.push('记得补上验证');
  if (tags.length === 0) tags.push('慢慢找到自己的节奏');
  const openingCash = state.dayStartCash ?? (state.player.background === 'graduate' ? 300000 : 500000);
  const result = {
    tags,
    workMinutes: state.work.minutes,
    spent: Math.max(0, openingCash - state.player.cash + earned),
    progress: state.work.progress,
    quality: state.work.quality,
    debt: state.work.debt,
    personalProgress: state.personalProgress,
  };
  if (state.routineDay) {
    const schedule = getDaySchedule(state);
    return {
      ...result,
      title: `第 ${schedule.day} 天过完了`,
      description: `${schedule.weekday}的工作和生活都记在这一天的日志里。明早 07:00 可以开始新一天。`,
      highlights: [
        state.work.minutes ? `今天在公司投入了 ${state.work.minutes} 分钟。` : '今天把时间留给了工作以外的事。',
        state.flags.lunchBreak ? '午间留了半小时休息。' : state.flags.lunch ? '忙到中午，也记得停下来吃饭。' : '今天的饭点由自己安排。',
        state.flags.walked ? '今天出了门，沿河走了一会儿。' : state.flags.eveningActivity ? '忙完以后，还留了点时间给自己的生活。' : '回家睡一觉，明天再出发。',
      ],
      earned,
    };
  }
  const decision: Record<ChoiceId, string> = {
    negotiate: '你和产品经理确认了范围，让承诺变得更清楚。',
    promise: '你接下了完整需求。记得给测试和修复留下空间。',
    'ask-help': '你请林工一起拆解问题，新关系从一个好问题开始。',
  };
  const highlights = [
    state.flags.breakfast ? '出门前吃了早餐，照顾好自己也是正经事。' : '今天没有在家吃早餐，明早可以给自己留半小时。',
    state.eventChoice ? decision[state.eventChoice] : state.work.minutes > 0 ? '你开始熟悉第一份需求，还没有走到需求变更节点。' : '今天把时间留给了工作以外的事情。',
    state.personalProgress > 0 ? `自己的小工具推进了 ${state.personalProgress}%，想法开始长出形状。` : state.flags.eveningActivity ? '下班后还有自己的生活，今天不只发生了工作。' : '明天可以给散步、朋友或个人项目留一点时间。',
  ];
  return {
    ...result,
    title: state.work.minutes >= 240 ? '第一天，慢慢有了自己的节奏。' : '第一天，也是一个新的开始。',
    description: '栈城还没有变熟，但你已经在这里认真生活了一天。今天的选择都记下来了。',
    highlights,
  };
}

function applyChoice(state: GameState, choice: ChoiceId) {
  if (choice === 'negotiate') {
    advance(state, 15); addStats(state, { credit: 5, stress: -6 }); state.work.progress += 6; state.work.quality += 2; state.relationships.pm += 6;
  } else if (choice === 'promise') {
    addStats(state, { stress: 12 }); state.work.debt += 12; state.relationships.pm += 4;
  } else if (choice === 'ask-help') {
    advance(state, 45); addStats(state, { skill: 2, social: 6, stress: -2 }); state.work.progress += 10; state.work.quality += 8; state.relationships.mentor += 10;
  } else throw new Error('这个选项不存在。');
  state.phase = 'playing'; state.pendingEvent = null; state.eventChoice = choice; state.flags.scopeResolved = true;
}

function beginNextDay(state: GameState, commandId: string): GameState {
  if (state.phase !== 'complete' || !state.summary || !state.flags.slept || state.minute !== NEXT_MORNING || state.locationId !== 'home') {
    throw new Error('先回家睡觉，才能开始新一天。');
  }
  const next = structuredClone(state);
  next.firstDaySummary ??= structuredClone(state.summary);
  next.routineDay = (state.routineDay ?? 1) + 1;
  next.dayStartCash = next.player.cash;
  next.minute = ROUTINE_MORNING;
  next.phase = 'playing';
  next.summary = null;
  next.pendingEvent = null;
  next.work.minutes = 0;
  next.flags = {
    breakfast: false,
    commuted: false,
    workSessions: 0,
    scopeResolved: state.flags.scopeResolved,
    eveningActivity: false,
    slept: false,
    lunch: false,
    lunchBreak: false,
    walked: false,
    overtimeAccepted: false,
  };
  const schedule = getDaySchedule(next);
  next.journal = [{ id: `day-${schedule.day}-morning`, minute: next.minute, title: `${schedule.weekday}早上好`, detail: schedule.description, category: 'life', changes: [] }];
  rememberCommand(next, commandId);
  return next;
}

export function transition(state: GameState, command: Command): GameState {
  if (!command.id || command.id.length > 200) throw new Error('行动编号无效。');
  if (state.processedCommandIds.includes(command.id)) return state;
  if (command.expectedRevision !== state.revision) throw new Error('这项行动已经过期，请再选择一次。');
  if (command.kind === 'next-day') return beginNextDay(state, command.id);
  if (command.kind === 'career') {
    if (state.phase !== 'complete') throw new Error('先结束这一天，再继续职业历程。');
    const { current } = getCareer(state);
    if (!current) throw new Error('这一年的职业事件已经结束。');
    if (!current.options.some(option => option.id === command.targetId)) throw new Error('请选择当前职业事件中的选项。');
    const next = {
      ...state,
      careerChoices: [...(state.careerChoices ?? []), command.targetId],
    };
    rememberCommand(next, command.id);
    return next;
  }
  if (state.phase === 'complete') throw new Error('这一天已经结束了，查看回顾后再开始新一天。');
  const next = structuredClone(state);
  let entry: Omit<JournalEntry, 'id' | 'minute' | 'changes'>;
  let earned = 0;

  if (command.kind === 'choice') {
    if (state.phase !== 'event' || !state.pendingEvent) throw new Error('当前没有需要回应的消息。');
    applyChoice(next, command.targetId);
    const text: Record<ChoiceId, [string, string]> = {
      negotiate: ['把范围说清楚了', '产品经理点点头：「那就先保证核心流程，我们把其他功能排进下一轮。」'],
      promise: ['先把完整需求接下来', '「好，那我们期待你的第一版。」你在便签上又加了一行：留时间测试。'],
      'ask-help': ['一起把问题拆开', '林工搬来一把椅子：「我们先看边界条件。这个地方，之前也有人踩过坑。」'],
    };
    entry = { title: text[command.targetId][0], detail: text[command.targetId][1], category: 'event' };
  } else if (command.kind === 'travel') {
    const option = getTravelOptions(state, command.targetId).find(item => item.mode === command.mode);
    if (!option) throw new Error('这条路线不存在。');
    if (option.disabledReason) throw new Error(option.disabledReason);
    advance(next, option.duration); next.player.cash -= option.cost;
    if (command.mode === 'walk') addStats(next, { energy: -4, mood: 3, stress: -2 });
    next.locationId = command.targetId;
    if (command.targetId === 'office') next.flags.commuted = true;
    const detailByMode = {
      drive: `开车 ${option.duration} 分钟，到达目的地。`,
      transit: `搭乘社区巴士，${option.duration} 分钟后到了。窗外是慢慢熟悉起来的栈城。`,
      walk: `步行 ${option.duration} 分钟，换一种速度认识这座城。`,
    };
    entry = { title: `到达${LOCATIONS[command.targetId].name}`, detail: detailByMode[command.mode], category: 'travel' };
  } else if (command.kind === 'action') {
    const rule = RULES.find(item => item.id === command.targetId);
    if (!rule) throw new Error('这项行动不存在。');
    const schedule = getDaySchedule(state);
    const disabled = actionDisabled(state, rule, schedule);
    if (disabled) throw new Error(disabled);
    if (rule.id === 'sleep') {
      const sleepMinutes = NEXT_MORNING - next.minute;
      advance(next, sleepMinutes, true);
      next.player.energy = Math.min(96, next.player.energy + sleepMinutes / 60 * 10);
      addStats(next, { stress: -18, mood: 8 });
      earned = workIncome(state);
      next.player.cash += earned;
      next.flags.slept = true; next.phase = 'complete';
    } else {
      const performance = (0.75 + state.player.skill / 100) * (state.player.energy < 30 ? 0.65 : 1) * (state.player.hunger < 25 ? 0.75 : 1);
      advance(next, rule.duration); next.player.cash -= rule.cost; addStats(next, rule.stats);
      let progress = (rule.progress ?? 0) * performance;
      if (has(state, 'focused')) progress *= 1.1;
      if (has(state, 'steady')) progress *= 0.95;
      if (state.eventChoice === 'promise') progress *= 1.15;
      next.work.progress += progress;
      next.work.quality += rule.quality ?? 0;
      next.work.debt += rule.debt ?? 0;
      if (rule.id === 'ai') next.work.debt += state.player.skill < 30 ? 4 : 0;
      if (WORK_ACTIONS.has(rule.id)) next.work.minutes += rule.duration;
      if (IMPLEMENTATION_ACTIONS.has(rule.id)) next.flags.workSessions += 1;
      if (rule.id === 'breakfast') next.flags.breakfast = true;
      if (rule.id === 'lunch' && state.minute >= 690 && state.minute < 840) next.flags.lunch = true;
      if (rule.id === 'lunch-break') next.flags.lunchBreak = true;
      if (rule.id === 'overtime') next.flags.overtimeAccepted = true;
      if (rule.id === 'walk' || rule.id === 'midweek-walk') next.flags.walked = true;
      if (rule.id === 'personal') next.personalProgress += 18;
      if (rule.id === 'talk') next.relationships.mentor += 5;
      if (rule.id === 'meetup') { next.relationships.friend += 8; next.personalProgress += 8; }
      if (rule.id === 'midweek-walk') next.relationships.friend += 3;
      const offHoursStart = state.routineDay ? schedule.workEnd ?? 0 : 1020;
      if (state.minute >= offHoursStart && EVENING_ACTIONS.has(rule.id)) next.flags.eveningActivity = true;
    }
    const sleepDetail = earned ? `今天的工作收入 ¥${(earned / 100).toFixed(2)} 已到账。明早 07:00 见。` : '合上电脑，把灯关小。醒来时，今天已经变成了一页值得留下的日常。';
    entry = { title: rule.id === 'sleep' ? '晚安，明天见' : rule.title, detail: rule.id === 'sleep' ? sleepDetail : rule.description, category: rule.category === 'work' ? 'work' : 'life' };
  } else throw new Error('行动类型无效。');

  normalize(next);
  rememberCommand(next, command.id);
  next.journal.push({ ...entry, id: `${command.id}:result`, minute: next.minute, changes: changes(state, next) });
  if (next.phase === 'complete') next.summary = makeSummary(next, earned);
  else if (!next.flags.scopeResolved && next.work.minutes >= 240 && next.flags.workSessions >= 2 && next.work.progress > 0) {
    next.phase = 'event'; next.pendingEvent = 'scope-change';
    next.journal.push({ id: `${command.id}:scope`, minute: next.minute, title: '产品经理发来一条消息', detail: '「第一版能不能顺便加上筛选和批量操作？看起来应该不难吧。」先别急着答应。', category: 'event', changes: [] });
  }
  return next;
}
