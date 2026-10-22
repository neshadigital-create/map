import { db } from './index';
import type { Entry, Food, Recipe, Settings } from './types';
import { per100 } from '../lib/macros';
import { uid } from '../lib/id';
import { suggestTargets } from '../lib/targets';

export async function logFood(food: Food, amount: number, day: string, mealId: string, extra: Partial<Entry> = {}) {
  const now = Date.now();
  const entry: Entry = {
    id: uid(),
    day,
    mealId,
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    unit: food.unit,
    amount,
    per100: per100(food),
    isOil: food.isOil,
    loggedAt: now,
    ...extra,
  };
  await db.transaction('rw', db.entries, db.foods, async () => {
    await db.entries.add(entry);
    await db.foods.update(food.id, { lastUsedAt: now });
  });
  return entry;
}

export async function logMany(items: { food: Food; amount: number }[], day: string, mealId: string) {
  const groupId = items.length > 1 ? uid() : undefined;
  for (const it of items) await logFood(it.food, it.amount, day, mealId, { groupId });
}

/** Logs every ingredient as its own entry so oil and dressing stay editable. */
export async function logRecipe(recipe: Recipe, day: string, mealId: string, factor = 1) {
  const foods = await db.foods.bulkGet(recipe.items.map((i) => i.foodId));
  const groupId = uid();
  const now = Date.now();
  await db.transaction('rw', db.entries, db.foods, db.recipes, async () => {
    for (let i = 0; i < recipe.items.length; i++) {
      const food = foods[i];
      if (!food) continue;
      await db.entries.add({
        id: uid(),
        day,
        mealId,
        foodId: food.id,
        name: food.name,
        brand: food.brand,
        unit: food.unit,
        amount: Math.round(recipe.items[i].amount * factor * 10) / 10,
        per100: per100(food),
        isOil: food.isOil,
        recipeId: recipe.id,
        recipeName: recipe.name,
        groupId,
        loggedAt: now + i,
      });
      await db.foods.update(food.id, { lastUsedAt: now });
    }
    await db.recipes.update(recipe.id, { lastUsedAt: now });
  });
}

export async function updateEntry(id: string, patch: Partial<Entry>) {
  await db.entries.update(id, patch);
}

export async function deleteEntry(id: string) {
  await db.entries.delete(id);
}

export async function deleteGroup(groupId: string) {
  await db.entries.where('groupId').equals(groupId).delete();
}

export async function copyMeal(fromDay: string, toDay: string, fromMealId: string, toMealId = fromMealId) {
  const src = await db.entries.where('[day+mealId]').equals([fromDay, fromMealId]).toArray();
  const now = Date.now();
  const groupMap = new Map<string, string>();
  const copies = src.map((e, i) => {
    let groupId = e.groupId;
    if (groupId) {
      if (!groupMap.has(groupId)) groupMap.set(groupId, uid());
      groupId = groupMap.get(groupId);
    }
    return { ...e, id: uid(), day: toDay, mealId: toMealId, groupId, loggedAt: now + i };
  });
  await db.entries.bulkAdd(copies);
  return copies.length;
}

export async function saveFood(food: Omit<Food, 'createdAt' | 'updatedAt'> & Partial<Food>) {
  const now = Date.now();
  const existing = await db.foods.get(food.id);
  const row: Food = { ...food, createdAt: existing?.createdAt ?? now, updatedAt: now } as Food;
  await db.foods.put(row);
  return row;
}

export async function deleteFood(id: string) {
  await db.foods.delete(id);
}

export async function toggleFavorite(food: Food) {
  await db.foods.update(food.id, { favorite: !food.favorite });
}

export async function saveRecipe(recipe: Omit<Recipe, 'createdAt' | 'updatedAt'> & Partial<Recipe>) {
  const now = Date.now();
  const existing = await db.recipes.get(recipe.id);
  await db.recipes.put({ ...recipe, createdAt: existing?.createdAt ?? now, updatedAt: now } as Recipe);
}

export async function deleteRecipe(id: string) {
  await db.recipes.delete(id);
}

export async function addWater(day: string, ml: number) {
  await db.water.add({ id: uid(), day, ml, at: Date.now() });
}

export async function undoWater(day: string) {
  const last = await db.water.where('day').equals(day).sortBy('at');
  const l = last[last.length - 1];
  if (l) await db.water.delete(l.id);
}

/** Saves settings; recomputes targets from the profile when auto targets are on. */
export async function updateSettings(patch: Partial<Settings>) {
  const cur = await db.settings.get('settings');
  if (!cur) return;
  const next = { ...cur, ...patch };
  if (next.autoTargets) next.targets = suggestTargets(next).targets;
  await db.settings.put(next);
}
