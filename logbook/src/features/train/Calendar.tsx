import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { addDays, trainingWeekStart, getTrainingWeekStartsOn } from '../../lib/dates';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { Card, IconButton, Label, Sheet } from '../../components/ui';
import { fmtDayLabel, fmtDuration } from '../../lib/dates';
import { cardioKcal } from '../../lib/training';
import { useSettings } from '../../db/hooks';

function monthKey(day: string) {
  return day.slice(0, 7);
}
function shiftMonth(m: string, n: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Month view: white dot = lifting session, blue ring = walk or treadmill. */
export function HistoryCalendar({ today }: { today: string }) {
  const t = useT();
  const { lang, open } = useUI();
  const [month, setMonth] = useState(monthKey(today));
  const first = `${month}-01`;
  // Grid follows the training week (Sunday-first by default)
  const gridStart = trainingWeekStart(first);
  const firstDow = getTrainingWeekStartsOn();
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const visible = cells.slice(0, cells[35].startsWith(month) ? 42 : 35);
  const data = useLiveQuery(async () => {
    const from = visible[0];
    const to = visible[visible.length - 1];
    const sessions = await db.sessions.where('day').between(from, to, true, true).toArray();
    const cardio = await db.cardio.where('day').between(from, to, true, true).toArray();
    return { lift: new Set(sessions.filter((s) => s.endedAt).map((s) => s.day)), walk: new Set(cardio.map((c) => c.day)) };
  }, [month]);
  const title = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${first}T00:00:00Z`),
  );
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${addDays(firstDow === 0 ? '2026-10-18' : '2026-10-19', i)}T00:00:00Z`)),
  );

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <Label>{t('History')}</Label>
        <div className="-mr-3 flex items-center">
          <IconButton icon="chevronLeft" label="Previous" onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="min-w-28 text-center text-[13px] capitalize text-ink-2">{title}</span>
          <IconButton icon="chevronRight" label="Next" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= monthKey(today)} className="disabled:opacity-30" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {weekdays.map((w, i) => (
          <div key={i} className="pb-2 text-[11px] uppercase text-ink-3">
            {w}
          </div>
        ))}
        {visible.map((d) => {
          const inMonth = d.startsWith(month);
          const lift = data?.lift.has(d);
          const walk = data?.walk.has(d);
          const active = lift || walk;
          return (
            <button
              key={d}
              disabled={!active}
              onClick={() => {
                haptic();
                open({ kind: 'calendarDay', day: d });
              }}
              className={`tap relative mx-auto grid size-10 place-items-center rounded-full text-[13px] tabular-nums ${
                !inMonth ? 'text-line-strong' : d === today ? 'text-ink' : 'text-ink-3'
              } ${walk ? 'ring-1 ring-accent' : ''} ${lift ? 'bg-raised !text-ink' : ''}`}
            >
              {Number(d.slice(8))}
              {lift && <span className="absolute bottom-1 size-1 rounded-full bg-ink" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-5 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-raised ring-1 ring-line-strong" /> {t('Lifting')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full ring-1 ring-accent" /> {t('Walk / treadmill')}
        </span>
      </div>
    </Card>
  );
}

export function CalendarDaySheet({ day }: { day: string }) {
  const t = useT();
  const { close, open, lang } = useUI();
  const settings = useSettings();
  const data = useLiveQuery(async () => ({
    sessions: (await db.sessions.where('day').equals(day).toArray()).filter((s) => s.endedAt),
    cardio: await db.cardio.where('day').equals(day).toArray(),
  }), [day]);
  return (
    <Sheet title={fmtDayLabel(day, lang)} onClose={close}>
      {data?.sessions.map((s) => (
        <button key={s.id} className="tap flex min-h-14 w-full items-center justify-between border-b border-line text-left" onClick={() => open({ kind: 'summary', sessionId: s.id })}>
          <span className="text-[15px]">{s.name}</span>
          <span className="text-[13px] text-ink-3">{fmtDuration(((s.endedAt ?? s.startedAt) - s.startedAt) / 60000)}</span>
        </button>
      ))}
      {data?.cardio.map((c) => (
        <button key={c.id} className="tap flex min-h-14 w-full items-center justify-between border-b border-line text-left" onClick={() => open({ kind: 'cardio', cardioId: c.id })}>
          <span className="text-[15px]">{c.type === 'treadmill' ? t('Treadmill') : t('Walk')}</span>
          <span className="text-[13px] tabular-nums text-ink-3">
            {c.minutes} min{c.distanceKm ? ` · ${c.distanceKm} km` : ''} · {cardioKcal(c, settings.weightKg)} kcal
          </span>
        </button>
      ))}
    </Sheet>
  );
}
