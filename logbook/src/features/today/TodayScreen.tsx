import { useSettings, useDayEntries, useWeekStats, useWaterTotal, useLastMealAt } from '../../db/hooks';
import { totals, fmtKcal, fmtG } from '../../lib/macros';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { Card, IconButton, Label, Button } from '../../components/ui';
import { Ring, Bar } from '../../components/Ring';
import { fmtDayLabel, dayKey, fmtWeekdayShort } from '../../lib/dates';
import { EatingWindowCard } from './EatingWindowCard';
import { WaterCard } from './WaterCard';
import type { Nutrients, Targets } from '../../db/types';
import type { WeekStats } from '../../db/hooks';

export function TodayScreen() {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const open = useUI((s) => s.open);
  const settings = useSettings();
  const today = dayKey(new Date(), settings.timezone);
  const entries = useDayEntries(today);
  const week = useWeekStats(today);
  const water = useWaterTotal(today);
  const lastMealAt = useLastMealAt();
  const tot = totals(entries);
  const tg = settings.targets;

  return (
    <div className="space-y-3">
      <header className="flex items-end justify-between px-1 pb-2 pt-1">
        <div>
          <Label className="mb-2.5">{fmtDayLabel(today, lang)}</Label>
          <h1 className="text-[30px] font-light tracking-[-0.03em]">{t('Today')}</h1>
        </div>
        <IconButton icon="settings" label={t('Settings')} onClick={() => open({ kind: 'settings' })} className="-mr-2" />
      </header>

      <CaloriesHero tot={tot} tg={tg} week={week} />
      <MacroCard tot={tot} tg={tg} week={week} />
      {settings.eatingWindow.enabled && (
        <EatingWindowCard start={settings.eatingWindow.start} end={settings.eatingWindow.end} tz={settings.timezone} lastMealAt={lastMealAt} />
      )}
      <WorkoutCard />
      <WaterCard day={today} total={water} goal={settings.waterGoalMl} />
      <WeekCard week={week} tg={tg} today={today} />
    </div>
  );
}

function WorkoutCard() {
  const t = useT();
  return (
    <Card className="anim-rise flex items-center gap-4 p-5">
      <div className="min-w-0 flex-1">
        <Label className="mb-3">{t("Today's training")}</Label>
        <div className="text-[17px] font-normal tracking-tight">{t('No program yet')}</div>
        <div className="mt-1 text-[13px] text-ink-3">{t('Set up your 5-day split in Train.')}</div>
      </div>
      <Button variant="secondary" onClick={() => useUI.getState().setTab('train')}>
        {t('Start')}
      </Button>
    </Card>
  );
}

function CaloriesHero({ tot, tg, week }: { tot: Nutrients; tg: Targets; week: WeekStats }) {
  const t = useT();
  const remaining = tg.kcal - tot.kcal;
  const over = remaining < 0;
  return (
    <Card className="anim-rise flex flex-col items-center px-5 pb-5 pt-6">
      <Ring value={tot.kcal} max={tg.kcal} size={248} stroke={5} color="var(--color-ink)" glow>
        <div className="numeral text-[76px]">{fmtKcal(Math.abs(remaining))}</div>
        <Label className="mt-3">{over ? t('kcal over target') : t('Calories remaining')}</Label>
      </Ring>
      <div className="-mt-6 grid w-full grid-cols-3 border-t border-line pt-4 text-center">
        <Stat label={t('Eaten')} value={fmtKcal(tot.kcal)} />
        <Stat label={t('Target')} value={fmtKcal(tg.kcal)} />
        <Stat label={t('Week avg')} value={week.loggedDays ? fmtKcal(week.avg.kcal) : '—'} accent />
      </div>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`numeral text-[24px] ${accent ? 'text-ink' : 'text-ink-2'}`}>{value}</div>
      <Label className="mt-2">{label}</Label>
    </div>
  );
}

