import { Card, Label } from '../../components/ui';
import { eatingWindowState, fmtDuration, minutesOfDay, parseHHMM } from '../../lib/dates';
import { useT } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';

export function EatingWindowCard({ start, end, tz, lastMealAt }: { start: string; end: string; tz: string; lastMealAt?: number }) {
  const t = useT();
  const now = useNow();
  const nowMin = minutesOfDay(now, tz);
  const st = eatingWindowState(nowMin, start, end);
  const s = parseHHMM(start) / 1440;
  const e = parseHHMM(end) / 1440;
  const sinceLast = lastMealAt ? (now.getTime() - lastMealAt) / 60000 : undefined;
  let line: string;
  if (st.phase === 'open') line = t('Open · closes in {t}', { t: fmtDuration(st.minutesToClose) });
  else if (sinceLast !== undefined && sinceLast < 36 * 60) line = t('Fasting · {t} since last meal', { t: fmtDuration(sinceLast) });
  else line = t('Opens in {t}', { t: fmtDuration(st.minutesToOpen) });

  const segments = e > s ? [[s, e]] : [[0, e], [s, 1]];
  return (
    <Card className="anim-rise p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <Label>{st.phase === 'open' ? t('Eating window') : t('Fasting')}</Label>
        <div className="text-[13px] tabular-nums text-ink-2">{line}</div>
      </div>
      <div className="relative h-[3px] w-full rounded-full bg-line">
        {segments.map(([a, b], i) => (
          <div
            key={i}
            className={`absolute inset-y-0 rounded-full ${st.phase === 'open' ? 'bg-accent' : 'bg-ink-3'}`}
            style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%` }}
          />
        ))}
        <div
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-[0_0_0_3px_var(--color-card)]"
          style={{ left: `${st.progress * 100}%`, transition: 'left 600ms var(--ease-out-soft)' }}
        />
      </div>
      <div className="mt-2.5 flex justify-between text-[11px] tabular-nums text-ink-3">
        <span>00:00</span>
        <span>
          {start} – {end}
        </span>
        <span>24:00</span>
      </div>
    </Card>
  );
}
