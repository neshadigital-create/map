import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSettings } from '../../db/hooks';
import { useExerciseMap } from '../../db/train';
import { addPhoto, addWeight, deleteMeasurement, deletePhoto, deleteWeight, saveMeasurement } from '../../db/progress';
import type { Measurement } from '../../db/types';
import { strengthSeries, volumeByMuscle, weeklyChange, weightSeries } from '../../lib/progress';
import { addDays, dayKey, fmtDayLabel } from '../../lib/dates';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { Button, Card, Label, NumField, Segmented, Sheet, Stepper } from '../../components/ui';
import { ChartCard, Empty, MuscleBars, shortDate, StrengthChart, WeeklyColumns, WeightChart } from './charts';
import { WeeklyReview } from './WeeklyReview';
import { useWeekSummaries } from './useProgressData';

type Range = '30' | '90' | 'all';

export default function ProgressScreen() {
  const t = useT();
  const { lang } = useUI();
  const settings = useSettings();
  const today = dayKey(new Date(), settings.timezone);
  const [sheet, setSheet] = useState<null | 'weight' | 'measure' | { photo: string }>(null);

  return (
    <div className="space-y-3">
      <header className="px-1 pb-2 pt-1">
        <Label className="mb-2.5">{fmtDayLabel(today, lang)}</Label>
        <h1 className="text-[30px] font-light tracking-[-0.03em]">{t('Progress')}</h1>
      </header>
      <WeeklyReview today={today} />
      <WeightCard today={today} onAdd={() => setSheet('weight')} />
      <NutritionCharts today={today} />
      <TrainingCharts />
      <MeasurementsCard onAdd={() => setSheet('measure')} />
      <PhotosCard today={today} onOpen={(id) => setSheet({ photo: id })} />

      {sheet === 'weight' && <WeightSheet today={today} onClose={() => setSheet(null)} />}
      {sheet === 'measure' && <MeasureSheet today={today} onClose={() => setSheet(null)} />}
      {sheet && typeof sheet === 'object' && <PhotoViewer id={sheet.photo} onClose={() => setSheet(null)} />}
    </div>
  );
}

