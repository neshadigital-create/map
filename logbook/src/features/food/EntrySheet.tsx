import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSettings } from '../../db/hooks';
import { deleteEntry, updateEntry } from '../../db/actions';
import { fmtKcal, scale } from '../../lib/macros';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { Button, Label, Segmented, Sheet, Stepper } from '../../components/ui';
import { NutrientGrid, portionChips } from './parts';

/** Edit an entry's amount (oil and dressing in 1 g steps), move it to another meal, or delete it. */
export function EntrySheet({ entryId }: { entryId: string }) {
  const t = useT();
  const { close, notify } = useUI();
  const settings = useSettings();
  const entry = useLiveQuery(() => db.entries.get(entryId), [entryId]);
  const food = useLiveQuery(async () => (entry?.foodId ? db.foods.get(entry.foodId) : undefined), [entry?.foodId]);
  const [amount, setAmount] = useState<number | null>(null);
  const [mealId, setMealId] = useState<string | null>(null);

  useEffect(() => {
    if (entry && amount === null) {
      setAmount(entry.amount);
      setMealId(entry.mealId);
    }
  }, [entry, amount]);

  if (!entry || amount === null) return null;
  const n = scale(entry.per100, amount / 100);
  const chips = food ? portionChips(food) : [];
  const step = entry.isOil ? 1 : amount >= 100 ? 10 : 5;

  return (
    <Sheet
      title={entry.name}
      onClose={close}
      footer={
        <div className="flex gap-2">
          <Button
            variant="danger"
            icon="trash"
            onClick={async () => {
              await deleteEntry(entry.id);
              haptic();
              notify(t('Deleted'));
              close();
            }}
          >
            {t('Delete')}
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={!(amount > 0)}
            onClick={async () => {
              await updateEntry(entry.id, { amount, mealId: mealId ?? entry.mealId });
              haptic('success');
              close();
            }}
          >
            {t('Save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pt-2">
        {entry.recipeName && <Label className="text-center">{entry.recipeName}</Label>}
        <div className="text-center">
          <div className="numeral text-[64px]">{fmtKcal(n.kcal)}</div>
          <Label className="mt-2">kcal</Label>
        </div>
        <NutrientGrid n={n} />
        <Stepper value={amount} onChange={setAmount} step={step} unit={entry.unit} large />
        {chips.length > 0 && (
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {chips.map((c) => (
              <button
                key={c.label}
                onClick={() => {
                  haptic();
                  setAmount(c.amount);
                }}
                className={`tap min-h-10 shrink-0 rounded-full border px-4 text-[13px] ${Math.abs(c.amount - amount) < 0.01 ? 'border-accent' : 'border-line text-ink-2'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div>
          <Label className="mb-2">{t('Move to')}</Label>
          <Segmented value={mealId ?? entry.mealId} onChange={setMealId} options={settings.meals.map((m) => ({ value: m.id, label: m.name }))} />
        </div>
      </div>
    </Sheet>
  );
}
