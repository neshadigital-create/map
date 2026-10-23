import { useSettings, useDayEntries, useWeekStats, useWaterTotal, useLastMealAt } from '../../db/hooks';
import { totals, fmtKcal, fmtG } from '../../lib/macros';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { Card, IconButton, Label } from '../../components/ui';
import { Bar } from '../../components/Ring';
import { Gauge } from '../../components/Gauge';
import { Icon } from '../../components/Icon';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { proteinSuggestion } from '../../lib/nudge';
import { haptic } from '../../lib/haptics';
import { fmtDayLabel, dayKey, fmtWeekdayShort, weekdayMon0, minutesOfDay } from '../../lib/dates';
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

function greeting(min: number) {
  if (min < 4 * 60) return 'Good night';
  if (min < 12 * 60) return 'Good morning';
  if (min < 18 * 60) return 'Good afternoon';
  return 'Good evening';
}

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
      <header className="flex items-end justify-between px-1 pb-3 pt-1">
        <div>
          <div className="eyebrow mb-2">{fmtDayLabel(today, lang)}</div>
          <h1 className="text-[28px] font-medium tracking-[-0.02em]">{t(greeting(minutesOfDay(new Date(), settings.timezone)))}</h1>
        </div>
        <IconButton icon="settings" label={t('Settings')} onClick={() => open({ kind: 'settings' })} className="-mr-1 border border-line bg-card" />
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
    sub = next.exercises.length ? `${next.exercises.length} ${t(next.exercises.length === 1 ? 'exercise' : 'exercises')}` : t('No exercises yet');
  } else if (prog.phase) {
    title = t('Week complete');
    sub = t('All {n} days done this week. Rest well.', { n: prog.days.length });
  }

  const last = useLiveQuery(async () => {
    if (!next) return undefined;
    const list = await db.sessions.where('name').equals(next.name).toArray().catch(() => []);
    return list.filter((x) => x.endedAt).sort((x, y) => y.startedAt - x.startedAt)[0];
  }, [next?.name]);
  const details: string[] = [];
  if (!active && !doneToday.length && next?.exercises.length) {
    details.push(`${next.exercises.length} ${t(next.exercises.length === 1 ? 'exercise' : 'exercises')}`);
    if (last?.endedAt) details.push(`${t('about')} ${Math.max(10, Math.round((last.endedAt - last.startedAt) / 60000 / 5) * 5)} min`);
    if (last?.feeling) details.push(t('last time felt {n}/5', { n: last.feeling }));
  }

  return (
    <div className="wood anim-rise p-5">
      {prog.phase && (
        <div className="tag">
          {t('Phase')} {prog.phase.index} · {t('Week')} {Math.max(1, prog.week)}
        </div>
      )}
      <div className={`text-[28px] font-medium leading-tight tracking-[-0.01em] ${prog.phase ? 'mt-4' : ''}`}>{title}</div>
      <div className="mt-1 text-[14px] opacity-80">{details.length ? details.join(' · ') : sub}</div>
      <div className="mt-5">
        {active ? (
          <WoodButton onClick={() => setSessionView(active.id)}>{t('Resume workout')}</WoodButton>
        ) : next && next.exercises.length && !doneToday.length ? (
          <WoodButton onClick={() => startWorkout({ template: next, phase: prog.phase, tz })}>{t('Start workout')}</WoodButton>
        ) : (
          <WoodButton onClick={() => setTab('train')}>{prog.phase ? t('Open Train') : t('Set up my program')}</WoodButton>
        )}
      </div>
      {week.cardioMinutes > 0 && (
        <div className="mt-4 border-t border-white/15 pt-3 text-[13px] opacity-80">
          {t('Walking')} · <span className="tabular-nums">{week.cardioMinutes} min</span> {t('this week')}
        </div>
      )}
    </div>
  );
}

/** Cream button on the wood panel by day, black steel at night via theme. */
function WoodButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={() => {
        haptic();
        onClick();
      }}
      className="tap btn-primary flex h-14 w-full items-center justify-center rounded-2xl text-[16px] font-semibold"
    >
      {children}
    </button>
  );
}