function WeightCard({ today, onAdd }: { today: string; onAdd: () => void }) {
  const t = useT();
  const [range, setRange] = useState<Range>('90');
  const logs = useLiveQuery(() => db.weights.toArray(), []) ?? [];
  const series = useMemo(() => weightSeries(logs), [logs]);
  const visible = range === 'all' ? series : series.filter((p) => p.day >= addDays(today, -Number(range)));
  const last = series[series.length - 1];
  const change = weeklyChange(series);
  return (
    <ChartCard
      title={t('Weight')}
      right={
        <Button size="sm" icon="plus" variant="ghost" onClick={onAdd} className="-my-2 -mr-2">
          {t('Log')}
        </Button>
      }
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <span className="numeral text-[52px]">{last ? last.trend.toFixed(1) : '—'}</span>
          <span className="ml-1.5 text-[13px] text-ink-3">kg · {t('7-day avg')}</span>
        </div>
        <div className="pb-1 text-right">
          <div className="text-[17px] tabular-nums">{change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)} kg`}</div>
          <Label className="mt-1.5">{t('This week')}</Label>
        </div>
      </div>
      {visible.length >= 2 ? (
        <WeightChart data={visible} labels={{ daily: t('Daily'), trend: t('7-day average') }} />
      ) : (
        <Empty>{t('Log your weight a few times a week. The trend line smooths out day-to-day water swings.')}</Empty>
      )}
      <Segmented<Range>
        className="mt-4"
        value={range}
        onChange={setRange}
        options={[
          { value: '30', label: '1M' },
          { value: '90', label: '3M' },
          { value: 'all', label: t('All') },
        ]}
      />
    </ChartCard>
  );
}

function NutritionCharts({ today }: { today: string }) {
  const t = useT();
  const settings = useSettings();
  const weeks = useWeekSummaries(today, 10) ?? [];
  const data = (key: 'avgKcal' | 'avgProtein') => weeks.map((w) => ({ label: shortDate(w.start), value: w.loggedDays ? w[key] : null, days: w.loggedDays }));
  const any = weeks.some((w) => w.loggedDays);
  return (
    <>
      <ChartCard title={t('Weekly avg calories')} right={<TargetKey value={`${settings.targets.kcal} kcal`} />}>
        {any ? <WeeklyColumns data={data('avgKcal')} target={settings.targets.kcal} color="var(--color-ink-2)" unit="kcal" /> : <Empty>{t('Log food to see weekly averages.')}</Empty>}
      </ChartCard>
      <ChartCard title={t('Weekly avg protein')} right={<TargetKey value={`${settings.targets.protein} g`} />}>
        {any ? <WeeklyColumns data={data('avgProtein')} target={settings.targets.protein} color="var(--color-protein)" unit="g" /> : <Empty>{t('Log food to see weekly averages.')}</Empty>}
      </ChartCard>
    </>
  );
}

/** Legend key for the horizontal target line. */
function TargetKey({ value }: { value: string }) {
  const t = useT();
  return (
    <span className="flex items-center gap-1.5 text-[12px] tabular-nums text-ink-3">
      <span className="h-px w-4 bg-ink-3" /> {t('Target')} {value}
    </span>
  );
}

function TrainingCharts() {
  const t = useT();
  const exMap = useExerciseMap();
  const [range, setRange] = useState<'7' | '28'>('28');
  const [lift, setLift] = useState<string | null>(null);
  const data = useLiveQuery(async () => ({ sets: await db.sets.toArray(), sessions: await db.sessions.toArray() }), []);
  const volume = useMemo(
    () => (data ? volumeByMuscle(data.sets, exMap, Date.now() - Number(range) * 86_400_000).map((v) => ({ name: v.muscle, kg: v.kg })) : []),
    [data, exMap, range],
  );
  const lifts = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const s of data.sets) if (s.done && s.type !== 'warmup') counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => exMap.has(id));
  }, [data, exMap]);
  const selected = lift && lifts.includes(lift) ? lift : lifts[0];
  const strength = useMemo(() => (data && selected ? strengthSeries(data.sets, new Map(data.sessions.map((s) => [s.id, s])), selected) : []), [data, selected]);

  return (
    <>
      <ChartCard
        title={t('Volume by muscle')}
        right={
          <Segmented
            className="!p-0.5"
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7d' },
              { value: '28', label: '4w' },
            ]}
          />
        }
      >
        {volume.length ? <MuscleBars data={volume} label={(n) => t(n)} /> : <Empty>{t('Finish a workout to see volume per muscle group.')}</Empty>}
      </ChartCard>
      <ChartCard title={t('Strength trend')} right={<span className="text-[12px] text-ink-3">e1RM · kg</span>}>
        {lifts.length > 0 && (
          <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
            {lifts.map((id) => (
              <button
                key={id}
                onClick={() => {
                  haptic();
                  setLift(id);
                }}
                className={`tap min-h-10 shrink-0 rounded-full border px-4 text-[13px] ${id === selected ? 'border-accent text-ink' : 'border-line text-ink-2'}`}
              >
                {exMap.get(id)?.name}
              </button>
            ))}
          </div>
        )}
        {strength.length >= 2 ? (
          <StrengthChart data={strength} />
        ) : (
          <Empty>{lifts.length ? t('Two or more sessions of this lift draw the line.') : t('Your lifts will show here after a few workouts.')}</Empty>
        )}
      </ChartCard>
    </>
  );
}

const MEASURES: { key: keyof Pick<Measurement, 'waistCm' | 'hipsCm' | 'thighsCm' | 'armsCm'>; label: string }[] = [
  { key: 'waistCm', label: 'Waist' },
  { key: 'hipsCm', label: 'Hips' },
  { key: 'thighsCm', label: 'Thighs' },
  { key: 'armsCm', label: 'Arms' },
];

const fmt1 = (n: number) => String(Math.round(n * 10) / 10);

function MeasurementsCard({ onAdd }: { onAdd: () => void }) {
  const t = useT();
  const rows = useLiveQuery(() => db.measurements.orderBy('day').toArray(), []) ?? [];
  const latest = (k: (typeof MEASURES)[number]['key']) => [...rows].reverse().find((r) => r[k] !== undefined);
  const first = (k: (typeof MEASURES)[number]['key']) => rows.find((r) => r[k] !== undefined);
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <Label>{t('Measurements')}</Label>
        <Button size="sm" icon="plus" variant="ghost" onClick={onAdd} className="-my-2 -mr-2">
          {t('Log')}
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {MEASURES.map(({ key, label }) => {
          const l = latest(key);
          const f = first(key);
          const diff = l && f && l.id !== f.id ? (l[key]! - f[key]!) : null;
          return (
            <div key={key}>
              <div className="numeral text-[26px]">{l ? fmt1(l[key]!) : '—'}</div>
              <Label className="mt-2">{t(label)}</Label>
              <div className="mt-1.5 text-[11px] tabular-nums text-ink-3">{diff === null ? 'cm' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)} cm`}</div>
            </div>
          );
        })}
      </div>
      {rows.length > 0 && (
        <div className="mt-4 border-t border-line pt-2">
          {[...rows].reverse().slice(0, 4).map((r) => (
            <button
              key={r.id}
              onClick={() => confirm(t('Delete this entry?')) && deleteMeasurement(r.id)}
              className="tap flex min-h-11 w-full items-center justify-between text-left text-[12px] tabular-nums text-ink-3"
            >
              <span>{shortDate(r.day)}</span>
              <span>{MEASURES.map(({ key }) => (r[key] === undefined ? '–' : fmt1(r[key]!))).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function PhotosCard({ today, onOpen }: { today: string; onOpen: (id: string) => void }) {
  const t = useT();
  const notify = useUI((s) => s.notify);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const photos = useLiveQuery(() => db.photos.orderBy('day').reverse().toArray(), []) ?? [];
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <Label>{t('Progress photos')}</Label>
        <Button size="sm" icon="plus" variant="ghost" disabled={busy} onClick={() => input.current?.click()} className="-my-2 -mr-2">
          {t('Add')}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            await addPhoto(today, file);
            haptic('success');
          } catch {
            notify(t('Could not read that image'));
          } finally {
            setBusy(false);
          }
        }}
      />
      {photos.length ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <Thumb key={p.id} blob={p.thumb} day={p.day} onClick={() => onOpen(p.id)} />
          ))}
        </div>
      ) : (
        <div className="py-4 text-[13px] text-ink-3">{t('Photos stay on this phone only. Same spot, same light works best.')}</div>
      )}
    </Card>
  );
}

