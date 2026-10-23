import { mealForTime, minutesOfDay } from '../../lib/dates';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Food, Recipe } from '../../db/types';
import { useSettings } from '../../db/hooks';
import { deleteRecipe, logRecipe, saveRecipe } from '../../db/actions';
import { forAmount, fmtKcal, sum } from '../../lib/macros';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { uid } from '../../lib/id';
import { Button, IconButton, Label, Sheet, Stepper, TextField } from '../../components/ui';
import { EmptyNote, MacroLine, NutrientGrid } from './parts';
import { FoodSearch } from './FoodSearch';
import { persistIfNeeded } from './AddFoodSheet';

type View = { v: 'list' } | { v: 'log'; recipe: Recipe } | { v: 'edit'; recipe: Recipe } | { v: 'pick'; recipe: Recipe };

function recipeTotals(r: Recipe, foods: Map<string, Food>) {
  const parts = r.items.map((i) => {
    const f = foods.get(i.foodId);
    return f ? forAmount(f, i.amount) : { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  });
  const grams = r.items.reduce((s, i) => s + i.amount, 0);
  return { n: sum(parts), grams };
}

export function RecipesSheet({ mealId }: { mealId: string }) {
  const t = useT();
  const { close, notify, day } = useUI();
  const settings = useSettings();
  const meal = settings.meals.find((m) => m.id === mealId) ?? mealForTime(settings.meals, minutesOfDay(new Date(), settings.timezone));
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? [];
  const foodsArr = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const foods = useMemo(() => new Map(foodsArr.map((f) => [f.id, f])), [foodsArr]);
  const [view, setView] = useState<View>({ v: 'list' });
  const sorted = [...recipes].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));

  async function quickLog(r: Recipe, factor = 1) {
    await logRecipe(r, day, meal.id, factor);
    haptic('success');
    notify(`${t('Added')} · ${r.name}`);
    close();
  }

  if (view.v === 'pick') {
    return (
      <Sheet title={t('Add ingredient')} onClose={() => setView({ v: 'edit', recipe: view.recipe })} tall>
        <FoodSearch
          onCreate={() => undefined}
          onPick={async (f) => {
            const stored = await persistIfNeeded(f);
            setView({
              v: 'edit',
              recipe: { ...view.recipe, items: [...view.recipe.items, { foodId: stored.id, amount: stored.portion?.amount ?? 100 }] },
            });
          }}
        />
      </Sheet>
    );
  }

  if (view.v === 'edit') {
    return <RecipeEditor recipe={view.recipe} foods={foods} onBack={() => setView({ v: 'list' })} onAdd={(r) => setView({ v: 'pick', recipe: r })} />;
  }

  if (view.v === 'log') {
    return <RecipeLogger recipe={view.recipe} foods={foods} mealName={meal.name} onBack={() => setView({ v: 'list' })} onLog={(f) => quickLog(view.recipe, f)} />;
  }

  return (
    <Sheet
      title={t('Recipes')}
      onClose={close}
      tall
      footer={
        <Button
          icon="plus"
          size="lg"
          className="w-full"
          onClick={() => setView({ v: 'edit', recipe: { id: `recipe-${uid()}`, name: '', items: [], createdAt: Date.now(), updatedAt: Date.now() } })}
        >
          {t('New recipe')}
        </Button>
      }
    >
      {sorted.length === 0 && <EmptyNote>—</EmptyNote>}
      {sorted.map((r) => {
        const { n, grams } = recipeTotals(r, foods);
        return (
          <div key={r.id} className="flex items-center gap-1 border-b border-line py-2 last:border-b-0">
            <button className="tap min-w-0 flex-1 py-2 text-left" onClick={() => setView({ v: 'log', recipe: r })}>
              <div className="truncate text-[15px]">{r.name}</div>
              <div className="mt-1 text-[12px] text-ink-3">
                {fmtKcal(n.kcal)} kcal · {Math.round(grams)} g · <MacroLine n={n} />
              </div>
            </button>
            <IconButton icon="edit" label={t('Edit recipe')} onClick={() => setView({ v: 'edit', recipe: r })} />
            <Button variant="primary" size="sm" icon="plus" onClick={() => quickLog(r)} aria-label={t('Log recipe')} className="!px-3" />
          </div>
        );
      })}
    </Sheet>
  );
}

