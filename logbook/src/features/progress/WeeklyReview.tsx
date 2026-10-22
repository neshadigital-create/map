import { Card, Label } from '../../components/ui';
import { addDays, weekdayMon0 } from '../../lib/dates';
import { fmtKcal } from '../../lib/macros';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { useWeekSummaries } from './useProgressData';

function range(start: string, end: string, lang: 'en' | 'fr') {
  const f = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${f.format(new Date(`${start}T00:00:00Z`))} – ${f.format(new Date(`${end}T00:00:00Z`))}`;
}

/**
 * Sunday review. On Sunday it reviews the current week; on other days the last full week.
 * Neutral wording: numbers and one plain observation, never a verdict.
 */
export function WeeklyReview({ today }: { today: string }) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const isSunday = weekdayMon0(today) === 6;
  const lastDay = isSunday ? today : addDays(today, -weekdayMon0(today) - 1);
  const weeks = useWeekSummaries(lastDay, 1);
  const w = weeks?.[0];
  if (!w) return null;
  const cells: [string, string, string?][] = [
    [t('Avg calories'), w.loggedDays ? fmtKcal(w.avgKcal) : '—', 'kcal'],
    [t('Avg protein'), w.loggedDays ? String(w.avgProtein) : '—', 'g'],
    [t('Protein days'), `${w.proteinDays}`, `/ ${w.loggedDays || 7}`],
    [t('Workouts'), String(w.workouts)],
    [t('Walking'), String(w.cardioMinutes), 'min'],
    [t('Weight'), w.weightChange === null ? '—' : `${w.weightChange > 0 ? '+' : ''}${w.weightChange.toFixed(1)}`, w.weightChange === null ? '' : 'kg'],
  ];
  return (
    <Card className="anim-rise p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <Label>{t('Weekly review')}</Label>
        <span className="text-[12px] text-ink-3">{range(w.start, w.end, lang)}</span>
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-5">
        {cells.map(([label, value, unit]) => (
          <div key={label}>
            <div>
              <span className="numeral text-[28px]">{value}</span>
              {unit && <span className="ml-1 text-[11px] text-ink-3">{unit}</span>}
            </div>
            <Label className="mt-2">{label}</Label>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-line pt-3.5 text-[13px] leading-relaxed text-ink-2">
        {w.loggedDays === 0
          ? t('No food logged that week. Any week is a fresh start.')
          : t('{n} of {d} logged days at your protein target. The weekly average is what moves the needle.', { n: w.proteinDays, d: w.loggedDays })}
      </div>
    </Card>
  );
}
