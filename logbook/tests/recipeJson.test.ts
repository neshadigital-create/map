import { describe, expect, it } from 'vitest';
import { matchRecipeLines, parseRecipeJson } from '../src/lib/recipeJson';
import { seedFoods } from '../src/db/seed';
import { forAmount, sum } from '../src/lib/macros';

const JSON_TEXT = `{
  "name": "Truffle Butter Penne with Fried Eggs & Parmesan",
  "servings": 1, "kcal": 880, "protein_g": 49, "carbs_g": 67, "fat_g": 44, "fiber_g": 3,
  "ingredients": [
    {"item": "Penne, dry", "g": 90},
    {"item": "Truffle butter", "tsp": 1},
    {"item": "Mâche", "g": 30},
    {"item": "Eggs", "count": 3},
    {"item": "Olive oil", "tsp": 2},
    {"item": "Parmesan, grated", "g": 40},
    {"item": "Emmental, grated", "g": 15}
  ]
}`;

describe('recipe JSON', () => {
  it('reads name, totals and ingredients', () => {
    const r = parseRecipeJson(JSON_TEXT)!;
    expect(r.name).toBe('Truffle Butter Penne with Fried Eggs & Parmesan');
    expect(r.stated).toMatchObject({ kcal: 880, protein: 49, carbs: 67, fat: 44, fiber: 3 });
    expect(r.lines.map((l) => l.raw)).toEqual(['90 g Penne, dry', '1 tsp Truffle butter', '30 g Mâche', '3 Eggs', '2 tsp Olive oil', '40 g Parmesan, grated', '15 g Emmental, grated']);
  });

  it('matches every ingredient to my foods and lands close to the stated totals', () => {
    const rows = matchRecipeLines(parseRecipeJson(JSON_TEXT)!.lines, seedFoods(0));
    expect(rows.map((r) => r.food?.id)).toEqual([
      'seed-penne-dry',
      'seed-truffle-butter',
      'seed-mache',
      'seed-egg-boiled',
      'seed-olive-oil',
      'seed-parmesan',
      'seed-emmental',
    ]);
    expect(rows.map((r) => r.amount)).toEqual([90, 5, 30, 150, 9, 40, 15]);
    const tot = sum(rows.map((r) => forAmount(r.food!, r.amount)));
    expect(Math.abs(tot.kcal - 880)).toBeLessThan(30);
    expect(Math.abs(tot.protein - 49)).toBeLessThan(3);
    // French table counts dry pasta at 66 g carbs/100 g; US-style labels (fibre included) say ~75
    expect(Math.abs(tot.carbs - 67)).toBeLessThan(6);
    expect(Math.abs(tot.fat - 44)).toBeLessThan(3);
  });

  it('accepts amount/unit pairs and ignores plain text', () => {
    const r = parseRecipeJson('{"ingredients":[{"name":"skyr","amount":150,"unit":"g"}]}')!;
    expect(r.lines[0].qty.quantity * r.lines[0].qty.factor).toBe(150);
    expect(parseRecipeJson('3 eggs, 1 tsp olive oil')).toBeNull();
    expect(parseRecipeJson('{ not json')).toBeNull();
  });
});
