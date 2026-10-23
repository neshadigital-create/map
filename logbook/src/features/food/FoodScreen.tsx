import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Entry, Meal } from '../../db/types';
import { useDayEntries, useSettings } from '../../db/hooks';
import { copyMeal, updateSettings } from '../../db/actions';
import { entryNutrients, fmtG, fmtKcal, totals } from '../../lib/macros';
import { addDays, dayKey, fmtDayLabel } from '../../lib/dates';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { Button, Card, IconButton, Label } from '../../components/ui';
import { Bar } from '../../components/Ring';
import { MacroLine } from './parts';

export function FoodScreen() {
  const t = useT();
  const { day, setDay, lang } = useUI();
  const settings = useSettings();
  const today = dayKey(new Date(), settings.timezone);
  const entries = useDayEntries(day);
  const tot = totals(entries);
  const tg = settings.targets;
  const dayTitle = day === today ? t('Today') : day === addDays(today, -1) ? t('Yesterday') : fmtDayLabel(day, lang).split(' ')[0];

  return (
    <div className="space-y-3">
      <header className="flex items-end justify-between px-1 pb-2 pt-1">
        <button className="tap min-w-0 text-left" onClick={() => setDay(today)}>
          <div className="eyebrow mb-2">{fmtDayLabel(day, lang)}</div>
          <h1 className="text-[28px] font-medium capitalize tracking-[-0.02em]">{dayTitle}</h1>
        </button>
        <div className="-mr-2 flex">
          <IconButton icon="chevronLeft" label={t('Yesterday')} onClick={() => setDay(addDays(day, -1))} />
          <IconButton icon="chevronRight" label={t('Tomorrow')} onClick={() => setDay(addDays(day, 1))} disabled={day >= today} className="disabled:opacity-30" />
        </div>
      </header>

      <Card className="p-5">
        <div className="mb-5 flex items-baseline justify-between">
          <Label>{t('Daily totals')}</Label>
          <div>
            <span className="numeral text-[40px]">{fmtKcal(tot.kcal)}</span>
            <span className="ml-1.5 text-[13px] text-ink-3">/ {fmtKcal(tg.kcal)} kcal</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <MacroCell label={t('Protein')} v={tot.protein} max={tg.protein} color="var(--color-protein)" />
          <MacroCell label={t('Carbs')} v={tot.carbs} max={tg.carbs} color="var(--color-carbs)" />
          <MacroCell label={t('Fat')} v={tot.fat} max={tg.fat} color="var(--color-fat)" />
        </div>
        <div className="mt-4 flex gap-6 border-t border-line pt-3.5 text-[12px] text-ink-3">
          <span>
            {t('Fiber')} <span className="tabular-nums text-ink-2">{fmtG(tot.fiber ?? 0)} g</span>
            <span className="text-ink-3"> / {tg.fiber}</span>
          </span>
          <span>
            {t('Sugar')} <span className="tabular-nums text-ink-2">{fmtG(tot.sugar ?? 0)} g</span>
          </span>
        </div>
      </Card>

      {settings.meals.map((m) => (
        <MealCard key={m.id} meal={m} meals={settings.meals} entries={entries.filter((e) => e.mealId === m.id)} day={day} />
      ))}
      {/* Entries whose meal was removed from settings still show up */}
      {entries.some((e) => !settings.meals.find((m) => m.id === e.mealId)) && (
        <MealCard
          meal={{ id: '_other', name: 'Other' }}
          meals={settings.meals}
          entries={entries.filter((e) => !settings.meals.find((m) => m.id === e.mealId))}
          day={day}
          readonly
        />
      )}
      <div className="px-1 pt-1 text-center text-[12px] text-ink-3">{t('Tap a meal name to rename it.')}</div>
    </div>
  );
}

