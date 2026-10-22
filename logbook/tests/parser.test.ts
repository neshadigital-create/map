import { describe, expect, it } from 'vitest';
import { parseQuickText, parseQuantity, splitItems, normalize } from '../src/lib/parser';
import { seedFoods } from '../src/db/seed';

const foods = seedFoods(0);

describe('quantity parsing', () => {
  it.each([
    ['3 eggs', 3, 'portion', 'eggs'],
    ['150g skyr', 150, 'g', 'skyr'],
    ['150 g skyr', 150, 'g', 'skyr'],
    ['1 tsp olive oil', 1, 'tsp', 'olive oil'],
    ['2 tbsp parmesan', 2, 'tbsp', 'parmesan'],
    ['1,5 cs huile d’olive', 1.5, 'tbsp', "huile d'olive"],
    ['1/2 cup chickpeas', 0.5, 'cup', 'chickpeas'],
    ['½ bottle pago', 0.5, 'portion', 'pago'],
    ['25 cl beer', 250, 'ml', 'beer'],
    ['a boiled egg', 1, 'portion', 'boiled egg'],
    ['deux oeufs', 2, 'portion', 'oeufs'],
    ['skyr 200g', 200, 'g', 'skyr'],
    ['chicken x2', 2, 'portion', 'chicken'],
    ['100g de poulet', 100, 'g', 'poulet'],
    ['mache', 1, 'portion', 'mache'],
    ['2 granola', 2, 'portion', 'granola'],
  ])('%s', (input, q, unit, query) => {
    const { qty, query: got } = parseQuantity(input);
    expect(qty.quantity * qty.factor).toBeCloseTo(q);
    expect(qty.unit).toBe(unit);
    expect(got).toBe(query);
  });

  it('does not eat "de" from words like dessert', () => {
    expect(parseQuantity('1 dessert').query).toBe('dessert');
  });
});

describe('splitting', () => {
  it('splits on commas, plus, and, et, newlines', () => {
    expect(splitItems('3 eggs, 1 tsp olive oil + 150g skyr and honey\nmache et peas')).toEqual([
      '3 eggs',
      '1 tsp olive oil',
      '150g skyr',
      'honey',
      'mache',
      'peas',
    ]);
  });
  it('normalizes accents and ligatures', () => {
    expect(normalize('Œuf  Mâche')).toBe('oeuf mache');
  });
});

describe('quick text matching', () => {
  it('parses the example sentence', () => {
    const lines = parseQuickText('3 eggs, 1 tsp olive oil, 150g skyr', foods);
    expect(lines.map((l) => l.food?.id)).toEqual(['seed-egg-boiled', 'seed-olive-oil', 'seed-skyr']);
    expect(lines.map((l) => l.amount)).toEqual([150, 4.5, 150]);
  });

  it('matches French names and aliases', () => {
    const lines = parseQuickText('2 oeufs, 100g poulet, 1 cs huile olive, betterave 80g', foods);
    expect(lines.map((l) => l.food?.id)).toEqual([
      'seed-egg-boiled',
      'seed-chicken-rotisserie',
      'seed-olive-oil',
      'seed-beetroot',
    ]);
    expect(lines[2].amount).toBe(13.5);
    expect(lines[3].amount).toBe(80);
  });

  it('prefers the exact skyr over skyr drinks', () => {
    expect(parseQuickText('skyr', foods)[0].food?.id).toBe('seed-skyr');
    expect(parseQuickText('skyr a boire', foods)[0].food?.id).toBe('seed-skyr-boire-vanille');
  });

  it('uses portion size for counts', () => {
    const [l] = parseQuickText('2 mini pain au chocolat', foods);
    expect(l.food?.id).toBe('seed-mini-pac');
    expect(l.amount).toBe(76);
  });

  it('leaves unknown items unmatched', () => {
    const [l] = parseQuickText('200g quinoa', foods);
    expect(l.food).toBeUndefined();
    expect(l.qty.quantity).toBe(200);
  });
});

import { offToFood } from '../src/lib/off';
describe('Open Food Facts mapping', () => {
  it('maps a product to a per-100 food with a portion', () => {
    const f = offToFood({
      code: '3033490004743',
      product_name_fr: 'Skyr nature',
      brands: 'Danone, Skyr',
      quantity: '4 x 150 g',
      serving_size: '150 g',
      serving_quantity: '150',
      nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, fat_100g: 0.2, carbohydrates_100g: 4, sugars_100g: 4 },
    })!;
    expect(f).toMatchObject({ id: 'off-3033490004743', brand: 'Danone', unit: 'g', basis: 'per100', portion: { amount: 150 } });
    expect(f.nutrients.protein).toBe(11);
  });
  it('falls back to kJ and detects ml', () => {
    const f = offToFood({ code: '1', product_name: 'Juice', quantity: '25 cl', product_quantity: 250, nutriments: { energy_100g: 200 } })!;
    expect(f.unit).toBe('ml');
    expect(f.nutrients.kcal).toBe(48);
  });
});
