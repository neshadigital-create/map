import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../src/db';
import { exportAll, importBackup } from '../src/db/backup';
import { logFood, logRecipe, copyMeal } from '../src/db/actions';
import { totals } from '../src/lib/macros';

describe('database', () => {
  it('seeds once and logs food, recipes and copies', async () => {
    await ensureSeeded();
    await ensureSeeded();
    expect(await db.foods.count()).toBe(21);
    const egg = (await db.foods.get('seed-egg-boiled'))!;
    await logFood(egg, 150, '2026-10-21', 'meal-1');
    await logRecipe((await db.recipes.get('seed-recipe-salad'))!, '2026-10-21', 'meal-2', 0.5);
    const day = await db.entries.where('day').equals('2026-10-21').toArray();
    expect(day).toHaveLength(6);
    const oil = day.find((e) => e.isOil)!;
    expect(oil.amount).toBeCloseTo(6.8);
    expect(await copyMeal('2026-10-21', '2026-10-22', 'meal-2')).toBe(5);
    const copied = await db.entries.where('day').equals('2026-10-22').toArray();
    expect(new Set(copied.map((e) => e.groupId)).size).toBe(1);
    expect(totals(copied).kcal).toBeCloseTo(totals(day.filter((e) => e.mealId === 'meal-2')).kcal);
  });

  it('round-trips a JSON backup without losing rows', async () => {
    const backup = JSON.parse(JSON.stringify(await exportAll()));
    const before = await db.entries.count();
    await db.entries.clear();
    const res = await importBackup(backup, 'merge');
    expect(await db.entries.count()).toBe(before);
    expect(res.imported.foods).toBe(21);
    // merging twice does not duplicate
    await importBackup(backup, 'merge');
    expect(await db.entries.count()).toBe(before);
  });

  it('round-trips photos as base64', async () => {
    const image = new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' });
    await db.photos.put({ id: 'p1', day: '2026-10-22', image, thumb: image, at: 1 });
    const backup = JSON.parse(JSON.stringify(await exportAll()));
    expect(backup.tables.photos[0].image.__blob).toBe('AQID+g==');
    await db.photos.clear();
    await importBackup(backup);
    const back = (await db.photos.get('p1'))!;
    expect(back.image.type).toBe('image/jpeg');
    expect([...new Uint8Array(await back.image.arrayBuffer())]).toEqual([1, 2, 3, 250]);
  });

  it('rejects files that are not Logbook data', async () => {
    await expect(importBackup({ hello: 'world' })).rejects.toThrow();
  });
});
