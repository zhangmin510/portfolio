export type LocationId = 'home' | 'office' | 'cafe' | 'store' | 'park' | 'makerspace';
export type TraitId = 'focused' | 'outgoing' | 'night-owl' | 'steady';
export type BackgroundId = 'graduate' | 'switcher';
export type WishId = 'balance' | 'craft' | 'sideproject';
export type ActionId = 'breakfast' | 'cook' | 'rest' | 'sleep' | 'personal' | 'focus' | 'rush' | 'test' | 'ai' | 'talk' | 'lunch' | 'coffee' | 'walk' | 'groceries' | 'meetup' | 'lunch-break' | 'overtime' | 'midweek-walk';
export type ChoiceId = 'negotiate' | 'promise' | 'ask-help';
export type TravelMode = 'drive' | 'transit' | 'walk';
export type StatKey = 'energy' | 'hunger' | 'mood' | 'social' | 'stress' | 'skill' | 'credit';

export interface CharacterOptions {
  name: string;
  background: BackgroundId;
  traits: TraitId[];
  wish: WishId;
  seed?: number;
  runId?: string;
}

export interface PlayerState {
  name: string;
  background: BackgroundId;
  traits: TraitId[];
  wish: WishId;
  cash: number;
  energy: number;
  hunger: number;
  mood: number;
  social: number;
  stress: number;
  skill: number;
  credit: number;
}

export interface ChangeRecord { label: string; value: number; unit?: string }
export interface JournalEntry {
  id: string;
  minute: number;
  title: string;
  detail: string;
  category: 'life' | 'work' | 'travel' | 'event';
  changes: ChangeRecord[];
}

export interface DailySummary {
  title: string;
  description: string;
  highlights: string[];
  workMinutes: number;
  spent: number;
  earned?: number;
  progress: number;
  quality: number;
  debt: number;
  personalProgress: number;
  tags: string[];
}

export interface GameState {
  schemaVersion: 1;
  rulesVersion: 'day-one-v1';
  runId: string;
  revision: number;
  rngState: number;
  minute: number;
  phase: 'playing' | 'event' | 'complete';
  player: PlayerState;
  locationId: LocationId;
  work: { progress: number; quality: number; debt: number; minutes: number };
  personalProgress: number;
  relationships: { pm: number; mentor: number; roommate: number; friend: number };
  flags: {
    breakfast: boolean;
    commuted: boolean;
    workSessions: number;
    scopeResolved: boolean;
    eveningActivity: boolean;
    slept: boolean;
    lunch?: boolean;
    lunchBreak?: boolean;
    walked?: boolean;
    overtimeAccepted?: boolean;
  };
  pendingEvent: 'scope-change' | null;
  eventChoice: ChoiceId | null;
  journal: JournalEntry[];
  processedCommandIds: string[];
  summary: DailySummary | null;
  careerChoices?: string[];
  routineDay?: number;
  dayStartCash?: number;
  firstDaySummary?: DailySummary;
}

export interface ActionPreview {
  id: ActionId;
  title: string;
  description: string;
  duration: number;
  cost: number;
  effects: string[];
  risk?: string;
  disabledReason?: string;
  category: 'life' | 'work' | 'social';
}

export interface TravelPreview {
  mode: TravelMode;
  duration: number;
  cost: number;
  disabledReason?: string;
}

export type Command = {
  id: string;
  expectedRevision: number;
} & (
  | { kind: 'action'; targetId: ActionId }
  | { kind: 'travel'; targetId: LocationId; mode: TravelMode }
  | { kind: 'choice'; targetId: ChoiceId }
  | { kind: 'career'; targetId: string }
  | { kind: 'next-day' }
);
