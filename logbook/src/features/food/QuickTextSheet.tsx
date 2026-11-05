import { mealForTime, minutesOfDay } from '../../lib/dates';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Food } from '../../db/types';
import { useSettings } from '../../db/hooks';
import { parseQuickText, parseLine, resolveAmount, parseQuantity } from '../../lib/parser';
import { loadCiqual } from '../../lib/ciqual';
import { forAmount, fmtKcal, sum } from '../../lib/macros';
import { logMany, logRecipe, saveFood, saveRecipe } from '../../db/actions';
import { matchRecipeLines, parseRecipeJson } from '../../lib/recipeJson';
import { uid } from '../../lib/id';
import type { Nutrients, Recipe } from '../../db/types';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { Button, IconButton, Label, Sheet } from '../../components/ui';
import { MacroLine, NutrientGrid, emptyFood, FoodEditor } from './parts';
import { FoodSearch } from './FoodSearch';
import { persistIfNeeded } from './AddFoodSheet';

interface Row {
  raw: string;
  food?: Food;
  amount: number;
  alternatives: Food[];
}

type View = { v: 'type' } | { v: 'confirm' } | { v: 'pick'; index: number } | { v: 'create'; index: number; name: string };

export function QuickTextSheet({ mealId }: { mealId: string }) {
  const t = useT();
  const { close, notify, day } = useUI();
  const settings = useSettings();
  const meal = settings.meals.find((m) => m.id === mealId) ?? mealForTime(settings.meals, minutesOfDay(new Date(), settings.timezone));
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [view, setView] = useState<View>({ v: 'type' });
  // Set when the text was a recipe pasted as JSON
  const [recipe, setRecipe] = useState<{ name: string; servings: number; stated?: Nutrients } | null>(null);

  async function parse() {
    const generic = await loadCiqual(useUI.getState().lang);
    const json = parseRecipeJson(text);
    if (json) {
      setRecipe({ name: json.name, servings: json.servings, stated: json.stated });
      setRows(matchRecipeLines(json.lines, foods, generic).map((r) => ({ raw: r.raw, food: r.food, amount: r.amount, alternatives: r.alternatives })));
      setView({ v: 'confirm' });
      return;
    }
    setRecipe(null);
    // My foods first; anything unmatched is tried against the generic table.
    const lines = parseQuickText(text, foods).map((l) => (l.food || !generic.length ? l : parseLine(l.raw, generic)));
    setRows(lines.map((l) => ({ raw: l.raw, food: l.food, amount: l.amount ?? 0, alternatives: l.alternatives })));
    setView({ v: 'confirm' });
  }

  function setFood(index: number, food: Food) {
    setRows((rs) =>
      rs.map((r, i) => (i === index ? { ...r, food, amount: r.amount > 0 && r.food ? r.amount : resolveAmount(parseQuantity(r.raw).qty, food) } : r)),
    );
    setView({ v: 'confirm' });
  }

  const matched = rows.filter((r) => r.food && r.amount > 0);
  const total = sum(matched.map((r) => forAmount(r.food!, r.amount)));
  const allMatched = rows.length > 0 && matched.length === rows.length;

  /** Saves the pasted recipe to my recipes (ingredients stay editable later). */
  async function saveAsRecipe(): Promise<Recipe> {
    const items = [];
    for (const r of matched) items.push({ foodId: (await persistIfNeeded(r.food!)).id, amount: r.amount });
    const now = Date.now();
    const rec: Recipe = { id: `recipe-${uid()}`, name: recipe?.name.trim() || t('Recipe'), items, createdAt: now, updatedAt: now };
    await saveRecipe(rec);
    return rec;
  }

  async function logAndSave() {
    const rec = await saveAsRecipe();
    // Ingredients are for the whole recipe; log one serving.
    await logRecipe(rec, day, meal.id, 1 / (recipe?.servings ?? 1));
    haptic('success');
    notify(`${t('Added')} · ${rec.name}`);
    close();
  }

  async function save() {
    const items = [];
    for (const r of matched) items.push({ food: await persistIfNeeded(r.food!), amount: r.amount });
    await logMany(items, day, meal.id);
    haptic('success');
    notify(`${t('Added')} · ${items.length}`);
    close();
  }

  if (view.v === 'pick') {
    return (
      <Sheet title={t('Choose food')} onClose={() => setView({ v: 'confirm' })} tall>
        {rows[view.index].alternatives.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {rows[view.index].alternatives.map((f) => (
              <Button key={f.id} size="sm" onClick={() => setFood(view.index, f)}>
                {f.name}
              </Button>
            ))}
          </div>
        )}
        <FoodSearch onPick={(f) => setFood(view.index, f)} onCreate={(name) => setView({ v: 'create', index: view.index, name })} />
      </Sheet>
    );
  }
  if (view.v === 'create') {
    return (
      <Sheet title={t('Create food')} onClose={() => setView({ v: 'confirm' })} tall>
        <FoodEditor
          initial={emptyFood(view.name)}
          onSave={async (f) => {
            const saved = await saveFood(f);
            setFood(view.index, saved);
          }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      title={t('Quick text')}
      onClose={close}
      tall
      footer={
        view.v === 'type' ? (
          <Button variant="primary" size="lg" className="w-full" disabled={!text.trim()} onClick={parse}>
            {t('Done')}
          </Button>
        ) : (
          recipe ? (
            <div className="flex gap-2">
              <Button
                disabled={!allMatched}
                onClick={async () => {
                  const rec = await saveAsRecipe();
                  haptic('success');
                  notify(`${t('Saved')} · ${rec.name}`);
                  close();
                }}
              >
                {t('Save recipe')}
              </Button>
              <Button variant="primary" size="lg" className="flex-1" disabled={!allMatched} onClick={logAndSave}>
                {recipe.servings > 1 ? t('Log 1 serving & save') : t('Log & save recipe')}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => setView({ v: 'type' })}>{t('Back')}</Button>
              <Button variant="primary" size="lg" className="flex-1" disabled={!allMatched} onClick={save}>
                {t('Log {n} items', { n: matched.length })}
              </Button>
            </div>
          )
        )
      }
    >
      {view.v === 'type' ? (
        <div className="pt-1">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="3 eggs, 1 tsp olive oil, 150g skyr"
            rows={5}
            className="field !min-h-40 resize-none !py-4 text-[17px] leading-relaxed"
          />
          <div className="mt-3 text-[13px] leading-relaxed text-ink-3">
            {t('Type what you ate')} · {t('Add to {meal}', { meal: meal.name })}
          </div>
          <div className="mt-1 text-[13px] leading-relaxed text-ink-3">{t('You can also paste a recipe in JSON (name, ingredients with g, tsp or count).')} {t('For pasta and rice, write “cooked” or “dry”.')}</div>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {recipe && (
            <div className="space-y-2">
              <input
                className="field display !text-[20px]"
                value={recipe.name}
                onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
                aria-label={t('Recipe name')}
              />
              {recipe.stated && <StatedCompare stated={recipe.stated} computed={total} servings={recipe.servings} />}
            </div>
          )}
          <div className="rounded-2xl border border-line p-4">
            <div className="mb-4 flex items-baseline justify-between">
              <Label>{t('Total')}</Label>
              <div>
                <span className="numeral text-[34px]">{fmtKcal(total.kcal)}</span>
                <span className="ml-1 text-[13px] text-ink-3">kcal</span>
              </div>
            </div>
            <NutrientGrid n={total} />
          </div>
          <div>
            {rows.map((r, i) => {
              const n = r.food ? forAmount(r.food, r.amount) : undefined;
              return (
                <div key={i} className="flex items-center gap-2 border-b border-line py-3 last:border-b-0">
                  <button className="tap min-w-0 flex-1 text-left" onClick={() => setView({ v: 'pick', index: i })}>
                    <div className="truncate text-[11px] uppercase tracking-[0.1em] text-ink-3">{r.raw}</div>
                    {r.food ? (
                      <>
                        <div className="mt-1 truncate text-[15px]">{r.food.name}</div>
                        <div className="mt-0.5 text-[12px] text-ink-3">
                          {fmtKcal(n!.kcal)} kcal · <MacroLine n={n!} />
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-[14px] text-ink-2 underline decoration-line-strong underline-offset-4">
                        {t('No match. Tap to choose.')}
                      </div>
                    )}
                  </button>
                  {r.food && (
                    <label className="flex shrink-0 items-baseline gap-1 rounded-xl border border-line bg-bg px-3">
                      <input
                        inputMode="decimal"
                        value={r.amount}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = Number(e.target.value.replace(',', '.'));
                          setRows((rs) => rs.map((x, j) => (j === i ? { ...x, amount: Number.isFinite(v) ? v : 0 } : x)));
                        }}
                        className="h-12 w-16 bg-transparent text-right tabular-nums outline-none"
                      />
                      <span className="text-[12px] text-ink-3">{r.food.unit}</span>
                    </label>
                  )}
                  <IconButton icon="close" label={t('Delete')} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="-mr-3" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** "Your recipe says 880 kcal" next to what my foods add up to, so I can spot a wrong match. */
function StatedCompare({ stated, computed, servings }: { stated: Nutrients; computed: Nutrients; servings: number }) {
  const t = useT();
  const per = { kcal: computed.kcal / servings, protein: computed.protein / servings, carbs: computed.carbs / servings, fat: computed.fat / servings };
  const off = Math.abs(per.kcal - stated.kcal) / Math.max(1, stated.kcal);
  return (
    <div className="tile px-4 py-3 text-[13px] leading-relaxed text-ink-2">
      <div>
        {t('Recipe says')}: <b className="font-semibold text-ink">{Math.round(stated.kcal)} kcal</b> · P {Math.round(stated.protein)} · C {Math.round(stated.carbs)} · F {Math.round(stated.fat)}
      </div>
      <div>
        {t('My foods give')}: <b className="font-semibold text-ink">{Math.round(per.kcal)} kcal</b> · P {Math.round(per.protein)} · C {Math.round(per.carbs)} · F {Math.round(per.fat)}
        {servings > 1 ? ` (${t('per serving')})` : ''}
      </div>
      <div className={`mt-1 text-[12px] ${off > 0.1 ? 'text-peach-ink' : 'text-olive-ink'}`}>
        {off > 0.1 ? t('More than 10% apart: check the matches below.') : t('Close match. Small gaps come from different food tables.')}
      </div>
    </div>
  );
}
