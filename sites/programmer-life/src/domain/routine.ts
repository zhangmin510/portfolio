import type { GameState } from './types';
import { hasGraduated } from './career';

export const ROUTINE_MORNING = 7 * 60;

const WEEKDAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

export interface DaySchedule {
  day: number;
  weekday: string;
  kind: 'workday' | 'midweek' | 'early-finish' | 'weekend' | 'overtime' | 'graduated';
  workStart: number | null;
  workEnd: number | null;
  lunchStart: number | null;
  lunchEnd: number | null;
  title: string;
  description: string;
}

export function getDaySchedule(state: Pick<GameState, 'routineDay' | 'careerChoices'>): DaySchedule {
  const day = state.routineDay ?? 1;
  const weekdayIndex = (day - 1) % 7;
  const schedule: DaySchedule = {
    day,
    weekday: WEEKDAYS[weekdayIndex],
    kind: 'workday',
    workStart: 9 * 60,
    workEnd: 18 * 60,
    lunchStart: 11 * 60 + 30,
    lunchEnd: 13 * 60,
    title: '普通工作日',
    description: '09:00 上班，11:30–13:00 吃饭午休，18:00 下班。',
  };
  if (hasGraduated(state)) {
    return { ...schedule, kind: 'graduated', workStart: null, workEnd: null, lunchStart: null, lunchEnd: null, title: '离职后的日常', description: '你已经离开公司。今天可以在家做自己的项目，或者出门散步。' };
  }
  if (day === 1) return { ...schedule, workEnd: 19 * 60, title: '入职第一天', description: '09:00 开工，19:00 下班。今天先熟悉公司和第一份需求。' };
  if (weekdayIndex === 2) return { ...schedule, kind: 'midweek', workEnd: 17 * 60, title: '周三小周末', description: '17:00 下班后，可以和朋友去栈桥公园走走。' };
  if (weekdayIndex === 4) return { ...schedule, kind: 'early-finish', workEnd: 16 * 60, title: '周五早点走', description: '今天工作到 16:00。下班后还有整个下午。' };
  if (weekdayIndex === 5 && Math.floor((day - 1) / 7) % 2 === 0) {
    return { ...schedule, kind: 'overtime', workStart: 10 * 60, workEnd: 14 * 60, title: '周六有临时班', description: '10:00–14:00 可在公司自愿接班，工时按 1.5 倍结算。' };
  }
  if (weekdayIndex >= 5) {
    return { ...schedule, kind: 'weekend', workStart: null, workEnd: null, lunchStart: null, lunchEnd: null, title: '周末休息', description: '公司今天休息。可以在家做自己的项目，也可以出门走走。' };
  }
  return schedule;
}
