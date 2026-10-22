import type { Food, Nutrients } from '../db/types';

/** Open Food Facts client. All calls fail gracefully; callers show a quiet message. */

const FIELDS =
  'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_quantity,serving_size,quantity,product_quantity';

export class OfflineError extends Error {}

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  generic_name_fr?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  product_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

async function getJSON(url: string, signal?: AbortSignal, timeoutMs = 8000): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OfflineError('offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  signal?.addEventListener('abort', () => ctrl.abort());
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

export function offToFood(p: OFFProduct): Food | null {
  const n = p.nutriments ?? {};
  const name = (p.product_name_fr || p.product_name || p.generic_name_fr || '').trim();
  if (!name || !p.code) return null;
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === undefined) {
    const kj = num(n['energy_100g']);
    if (kj !== undefined) kcal = kj / 4.184;
  }
  const nutrients: Nutrients = {
    kcal: Math.round(kcal ?? 0),
    protein: num(n['proteins_100g']) ?? 0,
    fat: num(n['fat_100g']) ?? 0,
    carbs: num(n['carbohydrates_100g']) ?? 0,
    fiber: num(n['fiber_100g']),
    sugar: num(n['sugars_100g']),
  };
  const q = `${p.quantity ?? ''} ${p.serving_size ?? ''}`.toLowerCase();
  const unit = /\d\s*(ml|cl|l)\b/.test(q) ? 'ml' : 'g';
  const serving = num(p.serving_quantity);
  const pack = num(p.product_quantity);
  const portion =
    serving && serving > 0
      ? { label: p.serving_size?.trim() || `${serving} ${unit}`, amount: serving }
      : pack && pack > 0 && pack <= 1000
        ? { label: p.quantity?.trim() || `${pack} ${unit}`, amount: pack }
        : undefined;
  const now = Date.now();
  return {
    id: `off-${p.code}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode: p.code,
    unit,
    basis: 'per100',
    nutrients,
    portion,
    source: 'off',
    createdAt: now,
    updatedAt: now,
  };
}

export function hasNutrition(f: Food): boolean {
  return f.nutrients.kcal > 0 || f.nutrients.protein + f.nutrients.carbs + f.nutrients.fat > 0;
}

export async function searchOFF(query: string, signal?: AbortSignal): Promise<Food[]> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=24&cc=fr&lc=fr&sort_by=unique_scans_n&fields=${FIELDS}`;
  const data = (await getJSON(url, signal, 10000)) as { products?: OFFProduct[] };
  return (data.products ?? []).map(offToFood).filter((f): f is Food => !!f && hasNutrition(f));
}

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<Food | null> {
  const clean = code.replace(/\D/g, '');
  if (!clean) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${FIELDS}`;
  const data = (await getJSON(url, signal)) as { status?: number; product?: OFFProduct };
  if (!data.product || data.status === 0) return null;
  return offToFood({ ...data.product, code: data.product.code ?? clean });
}
