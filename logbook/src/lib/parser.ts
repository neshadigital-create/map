import type { Food } from '../db/types';

/**
 * Quick text entry parser.
 * "3 eggs, 1 tsp olive oil, 150g skyr" -> one ParsedLine per item, matched against the food list.
 */

export type UnitKind = 'mass' | 'volume' | 'measure' | 'count';

export interface ParsedQuantity {
  quantity: number;
  unit: string; // canonical: g, ml, tsp, tbsp, cup, or 'portion'
  kind: UnitKind;
  /** factor to g/ml for mass and volume units */
  factor: number;
  explicitUnit: boolean;
}

export interface ParsedLine {
  raw: string;
  query: string;
  qty: ParsedQuantity;
  food?: Food;
  amount?: number;
  score: number;
  alternatives: Food[];
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  demi: 0.5,
};

interface UnitDef {
  unit: string;
  kind: UnitKind;
  factor: number;
}

// Order matters: longer phrases first.
const UNIT_ALIASES: [string, UnitDef][] = [
  ['cuilleres a soupe', { unit: 'tbsp', kind: 'measure', factor: 1 }],
  ['cuillere a soupe', { unit: 'tbsp', kind: 'measure', factor: 1 }],
  ['cuilleres a cafe', { unit: 'tsp', kind: 'measure', factor: 1 }],
  ['cuillere a cafe', { unit: 'tsp', kind: 'measure', factor: 1 }],
  ['tablespoons', { unit: 'tbsp', kind: 'measure', factor: 1 }],
  ['tablespoon', { unit: 'tbsp', kind: 'measure', factor: 1 }],
  ['teaspoons', { unit: 'tsp', kind: 'measure', factor: 1 }],
  ['teaspoon', { unit: 'tsp', kind: 'measure', factor: 1 }],
  ['grammes', { unit: 'g', kind: 'mass', factor: 1 }],
  ['gramme', { unit: 'g', kind: 'mass', factor: 1 }],
  ['grams', { unit: 'g', kind: 'mass', factor: 1 }],
  ['gram', { unit: 'g', kind: 'mass', factor: 1 }],
  ['tbsp', { unit: 'tbsp', kind: 'measure', factor: 1 }],
  ['tbs', { unit: 'tbsp', kind: 'measure', factor: 1 }],
  ['c.a.s', { unit: 'tbsp', kind: 'measure', factor: 1 }],
  ['cas', { unit: 'tbsp', kind: 'measure', factor: 1 }],
  ['cs', { unit: 'tbsp', kind: 'measure', factor: 1 }],
  ['tsp', { unit: 'tsp', kind: 'measure', factor: 1 }],
  ['c.a.c', { unit: 'tsp', kind: 'measure', factor: 1 }],
  ['cac', { unit: 'tsp', kind: 'measure', factor: 1 }],
  ['cc', { unit: 'tsp', kind: 'measure', factor: 1 }],
  ['cups', { unit: 'cup', kind: 'measure', factor: 1 }],
  ['cup', { unit: 'cup', kind: 'measure', factor: 1 }],
  ['tasses', { unit: 'cup', kind: 'measure', factor: 1 }],
  ['tasse', { unit: 'cup', kind: 'measure', factor: 1 }],
  ['kg', { unit: 'g', kind: 'mass', factor: 1000 }],
  ['gr', { unit: 'g', kind: 'mass', factor: 1 }],
  ['g', { unit: 'g', kind: 'mass', factor: 1 }],
  ['ml', { unit: 'ml', kind: 'volume', factor: 1 }],
  ['cl', { unit: 'ml', kind: 'volume', factor: 10 }],
  ['dl', { unit: 'ml', kind: 'volume', factor: 100 }],
  ['l', { unit: 'ml', kind: 'volume', factor: 1000 }],
  ['slices', { unit: 'portion', kind: 'count', factor: 1 }],
  ['slice', { unit: 'portion', kind: 'count', factor: 1 }],
  ['tranches', { unit: 'portion', kind: 'count', factor: 1 }],
  ['tranche', { unit: 'portion', kind: 'count', factor: 1 }],
  ['pieces', { unit: 'portion', kind: 'count', factor: 1 }],
  ['piece', { unit: 'portion', kind: 'count', factor: 1 }],
  ['pcs', { unit: 'portion', kind: 'count', factor: 1 }],
  ['pc', { unit: 'portion', kind: 'count', factor: 1 }],
  ['portions', { unit: 'portion', kind: 'count', factor: 1 }],
  ['portion', { unit: 'portion', kind: 'count', factor: 1 }],
  ['servings', { unit: 'portion', kind: 'count', factor: 1 }],
  ['serving', { unit: 'portion', kind: 'count', factor: 1 }],
  ['pots', { unit: 'portion', kind: 'count', factor: 1 }],
  ['pot', { unit: 'portion', kind: 'count', factor: 1 }],
  ['bottles', { unit: 'portion', kind: 'count', factor: 1 }],
  ['bottle', { unit: 'portion', kind: 'count', factor: 1 }],
  ['bouteilles', { unit: 'portion', kind: 'count', factor: 1 }],
  ['bouteille', { unit: 'portion', kind: 'count', factor: 1 }],
  ['packs', { unit: 'portion', kind: 'count', factor: 1 }],
  ['pack', { unit: 'portion', kind: 'count', factor: 1 }],
  ['x', { unit: 'portion', kind: 'count', factor: 1 }],
];