function MacroCard({ tot, tg, week }: { tot: Nutrients; tg: Targets; week: WeekStats }) {
  const t = useT();
  const toGo = Math.max(0, Math.round(tg.protein - tot.protein));
  return (
    <Card className="anim-rise p-5">
      <div className="flex items-center gap-5">
        <Ring value={tot.protein} max={tg.protein} size={132} stroke={4} color="var(--color-protein)" glow>
          <div className="numeral text-[40px]">{fmtG(tot.protein)}</div>
          <div className="mt-1 text-[12px] text-ink-3">/ {tg.protein} g</div>
        </Ring>
        <div className="min-w-0 flex-1">
          <Label className="mb-2 !text-protein">{t('Protein')}</Label>
          <div className="text-[15px] leading-snug text-ink">
            {toGo > 0 ? t('{n} g protein to go', { n: toGo }) : t('Protein target reached')}
          </div>
          <div className="mt-2 text-[12px] text-ink-3">
            {t('Week avg')} {week.loggedDays ? `${Math.round(week.avg.protein)} g` : '—'}
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-5 border-t border-line pt-4">
        <SlimMacro label={t('Carbs')} value={tot.carbs} max={tg.carbs} color="var(--color-carbs)" />
        <SlimMacro label={t('Fat')} value={tot.fat} max={tg.fat} color="var(--color-fat)" />
      </div>
    </Card>
  );
}

function SlimMacro({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <Label>{label}</Label>
        <div className="text-[13px] tabular-nums text-ink-2">
          <span className="text-ink">{fmtG(value)}</span> / {max} g
        </div>
      </div>
      <Bar value={value} max={max} color={color} />
    </div>
  );
}

function WeekCard({ week, tg, today }: { week: WeekStats; tg: Targets; today: string }) {
  const t = useT();
  const lang = useUI((s) => s.lang);
  const hit = week.days.filter((d) => d.logged && d.day <= today && Math.round(d.totals.protein) >= tg.protein).length;
  const peak = Math.max(tg.kcal * 1.25, ...week.days.map((d) => d.totals.kcal));
  return (
    <Card className="anim-rise p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <Label>{t('This week')}</Label>
        <div className="text-[12px] text-ink-3">
          {week.loggedDays ? t('avg of {n} logged days', { n: week.loggedDays }) : t('No food logged yet this week')}
        </div>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-2">
        <div>
          <div className="numeral text-[30px]">{week.loggedDays ? fmtKcal(week.avg.kcal) : '—'}</div>
          <Label className="mt-2">kcal</Label>
        </div>
        <div>
          <div className="numeral text-[30px] text-protein">{week.loggedDays ? Math.round(week.avg.protein) : '—'}</div>
          <Label className="mt-2">{t('Protein')} g</Label>
        </div>
        <div>
          <div className="numeral text-[30px]">
            {hit}
            <span className="text-ink-3">/{week.loggedDays}</span>
          </div>
          <Label className="mt-2">{t('Protein days')}</Label>
        </div>
      </div>
      <div className="relative flex h-24 items-end gap-2">
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-strong"
          style={{ bottom: `${(tg.kcal / peak) * 100}%` }}
        />
        {week.days.map((d) => {
          const h = d.logged ? Math.max(4, (d.totals.kcal / peak) * 100) : 2;
          const isToday = d.day === today;
          const proteinHit = d.logged && Math.round(d.totals.protein) >= tg.protein;
          return (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div
                className={`w-full max-w-7 rounded-md ${isToday ? 'bg-ink' : d.logged ? 'bg-ink-3' : 'bg-line'}`}
                style={{ height: `${h}%`, transition: 'height 600ms var(--ease-out-soft)' }}
              />
              <div className={`size-1 rounded-full ${proteinHit ? 'bg-protein' : 'bg-transparent'}`} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {week.days.map((d) => (
          <div key={d.day} className={`flex-1 text-center text-[11px] uppercase ${d.day === today ? 'text-ink' : 'text-ink-3'}`}>
            {fmtWeekdayShort(d.day, lang)}
          </div>
        ))}
      </div>
    </Card>
  );
}
