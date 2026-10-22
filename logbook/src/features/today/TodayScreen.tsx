import { useSettings, useDayEntries, useWeekStats, useWaterTotal, useLastMealAt } from '../../db/hooks';
import { totals, fmtKcal, fmtG } from '../../lib/macros';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { Card, IconButton, Label, Button } from '../../components/ui';
import { Ring, Bar } from '../../components/Ring';
import { fmtDayLabel, dayKey, fmtWeekdayShort, weekdayMon0 } from '../../lib/dates';
import { WeeklyReview } from '../progress/WeeklyReview';
import { EatingWindowCard } from './EatingWindowCard';
import { WaterCard } from './WaterCard';
import { BackupNudge, InstallHint, WelcomeCard } from './Hints';
import { useAnimatedNumber } from '../../lib/useAnimatedNumber';
import type { Nutrients, Targets } from '../../db/types';
import type { WeekStats } from '../../db/hooks';
import { useActiveSession, useProgram, useWeekTraining } from '../../db/train';
import { nextDayTemplate } from '../../lib/training';
import { startWorkout } from '../train/useStartWorkout';

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

      <InstallHint />
      <WelcomeCard />
      <CaloriesHero tot={tot} tg={tg} week={week} />
      <MacroCard tot={tot} tg={tg} week={week} />
      {settings.eatingWindow.enabled && (
        <EatingWindowCard start={settings.eatingWindow.start} end={settings.eatingWindow.end} tz={settings.timezone} lastMealAt={lastMealAt} />
      )}
      <WorkoutCard today={today} tz={settings.timezone} />
      <WaterCard day={today} total={water} goal={settings.waterGoalMl} />
      {weekdayMon0(today) === 6 && <WeeklyReview today={today} />}
      <WeekCard week={week} tg={tg} today={today} />
      <BackupNudge />
    </div>
  );
}

function WorkoutCard({ today, tz }: { today: string; tz: string }) {
  const t = useT();
  const prog = useProgram(today);
  const week = useWeekTraining(today);
  const active = useActiveSession();
  const setTab = useUI((s) => s.setTab);
  const setSessionView = useUI((s) => s.setSessionView);
  const next = prog.phase ? nextDayTemplate(prog.days, week.doneTemplateIds) : null;
  const doneToday = week.sessions.filter((s) => s.day === today);

  let title = t('No program yet');
  let sub = t('Set up your 5-day split in Train.');
  if (active) {
    title = active.name;
    sub = t('In progress');
  } else if (doneToday.length) {
    title = [...new Set(doneToday.map((s) => s.name))].join(' · ');
    sub = t('Done today');
  } else if (prog.phase && next) {
    title = next.name;
    sub = next.exercises.length ? `${next.exercises.length} ${t('exercises')}` : t('No exercises yet');
  } else if (prog.phase) {
    title = t('Week complete');
    sub = t('All {n} days done this week. Rest well.', { n: prog.days.length });
  }

  return (
    <Card className="anim-rise p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <Label>{t("Today's training")}</Label>
        {prog.phase && (
          <span className="text-[12px] tabular-nums text-ink-3">
            {t('Phase')} {prog.phase.index} · {t('Week')} {Math.max(1, prog.week)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[20px] font-light tracking-tight">{title}</div>
          <div className="mt-1 text-[13px] text-ink-3">{sub}</div>
        </div>
        {active ? (
          <Button variant="primary" onClick={() => setSessionView(active.id)}>
            {t('Resume')}
          </Button>
        ) : next && next.exercises.length && !doneToday.length ? (
          <Button variant="primary" onClick={() => startWorkout({ template: next, phase: prog.phase, tz })}>
            {t('Start')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setTab('train')}>
            {t('Train')}
          </Button>
        )}
      </div>
      {week.cardioMinutes > 0 && (
        <div className="mt-4 border-t border-line pt-3 text-[12px] text-ink-3">
          {t('Walking')} · <span className="tabular-nums text-ink-2">{week.cardioMinutes} min</span> {t('this week')}
        </div>
      )}
    </Card>
  );
}

function CaloriesHero({ tot, tg, week }: { tot: Nutrients; tg: Targets; week: WeekStats }) {
  const t = useT();
  const remaining = useAnimatedNumber(tg.kcal - tot.kcal);
  const eaten = useAnimatedNumber(tot.kcal);
  const over = tg.kcal - tot.kcal < 0;
  return (
    <Card className="anim-rise flex flex-col items-center px-5 pb-5 pt-6">
      <Ring value={tot.kcal} max={tg.kcal} size={248} stroke={5} color="var(--color-ink)" glow>
        <div className="numeral text-[76px]">{fmtKcal(Math.abs(remaining))}</div>
        <Label className="mt-3">{over ? t('kcal over target') : t('Calories remaining')}</Label>
      </Ring>
      <div className="-mt-6 grid w-full grid-cols-3 border-t border-line pt-4 text-center">
        <Stat label={t('Eaten')} value={fmtKcal(eaten)} />
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
  const protein = useAnimatedNumber(tot.protein);
  return (
    <Card className="anim-rise p-5">
      <div className="flex items-center gap-5">
        <Ring value={tot.protein} max={tg.protein} size={132} stroke={4} color="var(--color-protein)" glow>
          <div className="numeral text-[40px]">{Math.round(protein)}</div>
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
