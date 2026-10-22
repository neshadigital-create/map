import type { ActivityLevel, Goal, Sex, Targets } from '../db/types';

export const MIN_KCAL = 1200;

const ACTIVITY: Record<ActivityLevel, number> = {
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

const DEFICIT: Record<Goal, number> = {
  recomp: 0.2,
  lose: 0.25,
  maintain: 0,
};

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  goal: Goal;
  activity: ActivityLevel;
}

/** Mifflin-St Jeor resting energy. */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'female' ? base - 161 : base + 5;
}

export function tdee(p: Profile): number {
  return bmr(p) * ACTIVITY[p.activity];
}

/** Weight at BMI 25, a sensible default "reference" weight for protein. */
export function referenceGoalWeight(heightCm: number): number {
  const m = heightCm / 100;
  return Math.round(25 * m * m);
}

export interface Suggestion {
  targets: Targets;
  tdee: number;
  bmr: number;
  proteinRange: [number, number];
}

const r5 = (n: number) => Math.round(n / 5) * 5;
const r50 = (n: number) => Math.round(n / 50) * 50;

/**
 * Protein-first suggestion:
 *  - kcal: TDEE minus a moderate deficit, never below 1200
 *  - protein: 1.8 g/kg of goal weight (range 1.6-2.0)
 *  - carbs: ~25% of kcal (low-ish)
 *  - fat: the remainder, with a floor of 0.6 g/kg goal weight
 */
export function suggestTargets(p: Profile): Suggestion {
  const e = tdee(p);
  const kcal = Math.max(MIN_KCAL, r50(e * (1 - DEFICIT[p.goal])));
  const gw = p.goalWeightKg > 0 ? p.goalWeightKg : referenceGoalWeight(p.heightCm);
  const protein = r5(gw * 1.8);
  const proteinRange: [number, number] = [r5(gw * 1.6), r5(gw * 2.0)];
  const fatFloor = gw * 0.6;
  let carbs = r5((kcal * 0.25) / 4);
  let fat = (kcal - protein * 4 - carbs * 4) / 9;
  if (fat < fatFloor) {
    fat = fatFloor;
    carbs = Math.max(0, r5((kcal - protein * 4 - fat * 9) / 4));
  }
  return {
    targets: { kcal, protein, carbs, fat: r5(fat), fiber: 25 },
    tdee: Math.round(e),
    bmr: Math.round(bmr(p)),
    proteinRange,
  };
}

/** Clamp a manual kcal target to the safety floor. */
export function safeKcal(kcal: number): number {
  return Math.max(MIN_KCAL, Math.round(kcal));
}
