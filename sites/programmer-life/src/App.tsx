import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useGame } from './application/useGame';
import { getAutoplayAction } from './domain/autoplay';
import { hasGraduated } from './domain/career';
import { getActions, getTravelOptions } from './domain/engine';
import { getDaySchedule } from './domain/routine';
import { ACTION_SCENES } from './content/actionScenes';
import { EVENT_CHOICES, LOCATIONS, WISHES } from './content/game';
import type { ActionId, GameState, LocationId, TravelMode } from './domain/types';
import { ActionPerformance } from './ui/ActionPerformance';
import { CareerCalendar } from './ui/CareerCalendar';
import { CharacterCreation } from './ui/CharacterCreation';
import { DailySummary } from './ui/DailySummary';
import { GuestFeedback } from './ui/GuestFeedback';
import { Icon } from './ui/Icon';
import { TripFallback, TripStatus, travelModes } from './ui/Travel';
import { WorldScene } from './ui/WorldScene';
import { getTravelPath } from './world/travelRoutes';
import type { RoutePoint } from './world/travelRoutes';

type Panel = 'actions' | 'travel' | 'project' | 'journal' | 'settings' | 'needs' | 'goals' | null;
type CameraCommand = { kind: 'reset' | 'rotate' | 'zoom-in' | 'zoom-out'; nonce: number };
type Trip = {
  origin: Pick<GameState, 'runId' | 'revision'>;
  from: LocationId;
  to: LocationId;
  mode: TravelMode;
  path: readonly RoutePoint[];
  durationMs: number;
};
type PerformedAction = {
  origin: Pick<GameState, 'runId' | 'revision'>;
  id: ActionId;
  title: string;
  stage: number;
};
const money = (value: number) => `¥${(value / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
const clock = (minute: number) => `${String(Math.floor(minute % 1440 / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const duration = (minutes: number) => minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}`;
const actionIcons: Record<ActionId, string> = { breakfast: 'food', cook: 'food', rest: 'coffee', sleep: 'bed', personal: 'code', focus: 'code', rush: 'energy', test: 'check', ai: 'spark', talk: 'social', lunch: 'food', 'lunch-break': 'coffee', overtime: 'office', 'midweek-walk': 'leaf', coffee: 'coffee', walk: 'leaf', groceries: 'store', meetup: 'social' };
const objectActions: Partial<Record<ActionId, ActionId[]>> = { breakfast: ['breakfast', 'cook'], cook: ['breakfast', 'cook'], sleep: ['sleep', 'rest'], rest: ['rest', 'sleep'], focus: ['focus', 'rush', 'ai', 'overtime'], rush: ['focus', 'rush', 'ai'], ai: ['focus', 'rush', 'ai'], lunch: ['lunch', 'lunch-break'] };
const panelTitles: Record<Exclude<Panel, null>, string> = { actions: '此刻，想做点什么？', travel: '去城市的另一边', project: '工作与作品', journal: '我的手机', settings: '我的手机', needs: '状态与技能', goals: '今日安排' };
const weekdayNames = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

function Meter({ label, value, color = '#38a76e', icon }: { label: string; value: number; color?: string; icon: string }) {
  return <div className="sim-meter"><div><Icon name={icon} size={17} /><span>{label}</span><b>{Math.round(value)}<small>/100</small></b></div><div className="meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}><span style={{ width: `${value}%`, background: color }} /></div></div>;
}

function WorkProject({ game }: { game: GameState }) {
  const projectStatus = hasGraduated(game) ? '首个项目 · 已交接' : game.careerChoices?.length ? '首个项目 · 已上线' : '第一个需求 · 准备上线';
  return <><div className="panel-intro"><span className="small-tag">{projectStatus}</span><h3>让消息提醒，更贴心一点</h3><p>功能写出来之后，还要让它可靠地运行。</p></div><Meter label="实现进度" icon="code" value={game.work.progress} /><div className="project-metrics"><div><span>代码质量</span><strong>{game.work.quality}%</strong></div><div><span>技术债</span><strong>{game.work.debt}</strong></div><div><span>今日投入</span><strong>{(game.work.minutes / 60).toFixed(1)}h</strong></div></div><div className="info-note"><Icon name="info" size={17} /><p>实现推进功能，测试提高质量。赶工和 AI 辅助更快，也需要给验证留出时间。</p></div><hr /><div className="panel-intro"><span className="small-tag">自己的小计划</span><h3>稍后阅读小工具</h3><p>下班后的想法，也可以慢慢做成一个作品。</p></div><Meter label="原型进度" icon="spark" value={game.personalProgress} color="#dcad55" /><p className="quiet-note">本月愿望：{WISHES[game.player.wish].name}</p></>;
}

export default function App() {
  const { game, saved, message, setMessage, readOnly, busy, start, act, restore, download, reset, retrySave } = useGame();
  const [view, setView] = useState<'room' | 'city'>('room');
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const [activity, setActivity] = useState<ActionId | null>(null);
  const [destination, setDestination] = useState<LocationId>('office');
  const [travelMode, setTravelMode] = useState<TravelMode>('drive');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [performance, setPerformance] = useState<PerformedAction | null>(null);
  const activePerformance = useRef<PerformedAction | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const autoplayRequested = useRef(false);
  const activeTrip = useRef<Trip | null>(null);
  const presentedTripPath = useRef<readonly RoutePoint[] | null>(null);
  const tripProgress = useRef(0);
  const skipTrip = useRef(false);
  const getTripProgress = useCallback(() => tripProgress.current, []);
  const markTripPresented = useCallback((path: readonly RoutePoint[]) => {
    if (activeTrip.current?.path === path) presentedTripPath.current = path;
  }, []);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({ kind: 'reset', nonce: 0 });
  const [showSummary, setShowSummary] = useState(false);
  const [showCareer, setShowCareer] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [worldReady, setWorldReady] = useState(false);
  const [showPlaceNames, setShowPlaceNames] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const modalOpen = confirmReset || showSummary || showCareer || game?.phase === 'event';

  const selectAction = useCallback((id: ActionId) => {
    const chosen = id === 'cook' && game?.locationId === 'home' && game.minute < 660 && !game.flags.breakfast ? 'breakfast' : id;
    setSelectedAction(chosen); setPanel('actions');
  }, [game?.locationId, game?.minute, game?.flags.breakfast]);
  const selectLocation = useCallback((id: LocationId) => { setDestination(id); setTravelMode('drive'); setPanel('travel'); }, []);
  const moveCamera = (kind: CameraCommand['kind']) => setCameraCommand(previous => ({ kind, nonce: previous.nonce + 1 }));

  function stopAutoplay() {
    autoplayRequested.current = false;
    setAutoplay(false);
  }

  function startAutoplay() {
    if (readOnly || !saved || document.hidden) return;
    autoplayRequested.current = true;
    setPanel(null);
    setView('room');
    setAutoplay(true);
  }

  function depart(to: LocationId, mode: TravelMode) {
    if (!game || activeTrip.current || activePerformance.current || busy || readOnly || game.phase !== 'playing') return false;
    const option = getTravelOptions(game, to).find(item => item.mode === mode);
    if (!option || option.disabledReason) return false;
    const origin = { runId: game.runId, revision: game.revision };
    const path = getTravelPath(game.locationId, to, mode);
    const length = path.reduce((distance, point, index) => index === 0 ? 0 : distance + Math.hypot(point.x - path[index - 1].x, point.z - path[index - 1].z), 0);
    const journey = { origin, from: game.locationId, to, mode, path, durationMs: Math.min(7600, 3600 + length * 62) };
    presentedTripPath.current = null;
    tripProgress.current = 0;
    skipTrip.current = false;
    activeTrip.current = journey;
    setPanel(null);
    setView('city');
    setTrip(journey);
    return true;
  }

  function arrive({ origin, to, mode }: Pick<Trip, 'origin' | 'to' | 'mode'>) {
    const next = act({ kind: 'travel', targetId: to, mode }, origin);
    if (!next) { stopAutoplay(); return; }
    setActivity(null);
    setSelectedAction(null);
    setView('room');
    setPanel(autoplayRequested.current || next.phase !== 'playing' || to === 'home' || to === 'office' ? null : 'actions');
  }

  function perform(id: ActionId) {
    if (!game || activeTrip.current || activePerformance.current || busy || readOnly || game.phase !== 'playing') return false;
    const action = getActions(game).find(option => option.id === id);
    if (!action || action.disabledReason) return false;
    const scene = { id, stage: 0, title: action.title, origin: { runId: game.runId, revision: game.revision } };
    activePerformance.current = scene;
    setPanel(null);
    setView('room');
    setPerformance(scene);
    return true;
  }

  function finishPerformance(scene: PerformedAction) {
    if (activePerformance.current !== scene) return;
    activePerformance.current = null;
    setPerformance(null);
    if (act({ kind: 'action', targetId: scene.id }, scene.origin)) setActivity(scene.id);
    else stopAutoplay();
  }

  const advancePerformance = useEffectEvent((scene: PerformedAction) => {
    if (activePerformance.current !== scene) return;
    if (scene.stage + 1 === ACTION_SCENES[scene.id].length) {
      finishPerformance(scene);
      return;
    }
    const next = { ...scene, stage: scene.stage + 1 };
    activePerformance.current = next;
    setPerformance(next);
  });

  useEffect(() => {
    if (!performance) return;
    const duration = ACTION_SCENES[performance.id][performance.stage].milliseconds;
    let frame: number;
    let previous: number | null = null;
    let elapsed = 0;
    const tick = (now: number) => {
      if (document.hidden) previous = null;
      else {
        if (previous !== null) elapsed += Math.min(now - previous, 100);
        previous = now;
      }
      if (elapsed >= duration) advancePerformance(performance);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [performance]);

  useEffect(() => {
    if (!performance || (!readOnly && game?.runId === performance.origin.runId && game.revision === performance.origin.revision)) return;
    activePerformance.current = null;
    setPerformance(null);
  }, [performance, game?.runId, game?.revision, readOnly]);

  const finishTrip = useEffectEvent((completed: Trip) => {
    if (activeTrip.current !== completed) return;
    activeTrip.current = null;
    setTrip(null);
    arrive(completed);
  });

  useEffect(() => {
    if (!trip) return;
    let frame: number;
    let previous: number | null = null;
    let elapsed = 0;
    const startHoldMs = 400;
    const arrivalHoldMs = 600;
    const tick = (now: number) => {
      if (skipTrip.current) {
        finishTrip(trip);
        return;
      }
      if (presentedTripPath.current === trip.path) {
        if (previous !== null) elapsed += Math.min(now - previous, 100);
        previous = now;
        tripProgress.current = Math.max(0, Math.min(1, (elapsed - startHoldMs) / trip.durationMs));
        if (elapsed >= startHoldMs + trip.durationMs + arrivalHoldMs) {
          finishTrip(trip);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [trip]);

  useEffect(() => {
    if (!trip || (!readOnly && game?.runId === trip.origin.runId && game.revision === trip.origin.revision)) return;
    activeTrip.current = null;
    setTrip(null);
  }, [trip, game?.runId, game?.revision, readOnly]);

  const playNext = useEffectEvent(() => {
    if (!autoplayRequested.current || !game || busy || readOnly || !saved || activeTrip.current || activePerformance.current || document.hidden) return;
    const command = getAutoplayAction(game);
    if (!command) {
      stopAutoplay();
      setMessage('自动玩耍已暂停。请查看可做的事，手动继续。');
      return;
    }
    if (command.kind === 'travel') {
      if (!depart(command.targetId, command.mode)) stopAutoplay();
      return;
    }
    if (command.kind === 'action') {
      if (!perform(command.targetId)) stopAutoplay();
      return;
    }
    if (!act(command, game)) stopAutoplay();
  });

  useEffect(() => {
    if (!autoplay) return;
    if (!game || game.phase === 'complete' || readOnly || !saved) {
      stopAutoplay();
      return;
    }
    if (busy || trip || performance || showCareer || confirmReset) return;
    const timer = window.setTimeout(() => playNext(), game.phase === 'event' ? 2800 : 1000);
    return () => window.clearTimeout(timer);
  }, [autoplay, game, busy, trip, performance, saved, readOnly, showCareer, confirmReset]);

  useEffect(() => {
    if (!autoplay) return;
    function onVisibilityChange() { if (document.hidden) stopAutoplay(); }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [autoplay]);

  useEffect(() => { document.documentElement.dataset.reduceMotion = String(reduceMotion); }, [reduceMotion]);
  useEffect(() => { if (game?.phase === 'complete') setShowSummary(true); }, [game?.phase]);
  useEffect(() => { if (game?.phase === 'event' || game?.phase === 'complete') setPanel(null); }, [game?.phase]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 6500); return () => clearTimeout(timer); }, [message, setMessage]);
  useEffect(() => {
    if (!confirmReset && !showSummary && !showCareer && game?.phase !== 'event') return;
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]');
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.tabIndex = -1;
    dialog.focus({ preventScroll: true });
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (confirmReset) setConfirmReset(false);
        else if (showCareer) { setShowCareer(false); if (game?.phase === 'complete') setShowSummary(true); }
        else if (showSummary) { setShowSummary(false); setPanel('journal'); }
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary, [href], [tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (document.activeElement === dialog || !dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, [confirmReset, showSummary, showCareer, game?.phase]);

  if (!game) return <><CharacterCreation readOnly={readOnly} onStart={options => { start(options); setView('room'); setPanel(null); setActivity(null); }} />{message && <div className="toast" role="status"><Icon name="info" size={18} />{message}<button aria-label="关闭提示" onClick={() => setMessage('')}><Icon name="close" size={16} /></button></div>}</>;

  const hour = Math.floor(game.minute % 1440 / 60);
  const schedule = getDaySchedule(game);
  const day = Math.floor(game.minute / 1440) + schedule.day;
  const location = LOCATIONS[game.locationId];
  const mode = trip || view === 'city' || (game.locationId !== 'home' && game.locationId !== 'office') ? 'city' : game.locationId;
  const actions = getActions(game);
  const available = (id: ActionId) => actions.some(action => action.id === id && !action.disabledReason);
  const officeAction = (['overtime', 'lunch-break', 'focus', 'test', 'talk'] as const).find(available) ?? 'rest';
  const preferred: Record<LocationId, ActionId> = { home: hour < 11 && !game.flags.breakfast ? 'breakfast' : hour >= 18 && game.player.hunger >= 55 ? 'sleep' : 'cook', office: officeAction, cafe: 'coffee', store: 'groceries', park: available('midweek-walk') ? 'midweek-walk' : 'walk', makerspace: 'meetup' };
  const selected = actions.find(action => action.id === selectedAction) ?? actions.find(action => action.id === preferred[game.locationId] && !action.disabledReason) ?? actions.find(action => !action.disabledReason) ?? actions[0];
  const visibleActions = selectedAction ? actions.filter(action => (objectActions[selectedAction] ?? [selectedAction]).includes(action.id)) : actions;
  const travelOptions = getTravelOptions(game, destination);
  const travel = travelOptions.find(option => option.mode === travelMode) ?? travelOptions[0];

  const lowest = [{ name: '精力', value: game.player.energy, icon: 'energy' }, { name: '饱腹', value: game.player.hunger, icon: 'food' }, { name: '心情', value: game.player.mood, icon: 'smile' }, { name: '社交', value: game.player.social, icon: 'social' }].sort((a, b) => a.value - b.value)[0];
  const milestones = [{ label: '在家吃点早餐', done: game.flags.breakfast }, { label: '去字节花园报到', done: game.flags.commuted }, { label: '完成第一轮实现', done: game.flags.workSessions > 0 }, { label: '把时间留给生活', done: game.flags.eveningActivity || game.flags.slept }];
  const workFinished = schedule.workEnd !== null && game.minute >= schedule.workEnd;
  const isOffice = game.locationId === 'office';
  const nextHint = game.phase === 'complete' ? '今天结束了，可以开启新一天或查看职业日历。'
    : view === 'city' ? '点一个地点，选择怎么过去。'
    : hour >= 18 && game.locationId === 'home' ? '今天辛苦了。睡一觉，明天继续。'
    : schedule.kind === 'midweek' && workFinished ? '周三小周末到了，可以去栈桥公园走走。'
    : schedule.kind === 'early-finish' && workFinished ? '周五提前下班，剩下的时间归你。'
    : schedule.kind === 'graduated' ? '已经从字节花园毕业，今天可以按自己的节奏来。'
    : schedule.kind === 'weekend' ? '周末不用上班，去公园散散步吧。'
    : available('overtime') ? '今天有可选的周末值班，也可以自由安排。'
    : isOffice && available('lunch-break') ? '午休时间到了，离开工位透透气。'
    : isOffice ? '点电脑开始工作，也别忘了吃饭休息。'
    : !game.flags.breakfast && !game.flags.commuted ? '点一下冰箱，先吃点早餐。'
    : !game.flags.commuted && !workFinished ? '打开地图，去字节花园上班。'
    : '看看周围，还有哪些想做的事。';

  function goHome() {
    if (game!.locationId === 'home') { setView('room'); setPanel(null); }
    else { setView('city'); selectLocation('home'); }
  }
  function nextStep() {
    if (game!.phase === 'complete') { setShowSummary(true); return; }
    if (game!.locationId === 'home' && hour >= 18) { selectAction('sleep'); return; }
    if (isOffice && workFinished && schedule.kind !== 'midweek') { goHome(); return; }
    if (isOffice && !workFinished && schedule.workEnd !== null) { selectAction(preferred.office); return; }
    if (game!.locationId === 'park') { selectAction(preferred.park); return; }
    const target = !game!.flags.commuted && !workFinished && schedule.workEnd !== null && schedule.kind !== 'overtime' ? 'office' : 'park';
    setView('city');
    selectLocation(target);
  }

  function openCareer() {
    setShowSummary(false);
    setPanel(null);
    setShowCareer(true);
  }

  function startNextDay(automatic = false) {
    if (!act({ kind: 'next-day' })) return;
    setShowSummary(false);
    setPanel(null);
    setActivity(null);
    setSelectedAction(null);
    setView('room');
    if (automatic) startAutoplay();
  }

  return <div className="game-shell">
    <div className="world-layer" inert={!!trip || !!performance || autoplay || modalOpen}>
      <WorldScene
        mode={mode} locationId={game.locationId} name={game.player.name} minute={game.minute}
        activity={activity} performance={performance ?? undefined} revision={game.revision} onAction={selectAction} onLocation={selectLocation}
        cameraCommand={cameraCommand} reduceMotion={reduceMotion} onReady={setWorldReady} showNames={showPlaceNames}
        travel={trip ? { path: trip.path, mode: trip.mode, progress: getTripProgress } : undefined}
        travelFallback={trip ? <TripFallback path={trip.path} mode={trip.mode} progress={getTripProgress} onPresented={markTripPresented} /> : undefined}
        onTravelPresented={markTripPresented}
      />
    </div>
    {trip && <TripStatus from={trip.from} to={trip.to} mode={trip.mode} progress={getTripProgress} onSkip={() => { skipTrip.current = true; }} onPauseAutoplay={autoplay ? stopAutoplay : undefined} />}
    {performance && <ActionPerformance id={performance.id} stage={performance.stage} title={performance.title} onSkip={() => finishPerformance(performance)} onPauseAutoplay={autoplay ? stopAutoplay : undefined} />}
    {!trip && !performance && !modalOpen && game.phase === 'playing' && <button type="button" className="autoplay-control" aria-pressed={autoplay} disabled={readOnly || !saved} onClick={autoplay ? stopAutoplay : startAutoplay}>
      <Icon name={autoplay ? 'pause' : 'play'} size={17} />{autoplay ? '暂停自动玩耍' : '自动玩耍'}
    </button>}
    {!trip && !performance && <div className="hud-layer" inert={autoplay || modalOpen}>
      <header className="sim-topbar">
        <button className="game-wordmark" aria-label="栈城日常，查看今日目标" onClick={() => setPanel(panel === 'goals' ? null : 'goals')}>栈城<span>LIFE</span></button>
        <div className="sim-clock"><strong><Icon name={hour >= 19 || hour < 6 ? 'moon' : 'sun'} size={17} />{clock(game.minute)}<i>·</i><span>{game.player.mood >= 60 ? '心情不错' : game.player.mood >= 30 ? '还好' : '想休息一下'}</span></strong><small><span className={`live-dot ${!saved ? 'unsaved' : ''}`} />第 {day} 天 · {weekdayNames[(day - 1) % 7]}<i>·</i>{readOnly ? '只读模式' : saved ? '已保存' : '未保存'}</small></div>
        <button className="wallet-button" aria-label={`可用余额 ${money(game.player.cash)}，打开账单`} onClick={() => setPanel('settings')}><Icon name="wallet" size={17} /><strong>{money(game.player.cash)}</strong></button>
        <button className="round-button top-menu" aria-label="打开手机与设置" onClick={() => setPanel(panel === 'settings' ? null : 'settings')}><Icon name="settings" size={19} /></button>
      </header>
      <div className="character-hud"><button className="portrait-button" onClick={() => setPanel(panel === 'needs' ? null : 'needs')} aria-label="查看角色状态"><span>{game.player.name.slice(0, 1)}</span><i /></button><button className={`need-chip ${lowest.value < 25 ? 'low' : ''}`} onClick={() => setPanel('needs')}><Icon name={lowest.icon} size={16} />{lowest.name} {lowest.value}%</button><span className="player-name">{game.player.name}</span></div>
      <div className="place-chip"><Icon name={mode === 'city' ? 'map' : location.icon} size={14} />{mode === 'city' ? '栈城地图' : location.name}{mode === 'city' && <button className={showPlaceNames ? 'active' : ''} aria-pressed={showPlaceNames} onClick={() => setShowPlaceNames(!showPlaceNames)}>地点名</button>}<span>{mode === 'city' ? '点击地点，选择出行' : location.subtitle}</span></div>
      <div className="world-tools"><button className="round-button" aria-label="今日安排" onClick={() => setPanel(panel === 'goals' ? null : 'goals')}><Icon name="spark" size={21} /><b className="tool-badge">{milestones.filter(item => item.done).length}</b></button><button className="round-button" aria-label="查看所有可选行动" onClick={() => { setSelectedAction(null); setPanel(panel === 'actions' ? null : 'actions'); }}><Icon name="project" size={21} /></button></div>
      {readOnly && <div className="state-banner"><Icon name="info" size={15} />另一个标签页正在游玩，此页只读。<button onClick={() => window.location.reload()}>刷新</button></div>}
      {!saved && <div className="state-banner"><Icon name="save" size={15} />最近进度尚未保存。<button onClick={retrySave}>重试</button><button onClick={download}>导出</button></div>}
      <div className="camera-tools" aria-label="镜头控制"><button className="round-button" aria-label="旋转视角" onClick={() => moveCamera('rotate')}><Icon name="rotate" size={20} /></button><div><button aria-label="放大场景" onClick={() => moveCamera('zoom-in')}><Icon name="zoom-in" size={19} /></button><button aria-label="缩小场景" onClick={() => moveCamera('zoom-out')}><Icon name="zoom-out" size={19} /></button></div><button className="round-button" aria-label="重置镜头" onClick={() => moveCamera('reset')}><Icon name="reset" size={19} /></button></div>
      <div className="scene-guide"><span>{autoplay ? '自动安排今日作息，睡觉后暂停' : nextHint}</span>{!autoplay && <small>{worldReady ? '拖动旋转 · 滚轮缩放' : '场景载入中'}<i>·</i>思考时，时间暂停</small>}</div>
      {busy && <div className="activity-feedback" role="status"><span className="live-dot" />{game.journal[game.journal.length - 1]?.title ?? '这一刻，收好了'}</div>}
      <div className="dock-area"><nav className="sim-dock" aria-label="游戏操作"><button className={view === 'room' && panel === null ? 'active' : ''} onClick={goHome}><Icon name="home" size={21} /><span>家里</span></button><button className={panel === 'project' ? 'active' : ''} onClick={() => setPanel(panel === 'project' ? null : 'project')}><Icon name="project" size={21} /><span>项目</span></button><button className={view === 'city' ? 'active' : ''} onClick={() => { setView(view === 'city' ? 'room' : 'city'); setPanel(null); }}><Icon name="map" size={21} /><span>地图</span></button></nav><button className={`phone-button ${panel === 'journal' || panel === 'settings' ? 'active' : ''}`} aria-label="打开手机" onClick={() => setPanel(panel === 'journal' ? null : 'journal')}><Icon name="phone" size={23} /></button></div>
      <button className="quick-action" onClick={() => { if (game.phase === 'complete') { setShowSummary(true); return; } setSelectedAction(null); setPanel(panel === 'actions' ? null : 'actions'); }}><Icon name="spark" size={17} />{game.phase === 'complete' ? '回看这一天' : '可做的事'}<Icon name="chevron" size={14} /></button>
    </div>}
    {panel && <aside inert={modalOpen} className={`context-panel ${panel === 'travel' || panel === 'actions' ? 'action-context' : ''}`} aria-label={panelTitles[panel]}><div className="panel-header"><h2>{panelTitles[panel]}</h2><button className="icon-button" aria-label="关闭面板" onClick={() => setPanel(null)}><Icon name="close" size={20} /></button></div><div className="panel-body">
      {panel === 'actions' && <><div className="current-place"><Icon name={location.icon} size={15} />{location.name}<span>·</span>{clock(game.minute)}</div><div className="actions-list">{visibleActions.map(action => <button className={`action-option ${selected?.id === action.id ? 'selected' : ''} ${action.disabledReason ? 'unavailable' : ''}`} key={action.id} aria-pressed={selected?.id === action.id} onClick={() => setSelectedAction(action.id)}><span className="action-icon"><Icon name={actionIcons[action.id]} size={20} /></span><span><strong>{action.title}</strong><small>{action.id === 'sleep' ? '睡到明早 07:00' : duration(action.duration)} · {action.cost ? money(action.cost) : '免费'}</small></span><Icon name="chevron" size={14} /></button>)}</div>{selected && <div className="action-preview"><h3>{selected.title}</h3><p>{selected.description}</p><div className="effect-chips">{selected.effects.map(effect => <span key={effect}>{effect}</span>)}</div>{selected.risk && <p className="risk-note"><Icon name="info" size={14} />{selected.risk}</p>}<p className="quiet-note">行动期间，日常需求也会随游戏时间变化。</p><button className="primary-button" disabled={busy || readOnly || !!selected.disabledReason || game.phase !== 'playing'} onClick={() => perform(selected.id)}>{selected.id === 'sleep' ? '睡到明早 07:00' : `开始 · ${duration(selected.duration)}`}<Icon name="arrow" size={18} /></button>{selected.disabledReason && <p className="disabled-explanation">{selected.disabledReason}</p>}</div>}{game.phase === 'complete' && <button className="primary-button" onClick={() => setShowSummary(true)}>打开首日回顾 <Icon name="journal" size={17} /></button>}</>}
      {panel === 'travel' && <>
        <div className="venue-icon"><Icon name={LOCATIONS[destination].icon} size={29} /></div>
        <div className="panel-intro"><h3>{LOCATIONS[destination].name}</h3><p>{LOCATIONS[destination].description}</p></div>
        {destination === game.locationId ? <>
          <p className="info-note">你已经在这里了。</p>
          <button className="primary-button" onClick={() => { setView('room'); setPanel(game.locationId === 'home' || game.locationId === 'office' ? null : 'actions'); }}>看看这里 <Icon name="arrow" size={18} /></button>
        </> : <>
          <div className="travel-options journey-options">{travelOptions.map(option => <button
            className={travelMode === option.mode ? 'selected' : ''}
            aria-pressed={travelMode === option.mode}
            onClick={() => setTravelMode(option.mode)}
            key={option.mode}
          >
            <Icon name={travelModes[option.mode].icon} size={23} />
            <strong>{travelModes[option.mode].label}</strong>
            <span>{duration(option.duration)} · {option.cost ? money(option.cost) : '免费'}</span>
          </button>)}</div>
          <button className="primary-button" disabled={busy || readOnly || !travel || !!travel.disabledReason || game.phase !== 'playing'} onClick={() => { if (travel) depart(destination, travel.mode); }}>
            出发去{LOCATIONS[destination].name}<Icon name="arrow" size={18} />
          </button>
          {travel?.disabledReason && <p className="disabled-explanation">{travel.disabledReason}</p>}
          <p className="quiet-note">抵达后扣除费用，并推进游戏时间。</p>
        </>}
      </>}
      {panel === 'project' && <><WorkProject game={game} /><button className="secondary-button career-entry" onClick={openCareer}><Icon name="calendar" size={18} />职业日历</button></>}
      {panel === 'needs' && <><div className="panel-intro"><span className="small-tag">初级工程师 · {game.player.name}</span><h3>今天过得怎么样？</h3><p>身体、心情和成长，都值得关心。</p></div><div className="needs-list"><Meter label="精力" value={game.player.energy} icon="energy" color="#e1b44f" /><Meter label="饱腹" value={game.player.hunger} icon="food" color="#df9465" /><Meter label="心情" value={game.player.mood} icon="smile" /><Meter label="社交" value={game.player.social} icon="social" color="#6da5c2" /><Meter label="累积压力" value={game.player.stress} icon="info" color="#d98974" /></div><hr /><div className="needs-list"><Meter label="工程能力" value={game.player.skill} icon="code" /><Meter label="职业信用" value={game.player.credit} icon="check" /></div><p className="quiet-note">离开页面，游戏时间和需求都会暂停。</p></>}
      {panel === 'goals' && <>
        <div className="panel-intro"><span className="small-tag">第 {schedule.day} 天 · {schedule.weekday}</span><h3>{schedule.title}</h3><p>{schedule.description}</p></div>
        <div className="day-plan">
          {schedule.workStart !== null && schedule.workEnd !== null && <span><strong>{schedule.kind === 'overtime' ? '可选值班' : '工作时段'}</strong> {clock(schedule.workStart)}–{clock(schedule.workEnd)}</span>}
          {schedule.lunchStart !== null && schedule.lunchEnd !== null && <span><strong>公司午休</strong> {clock(schedule.lunchStart)}–{clock(schedule.lunchEnd)}</span>}
          <span><strong>散步</strong> 栈桥公园全天开放</span>
        </div>
        {schedule.day === 1 && <div className="goals-list">{milestones.map((item, index) => <div className={item.done ? 'done' : ''} key={item.label}><span>{item.done ? <Icon name="check" size={16} /> : index + 1}</span>{item.label}</div>)}</div>}
        <button className="primary-button" onClick={nextStep}>{game.phase === 'complete' ? '打开今天的回顾' : game.locationId === 'home' && hour >= 18 ? '休息，迎接明天' : '按今天的安排继续'}<Icon name="arrow" size={18} /></button>
        {schedule.kind === 'overtime' && !workFinished && game.locationId !== 'office' && <button className="secondary-button career-entry" onClick={() => { setView('city'); selectLocation('office'); }}>去公司看看周末值班</button>}
        <button className="secondary-button career-entry" onClick={openCareer}><Icon name="calendar" size={17} />职业日历</button>
      </>}
      {(panel === 'journal' || panel === 'settings') && <><div className="phone-tabs"><button className={panel === 'journal' ? 'active' : ''} onClick={() => setPanel('journal')}><Icon name="journal" size={16} />手记</button><button className={panel === 'settings' ? 'active' : ''} onClick={() => setPanel('settings')}><Icon name="settings" size={16} />设置与账单</button></div>{panel === 'journal' ? <><div className="panel-intro"><h3>今天留下的片刻</h3><p>每一个选择，都记在这里。</p></div><div className="timeline">{[...game.journal].reverse().map(entry => <article key={entry.id}><time>{clock(entry.minute)}</time><div><h3>{entry.title}</h3><p>{entry.detail}</p><div className="effect-chips">{entry.changes.map((change, index) => <span key={index}>{change.label} {change.value > 0 ? '+' : ''}{Number(change.value.toFixed(1))}{change.unit ?? ''}</span>)}</div></div></article>)}</div></> : <><div className="save-indicator"><Icon name="save" size={22} /><span><strong>{readOnly ? '此标签页只读' : saved ? '所有进度已保存在本机' : '有尚未保存的进度'}</strong><small>第 {day} 天 {clock(game.minute)}</small></span></div><div className="settings-buttons"><button className="secondary-button" onClick={download}><Icon name="download" size={17} />导出</button><button className="secondary-button" disabled={readOnly || busy} onClick={() => importInput.current?.click()}><Icon name="upload" size={17} />导入</button></div><input ref={importInput} type="file" accept="application/json,.json" hidden aria-label="导入 JSON 存档" onChange={async event => { const input = event.currentTarget; const file = input.files?.[0]; try { if (file) { if (file.size > 1_000_000) setMessage('请选择小于 1MB 的 JSON 存档。'); else restore(await file.text()); } } catch { setMessage('无法读取文件，请重新选择存档。'); } finally { input.value = ''; } }} /><p className="quiet-note">导入会替换当前人生。离线不消耗需求，清除浏览器数据会清除进度。</p><label className="toggle-setting"><span>减少动态效果<small>出行时使用固定路线图，保留车辆移动。</small></span><input type="checkbox" checked={reduceMotion} onChange={event => setReduceMotion(event.target.checked)} /></label><hr /><h3 className="small-heading">工作收入</h3><p className="quiet-note">从第 2 天开始，每天睡觉时按当天工时结算。参加周末值班时，工时按 1.5 倍结算。</p><hr /><GuestFeedback className="secondary-button" /><button className="text-button restart-button" disabled={busy || readOnly} onClick={() => setConfirmReset(true)}><Icon name="reset" size={16} />重新开始一段生活</button></>}</>}
    </div></aside>}
    {game.phase === 'event' && <div className="modal-backdrop"><section className="event-modal" role="dialog" aria-modal="true" aria-labelledby="event-title"><div className="event-person"><span>林</span><div><strong>林可</strong><small>产品经理 · 一条新消息</small></div><span className="message-time">{clock(game.minute)}</span></div><h2 id="event-title">“顺手加个小功能，可以吗？”</h2><p className="event-copy">消息提醒做到一半，林可想再加上批量标记。看起来只多一个按钮，按钮后面却还有边界情况。</p><div className="event-quote">“演示的时候一起带上，效果应该会很好。你觉得呢？”</div><div className="event-choices">{EVENT_CHOICES.map(choice => <button disabled={busy || readOnly} onClick={() => { stopAutoplay(); act({ kind: 'choice', targetId: choice.id }); }} key={choice.id}><strong>{choice.title}<Icon name="chevron" size={17} /></strong><p>{choice.description}</p><small>{choice.effects.join(' · ')}</small></button>)}</div><p className="quiet-note"><Icon name="clock" size={14} />{autoplay ? '自动玩耍即将回复，也可以自己选。' : '读消息时，游戏时间暂停。'}</p><button type="button" className="text-button autoplay-event-control" disabled={readOnly || !saved} onClick={autoplay ? stopAutoplay : startAutoplay}><Icon name={autoplay ? 'pause' : 'play'} size={15} />{autoplay ? '暂停自动玩耍' : '自动玩耍'}</button></section></div>}
    {showSummary && game.phase === 'complete' && <DailySummary game={game} day={schedule.day} disabled={readOnly || busy} onNextDay={() => startNextDay()} onAutoplayNextDay={saved ? () => startNextDay(true) : undefined} onCareer={openCareer} onClose={() => { setShowSummary(false); setPanel('journal'); }} onExport={download} onRestart={() => setConfirmReset(true)} />}
    {showCareer && <CareerCalendar game={game} reduceMotion={reduceMotion} disabled={readOnly || busy} onChoice={id => act({ kind: 'career', targetId: id })} onClose={() => { setShowCareer(false); if (game.phase === 'complete') setShowSummary(true); }} />}
    {confirmReset && <div className="modal-backdrop"><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-title"><Icon name="reset" size={30} /><h2 id="reset-title">换一种方式过今天？</h2><p>重新开始会替换当前进度。可以先导出存档，把这一天留下来。</p><div className="confirm-actions"><button className="secondary-button" onClick={download}>先导出</button><button className="primary-button" disabled={busy || readOnly} onClick={() => { reset(); setConfirmReset(false); setShowSummary(false); setShowCareer(false); setPanel(null); setView('room'); setActivity(null); }}>重新开始</button></div><button className="text-button" onClick={() => setConfirmReset(false)}>继续现在的生活</button></section></div>}
    {message && <div className="toast" role="status"><Icon name="info" size={18} />{message}<button aria-label="关闭提示" onClick={() => setMessage('')}><Icon name="close" size={16} /></button></div>}
  </div>;
}