const GENERIC_MEASURES: Record<string, number> = { tsp: 5, tbsp: 15, cup: 240 };

const NUM = String.raw`(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[½¼¾⅓⅔])`;

function toNumber(s: string): number {
  const t = s.replace(/\s/g, '');
  if (FRACTIONS[t] !== undefined) return FRACTIONS[t];
  if (t.includes('/')) {
    const [a, b] = t.split('/').map((x) => Number(x.replace(',', '.')));
    return b ? a / b : NaN;
  }
  return Number(t.replace(',', '.'));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const UNIT_RE = UNIT_ALIASES.map(([a]) => escapeRe(a)).join('|');

const LEADING = new RegExp(String.raw`^${NUM}\s*(?:(${UNIT_RE})(?![a-z]))?\s*(?:(?:of|de)\s+|d')?(.*)$`);
const LEADING_WORD = new RegExp(
  String.raw`^(${Object.keys(WORD_NUMBERS).join('|')})\s+(?:(${UNIT_RE})(?![a-z])\s*)?(?:(?:of|de)\s+|d')?(.*)$`,
);
const TRAILING = new RegExp(String.raw`^(.*?)\s+(?:x\s*)?${NUM}\s*(${UNIT_RE})?$`);

function unitDef(u?: string): UnitDef | undefined {
  if (!u) return undefined;
  return UNIT_ALIASES.find(([a]) => a === u)?.[1];
}

function makeQty(q: number, u?: string): ParsedQuantity {
  const d = unitDef(u);
  if (!d) return { quantity: q, unit: 'portion', kind: 'count', factor: 1, explicitUnit: false };
  return { quantity: q, unit: d.unit, kind: d.kind, factor: d.factor, explicitUnit: true };
}

export function parseQuantity(line: string): { qty: ParsedQuantity; query: string } {
  const s = normalize(line);
  let m = s.match(LEADING);
  if (m && m[3] !== undefined) {
    return { qty: makeQty(toNumber(m[1]), m[2]), query: m[3].trim() };
  }
  m = s.match(LEADING_WORD);
  if (m && m[3]) {
    return { qty: makeQty(WORD_NUMBERS[m[1]], m[2]), query: m[3].trim() };
  }
  m = s.match(TRAILING);
  if (m && m[1]) {
    return { qty: makeQty(toNumber(m[2]), m[3]), query: m[1].trim() };
  }
  return { qty: makeQty(1), query: s };
}

export function splitItems(text: string): string[] {
  return text
    .split(/[,;\n+]|\s+and\s+|\s+et\s+|\s+with\s+|\s+avec\s+/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

const STOP = new Set(['of', 'de', 'd', 'la', 'le', 'les', 'du', 'des', 'the', 'a', 'au', 'aux', 'en', 'l']);

function singular(t: string): string {
  if (t.length > 3 && t.endsWith('es') && !t.endsWith('ses')) return t.slice(0, -1);
  if (t.length > 3 && (t.endsWith('s') || t.endsWith('x'))) return t.slice(0, -1);
  return t;
}

function tokens(s: string): string[] {
  return normalize(s)
    .replace(/[^a-z0-9' ]/g, ' ')
    .split(/[\s']+/)
    .filter((t) => t && !STOP.has(t))
    .map(singular);
}

function candidates(food: Food): string[] {
  const list = [food.name, ...(food.aliases ?? [])];
  if (food.brand) list.push(`${food.brand} ${food.name}`);
  return list;
}

/** Similarity 0..1 between a typed query and a food. */
export function matchScore(query: string, food: Food): number {
  const qn = tokens(query).join(' ');
  if (!qn) return 0;
  const qt = new Set(qn.split(' '));
  let best = 0;
  for (const c of candidates(food)) {
    const cn = tokens(c).join(' ');
    if (!cn) continue;
    if (cn === qn) return 1;
    const ct = new Set(cn.split(' '));
    let inter = 0;
    for (const t of qt) if (ct.has(t)) inter++;
    const union = qt.size + ct.size - inter;
    let s = union ? inter / union : 0;
    // Whole-word containment ("oil" in "olive oil") gets a boost
    if (inter > 0 && (inter === qt.size || inter === ct.size)) s = Math.max(s, 0.55 + 0.35 * (inter / union));
    // Prefix match while typing ("chick" -> "chickpeas")
    if (s === 0 && [...qt].some((q) => q.length >= 3 && [...ct].some((t) => t.startsWith(q)))) s = 0.4;
    best = Math.max(best, s);
  }
  return best;
}

export function rankFoods(query: string, foods: Food[], limit = 20): { food: Food; score: number }[] {
  return foods
    .map((food) => ({ food, score: matchScore(query, food) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(!!b.food.favorite) - Number(!!a.food.favorite) ||
        (b.food.lastUsedAt ?? 0) - (a.food.lastUsedAt ?? 0),
    )
    .slice(0, limit);
}

export const MATCH_THRESHOLD = 0.4;

/** Resolve a parsed quantity to g/ml for a given food. */
export function resolveAmount(qty: ParsedQuantity, food: Food): number {
  switch (qty.kind) {
    case 'mass':
    case 'volume':
      return qty.quantity * qty.factor;
    case 'measure':
      return qty.quantity * (food.measures?.[qty.unit] ?? GENERIC_MEASURES[qty.unit] ?? 15);
    case 'count':
      return qty.quantity * (food.portion?.amount ?? 100);
  }
}

export function parseLine(raw: string, foods: Food[]): ParsedLine {
  const { qty, query } = parseQuantity(raw);
  const ranked = rankFoods(query, foods, 4);
  const top = ranked[0];
  const food = top && top.score >= MATCH_THRESHOLD ? top.food : undefined;
  return {
    raw,
    query,
    qty,
    food,
    amount: food ? Math.round(resolveAmount(qty, food) * 10) / 10 : undefined,
    score: top?.score ?? 0,
    alternatives: ranked.map((r) => r.food).filter((f) => f !== food),
  };
}

export function parseQuickText(text: string, foods: Food[]): ParsedLine[] {
  return splitItems(text).map((item) => parseLine(item, foods));
}
