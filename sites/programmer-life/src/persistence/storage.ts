import type { GameState } from '../domain/types';
import { CAREER_EVENT_COUNT, getCareer } from '../domain/career';
import { ROUTINE_MORNING } from '../domain/routine';

export const SAVE_KEY = 'programmer-life:day-one:save';
export const BACKUP_KEY = `${SAVE_KEY}:backup`;
const MAX_SAVE_LENGTH = 1_000_000;
const MAX_TIME = 1_440 + ROUTINE_MORNING;

type RecordValue = Record<string, unknown>;

function invalid(detail: string): never {
  throw new Error(`存档无效：${detail}`);
}

function object(value: unknown, name: string): asserts value is RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(`${name}格式不正确`);
}

function text(value: unknown, name: string, max = 500, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) invalid(`${name}不正确`);
}

function number(value: unknown, name: string, min: number, max: number, integer = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    invalid(`${name}超出范围`);
  }
}

function enumeration(value: unknown, name: string, options: readonly unknown[]): void {
  if (!options.includes(value)) invalid(`${name}不受支持`);
}

function bool(value: unknown, name: string): void {
  if (typeof value !== 'boolean') invalid(`${name}不正确`);
}

function strings(value: unknown, name: string, maxItems = 100): asserts value is string[] {
  if (!Array.isArray(value) || value.length > maxItems) invalid(`${name}格式不正确`);
  value.forEach((entry: unknown) => text(entry, name, 500));
}

function validateSummary(value: unknown, name: string) {
  object(value, name);
  text(value.title, '回顾标题', 200);
  text(value.description, '回顾内容', 4_000);
  strings(value.highlights, '今日经历', 20);
  strings(value.tags, '今日标签', 20);
  number(value.workMinutes, '回顾工作时间', 0, 1_380, true);
  number(value.spent, '今日花费', 0, 100_000_000, true);
  if (value.earned !== undefined) number(value.earned, '今日工作收入', 0, 100_000_000, true);
  for (const key of ['progress', 'quality', 'debt', 'personalProgress']) number(value[key], '回顾项目状态', 0, 100);
}

