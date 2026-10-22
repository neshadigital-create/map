import { describe, expect, it } from 'vitest';
import { forAmount, per100, totals, scale, fmtG, kcalFromMacros } from '../src/lib/macros';
import { seedFoods } from '../src/db/seed';

const foods = seedFoods(0);
const byId = (id: string) => foods.find((f) => f.id === id)!;

describe('macro math', () => {
  it('per-100 foods scale linearly', () => {
    const n = forAmount(byId('seed-skyr'), 150);
    expect(n.kcal).toBeCloseTo(90);
    expect(n.protein).toBeCloseTo(15.75);
  });

  it('portion foods convert through the portion amount', () => {
    const egg = byId('seed-egg-boiled');
    expect(per100(egg).kcal).toBeCloseTo(140);
    expect(forAmount(egg, 150).kcal).toBeCloseTo(210); // 3 eggs
    expect(forAmount(egg, 150).protein).toBeCloseTo(18);
  });

  it('one tbsp olive oil is 120 kcal, one tsp is 40', () => {
    const oil = byId('seed-olive-oil');
    expect(forAmount(oil, 13.5).kcal).toBeCloseTo(120);
    expect(forAmount(oil, 4.5).kcal).toBeCloseTo(40);
  });

  it('totals entries and keeps optional fields', () => {
    const t = totals([
      { per100: { kcal: 100, protein: 10, fat: 1, carbs: 5, fiber: 2 }, amount: 200 },
      { per100: { kcal: 50, protein: 1, fat: 0, carbs: 10, sugar: 8 }, amount: 50 },
    ]);
    expect(t.kcal).toBe(225);
    expect(t.protein).toBe(20.5);
    expect(t.fiber).toBe(4);
    expect(t.sugar).toBe(4);
  });

  it('scale ignores missing values', () => {
    expect(scale({ kcal: 10, protein: 1, fat: 1, carbs: 1 }, 2).fiber).toBeUndefined();
  });

  it('formats grams', () => {
    expect(fmtG(4.26)).toBe('4.3');
    expect(fmtG(12.6)).toBe('13');
    expect(fmtG(0)).toBe('0');
  });

  it('seed labels roughly agree with Atwater', () => {
    for (const f of foods) {
      const k = kcalFromMacros(f.nutrients);
      // alcohol (beer) and fiber make some labels differ; just guard against typos
      if (f.id === 'seed-beer-grizzly') continue;
      expect(Math.abs(k - f.nutrients.kcal) / f.nutrients.kcal).toBeLessThan(0.25);
    }
  });
});
