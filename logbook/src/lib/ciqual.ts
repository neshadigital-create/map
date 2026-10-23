import type { Food, Lang } from '../db/types';

/**
 * Generic foods from the ANSES-CIQUAL table (French food composition database),
 * bundled with the app as data/ciqual.json so search works offline.
 */
export interface CiqualFile {
  source: string;
  foods: [number, string, string, number, number, number, number, number | null, number | null][];
}

export function ciqualToFoods(data: CiqualFile, lang: Lang): Food[] {
  return data.foods.map(([code, fr, en, kcal, protein, fat, carbs, fiber, sugar]) => ({
    id: `ciqual-${code}`,
    name: lang === 'fr' ? fr : en || fr,
    aliases: [lang === 'fr' ? en : fr].filter(Boolean),
    unit: 'g',
    basis: 'per100',
    nutrients: { kcal, protein, fat, carbs, fiber: fiber ?? undefined, sugar: sugar ?? undefined },
    source: 'ciqual',
    createdAt: 0,
    updatedAt: 0,
  }));
}

let raw: Promise<CiqualFile | null> | null = null;
const cache = new Map<Lang, Food[]>();

/** Loads once per session; resolves to [] if the file isn't there (e.g. not built yet). */
export async function loadCiqual(lang: Lang): Promise<Food[]> {
  if (cache.has(lang)) return cache.get(lang)!;
  raw ??= fetch(`${import.meta.env.BASE_URL}data/ciqual.json`)
    .then((r) => (r.ok ? (r.json() as Promise<CiqualFile>) : null))
    .catch(() => null);
  const data = await raw;
  if (!data) {
    raw = null;
    return [];
  }
  const foods = ciqualToFoods(data, lang);
  cache.set(lang, foods);
  return foods;
}
