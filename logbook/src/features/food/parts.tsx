import { useMemo, useState } from 'react';
import type { Food, Nutrients, Unit } from '../../db/types';
import { defaultAmount, fmtG, fmtKcal, forAmount } from '../../lib/macros';
import { useT } from '../../lib/i18n';
import { haptic } from '../../lib/haptics';
import { Button, Label, NumField, Segmented, Stepper, TextField, Toggle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { uid } from '../../lib/id';

/** "P 18 · C 2 · F 15" in quiet colours. */
export function MacroLine({ n, className = '' }: { n: Nutrients; className?: string }) {
  return (
    <span className={`text-[12px] tabular-nums text-ink-3 ${className}`}>
      <span className="text-protein">P {fmtG(n.protein)}</span>
      <span className="mx-1.5 text-line-strong">·</span>C {fmtG(n.carbs)}
      <span className="mx-1.5 text-line-strong">·</span>F {fmtG(n.fat)}
    </span>
  );
}

export function foodSummary(f: Food): { label: string; n: Nutrients } {
  if (f.basis === 'portion' && f.portion) return { label: f.portion.label, n: f.nutrients };
  return { label: `100 ${f.unit}`, n: f.nutrients };
}

export function FoodRow({ food, onClick, right }: { food: Food; onClick: () => void; right?: React.ReactNode }) {
  const s = foodSummary(food);
  return (
    <div className="flex items-center border-b border-line last:border-b-0">
      <button
        onClick={() => {
          haptic();
          onClick();
        }}
        className="tap flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px]">{food.name}</div>
          <div className="mt-1 truncate text-[12px] text-ink-3">
            {food.brand ? `${food.brand} · ` : ''}
            {s.label} · <MacroLine n={s.n} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[15px] tabular-nums">{fmtKcal(s.n.kcal)}</div>
          <div className="text-[11px] text-ink-3">kcal</div>
        </div>
      </button>
      {right}
    </div>
  );
}

export function NutrientGrid({ n }: { n: Nutrients }) {
  const t = useT();
  const cells: [string, number | undefined, string?][] = [
    [t('Protein'), n.protein, 'text-protein'],
    [t('Carbs'), n.carbs],
    [t('Fat'), n.fat],
    [t('Fiber'), n.fiber],
    [t('Sugar'), n.sugar],
  ];
  return (
    <div className="grid grid-cols-5 gap-1 text-center">
      {cells.map(([label, v, cls]) => (
        <div key={label}>
          <div className={`numeral text-[22px] ${cls ?? ''}`}>{v === undefined ? '–' : fmtG(v)}</div>
          <div className="mt-1.5 truncate text-[10px] uppercase tracking-[0.1em] text-ink-3">{label}</div>
        </div>
      ))}
    </div>
  );
}

/** Choose an amount for a food with quick portion chips and live macros. */
export function AmountPanel({
  food,
  initial,
  confirmLabel,
  onConfirm,
}: {
  food: Food;
  initial?: number;
  confirmLabel: string;
  onConfirm: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(initial ?? defaultAmount(food));
  const n = useMemo(() => forAmount(food, amount), [food, amount]);
  const chips = portionChips(food);
  const step = food.isOil ? 1 : amount >= 100 ? 10 : 5;
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="numeral text-[64px]">{fmtKcal(n.kcal)}</div>
        <Label className="mt-2">kcal</Label>
      </div>
      <NutrientGrid n={n} />
      <Stepper value={amount} onChange={setAmount} step={step} unit={food.unit} large />
      {chips.length > 0 && (
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {chips.map((c) => (
            <button
              key={c.label}
              onClick={() => {
                haptic();
                setAmount(c.amount);
              }}
              className={`tap min-h-10 shrink-0 rounded-full border px-4 text-[13px] ${Math.abs(c.amount - amount) < 0.01 ? 'border-accent text-ink' : 'border-line text-ink-2'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <Button variant="primary" size="lg" className="w-full" onClick={() => onConfirm(amount)} disabled={!(amount > 0)}>
        {confirmLabel}
      </Button>
    </div>
  );
}

export function portionChips(food: Food): { label: string; amount: number }[] {
  const chips: { label: string; amount: number }[] = [];
  if (food.portion) {
    const p = food.portion;
    chips.push({ label: p.label, amount: p.amount });
    const unitLabel = p.label.replace(/^1\s+/, '');
    if (!food.isOil) chips.push({ label: `2 × ${unitLabel}`, amount: p.amount * 2 });
    chips.push({ label: `½ ${unitLabel}`, amount: Math.round(p.amount * 5) / 10 });
  }
  for (const [k, v] of Object.entries(food.measures ?? {})) {
    if (!chips.some((c) => Math.abs(c.amount - v) < 0.01)) chips.push({ label: `1 ${k}`, amount: v });
  }
  if (food.isOil && food.measures?.tsp) chips.push({ label: '2 tsp', amount: food.measures.tsp * 2 });
  if (!food.isOil) for (const g of [50, 100, 150, 200]) if (!chips.some((c) => c.amount === g)) chips.push({ label: `${g} ${food.unit}`, amount: g });
  return chips;
}

export function emptyFood(name = ''): Food {
  const now = Date.now();
  return {
    id: `user-${uid()}`,
    name,
    unit: 'g',
    basis: 'per100',
    nutrients: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
    source: 'user',
    createdAt: now,
    updatedAt: now,
  };
}

/** Create or edit a food. Values can be per 100 g/ml or per portion. */
export function FoodEditor({
  initial,
  onSave,
  onDelete,
  saveLabel,
}: {
  initial: Food;
  onSave: (f: Food) => void;
  onDelete?: () => void;
  saveLabel?: string;
}) {
  const t = useT();
  const [f, setF] = useState<Food>(initial);
  const set = (patch: Partial<Food>) => setF((cur) => ({ ...cur, ...patch }));
  const setN = (k: keyof Nutrients, v: number | undefined) =>
    setF((cur) => ({ ...cur, nutrients: { ...cur.nutrients, [k]: k === 'fiber' || k === 'sugar' ? v : (v ?? 0) } }));
  const valid = f.name.trim().length > 0 && (f.basis === 'per100' || (f.portion?.amount ?? 0) > 0);
  return (
    <div className="space-y-5">
      <TextField label={t('Name')} value={f.name} onChange={(name) => set({ name })} />
      <TextField label={t('Brand')} value={f.brand ?? ''} onChange={(brand) => set({ brand: brand || undefined })} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-2">{t('Unit')}</Label>
          <Segmented<Unit>
            value={f.unit}
            onChange={(unit) => set({ unit })}
            options={[
              { value: 'g', label: 'g' },
              { value: 'ml', label: 'ml' },
            ]}
          />
        </div>
        <div>
          <Label className="mb-2">{t('Values per')}</Label>
          <Segmented
            value={f.basis}
            onChange={(basis) => set({ basis, portion: basis === 'portion' ? (f.portion ?? { label: '1 portion', amount: 100 }) : f.portion })}
            options={[
              { value: 'per100', label: `100 ${f.unit}` },
              { value: 'portion', label: t('portion') },
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('Portion name')}
          value={f.portion?.label ?? ''}
          placeholder="1 pot"
          onChange={(label) => set({ portion: { amount: f.portion?.amount ?? 100, label } })}
        />
        <NumField
          label={t('Portion size')}
          unit={f.unit}
          value={f.portion?.amount}
          onChange={(amount) => set({ portion: amount ? { label: f.portion?.label || `${amount} ${f.unit}`, amount } : undefined })}
        />
      </div>
      <div className="rounded-2xl border border-line p-4">
        <Label className="mb-4">{f.basis === 'per100' ? `${t('per 100')} ${f.unit}` : f.portion?.label || t('One portion')}</Label>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="kcal" value={f.nutrients.kcal} onChange={(v) => setN('kcal', v)} />
          <NumField label={t('Protein')} unit="g" value={f.nutrients.protein} onChange={(v) => setN('protein', v)} />
          <NumField label={t('Carbs')} unit="g" value={f.nutrients.carbs} onChange={(v) => setN('carbs', v)} />
          <NumField label={t('Fat')} unit="g" value={f.nutrients.fat} onChange={(v) => setN('fat', v)} />
          <NumField label={t('Fiber')} unit="g" value={f.nutrients.fiber} onChange={(v) => setN('fiber', v)} />
          <NumField label={t('Sugar')} unit="g" value={f.nutrients.sugar} onChange={(v) => setN('sugar', v)} />
        </div>
      </div>
      <Toggle checked={!!f.isOil} onChange={(isOil) => set({ isOil })} label={t('Counts as oil or dressing')} />
      <div className="flex gap-2 pt-1">
        {onDelete && (
          <Button variant="danger" icon="trash" onClick={onDelete}>
            {t('Delete')}
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={!valid}
          onClick={() => onSave({ ...f, name: f.name.trim(), updatedAt: Date.now() })}
        >
          {saveLabel ?? t('Save')}
        </Button>
      </div>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-[13px] text-ink-3">{children}</div>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1 mt-5 flex items-center justify-between first:mt-1">
      <Label>{children}</Label>
      {right}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="relative"
    >
      <Icon name="search" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field !min-h-13 !rounded-2xl !pl-12"
      />
    </form>
  );
}
