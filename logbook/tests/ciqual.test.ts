import { describe, expect, it } from 'vitest';
import { ciqualToFoods, type CiqualFile } from '../src/lib/ciqual';
import { rankFoods, parseQuickText } from '../src/lib/parser';
import { forAmount } from '../src/lib/macros';

const data: CiqualFile = {
  source: 'test',
  foods: [
    [20020, 'Courgette, pulpe et peau, crue', 'Zucchini, pulp and peel, raw', 17, 1.2, 0.3, 1.4, 1.1, 0],
    [20021, 'Courgette, pulpe et peau, cuite', 'Zucchini, pulp and peel, cooked', 19, 1, 0.4, 2, 1.5, null],
    [26036, 'Saumon, cuit', 'Salmon, cooked', 206, 24.9, 11.8, 0, null, null],
  ],
};

describe('CIQUAL foods', () => {
  it('maps rows to per-100 g foods in the chosen language', () => {
    const fr = ciqualToFoods(data, 'fr');
    expect(fr[2]).toMatchObject({ id: 'ciqual-26036', name: 'Saumon, cuit', aliases: ['Salmon, cooked'], basis: 'per100', source: 'ciqual' });
    expect(fr[2].nutrients.fiber).toBeUndefined();
    expect(ciqualToFoods(data, 'en')[0].name).toBe('Zucchini, pulp and peel, raw');
    expect(forAmount(fr[2], 150).protein).toBeCloseTo(37.35);
  });
  it('is searchable in both languages', () => {
    const en = ciqualToFoods(data, 'en');
    expect(rankFoods('courgette', en)[0].food.id).toMatch(/ciqual-2002/);
    expect(rankFoods('salmon', en)[0].food.id).toBe('ciqual-26036');
  });
  it('feeds quick text when my own foods have no match', () => {
    const [line] = parseQuickText('120g saumon', ciqualToFoods(data, 'en'));
    expect(line.food?.id).toBe('ciqual-26036');
    expect(line.amount).toBe(120);
  });
});
