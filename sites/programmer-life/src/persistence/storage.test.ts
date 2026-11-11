import { describe, expect, it } from 'vitest';
import type { GameState } from '../domain/types';
import { BACKUP_KEY, SAVE_KEY, clearGame, exportGame, importGame, loadGame, replaceGame, saveGame, validateSave } from './storage';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  failKey: string | null = null;
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new Error('Quota exceeded');
    this.data.set(key, value);
  }
}

function fixture(): GameState {
  return {
    schemaVersion: 1, rulesVersion: 'day-one-v1', runId: 'test-life', revision: 0,
    rngState: 42, minute: 480, phase: 'playing', locationId: 'home',
    player: {
      name: '小栈', background: 'graduate', traits: ['focused', 'steady'], wish: 'balance', cash: 300_000,
      energy: 80, hunger: 60, mood: 70, social: 60, stress: 10, skill: 30, credit: 50,
    },
    work: { progress: 0, quality: 0, debt: 0, minutes: 0 }, personalProgress: 0,
    relationships: { pm: 30, mentor: 30, roommate: 40, friend: 30 },
    flags: { breakfast: false, commuted: false, workSessions: 0, scopeResolved: false, eveningActivity: false, slept: false },
    pendingEvent: null, eventChoice: null, journal: [], processedCommandIds: [], summary: null,
  };
}

