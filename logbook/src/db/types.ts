export type Unit = 'g' | 'ml';

/** Core nutrients. Fiber and sugar are optional because many labels skip them. */
export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  sugar?: number;
}

export type FoodSource = 'seed' | 'user' | 'off';

export interface Food {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  unit: Unit;
  /** 'per100' = nutrients are per 100 g/ml. 'portion' = nutrients are for one portion. */
  basis: 'per100' | 'portion';
  nutrients: Nutrients;
  /** Default portion. Required for basis 'portion'; optional helper for 'per100'. */
  portion?: { label: string; amount: number };
  /** Extra household measures in g/ml, e.g. { tsp: 4.5, tbsp: 13.5 } */
  measures?: Record<string, number>;
  /** Counts as "oil and dressing" in the per-meal breakdown. */
  isOil?: boolean;
  aliases?: string[];
  favorite?: boolean;
  source: FoodSource;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

export interface Entry {
  id: string;
  /** Local day key YYYY-MM-DD (Europe/Paris by default) */
  day: string;
  mealId: string;
  foodId?: string;
  name: string;
  brand?: string;
  unit: Unit;
  amount: number;
  /** Snapshot of nutrients per 100 g/ml at log time, so later food edits don't rewrite history. */
  per100: Nutrients;
  isOil?: boolean;
  /** Set when logged from a saved recipe; groups items in the meal list. */
  recipeId?: string;
  recipeName?: string;
  groupId?: string;
  loggedAt: number;
}

export interface RecipeItem {
  foodId: string;
  amount: number;
}

export interface Recipe {
  id: string;
  name: string;
  items: RecipeItem[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

export interface WaterLog {
  id: string;
  day: string;
  ml: number;
  at: number;
}

export interface Meal {
  id: string;
  name: string;
}

export type Sex = 'female' | 'male';
export type ActivityLevel = 'light' | 'moderate' | 'high';
export type Goal = 'recomp' | 'lose' | 'maintain';
export type Lang = 'en' | 'fr';

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface Settings {
  id: 'settings';
  lang: Lang;
  timezone: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  goal: Goal;
  activity: ActivityLevel;
  /** When true, targets follow the suggestion; editing any target turns this off. */
  autoTargets: boolean;
  targets: Targets;
  waterGoalMl: number;
  eatingWindow: { start: string; end: string; enabled: boolean };
  restTimerSec: number;
  meals: Meal[];
}

export interface Meta {
  key: string;
  value: unknown;
}

/* ---------- Training ---------- */

export const MUSCLES = [
  'glutes',
  'quads',
  'hamstrings',
  'calves',
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'abs',
  'full body',
  'other',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  createdAt: number;
}

export interface Program {
  id: string;
  name: string;
  createdAt: number;
}

/** An 8-week block. Exercises can change between phases. */
export interface Phase {
  id: string;
  programId: string;
  index: number; // 1-based
  /** Monday the phase starts on (YYYY-MM-DD) */
  startDate: string;
  weeks: number;
  createdAt: number;
}

export interface PlannedExercise {
  id: string;
  exerciseId: string;
  sets: number;
  /** e.g. "8-12" or "10" */
  reps: string;
}

export interface DayTemplate {
  id: string;
  phaseId: string;
  order: number; // 0..4
  name: string; // e.g. "Day 1" or "Legs"
  exercises: PlannedExercise[];
}

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

export interface SessionExercise {
  exerciseId: string;
  reps?: string;
  feeling?: number; // 1-5
  note?: string;
}

export interface Session {
  id: string;
  day: string;
  name: string;
  phaseId?: string;
  dayTemplateId?: string;
  week?: number;
  startedAt: number;
  endedAt?: number;
  exercises: SessionExercise[];
  feeling?: number;
  note?: string;
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  type: SetType;
  weight: number; // kg
  reps: number;
  done: boolean;
  at: number;
}

export type CardioType = 'treadmill' | 'walk';

export interface Cardio {
  id: string;
  day: string;
  type: CardioType;
  minutes: number;
  distanceKm?: number;
  inclinePct?: number;
  speedKmh?: number;
  steps?: number;
  note?: string;
  at: number;
}
