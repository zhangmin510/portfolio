import { useCallback, useEffect, useRef, useState } from 'react';
import { createGame, transition } from '../domain/engine';
import type { CharacterOptions, Command, GameState } from '../domain/types';
import { clearGame, exportGame, importGame, loadGame, replaceGame, SAVE_KEY, saveGame } from '../persistence/storage';

type CommandInput<T = Command> = T extends Command ? Omit<T, 'id' | 'expectedRevision'> : never;

function initialLoad() {
  try { return loadGame(); } catch (error) { return { state: null, warning: error instanceof Error ? error.message : '暂时无法读取本地进度。' }; }
}

export function useGame() {
  const [initial] = useState(initialLoad);
  const [game, setGame] = useState<GameState | null>(initial.state);
  const gameRef = useRef(game);
  const [message, setMessage] = useState(initial.warning ?? '');
  const [saved, setSaved] = useState(true);
  const [readOnly, setReadOnly] = useState(Boolean(navigator.locks));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let release: (() => void) | undefined;
    const controller = new AbortController();
    if (navigator.locks) {
      void navigator.locks.request('programmer-life:single-writer', { signal: controller.signal }, async () => {
        if (cancelled) return;
        const latest = initialLoad();
        gameRef.current = latest.state;
        setGame(latest.state);
        setSaved(true);
        setMessage(latest.warning ?? '');
        setReadOnly(false);
        await new Promise<void>(resolve => { release = resolve; if (cancelled) resolve(); });
      }).catch(error => { if (!cancelled && error?.name !== 'AbortError') setReadOnly(true); });
    }
    function changed(event: StorageEvent) {
      if (event.key !== SAVE_KEY) return;
      setReadOnly(true);
      setMessage('另一个标签页更新了进度。此页已暂停，请刷新以读取最新存档。');
    }
    window.addEventListener('storage', changed);
    return () => { cancelled = true; controller.abort(); release?.(); window.removeEventListener('storage', changed); if (timer.current) clearTimeout(timer.current); };
  }, []);

  const persist = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
    try { saveGame(next); setSaved(true); } catch (error) { setSaved(false); setMessage(error instanceof Error ? error.message : '保存失败，请导出进度。'); }
  }, []);

  function start(options: CharacterOptions) {
    if (readOnly || busyRef.current) return;
    try {
      const next = createGame({ ...options, seed: 20261107, runId: crypto.randomUUID() });
      replaceGame(next);
      gameRef.current = next;
      setGame(next);
      setSaved(true);
      setMessage('你搬进了梧桐里。第一天，不用急着证明什么。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '无法开始，请重试。'); }
  }

  function act(input: CommandInput, expected?: Pick<GameState, 'runId' | 'revision'>) {
    if (readOnly || busyRef.current || !gameRef.current) return;
    try {
      const current = gameRef.current;
      if (expected && (current.runId !== expected.runId || current.revision !== expected.revision)) {
        throw new Error('出发前的进度已经变化，请重新选择路线。');
      }
      const next = transition(current, { ...input, id: crypto.randomUUID(), expectedRevision: current.revision } as Command);
      busyRef.current = true;
      setBusy(true);
      persist(next);
      timer.current = setTimeout(() => { busyRef.current = false; setBusy(false); }, 500);
      return next;
    } catch (error) { setMessage(error instanceof Error ? error.message : '这件事暂时无法进行。'); }
  }

  function restore(text: string) {
    if (readOnly || busyRef.current) return;
    try {
      const restored = importGame(text);
      replaceGame(restored);
      gameRef.current = restored;
      setGame(restored);
      setSaved(true);
      setMessage(`已恢复 ${restored.player.name} 的生活，时间停在存档的那一刻。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : '无法导入存档。'); }
  }

  function download() {
    if (!gameRef.current) return;
    const blob = new Blob([exportGame(gameRef.current)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `栈城日常-${gameRef.current.player.name}-第${Math.floor(gameRef.current.minute / 1440) + 1}天.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reset() {
    if (readOnly || busyRef.current) return;
    try { clearGame(); gameRef.current = null; setGame(null); setSaved(true); setMessage(''); } catch (error) { setMessage(error instanceof Error ? error.message : '无法清除存档。'); }
  }

  return { game, saved, message, setMessage, readOnly, busy, start, act, restore, download, reset, retrySave: () => { if (gameRef.current && !readOnly) persist(gameRef.current); } };
}
