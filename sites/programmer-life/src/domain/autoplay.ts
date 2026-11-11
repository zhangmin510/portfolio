import { getActions, getTravelOptions } from './engine';
import { getDaySchedule } from './routine';
import type { ActionId, ChoiceId, GameState, LocationId, TravelMode } from './types';

export type AutoplayAction =
  | { kind: 'action'; targetId: ActionId }
  | { kind: 'travel'; targetId: LocationId; mode: TravelMode }
  | { kind: 'choice'; targetId: ChoiceId };

const BEDTIME = 18 * 60;
const LAST_PARK_DEPARTURE = 21 * 60;

/** Choose one legal command for the current day, leaving execution to the regular engine. */
export function getAutoplayAction(state: GameState): AutoplayAction | null {
  if (state.phase === 'complete') return null;
  if (state.phase === 'event') {
    return state.pendingEvent === 'scope-change' ? { kind: 'choice', targetId: 'negotiate' } : null;
  }

  const { minute, locationId, flags, player } = state;
  const schedule = getDaySchedule(state);
  const workEnd = schedule.workEnd;
  const workingToday = workEnd !== null && (schedule.kind !== 'overtime' || flags.overtimeAccepted);
  const available = getActions(state).filter(action => !action.disabledReason);

  function pick(...ids: ActionId[]): AutoplayAction | null {
    const targetId = ids.find(id => available.some(action => action.id === id));
    return targetId ? { kind: 'action', targetId } : null;
  }

  function go(targetId: LocationId, latestArrival = Infinity): AutoplayAction | null {
    const travel = getTravelOptions(state, targetId).find(option => !option.disabledReason && minute + option.duration <= latestArrival);
    return travel ? { kind: 'travel', targetId, mode: travel.mode } : null;
  }

  if (locationId === 'home' && minute < 10 * 60 + 30 && !flags.breakfast) {
    const breakfast = pick('breakfast');
    if (breakfast) return breakfast;
  }

  if (locationId !== 'office' && workingToday && !flags.commuted && minute < BEDTIME) {
    const commute = go('office', workEnd - 30);
    if (commute) return commute;
  }

  if (locationId === 'office' && workingToday && minute < workEnd) {
    const { lunchStart, lunchEnd } = schedule;
    const lunchtime = lunchStart !== null && lunchEnd !== null && minute >= lunchStart && minute < lunchEnd;
    if (lunchtime) {
      const lunch = !flags.lunch ? pick('lunch') : null;
      return lunch ?? pick('lunch-break', 'rest');
    }

    if (player.hunger < 28) {
      const meal = pick('lunch');
      if (meal) return meal;
    }

    // Day one also respects lunch, even though its work rules allow longer blocks.
    const morning = lunchStart !== null && minute < lunchStart;
    const workOrder: ActionId[] = flags.workSessions >= 2 && (state.work.quality < 65 || state.work.debt >= 10)
      ? ['test', 'focus', 'talk']
      : ['focus', 'test', 'talk'];
    const work = workOrder.find(id => available.some(action => action.id === id && (!morning || minute + action.duration <= lunchStart)));
    if (work) return { kind: 'action', targetId: work };

    // A real break advances time to the next available work or lunch block.
    const rest = player.hunger >= 10 || minute < (lunchStart ?? 0) ? pick('rest') : null;
    if (rest) return rest;
  }

  if (locationId === 'park' && !flags.walked) {
    const walk = pick('midweek-walk', 'walk');
    if (walk) return walk;
  }
  if (!flags.walked && locationId !== 'park' && minute < LAST_PARK_DEPARTURE) {
    const park = go('park');
    if (park) return park;
  }
  if (locationId !== 'home') return go('home');

  if (player.hunger < 58) {
    const dinner = pick('cook');
    if (dinner) return dinner;
  }
  if (minute >= BEDTIME) return pick('sleep');
  if (player.energy >= 25 && state.personalProgress < 100) {
    const personal = pick('personal');
    if (personal) return personal;
  }
  return pick('rest');
}
