import { describe, expect, it } from 'vitest';
import { suggestTargets, bmr, MIN_KCAL, referenceGoalWeight, safeKcal } from '../src/lib/targets';

const me = {
  sex: 'female' as const,
  age: 34,
  heightCm: 166,
  weightKg: 99,
  goalWeightKg: 69,
  goal: 'recomp' as const,
  activity: 'moderate' as const,
};

describe('targets', () => {
  it('computes Mifflin-St Jeor', () => {
    expect(bmr(me)).toBeCloseTo(1696.5);
  });

  it('suggests a moderate deficit with protein first', () => {
    const s = suggestTargets(me);
    expect(s.targets.kcal).toBe(2100);
    expect(s.targets.protein).toBe(125);
    expect(s.proteinRange).toEqual([110, 140]);
    const kcalFromMacros = s.targets.protein * 4 + s.targets.carbs * 4 + s.targets.fat * 9;
    expect(Math.abs(kcalFromMacros - s.targets.kcal)).toBeLessThan(60);
    expect(s.targets.carbs).toBeLessThan(s.targets.fat * 1.5);
  });

  it('never suggests below 1200 kcal', () => {
    const tiny = { ...me, weightKg: 40, heightCm: 145, age: 70, activity: 'light' as const, goal: 'lose' as const };
    expect(suggestTargets(tiny).targets.kcal).toBeGreaterThanOrEqual(MIN_KCAL);
    expect(safeKcal(900)).toBe(1200);
  });

  it('reference goal weight is BMI 25', () => {
    expect(referenceGoalWeight(166)).toBe(69);
  });
});