function useObjectURL(blob?: Blob) {
  return useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
}

function Thumb({ blob, day, onClick }: { blob: Blob; day: string; onClick: () => void }) {
  const url = useObjectURL(blob);
  return (
    <button onClick={onClick} className="tap relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-bg">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] tabular-nums text-white/90">{shortDate(day)}</span>
    </button>
  );
}

function PhotoViewer({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const photo = useLiveQuery(() => db.photos.get(id), [id]);
  const url = useObjectURL(photo?.image);
  if (!photo) return null;
  return (
    <Sheet
      title={fmtDayLabel(photo.day, lang)}
      onClose={onClose}
      tall
      footer={
        <Button
          variant="danger"
          icon="trash"
          className="w-full"
          onClick={async () => {
            if (!confirm(t('Delete this photo?'))) return;
            await deletePhoto(id);
            onClose();
          }}
        >
          {t('Delete')}
        </Button>
      }
    >
      {url && <img src={url} alt="" className="mx-auto max-h-full rounded-2xl" />}
    </Sheet>
  );
}

function WeightSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const t = useT();
  const settings = useSettings();
  const recent = useLiveQuery(() => db.weights.orderBy('day').reverse().limit(6).toArray(), []) ?? [];
  const [kg, setKg] = useState<number | null>(null);
  const [day, setDay] = useState(today);
  const value = kg ?? recent[0]?.kg ?? settings.weightKg;
  return (
    <Sheet
      title={t('Log weight')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={async () => {
            await addWeight(day, value);
            haptic('success');
            onClose();
          }}
        >
          {t('Save')}
        </Button>
      }
    >
      <div className="space-y-6 pt-2">
        <Stepper value={value} onChange={setKg} step={0.1} unit="kg" large decimals={1} />
        <label className="block">
          <Label className="mb-2">{t('Date')}</Label>
          <input type="date" className="field" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        {recent.length > 0 && (
          <div>
            <Label className="mb-1">{t('Recent')}</Label>
            {recent.map((w) => (
              <div key={w.id} className="flex min-h-11 items-center justify-between border-b border-line text-[14px] tabular-nums last:border-b-0">
                <span className="text-ink-2">{shortDate(w.day)}</span>
                <span className="flex items-center gap-3">
                  {w.kg} kg
                  <button className="tap text-[12px] text-ink-3" onClick={() => deleteWeight(w.id)}>
                    {t('Delete')}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function MeasureSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const t = useT();
  const last = useLiveQuery(() => db.measurements.orderBy('day').last(), []);
  const [m, setM] = useState<Partial<Measurement>>({});
  const [day, setDay] = useState(today);
  const val = (k: (typeof MEASURES)[number]['key']) => (k in m ? m[k] : last?.[k]);
  return (
    <Sheet
      title={t('Measurements')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={async () => {
            await saveMeasurement({ day, waistCm: val('waistCm'), hipsCm: val('hipsCm'), thighsCm: val('thighsCm'), armsCm: val('armsCm') });
            haptic('success');
            onClose();
          }}
        >
          {t('Save')}
        </Button>
      }
    >
      <div className="space-y-5 pt-2">
        <div className="grid grid-cols-2 gap-3">
          {MEASURES.map(({ key, label }) => (
            <NumField key={key} label={t(label)} unit="cm" value={val(key)} onChange={(v) => setM((cur) => ({ ...cur, [key]: v }))} />
          ))}
        </div>
        <label className="block">
          <Label className="mb-2">{t('Date')}</Label>
          <input type="date" className="field" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        <div className="text-[12px] text-ink-3">{t('All optional. Measure at the same spot each time.')}</div>
      </div>
    </Sheet>
  );
}