/** Validate before accepting either disk data or an imported file. Never advances the clock. */
export function validateSave(value: unknown): GameState {
  object(value, '内容');
  if (value.schemaVersion !== 1) invalid('版本不兼容，请使用首日原型的存档');
  if (value.rulesVersion !== 'day-one-v1') invalid('规则版本不兼容');
  text(value.runId, '人生编号', 128);
  number(value.revision, '状态版本', 0, 100_000, true);
  number(value.rngState, '随机状态', 0, 0xffff_ffff, true);
  const routine = value.routineDay !== undefined;
  if (routine) {
    number(value.routineDay, '日常天数', 2, 100_000, true);
    if (value.firstDaySummary === undefined) invalid('日常进度缺少首日回顾');
  }
  if (routine || value.dayStartCash !== undefined) number(value.dayStartCash, '今日初始现金', 0, 100_000_000, true);
  if (value.firstDaySummary !== undefined) validateSummary(value.firstDaySummary, '首日回顾');
  const morning = routine ? ROUTINE_MORNING : 480;
  number(value.minute, '游戏时间', morning, MAX_TIME, true);
  enumeration(value.phase, '游戏阶段', ['playing', 'event', 'complete']);
  enumeration(value.locationId, '地点', ['home', 'office', 'cafe', 'store', 'park', 'makerspace']);

  object(value.player, '角色');
  const player = value.player;
  text(player.name, '名字', 32);
  enumeration(player.background, '背景', ['graduate', 'switcher']);
  enumeration(player.wish, '本月愿望', ['balance', 'craft', 'sideproject']);
  strings(player.traits, '性格', 2);
  if (player.traits.length !== 2 || new Set(player.traits).size !== 2) invalid('请选择两种不同性格');
  player.traits.forEach((trait: unknown) => enumeration(trait, '性格', ['focused', 'outgoing', 'night-owl', 'steady']));
  number(player.cash, '现金', 0, 100_000_000, true);
  for (const key of ['energy', 'hunger', 'mood', 'social', 'stress', 'skill', 'credit']) {
    number(player[key], '角色状态', 0, 100);
  }

  object(value.work, '工作项目');
  for (const key of ['progress', 'quality', 'debt']) number(value.work[key], '项目状态', 0, 100);
  number(value.work.minutes, '工作时间', 0, 1_380, true);
  number(value.personalProgress, '个人项目进度', 0, 100);

  object(value.relationships, '关系');
  for (const key of ['pm', 'mentor', 'roommate', 'friend']) number(value.relationships[key], '关系状态', 0, 100);
  object(value.flags, '经历');
  for (const key of ['breakfast', 'commuted', 'scopeResolved', 'eveningActivity', 'slept']) bool(value.flags[key], '经历');
  for (const key of ['lunch', 'lunchBreak', 'walked', 'overtimeAccepted']) {
    if (value.flags[key] !== undefined) bool(value.flags[key], '日常经历');
  }
  number(value.flags.workSessions, '工作次数', 0, 100, true);
  enumeration(value.pendingEvent, '待处理事件', [null, 'scope-change']);
  enumeration(value.eventChoice, '事件选择', [null, 'negotiate', 'promise', 'ask-help']);
  if ((value.phase === 'event') !== (value.pendingEvent === 'scope-change')) invalid('事件与游戏阶段不一致');
  if (value.flags.scopeResolved !== (value.eventChoice !== null)) invalid('事件记录不一致');
  if (value.phase === 'event' && value.flags.scopeResolved) invalid('已完成的事件不能再次等待选择');

  strings(value.processedCommandIds, '行动记录', 2_000);
  if (new Set(value.processedCommandIds).size !== value.processedCommandIds.length) invalid('行动记录重复');
  if (!Array.isArray(value.journal) || value.journal.length > 2_000) invalid('日志格式不正确');
  let previousMinute = 0;
  for (const entry of value.journal) {
    object(entry, '日志');
    text(entry.id, '日志编号', 207);
    number(entry.minute, '日志时间', morning, value.minute, true);
    if (entry.minute < previousMinute) invalid('日志时间顺序不正确');
    previousMinute = entry.minute;
    text(entry.title, '日志标题', 200);
    text(entry.detail, '日志内容', 4_000, true);
    enumeration(entry.category, '日志类型', ['life', 'work', 'travel', 'event']);
    if (!Array.isArray(entry.changes) || entry.changes.length > 30) invalid('日志变化格式不正确');
    for (const change of entry.changes) {
      object(change, '状态变化');
      text(change.label, '状态变化名称', 80);
      number(change.value, '状态变化', -100_000_000, 100_000_000);
      if (change.unit !== undefined) text(change.unit, '状态单位', 20, true);
    }
  }

  if (value.phase === 'complete') {
    if (value.minute !== MAX_TIME || !value.flags.slept || value.locationId !== 'home') invalid('当日结束状态不一致');
    validateSummary(value.summary, '当日回顾');
  } else {
    if (value.summary !== null || value.flags.slept || value.minute >= MAX_TIME) invalid('尚未结束的日常状态不一致');
  }

  if (value.careerChoices !== undefined) {
    strings(value.careerChoices, '职业事件选择', CAREER_EVENT_COUNT);
    if (value.careerChoices.length > 0 && value.phase !== 'complete' && value.firstDaySummary === undefined) invalid('首日结束后才能记录职业事件');
    try {
      getCareer(value as unknown as GameState);
    } catch {
      invalid('职业事件选择顺序不正确');
    }
  }

  // A plain detached snapshot prevents callers mutating the source during a write.
  return JSON.parse(JSON.stringify(value)) as GameState;
}

function getStorage(storage?: Storage): Storage {
  if (storage) return storage;
  if (typeof window === 'undefined') throw new Error('当前环境无法访问本地存档。');
  try {
    return window.localStorage;
  } catch {
    throw new Error('浏览器未允许本地存档，请导出进度以免丢失。');
  }
}