function CaloriesHero({ tot, tg, week }: { tot: Nutrients; tg: Targets; week: WeekStats }) {
  const t = useT();
  const remaining = useAnimatedNumber(tg.kcal - tot.kcal);
  const eaten = useAnimatedNumber(tot.kcal);
  const over = tg.kcal - tot.kcal < 0;
  return (
    <Card className="anim-rise flex flex-col items-center px-5 pb-5 pt-7">
      <Gauge value={tot.kcal} max={tg.kcal}>
        <div className="numeral text-[54px] !font-normal">{fmtKcal(Math.abs(remaining))}</div>
        <div className="mt-1.5 text-[14px] text-ink-3">{over ? t('kcal over today') : t('kcal left today')}</div>
      </Gauge>
      <div className="mt-1 grid w-full grid-cols-3 border-t border-line pt-4 text-center">
        <Stat label={t('Eaten')} value={fmtKcal(eaten)} />
        <Stat label={t('Goal')} value={fmtKcal(tg.kcal)} />
        <Stat label={t('Week average')} value={week.loggedDays ? fmtKcal(week.avg.kcal) : '—'} />
      </div>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`numeral text-[30px] !font-normal ${accent ? 'text-accent' : 'text-ink'}`}>{value}</div>
      <div className="mt-1 text-[12.5px] text-ink-3">{label}</div>
    </div>
  );
}

function MacroCard({ tot, tg, week }: { tot: Nutrients; tg: Targets; week: WeekStats }) {
  const t = useT();
  const open = useUI((st) => st.open);
  const toGo = Math.max(0, Math.round(tg.protein - tot.protein));
  const protein = useAnimatedNumber(tot.protein);
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const sug = proteinSuggestion(foods, toGo);
  return (
    <Card className="anim-rise p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[16px] font-medium">{t('Protein')}</div>
        <div>
          <span className="numeral text-[34px] !font-normal">{Math.round(protein)}</span>
          <span className="text-[14px] text-ink-3"> / {tg.protein} g</span>
        </div>
      </div>
      <div className="mt-2.5">
        <Bar value={tot.protein} max={tg.protein} color="var(--color-protein)" height={10} />
      </div>
      <button
        onClick={() => sug && open({ kind: 'add', mealId: '', foodId: sug.food.id })}
        disabled={!sug}
        className="tap mt-3.5 flex w-full items-center gap-3 rounded-2xl bg-raised px-4 py-3 text-left text-[14px] leading-snug text-ink-2"
      >
        <Icon name={toGo > 0 ? 'clock' : 'check'} size={20} className="shrink-0 text-protein" />
        <span className="min-w-0 flex-1">
          {toGo > 0 ? (
            <>
              <b className="font-medium text-ink">{t('{n} g to go.', { n: toGo })}</b>{' '}
              {sug ? t('{food} covers {n} g.', { food: sug.food.name, n: sug.protein }) : t('Week average {n} g.', { n: Math.round(week.avg.protein) })}
            </>
          ) : (
            <b className="font-medium text-ink">{t('Protein target reached')}</b>
          )}
        </span>
        {sug && <Icon name="plus" size={18} className="shrink-0 text-ink-3" />}
      </button>
      <div className="mt-4 grid grid-cols-2 gap-5">
        <SlimMacro label={t('Carbs')} value={tot.carbs} max={tg.carbs} color="var(--color-carbs)" />
        <SlimMacro label={t('Fat')} value={tot.fat} max={tg.fat} color="var(--color-fat)" />
      </div>
    </Card>
  );
}

function SlimMacro({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[13px]">
        <span className="text-ink-2">{label}</span>
        <span className="tabular-nums text-ink-3">
          <span className="font-medium text-ink">{fmtG(value)}</span> / {max} g
        </span>
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
          <div className="numeral text-[32px] !font-normal">{week.loggedDays ? fmtKcal(week.avg.kcal) : '—'}</div>
          <Label className="mt-1">{t('kcal a day')}</Label>
        </div>
        <div>
          <div className="numeral text-[32px] !font-normal text-protein">{week.loggedDays ? Math.round(week.avg.protein) : '—'}</div>
          <Label className="mt-1">{t('g protein a day')}</Label>
        </div>
        <div>
          <div className="numeral text-[32px] !font-normal">
            {hit}
            <span className="text-ink-3">/{week.loggedDays}</span>
          </div>
          <Label className="mt-1">{t('Protein days')}</Label>
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
                className={`w-full max-w-7 rounded-md ${isToday ? 'bg-accent' : d.logged ? 'bg-ink-3' : 'bg-track'}`}
                style={{ height: `${h}%`, transition: 'height 600ms var(--ease-out-soft)' }}
              />
              <div className={`size-1.5 rounded-full ${proteinHit ? 'bg-protein' : 'bg-transparent'}`} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {week.days.map((d) => (
          <div key={d.day} className={`flex-1 text-center font-mono text-[11px] uppercase ${d.day === today ? 'text-ink' : 'text-ink-3'}`}>
            {fmtWeekdayShort(d.day, lang)}
          </div>
        ))}
      </div>
    </Card>
  );
}
