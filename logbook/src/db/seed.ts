import type { Food, Nutrients, Recipe, Unit } from './types';

/**
 * Starter foods. All values are estimates and editable in the app.
 * Portion amounts (g/ml) are approximations used to convert to per-100 values.
 */
interface SeedFood {
  id: string;
  name: string;
  brand?: string;
  unit?: Unit;
  basis: 'per100' | 'portion';
  n: Nutrients;
  portion?: { label: string; amount: number };
  measures?: Record<string, number>;
  isOil?: boolean;
  aliases?: string[];
}

const SEED: SeedFood[] = [
  {
    id: 'seed-egg-boiled',
    name: 'Large boiled egg',
    basis: 'portion',
    n: { kcal: 70, protein: 6, fat: 5, carbs: 0.5 },
    portion: { label: '1 egg', amount: 50 },
    aliases: ['egg', 'eggs', 'boiled egg', 'oeuf', 'oeufs', 'oeuf dur'],
  },
  {
    id: 'seed-skyr',
    name: 'Plain skyr',
    basis: 'per100',
    n: { kcal: 60, protein: 10.5, fat: 0.2, carbs: 4, sugar: 4 },
    portion: { label: '1 pot', amount: 150 },
    measures: { tbsp: 20 },
    aliases: ['skyr', 'skyr nature'],
  },
  {
    id: 'seed-skyr-boire-vanille',
    name: 'Skyr à Boire vanille',
    brand: 'Danone',
    basis: 'portion',
    n: { kcal: 160, protein: 15, fat: 0.5, carbs: 21, sugar: 20 },
    portion: { label: '1 bottle', amount: 270 },
    aliases: ['skyr a boire', 'skyr drink vanilla', 'skyr vanille'],
  },
  {
    id: 'seed-siggis-mangue',
    name: "Siggi's skyr drink mangue-passion",
    brand: "Siggi's",
    basis: 'portion',
    n: { kcal: 160, protein: 21, fat: 3.5, carbs: 21, sugar: 18 },
    portion: { label: '1 bottle', amount: 280 },
    aliases: ['siggis', 'siggi', 'skyr drink mango', 'siggis mangue'],
  },
  {
    id: 'seed-chicken-rotisserie',
    name: 'Rotisserie chicken breast',
    basis: 'per100',
    n: { kcal: 165, protein: 31, fat: 3.5, carbs: 0 },
    portion: { label: '1 breast', amount: 150 },
    aliases: ['chicken', 'chicken breast', 'poulet', 'blanc de poulet', 'poulet roti'],
  },
  {
    id: 'seed-mache',
    name: 'Mâche',
    basis: 'per100',
    n: { kcal: 14, protein: 1.5, fat: 0, carbs: 2, fiber: 1.5 },
    portion: { label: '1 bowl', amount: 80 },
    aliases: ['mache', 'lambs lettuce', 'salad', 'salade', 'greens'],
  },
  {
    id: 'seed-olive-oil',
    name: 'Olive oil',
    unit: 'ml',
    basis: 'portion',
    n: { kcal: 120, protein: 0, fat: 14, carbs: 0 },
    portion: { label: '1 tbsp', amount: 13.5 },
    measures: { tbsp: 13.5, tsp: 4.5 },
    isOil: true,
    aliases: ['oil', 'huile', "huile d'olive", 'huile olive', 'evoo'],
  },
  {
    id: 'seed-parmesan',
    name: 'Parmesan',
    basis: 'portion',
    n: { kcal: 40, protein: 3.5, fat: 2.7, carbs: 0.3 },
    portion: { label: '10 g', amount: 10 },
    measures: { tbsp: 5 },
    aliases: ['parmigiano', 'parmesan rape'],
  },
  {
    id: 'seed-emmental',
    name: 'Emmental',
    basis: 'portion',
    n: { kcal: 38, protein: 2.8, fat: 3, carbs: 0 },
    portion: { label: '10 g', amount: 10 },
    aliases: ['emmental rape', 'gruyere', 'cheese', 'fromage rape'],
  },
  {
    id: 'seed-chickpeas',
    name: 'Cooked chickpeas',
    basis: 'per100',
    n: { kcal: 165, protein: 9, fat: 2.6, carbs: 27, fiber: 7.6 },
    portion: { label: '1/2 cup', amount: 80 },
    measures: { tbsp: 15 },
    aliases: ['chickpeas', 'pois chiches', 'pois chiche'],
  },
  {
    id: 'seed-beetroot',
    name: 'Cooked beetroot',
    basis: 'per100',
    n: { kcal: 40, protein: 1.5, fat: 0, carbs: 9, fiber: 2, sugar: 7 },
    portion: { label: '1 beet', amount: 100 },
    aliases: ['beetroot', 'beet', 'betterave', 'betteraves'],
  },
  {
    id: 'seed-peas',
    name: 'Green peas',
    basis: 'per100',
    n: { kcal: 80, protein: 5.5, fat: 0.5, carbs: 14, fiber: 5, sugar: 5 },
    portion: { label: '1 serving', amount: 80 },
    aliases: ['peas', 'petits pois', 'petit pois'],
  },
  {
    id: 'seed-honey',
    name: 'Honey',
    basis: 'portion',
    n: { kcal: 20, protein: 0, fat: 0, carbs: 5.5, sugar: 5.5 },
    portion: { label: '1 tsp', amount: 7 },
    measures: { tsp: 7, tbsp: 21 },
    aliases: ['miel'],
  },
  {
    id: 'seed-muesli-nuts',
    name: 'Muesli / granola with nuts',
    basis: 'per100',
    n: { kcal: 450, protein: 10, fat: 18, carbs: 60, fiber: 7, sugar: 20 },
    portion: { label: '1 bowl', amount: 45 },
    measures: { tbsp: 10 },
    aliases: ['muesli', 'granola'],
  },
  {
    id: 'seed-cruesli-choc',
    name: 'Cruesli chocolat au lait',
    brand: 'Quaker',
    basis: 'per100',
    n: { kcal: 450, protein: 8, fat: 15, carbs: 68, fiber: 6, sugar: 20 },
    portion: { label: '1 bowl', amount: 45 },
    aliases: ['cruesli', 'cruesli chocolat'],
  },
  {
    id: 'seed-sodebo-manhattan',
    name: 'Salade & Compagnie Manhattan',
    brand: 'Sodebo',
    basis: 'portion',
    n: { kcal: 595, protein: 27, fat: 28, carbs: 54 },
    portion: { label: '1 box', amount: 320 },
    aliases: ['sodebo', 'manhattan', 'salade compagnie'],
  },
  {
    id: 'seed-pago-ace',
    name: 'ACE juice',
    brand: 'Pago',
    unit: 'ml',
    basis: 'portion',
    n: { kcal: 115, protein: 0, fat: 0, carbs: 28, sugar: 27 },
    portion: { label: '1 bottle', amount: 250 },
    aliases: ['pago', 'ace', 'jus ace', 'juice'],
  },
  {
    id: 'seed-beer-grizzly',
    name: 'Beer Grizzly 8%',
    unit: 'ml',
    basis: 'portion',
    n: { kcal: 210, protein: 0, fat: 0, carbs: 15 },
    portion: { label: '25 cl', amount: 250 },
    aliases: ['beer', 'biere', 'grizzly'],
  },
  {
    id: 'seed-baton-berger',
    name: 'Mini bâton de berger noisette',
    brand: 'Justin Bridou',
    basis: 'portion',
    n: { kcal: 390, protein: 19, fat: 33, carbs: 2 },
    portion: { label: '1 pack', amount: 80 },
    aliases: ['baton de berger', 'justin bridou', 'saucisson'],
  },
  {
    id: 'seed-amandine',
    name: 'Amandine bourdaloue',
    basis: 'portion',
    n: { kcal: 380, protein: 6, fat: 22, carbs: 42 },
    portion: { label: '1 pastry', amount: 110 },
    aliases: ['amandine', 'bourdaloue', 'tarte amandine'],
  },
  {
    id: 'seed-mini-pac',
    name: 'Mini pain au chocolat',
    basis: 'portion',
    n: { kcal: 155, protein: 3, fat: 8.5, carbs: 17.5 },
    portion: { label: '1 piece', amount: 38 },
    aliases: ['pain au chocolat', 'chocolatine', 'mini pain au chocolat'],
  },
];

export function seedFoods(now = Date.now()): Food[] {
  return SEED.map((s) => ({
    id: s.id,
    name: s.name,
    brand: s.brand,
    unit: s.unit ?? 'g',
    basis: s.basis,
    nutrients: s.n,
    portion: s.portion,
    measures: s.measures,
    isOil: s.isOil,
    aliases: s.aliases,
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  }));
}

export function seedRecipes(now = Date.now()): Recipe[] {
  return [
    {
      id: 'seed-recipe-salad',
      name: 'My usual salad',
      items: [
        { foodId: 'seed-mache', amount: 80 },
        { foodId: 'seed-chicken-rotisserie', amount: 150 },
        { foodId: 'seed-beetroot', amount: 100 },
        { foodId: 'seed-chickpeas', amount: 80 },
        { foodId: 'seed-olive-oil', amount: 13.5 },
      ],
      favorite: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
