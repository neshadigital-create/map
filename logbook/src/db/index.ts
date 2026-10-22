import Dexie, { type EntityTable } from 'dexie';
import type { Entry, Food, Meta, Recipe, Settings, WaterLog } from './types';
import { seedFoods, seedRecipes } from './seed';
import { suggestTargets } from '../lib/targets';
import { DEFAULT_TZ } from '../lib/dates';

/**
 * Single IndexedDB database for the whole app. Workout tables are added in a later
 * schema version; Dexie keeps any tables it does not know about, so earlier data is safe.
 */
export class LogbookDB extends Dexie {
  foods!: EntityTable<Food, 'id'>;
  entries!: EntityTable<Entry, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  water!: EntityTable<WaterLog, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  meta!: EntityTable<Meta, 'key'>;

  constructor(name = 'logbook') {
    super(name);
    this.version(1).stores({
      foods: 'id, name, barcode, source, favorite, lastUsedAt, updatedAt',
      entries: 'id, day, [day+mealId], foodId, recipeId, groupId, loggedAt',
      recipes: 'id, name, favorite, lastUsedAt',
      water: 'id, day, at',
      settings: 'id',
      meta: 'key',
    });
  }
}

export const db = new LogbookDB();

export function defaultSettings(): Settings {
  const profile = {
    sex: 'female' as const,
    age: 34,
    heightCm: 166,
    weightKg: 99,
    goalWeightKg: 69,
    goal: 'recomp' as const,
    activity: 'moderate' as const,
  };
  return {
    id: 'settings',
    lang: 'en',
    timezone: DEFAULT_TZ,
    ...profile,
    autoTargets: true,
    targets: suggestTargets(profile).targets,
    waterGoalMl: 2500,
    eatingWindow: { start: '11:30', end: '20:00', enabled: true },
    restTimerSec: 90,
    meals: [
      { id: 'meal-1', name: 'Meal 1' },
      { id: 'meal-2', name: 'Meal 2' },
      { id: 'snacks', name: 'Snacks' },
    ],
  };
}

/** First run: seed foods, the usual salad and default settings. Never overwrites existing rows. */
export async function ensureSeeded(database: LogbookDB = db): Promise<void> {
  await database.transaction('rw', database.foods, database.recipes, database.settings, database.meta, async () => {
    const seeded = await database.meta.get('seeded-v1');
    if (!(await database.settings.get('settings'))) await database.settings.put(defaultSettings());
    if (seeded) return;
    const now = Date.now();
    const foods = seedFoods(now);
    const existing = new Set((await database.foods.bulkGet(foods.map((f) => f.id))).filter(Boolean).map((f) => f!.id));
    await database.foods.bulkAdd(foods.filter((f) => !existing.has(f.id)));
    const recipes = seedRecipes(now);
    const existingR = new Set(
      (await database.recipes.bulkGet(recipes.map((r) => r.id))).filter(Boolean).map((r) => r!.id),
    );
    await database.recipes.bulkAdd(recipes.filter((r) => !existingR.has(r.id)));
    await database.meta.put({ key: 'seeded-v1', value: now });
  });
}
