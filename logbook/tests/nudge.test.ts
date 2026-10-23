import { describe, expect, it } from 'vitest';
import { proteinSuggestion } from '../src/lib/nudge';
import { seedFoods } from '../src/db/seed';

const foods = seedFoods(0);

describe('protein nudge', () => {
  it('suggests a protein-dense portion from my foods', () => {
    expect(proteinSuggestion(foods, 32)!.food.id).toBe('seed-skyr'); // 150 g pot, 16 g, very lean
    expect(proteinSuggestion(foods, 45)!.food.id).toBe('seed-chicken-rotisserie'); // 150 g = 46.5 g
  });
  it('avoids overshooting small gaps', () => {
    const s = proteinSuggestion(foods, 16)!;
    expect(s.protein).toBeLessThanOrEqual(28);
    expect(['seed-skyr', 'seed-siggis-mangue', 'seed-skyr-boire-vanille', 'seed-egg-boiled']).toContain(s.food.id);
  });
  it('stays quiet when nearly there', () => {
    expect(proteinSuggestion(foods, 5)).toBeNull();
  });
});
