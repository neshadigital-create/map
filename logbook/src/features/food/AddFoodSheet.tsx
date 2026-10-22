import { useState } from 'react';
import type { Food } from '../../db/types';
import { useSettings } from '../../db/hooks';
import { db } from '../../db';
import { deleteFood, logFood, saveFood } from '../../db/actions';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { hasNutrition } from '../../lib/off';
import { Button, IconButton, Sheet } from '../../components/ui';
import { AmountPanel, FoodEditor, emptyFood } from './parts';
import { FoodSearch } from './FoodSearch';

type View = { v: 'search' } | { v: 'amount'; food: Food } | { v: 'edit'; food: Food; isNew: boolean };

/** Ensures a food from Open Food Facts is stored locally before logging it. */
export async function persistIfNeeded(food: Food): Promise<Food> {
  const existing = await db.foods.get(food.id);
  if (existing) return existing;
  return saveFood(food);
}

export function AddFoodSheet({ mealId, initialFood }: { mealId: string; initialFood?: Food }) {
  const t = useT();
  const { close, open, notify, day } = useUI();
  const settings = useSettings();
  const meal = settings.meals.find((m) => m.id === mealId) ?? settings.meals[0];
  const [view, setView] = useState<View>(initialFood ? { v: 'amount', food: initialFood } : { v: 'search' });

  const title =
    view.v === 'search' ? t('Add to {meal}', { meal: meal.name }) : view.v === 'amount' ? view.food.name : view.isNew ? t('Create food') : t('Edit food');

  async function add(food: Food, amount: number) {
    const stored = await persistIfNeeded(food);
    await logFood(stored, amount, day, meal.id);
    haptic('success');
    notify(`${t('Added')} · ${stored.name}`);
    setView({ v: 'search' });
  }

  return (
    <Sheet
      title={title}
      onClose={close}
      tall
      right={
        view.v === 'amount' ? (
          <IconButton icon="edit" label={t('Edit food')} onClick={() => setView({ v: 'edit', food: view.food, isNew: false })} />
        ) : view.v !== 'search' ? (
          <Button variant="ghost" size="sm" onClick={() => setView({ v: 'search' })}>
            {t('Back')}
          </Button>
        ) : null
      }
    >
      {view.v === 'search' && (
        <FoodSearch
          onPick={(food) => setView({ v: 'amount', food })}
          onCreate={(name) => setView({ v: 'edit', food: emptyFood(name), isNew: true })}
          header={
            <div className="mb-2 grid grid-cols-4 gap-2">
              <QuickAction label={t('Quick text')} icon="text" onClick={() => open({ kind: 'quick', mealId: meal.id })} />
              <QuickAction label={t('Scan')} icon="barcode" onClick={() => open({ kind: 'scan', mealId: meal.id })} />
              <QuickAction label={t('Recipes')} icon="book" onClick={() => open({ kind: 'recipes', mealId: meal.id })} />
              <QuickAction label={t('Manual entry')} icon="edit" onClick={() => setView({ v: 'edit', food: emptyFood(), isNew: true })} />
            </div>
          }
        />
      )}
      {view.v === 'amount' && (
        <div className="pt-2">
          {view.food.source === 'off' && !hasNutrition(view.food) && (
            <div className="mb-4 text-center text-[13px] text-ink-3">{t('Missing nutrition data, please check values')}</div>
          )}
          <AmountPanel key={view.food.id + view.food.updatedAt} food={view.food} confirmLabel={t('Add to {meal}', { meal: meal.name })} onConfirm={(a) => add(view.food, a)} />
        </div>
      )}
      {view.v === 'edit' && (
        <div className="pt-2">
          <FoodEditor
            initial={view.food}
            onSave={async (f) => {
              const saved = await saveFood({ ...f, source: f.source === 'off' ? 'off' : f.source });
              notify(t('Saved'));
              setView({ v: 'amount', food: saved });
            }}
            onDelete={
              view.isNew
                ? undefined
                : async () => {
                    await deleteFood(view.food.id);
                    notify(t('Deleted'));
                    setView({ v: 'search' });
                  }
            }
          />
        </div>
      )}
    </Sheet>
  );
}

function QuickAction({ label, icon, onClick }: { label: string; icon: 'text' | 'barcode' | 'book' | 'edit'; onClick: () => void }) {
  return (
    <Button variant="secondary" className="!min-h-18 !flex-col !gap-1.5 !rounded-2xl !px-1 !text-[11px]" icon={icon} onClick={onClick}>
      <span className="truncate">{label}</span>
    </Button>
  );
}
