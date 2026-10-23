import type { Food } from '../db/types';
import { per100 } from './macros';

/**
 * Pick one of my own foods that helps close a protein gap: a ready portion with at least
 * 10 g protein that doesn't overshoot by much. Prefers protein-dense foods I've eaten recently.
 */
export function proteinSuggestion(foods: Food[], toGo: number): { food: Food; protein: number } | null {
  if (toGo < 8) return null;
  let best: { food: Food; protein: number; score: number } | null = null;
  for (const f of foods) {
    if (!f.portion || f.isOil) continue;
    const p100 = per100(f);
    const protein = (p100.protein * f.portion.amount) / 100;
    const kcal = (p100.kcal * f.portion.amount) / 100;
    if (protein < 10 || protein > toGo + 12 || kcal <= 0) continue;
    const density = (protein * 4) / kcal; // share of kcal from protein
    const recency = f.lastUsedAt ? 0.15 : 0;
    const score = density + recency + (f.favorite ? 0.1 : 0) - Math.abs(toGo - protein) / 200;
    if (!best || score > best.score) best = { food: f, protein, score };
  }
  return best ? { food: best.food, protein: Math.round(best.protein) } : null;
}