describe('local saves', () => {
  it('roundtrips exactly without changing time or mutating the source', () => {
    const storage = new MemoryStorage();
    const state = fixture();
    saveGame(state, storage);
    const loaded = loadGame(storage);
    expect(loaded).toEqual({ state, source: 'current' });
    expect(loaded.state).not.toBe(state);
    expect(importGame(exportGame(state))).toEqual(state);
    expect(state.minute).toBe(480);
  });

  it('restores the last valid backup when the current JSON is corrupt', () => {
    const storage = new MemoryStorage();
    const first = fixture();
    saveGame(first, storage);
    saveGame({ ...first, revision: 1, minute: 510 }, storage);
    storage.setItem(SAVE_KEY, '{broken');
    expect(loadGame(storage)).toMatchObject({ state: first, source: 'backup', warning: expect.any(String) });
  });

  it('never rotates a corrupt current save over a good backup', () => {
    const storage = new MemoryStorage();
    const state = fixture();
    storage.setItem(BACKUP_KEY, JSON.stringify(state));
    storage.setItem(SAVE_KEY, '{broken');
    const backup = storage.getItem(BACKUP_KEY);
    saveGame({ ...state, revision: 2 }, storage);
    expect(storage.getItem(BACKUP_KEY)).toBe(backup);
    expect(loadGame(storage).state?.revision).toBe(2);
  });

  it('keeps a recoverable snapshot when the current write fails', () => {
    const storage = new MemoryStorage();
    const state = fixture();
    saveGame(state, storage);
    storage.failKey = SAVE_KEY;
    expect(() => saveGame({ ...state, revision: 1 }, storage)).toThrow('尚未保存');
    expect(loadGame(storage).state).toEqual(state);
    expect(JSON.parse(storage.getItem(BACKUP_KEY)!)).toEqual(state);
  });

  it('preserves the main save if backup rotation fails', () => {
    const storage = new MemoryStorage();
    const state = fixture();
    saveGame(state, storage);
    storage.failKey = BACKUP_KEY;
    expect(() => saveGame({ ...state, revision: 1 }, storage)).toThrow('尚未保存');
    expect(loadGame(storage).state).toEqual(state);
  });

  it('makes repeated writes idempotent and rejects revision conflicts', () => {
    const storage = new MemoryStorage();
    const state = fixture();
    saveGame(state, storage);
    saveGame(state, storage);
    expect(storage.getItem(BACKUP_KEY)).toBeNull();
    expect(() => saveGame({ ...state, minute: 500 }, storage)).toThrow('冲突');
    saveGame({ ...state, revision: 2 }, storage);
    expect(() => saveGame({ ...state, revision: 1 }, storage)).toThrow('新的进度');
    expect(() => saveGame({ ...state, runId: 'other-life', revision: 3 }, storage)).toThrow('新的进度');
  });

  it('rejects malformed, future, out-of-range and inconsistent imported data', () => {
    expect(() => importGame('not json')).toThrow('JSON');
    expect(() => validateSave({ ...fixture(), schemaVersion: 2 })).toThrow('版本');
    expect(() => validateSave({ ...fixture(), minute: 1_861 })).toThrow('时间');
    expect(() => validateSave({ ...fixture(), player: { ...fixture().player, cash: -1 } })).toThrow('现金');
    expect(() => validateSave({ ...fixture(), player: { ...fixture().player, energy: Infinity } })).toThrow('状态');
    expect(() => validateSave({ ...fixture(), player: { ...fixture().player, traits: ['focused', 'focused'] } })).toThrow('性格');
    expect(() => validateSave({ ...fixture(), phase: 'event' })).toThrow('事件');
    expect(() => validateSave({ ...fixture(), phase: 'complete' })).toThrow('结束');
    expect(() => importGame(' '.repeat(1_000_001))).toThrow('过大');
  });

  it('explicitly replaces a different run or earlier revision while retaining the previous valid run', () => {
    const storage = new MemoryStorage();
    const current = { ...fixture(), revision: 5, minute: 900 };
    saveGame(current, storage);
    const restored = { ...fixture(), runId: 'imported-life', revision: 0 };
    replaceGame(restored, storage);
    expect(loadGame(storage).state).toEqual(restored);
    expect(JSON.parse(storage.getItem(BACKUP_KEY)!)).toEqual(current);
    replaceGame({ ...restored, revision: 2 }, storage);
    replaceGame(restored, storage);
    expect(loadGame(storage).state?.revision).toBe(0);
  });

  it('does not clear the original run when replacement validation or either write fails', () => {
    const storage = new MemoryStorage();
    const current = fixture();
    const replacement = { ...fixture(), runId: 'new-life' };
    saveGame(current, storage);
    expect(() => replaceGame({ ...replacement, minute: -1 }, storage)).toThrow('时间');
    expect(loadGame(storage).state).toEqual(current);
    storage.failKey = BACKUP_KEY;
    expect(() => replaceGame(replacement, storage)).toThrow('原进度仍保留');
    expect(loadGame(storage).state).toEqual(current);
    storage.failKey = SAVE_KEY;
    expect(() => replaceGame(replacement, storage)).toThrow('原进度仍保留');
    expect(loadGame(storage).state).toEqual(current);
    expect(JSON.parse(storage.getItem(BACKUP_KEY)!)).toEqual(current);
  });

  it('preserves a valid backup when explicitly replacing a damaged main save', () => {
    const storage = new MemoryStorage();
    const backup = fixture();
    storage.setItem(BACKUP_KEY, JSON.stringify(backup));
    storage.setItem(SAVE_KEY, '{broken');
    const replacement = { ...backup, runId: 'replacement' };
    replaceGame(replacement, storage);
    expect(loadGame(storage).state).toEqual(replacement);
    expect(JSON.parse(storage.getItem(BACKUP_KEY)!)).toEqual(backup);
  });

  it('rejects broken nested log data and duplicate command IDs', () => {
    const state = fixture();
    expect(() => validateSave({ ...state, journal: [null] })).toThrow('日志');
    expect(() => validateSave({ ...state, processedCommandIds: ['same', 'same'] })).toThrow('重复');
    expect(() => validateSave({ ...state, relationships: { ...state.relationships, mentor: -1 } })).toThrow('关系');
  });

  it('returns a useful warning if both copies are damaged and can clear an explicit restart', () => {
    const storage = new MemoryStorage();
    expect(loadGame(storage)).toEqual({ state: null, source: 'none' });
    storage.setItem(SAVE_KEY, '[]');
    storage.setItem(BACKUP_KEY, 'null');
    expect(loadGame(storage)).toMatchObject({ state: null, source: 'none', warning: expect.any(String) });
    clearGame(storage);
    expect(loadGame(storage)).toEqual({ state: null, source: 'none' });
  });

  it('supports a complete recap as a detached valid save', () => {
    const state = fixture();
    state.minute = 1_860;
    state.phase = 'complete';
    state.flags.slept = true;
    state.summary = {
      title: '第一天结束', description: '在栈城过了平静的一天。', highlights: ['给自己做了早餐'],
      workMinutes: 0, spent: 0, progress: 0, quality: 0, debt: 0, personalProgress: 0, tags: ['调整节奏'],
    };
    expect(validateSave(state)).toEqual(state);
    expect(validateSave(state)).not.toBe(state);
  });
});