function parse(raw: string): GameState {
  if (raw.length > MAX_SAVE_LENGTH) invalid('文件过大');
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    invalid('无法读取 JSON 文件');
  }
  return validateSave(value);
}

export function loadGame(storage?: Storage): { state: GameState | null; source: 'current' | 'backup' | 'none'; warning?: string } {
  let target: Storage;
  let current: string | null;
  let backup: string | null;
  try {
    target = getStorage(storage);
    current = target.getItem(SAVE_KEY);
    backup = target.getItem(BACKUP_KEY);
  } catch {
    return { state: null, source: 'none', warning: '浏览器未允许本地存档。你仍可游玩，并随时导出进度。' };
  }
  if (current !== null) {
    try {
      return { state: parse(current), source: 'current' };
    } catch { /* Try the last known good snapshot. */ }
  }
  if (backup !== null) {
    try {
      return { state: parse(backup), source: 'backup', warning: '已恢复上次有效备份；最近一次行动可能需要重做。' };
    } catch { /* Both copies may be corrupt; keep them until the user starts over. */ }
  }
  if (current !== null || backup !== null) {
    return { state: null, source: 'none', warning: '本地存档无法读取。可导入先前导出的进度，或开始新的一天。' };
  }
  return { state: null, source: 'none' };
}

export function saveGame(state: GameState, storage?: Storage): void {
  const validated = validateSave(state);
  const raw = JSON.stringify(validated);
  if (raw.length > MAX_SAVE_LENGTH) invalid('内容过大，请先导出进度');
  const target = getStorage(storage);
  let previousRaw: string | null;
  try {
    previousRaw = target.getItem(SAVE_KEY);
  } catch {
    throw new Error('无法读取本地存档，请导出进度。');
  }
  let previous: GameState | null = null;
  if (previousRaw !== null) {
    try { previous = parse(previousRaw); } catch { /* Never rotate a corrupt current save into the valid backup. */ }
  }
  if (previous) {
    if (previous.runId !== validated.runId || previous.revision > validated.revision) {
      throw new Error('另一个页面已有新的进度，请重新载入后继续。');
    }
    if (previous.revision === validated.revision) {
      if (JSON.stringify(previous) === raw) return;
      throw new Error('同一版本的进度发生冲突，请重新载入后继续。');
    }
  }
  try {
    if (previous && previousRaw !== null) target.setItem(BACKUP_KEY, previousRaw);
    target.setItem(SAVE_KEY, raw);
  } catch {
    throw new Error('进度尚未保存：浏览器存储不可用或已满，请重试或导出进度。');
  }
}

/** Explicit user-driven replacement: validate first, retain the previous valid run, then write. */
export function replaceGame(state: GameState, storage?: Storage): void {
  const raw = JSON.stringify(validateSave(state));
  if (raw.length > MAX_SAVE_LENGTH) invalid('内容过大，请先导出进度');
  const target = getStorage(storage);
  let previousRaw: string | null;
  try {
    previousRaw = target.getItem(SAVE_KEY);
  } catch {
    throw new Error('无法读取原存档，尚未替换当前进度。');
  }
  let validPrevious = false;
  if (previousRaw !== null) {
    try { parse(previousRaw); validPrevious = true; } catch { /* Keep any existing good backup instead. */ }
  }
  try {
    if (validPrevious && previousRaw !== null) target.setItem(BACKUP_KEY, previousRaw);
    target.setItem(SAVE_KEY, raw);
  } catch {
    throw new Error('无法替换存档，原进度仍保留。请检查浏览器存储空间或导出备份。');
  }
}

export function exportGame(state: GameState): string {
  return JSON.stringify(validateSave(state), null, 2);
}

export function importGame(text: string): GameState {
  if (typeof text !== 'string') invalid('文件内容不正确');
  return parse(text);
}

export function clearGame(storage?: Storage): void {
  const target = getStorage(storage);
  try {
    target.removeItem(SAVE_KEY);
    target.removeItem(BACKUP_KEY);
  } catch {
    throw new Error('无法清除本地存档，请检查浏览器存储权限。');
  }
}
