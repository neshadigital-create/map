import type { Entry, Food, Nutrients } from '../db/types';

export const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0 };

const KEYS = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar'] as const;

export function scale(n: Nutrients, factor: number): Nutrients {
  const out: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const k of KEYS) {
    const v = n[k];
    if (v !== undefined && Number.isFinite(v)) out[k] = v * factor;
  }
  return out;
}

export function add(a: Nutrients, b: Nutrients): Nutrients {
  const out: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0 };
  for (const k of KEYS) out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  return out;
}

export function sum(list: Nutrients[]): Nutrients {
  return list.reduce(add, { ...ZERO });
}

/** Nutrients per 100 g/ml for a food, whatever basis it was entered in. */
export function per100(food: Pick<Food, 'basis' | 'nutrients' | 'portion'>): Nutrients {
  if (food.basis === 'per100') return { ...food.nutrients };
  const amt = food.portion?.amount;
  if (!amt || amt <= 0) return { ...food.nutrients };
  return scale(food.nutrients, 100 / amt);
}

/** Nutrients for a given amount (g/ml) of a food. */
export function forAmount(food: Pick<Food, 'basis' | 'nutrients' | 'portion'>, amount: number): Nutrients {
  return scale(per100(food), amount / 100);
}

export function entryNutrients(e: Pick<Entry, 'per100' | 'amount'>): Nutrients {
  return scale(e.per100, e.amount / 100);
}

export function totals(entries: Pick<Entry, 'per100' | 'amount'>[]): Nutrients {
  return sum(entries.map(entryNutrients));
}

/** Default amount to offer when logging a food. */
export function defaultAmount(food: Pick<Food, 'portion' | 'basis'>): number {
  if (food.portion?.amount) return food.portion.amount;
  return 100;
}

/** kcal from macros (Atwater 4/4/9). Useful to sanity-check labels. */
export function kcalFromMacros(n: Pick<Nutrients, 'protein' | 'fat' | 'carbs'>): number {
  return n.protein * 4 + n.carbs * 4 + n.fat * 9;
}

export function round(n: number, step = 1): number {
  return Math.round(n / step) * step;
}

/** Display helper: integers above 10, one decimal below. */
export function fmtG(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 10 || abs === 0) return String(Math.round(n));
  return (Math.round(n * 10) / 10).toString();
}

export function fmtKcal(n: number): string {
  return Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
}
