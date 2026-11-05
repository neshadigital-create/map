import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../src/db';
import { fixTrufflePenne, logRecipe, saveRecipe } from '../src/db/actions';
import { totals } from '../src/lib/macros';

describe('Truffle Butter Penne fix', () => {
  it('swaps dry penne for cooked in the recipe and its logged entries, once', async () => {
    await ensureSeeded();
    await saveRecipe({
      id: 'r1',
      name: 'Truffle Butter Penne with Fried Eggs & Parmesan',
      items: [
        { foodId: 'seed-penne-dry', amount: 90 },
        { foodId: 'seed-egg-boiled', amount: 150 },
      ],
    });
    await logRecipe((await db.recipes.get('r1'))!, '2026-11-05', 'meal-1');
    const before = totals(await db.entries.toArray()).kcal;
    expect(await fixTrufflePenne()).toBe(2);
    const after = await db.entries.toArray();
    expect(after.find((e) => e.foodId === 'seed-penne-cooked')?.amount).toBe(90);
    expect(Math.round(before - totals(after).kcal)).toBe(189); // 302 -> 113 kcal
    expect((await db.recipes.get('r1'))!.items[0].foodId).toBe('seed-penne-cooked');
    expect(await fixTrufflePenne()).toBe(0);
  });
});
