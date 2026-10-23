import { useSettings } from '../../db/hooks';
import { addWater } from '../../db/actions';
import { dayKey, mealForTime, minutesOfDay } from '../../lib/dates';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { Sheet } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';

/** The centre + button: everything you might log, one tap away. */
export function QuickAddSheet() {
  const t = useT();
  const { open, close, setTab, notify } = useUI();
  const settings = useSettings();
  const meal = mealForTime(settings.meals, minutesOfDay(new Date(), settings.timezone));
  const today = dayKey(new Date(), settings.timezone);
  const items: { icon: IconName; label: string; sub: string; action: () => void }[] = [
    { icon: 'search', label: t('Food'), sub: t('Search my foods'), action: () => open({ kind: 'add', mealId: meal.id }) },
    { icon: 'text', label: t('Quick text'), sub: '3 eggs, 150g skyr', action: () => open({ kind: 'quick', mealId: meal.id }) },
    { icon: 'barcode', label: t('Scan'), sub: t('Barcode'), action: () => open({ kind: 'scan', mealId: meal.id }) },
    { icon: 'book', label: t('Recipes'), sub: t('My usual salad'), action: () => open({ kind: 'recipes', mealId: meal.id }) },
    {
      icon: 'drop',
      label: t('Water'),
      sub: '+250 ml',
      action: async () => {
        await addWater(today, 250);
        haptic('success');
        notify(`${t('Water')} +250 ml`);
        close();
      },
    },
    { icon: 'clock', label: t('Walk'), sub: t('Treadmill or outside'), action: () => open({ kind: 'cardio' }) },
    {
      icon: 'progress',
      label: t('Weight'),
      sub: 'kg',
      action: () => {
        close();
        setTab('progress');
      },
    },
    {
      icon: 'train',
      label: t('Workout'),
      sub: t('Train'),
      action: () => {
        close();
        setTab('train');
      },
    },
  ];
  return (
    <Sheet title={t('Add to {meal}', { meal: meal.name })} onClose={close}>
      <div className="grid grid-cols-2 gap-2.5 pb-3 pt-1">
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => {
              haptic();
              it.action();
            }}
            className="tap flex min-h-[84px] flex-col items-start justify-between rounded-2xl border border-line bg-raised p-3.5 text-left active:bg-line"
          >
            <Icon name={it.icon} size={22} className="text-accent" />
            <span>
              <span className="block text-[15px] font-medium">{it.label}</span>
              <span className="block truncate text-[12px] text-ink-3">{it.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