function RecipeLogger({
  recipe,
  foods,
  mealName,
  onBack,
  onLog,
}: {
  recipe: Recipe;
  foods: Map<string, Food>;
  mealName: string;
  onBack: () => void;
  onLog: (factor: number) => void;
}) {
  const t = useT();
  const base = recipeTotals(recipe, foods);
  const [grams, setGrams] = useState(Math.round(base.grams));
  const factor = base.grams > 0 ? grams / base.grams : 1;
  const n = { ...base.n, kcal: base.n.kcal * factor, protein: base.n.protein * factor, carbs: base.n.carbs * factor, fat: base.n.fat * factor, fiber: (base.n.fiber ?? 0) * factor, sugar: (base.n.sugar ?? 0) * factor };
  return (
    <Sheet title={recipe.name} onClose={onBack} tall>
      <div className="space-y-6 pt-2">
        <div className="text-center">
          <div className="numeral text-[64px]">{fmtKcal(n.kcal)}</div>
          <Label className="mt-2">kcal</Label>
        </div>
        <NutrientGrid n={n} />
        <Stepper value={grams} onChange={setGrams} step={10} unit="g" large decimals={0} />
        <div className="flex gap-2">
          {[0.5, 0.75, 1, 1.5].map((f) => (
            <button
              key={f}
              onClick={() => setGrams(Math.round(base.grams * f))}
              className={`tap min-h-10 flex-1 rounded-full border text-[13px] ${Math.abs(factor - f) < 0.01 ? 'border-accent' : 'border-line text-ink-2'}`}
            >
              ×{f}
            </button>
          ))}
        </div>
        <div>
          {recipe.items.map((i, k) => {
            const f = foods.get(i.foodId);
            if (!f) return null;
            return (
              <div key={k} className="flex justify-between border-b border-line py-2.5 text-[13px] last:border-b-0">
                <span className={f.isOil ? 'text-fat' : 'text-ink-2'}>{f.name}</span>
                <span className="tabular-nums text-ink-3">
                  {Math.round(i.amount * factor * 10) / 10} {f.unit} · {fmtKcal(forAmount(f, i.amount * factor).kcal)} kcal
                </span>
              </div>
            );
          })}
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={() => onLog(factor)}>
          {t('Add to {meal}', { meal: mealName })}
        </Button>
      </div>
    </Sheet>
  );
}

function RecipeEditor({
  recipe,
  foods,
  onBack,
  onAdd,
}: {
  recipe: Recipe;
  foods: Map<string, Food>;
  onBack: () => void;
  onAdd: (r: Recipe) => void;
}) {
  const t = useT();
  const notify = useUI((s) => s.notify);
  const [r, setR] = useState(recipe);
  const exists = useLiveQuery(() => db.recipes.get(recipe.id).then(Boolean), [recipe.id]);
  const { n, grams } = recipeTotals(r, foods);
  return (
    <Sheet
      title={recipe.name ? t('Edit recipe') : t('New recipe')}
      onClose={onBack}
      tall
      footer={
        <div className="flex gap-2">
          {exists ? (
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                await deleteRecipe(r.id);
                notify(t('Deleted'));
                onBack();
              }}
            />
          ) : null}
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={!r.name.trim() || r.items.length === 0}
            onClick={async () => {
              await saveRecipe({ ...r, name: r.name.trim() });
              notify(t('Saved'));
              onBack();
            }}
          >
            {t('Save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pt-1">
        <TextField label={t('Recipe name')} value={r.name} onChange={(name) => setR({ ...r, name })} />
        <div className="flex items-baseline justify-between">
          <Label>{t('Total')}</Label>
          <div className="text-[13px] text-ink-2">
            {fmtKcal(n.kcal)} kcal · {Math.round(grams)} g · <MacroLine n={n} />
          </div>
        </div>
        <div>
          {r.items.map((i, k) => {
            const f = foods.get(i.foodId);
            return (
              <div key={k} className="flex items-center gap-2 border-b border-line py-2">
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[14px] ${f?.isOil ? 'text-fat' : ''}`}>{f?.name ?? '?'}</div>
                  <div className="text-[12px] text-ink-3">{f ? `${fmtKcal(forAmount(f, i.amount).kcal)} kcal` : ''}</div>
                </div>
                <label className="flex shrink-0 items-baseline gap-1 rounded-xl border border-line bg-bg px-3">
                  <input
                    inputMode="decimal"
                    value={i.amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = Number(e.target.value.replace(',', '.'));
                      setR({ ...r, items: r.items.map((x, j) => (j === k ? { ...x, amount: Number.isFinite(v) ? v : 0 } : x)) });
                    }}
                    className="h-12 w-16 bg-transparent text-right tabular-nums outline-none"
                  />
                  <span className="text-[12px] text-ink-3">{f?.unit ?? 'g'}</span>
                </label>
                <IconButton icon="close" label={t('Delete')} onClick={() => setR({ ...r, items: r.items.filter((_, j) => j !== k) })} className="-mr-3" />
              </div>
            );
          })}
        </div>
        <Button icon="plus" className="w-full" onClick={() => onAdd(r)}>
          {t('Add ingredient')}
        </Button>
      </div>
    </Sheet>
  );
}
