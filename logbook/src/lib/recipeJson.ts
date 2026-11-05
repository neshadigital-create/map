import type { Food, Nutrients } from '../db/types';
import { parseLine, rankFoods, resolveAmount, MATCH_THRESHOLD, type ParsedQuantity } from './parser';

/**
 * Reads a recipe pasted as JSON, e.g.
 * { "name": "...", "servings": 1, "kcal": 880, "protein_g": 49, "ingredients": [{ "item": "Penne, dry", "g": 90 }, { "item": "Eggs", "count": 3 }] }
 */
export interface RecipeLine {
  raw: string;
  query: string;
  qty: ParsedQuantity;
}

export interface ParsedRecipe {
  name: string;
  servings: number;
  /** Totals stated in the JSON, per serving, when given */
  stated?: Nutrients;
  lines: RecipeLine[];
}

const UNIT_KEYS: Record<string, { unit: string; kind: ParsedQuantity['kind']; factor: number }> = {
  g: { unit: 'g', kind: 'mass', factor: 1 },
  grams: { unit: 'g', kind: 'mass', factor: 1 },
  kg: { unit: 'g', kind: 'mass', factor: 1000 },
  ml: { unit: 'ml', kind: 'volume', factor: 1 },
  cl: { unit: 'ml', kind: 'volume', factor: 10 },
  l: { unit: 'ml', kind: 'volume', factor: 1000 },
  tsp: { unit: 'tsp', kind: 'measure', factor: 1 },
  tbsp: { unit: 'tbsp', kind: 'measure', factor: 1 },
  cup: { unit: 'cup', kind: 'measure', factor: 1 },
  count: { unit: 'portion', kind: 'count', factor: 1 },
  pieces: { unit: 'portion', kind: 'count', factor: 1 },
  qty: { unit: 'portion', kind: 'count', factor: 1 },
  servings: { unit: 'portion', kind: 'count', factor: 1 },
};

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function pick(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) if (o[k] !== undefined) return num(o[k]);
  return undefined;
}

export function parseRecipeJson(text: string): ParsedRecipe | null {
  const t = text.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  let data: unknown;
  try {
    data = JSON.parse(t);
  } catch {
    return null;
  }
  const o = (Array.isArray(data) ? { ingredients: data } : data) as Record<string, unknown>;
  const list = Array.isArray(o.ingredients) ? o.ingredients : null;
  if (!list) return null;
  const lines: RecipeLine[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const ing = raw as Record<string, unknown>;
    const item = String(ing.item ?? ing.name ?? ing.food ?? '').trim();
    if (!item) continue;
    let qty: ParsedQuantity | undefined;
    for (const [key, def] of Object.entries(UNIT_KEYS)) {
      const v = num(ing[key]);
      if (v !== undefined) {
        qty = { quantity: v, unit: def.unit, kind: def.kind, factor: def.factor, explicitUnit: def.kind !== 'count' };
        break;
      }
    }
    // { "amount": 90, "unit": "g" } style
    if (!qty && num(ing.amount) !== undefined) {
      const u = String(ing.unit ?? 'count').toLowerCase();
      const def = UNIT_KEYS[u] ?? UNIT_KEYS.count;
      qty = { quantity: num(ing.amount)!, unit: def.unit, kind: def.kind, factor: def.factor, explicitUnit: def.kind !== 'count' };
    }
    qty ??= { quantity: 1, unit: 'portion', kind: 'count', factor: 1, explicitUnit: false };
    const label = qty.kind === 'count' ? `${qty.quantity}` : `${qty.quantity * qty.factor} ${qty.unit}`;
    lines.push({ raw: `${label} ${item}`, query: item, qty });
  }
  const kcal = pick(o, 'kcal', 'calories', 'energy_kcal');
  const stated: Nutrients | undefined =
    kcal === undefined
      ? undefined
      : {
          kcal,
          protein: pick(o, 'protein_g', 'protein') ?? 0,
          carbs: pick(o, 'carbs_g', 'carbs', 'carbohydrates_g') ?? 0,
          fat: pick(o, 'fat_g', 'fat') ?? 0,
          fiber: pick(o, 'fiber_g', 'fiber', 'fibre_g'),
          sugar: pick(o, 'sugar_g', 'sugar', 'sugars_g'),
        };
  return { name: String(o.name ?? o.title ?? 'Recipe').trim() || 'Recipe', servings: Math.max(1, pick(o, 'servings') ?? 1), stated, lines };
}

/** Match each line: my foods first, then the generic table. */
export function matchRecipeLines(lines: RecipeLine[], mine: Food[], generic: Food[] = []) {
  return lines.map((l) => {
    let best = rankFoods(l.query, mine, 4);
    let food = best[0] && best[0].score >= MATCH_THRESHOLD ? best[0].food : undefined;
    if (!food && generic.length) {
      const g = parseLine(l.query, generic);
      food = g.food;
      best = rankFoods(l.query, generic, 4);
    }
    return {
      raw: l.raw,
      food,
      amount: food ? Math.round(resolveAmount(l.qty, food) * 10) / 10 : 0,
      alternatives: best.map((b) => b.food).filter((f) => f !== food),
      qty: l.qty,
    };
  });
}