function MacroCell({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  return (
    <div>
      <div className="numeral mb-1 text-[26px]">
        {fmtG(v)}
        <span className="ml-1 text-[12px] tracking-normal text-ink-3">/ {max}</span>
      </div>
      <Label className="mb-2.5">{label}</Label>
      <Bar value={v} max={max} color={color} />
    </div>
  );
}

function MealCard({ meal, meals, entries, day, readonly }: { meal: Meal; meals: Meal[]; entries: Entry[]; day: string; readonly?: boolean }) {
  const t = useT();
  const { open, notify } = useUI();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(meal.name);
  const tot = totals(entries);
  const oil = entries.filter((e) => e.isOil);
  const oilTot = totals(oil);
  const yesterday = addDays(day, -1);
  const yCount = useLiveQuery(() => db.entries.where('[day+mealId]').equals([yesterday, meal.id]).count(), [yesterday, meal.id]) ?? 0;

  // Group recipe items under their recipe name, keep logging order.
  const blocks = useMemo(() => {
    const out: { key: string; title?: string; items: Entry[] }[] = [];
    for (const e of entries) {
      const last = out[out.length - 1];
      if (e.recipeName && e.groupId && last?.key === e.groupId) last.items.push(e);
      else out.push({ key: e.recipeName && e.groupId ? e.groupId : e.id, title: e.recipeName, items: [e] });
    }
    return out;
  }, [entries]);

  async function saveName() {
    setRenaming(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === meal.name) return setName(meal.name);
    await updateSettings({ meals: meals.map((m) => (m.id === meal.id ? { ...m, name: trimmed } : m)) });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-5 pb-2 pt-4">
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="field !min-h-10 flex-1 !text-[17px]"
          />
        ) : (
          <button className="tap min-w-0 flex-1 truncate text-left text-[17px] tracking-tight" onClick={() => !readonly && setRenaming(true)}>
            {meal.name}
          </button>
        )}
        <div className="shrink-0 text-right">
          <span className="text-[17px] tabular-nums">{fmtKcal(tot.kcal)}</span>
          <span className="ml-1 text-[12px] text-ink-3">kcal</span>
        </div>
      </div>
      {entries.length > 0 && (
        <div className="px-5">
          <MacroLine n={tot} />
        </div>
      )}

      <div className="mt-2">
        {blocks.map((b) => (
          <div key={b.key}>
            {b.title && (
              <div className="flex items-baseline justify-between px-5 pb-1 pt-3">
                <Label>{b.title}</Label>
                <span className="text-[12px] tabular-nums text-ink-3">{fmtKcal(totals(b.items).kcal)} kcal</span>
              </div>
            )}
            {b.items.map((e) => (
              <EntryRow key={e.id} e={e} indent={!!b.title} onClick={() => open({ kind: 'entry', entryId: e.id })} />
            ))}
          </div>
        ))}
      </div>

      {oil.length > 0 && (
        <button
          className="tap mx-5 mt-2 flex w-[calc(100%-2.5rem)] items-center justify-between rounded-xl border border-line px-3 py-2.5 text-[12px]"
          onClick={() => open({ kind: 'entry', entryId: oil[0].id })}
        >
          <span className="uppercase tracking-[0.12em] text-fat">{t('Oil and dressing')}</span>
          <span className="tabular-nums text-ink-2">
            {oil.map((o) => `${fmtG(o.amount)} ${o.unit}`).join(' + ')} · {fmtKcal(oilTot.kcal)} kcal ·{' '}
            {tot.kcal > 0 ? Math.round((oilTot.kcal / tot.kcal) * 100) : 0}%
          </span>
        </button>
      )}

      {!readonly && (
        <div className="flex gap-2 p-3 pt-3">
          <Button icon="plus" variant="ghost" className="flex-1 !justify-start" onClick={() => open({ kind: 'add', mealId: meal.id })}>
            {t('Add food')}
          </Button>
          {yCount > 0 && (
            <Button
              icon="copy"
              variant="ghost"
              size="md"
              onClick={async () => {
                const n = await copyMeal(yesterday, day, meal.id);
                haptic('success');
                notify(n ? t('Copied {n} items from yesterday', { n }) : t('Nothing logged in this meal yesterday'));
              }}
            >
              {t('Copy yesterday')}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function EntryRow({ e, onClick, indent }: { e: Entry; onClick: () => void; indent?: boolean }) {
  const n = entryNutrients(e);
  return (
    <button
      onClick={() => {
        haptic();
        onClick();
      }}
      className={`tap flex min-h-14 w-full items-center gap-3 border-t border-line py-2.5 pr-5 text-left active:bg-raised ${indent ? 'pl-8' : 'pl-5'}`}
    >
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] ${e.isOil ? 'text-fat' : ''}`}>{e.name}</div>
        <div className="mt-0.5 truncate text-[12px] text-ink-3">
          {fmtG(e.amount)} {e.unit} · <MacroLine n={n} />
        </div>
      </div>
      <div className="shrink-0 text-[15px] tabular-nums text-ink-2">{fmtKcal(n.kcal)}</div>
    </button>
  );
}
