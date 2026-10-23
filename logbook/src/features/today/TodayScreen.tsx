import { useSettings, useDayEntries, useWeekStats, useWaterTotal, useLastMealAt } from '../../db/hooks';
import { totals, fmtKcal, fmtG } from '../../lib/macros';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { Card, IconButton, Label } from '../../components/ui';
import { Bar } from '../../components/Ring';
import { GradientRing } from '../../components/GradientRing';
import { PhotoCard } from '../../components/Photo';
import { dayCoverId } from '../../lib/covers';
import { phaseLabel } from '../../lib/training';
import { Icon } from '../../components/Icon';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { proteinSuggestion } from '../../lib/nudge';
import { haptic } from '../../lib/haptics';
import { fmtDayLabel, dayKey, fmtWeekdayShort, weekdayMon0, minutesOfDay, fmtShortDate } from '../../lib/dates';
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
      <header className="flex items-start justify-between px-1 pb-2 pt-1">
        <div>
          <div className="eyebrow mb-2.5 capitalize">{fmtDayLabel(today, lang)}</div>
          <h1 className="display text-[42px]">{t(greeting(minutesOfDay(new Date(), settings.timezone)))}</h1>
        </div>
        <IconButton icon="settings" label={t('Settings')} onClick={() => open({ kind: 'settings' })} className="-mr-1 bg-raised" />
      </header>

      <InstallHint />
      <WelcomeCard />
      <CaloriesHero tot={tot} tg={tg} week={week} />
      <MacroCard tot={tot} tg={tg} week={week} />
      <WorkoutCard today={today} tz={settings.timezone} />
      {settings.eatingWindow.enabled && (
        <EatingWindowCard start={settings.eatingWindow.start} end={settings.eatingWindow.end} tz={settings.timezone} lastMealAt={lastMealAt} />
      )}
      <WaterCard day={today} total={water} goal={settings.waterGoalMl} />
      {weekdayMon0(today) === 6 && <WeeklyReview today={today} />}
      <WeekCard week={week} tg={tg} today={today} />
      <BackupNudge />
    </div>
  );
}

function WorkoutCard({ today, tz }: { today: string; tz: string }) {
  const t = useT();
  const lang = useUI((st) => st.lang);
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

  const coverName = active?.name ?? (doneToday[0]?.name || next?.name);
  return (
    <div className="anim-rise">
      <div className="mb-2.5 mt-3 flex items-baseline justify-between px-1">
        <div className="text-[17px] font-semibold">{t("Today's training")}</div>
        {prog.phase && (
          <div className="text-[13px] text-ink-3">
            {phaseLabel(prog.phase)}
            {prog.upcoming ? ` · ${t('starts {d}', { d: fmtShortDate(prog.phase.startDate, lang) })}` : ` · ${t('Week')} ${Math.max(1, prog.week)}`}
          </div>
        )}
      </div>
      <PhotoCard
        coverId={coverName ? dayCoverId(coverName) : undefined}
        className="min-h-[220px]"
        onClick={() => (active ? setSessionView(active.id) : setTab('train'))}
      >
        <div className="flex h-full min-h-[220px] flex-col justify-end p-4">
          {next && !active && !doneToday.length && (
            <span className="chip mb-2 self-start">
              {prog.phase?.kind === 'deload' ? t('Deload') : `${t('Day')} ${next.order + 1}`}
            </span>
          )}
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <div className="display text-[34px] drop-shadow-sm">{title}</div>
              <div className="mt-1 text-[13px] text-white/90">{details.length ? details.join(' · ') : sub}</div>
            </div>
            {active ? (
              <PlayButton label={t('Resume workout')} onClick={() => setSessionView(active.id)} />
            ) : next && next.exercises.length && !doneToday.length && !prog.upcoming ? (
              <PlayButton label={t('Start workout')} onClick={() => startWorkout({ template: next, phase: prog.phase, tz })} />
            ) : null}
          </div>
        </div>
      </PhotoCard>
      {week.cardioMinutes > 0 && (
        <div className="px-1 pt-2 text-[13px] text-ink-3">
          {t('Walking')} · <span className="tabular-nums text-ink-2">{week.cardioMinutes} min</span> {t('this week')}
        </div>
      )}
    </div>
  );
}

function PlayButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        haptic('success');
        onClick();
      }}
      className="tap grid size-14 shrink-0 place-items-center rounded-full bg-[#1f2235] text-white shadow-lg"
    >
      <Icon name="play" size={22} fill="currentColor" strokeWidth={0} />
    </button>
  );
}

function CaloriesHero({ tot, tg, week }: { tot: Nutrients; tg: Targets; week: WeekStats }) {
  const t = useT();
  const remaining = useAnimatedNumber(tg.kcal - tot.kcal);
  const eaten = useAnimatedNumber(tot.kcal);
  const over = tg.kcal - tot.kcal < 0;
  return (
    <div className="peach anim-rise flex items-center gap-5 p-5">
      <GradientRing value={tot.kcal} max={tg.kcal} size={136}>
        <div>
          <div className="numeral text-[38px]">{fmtKcal(Math.abs(remaining))}</div>
          <div className="mt-1 text-[12px] text-ink-2">{over ? t('kcal over') : t('kcal left')}</div>
        </div>
      </GradientRing>
      <div className="min-w-0 flex-1 space-y-2 text-[14px]">
        <Stat label={t('Eaten')} value={fmtKcal(eaten)} />
        <Stat label={t('Goal')} value={fmtKcal(tg.kcal)} />
        <Stat label={t('Week average')} value={week.loggedDays ? fmtKcal(week.avg.kcal) : '—'} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-ink-2">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
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
    <div className="anim-rise space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <MacroTile label={t('Protein')} value={Math.round(protein)} max={tg.protein} unit="g" color="var(--color-protein)" />
        <MacroTile label={t('Carbs')} value={tot.carbs} max={tg.carbs} color="var(--color-carbs)" />
        <MacroTile label={t('Fat')} value={tot.fat} max={tg.fat} color="var(--color-fat)" />
      </div>
      <button
        onClick={() => sug && open({ kind: 'add', mealId: '', foodId: sug.food.id })}
        disabled={!sug}
        className="tap tile flex w-full items-center gap-3 px-4 py-3.5 text-left text-[14px] leading-snug text-ink-2"
      >
        <Icon name={toGo > 0 ? 'flame' : 'check'} size={20} className="shrink-0 text-fat" />
        <span className="min-w-0 flex-1">
          {toGo > 0 ? (
            <>
              <b className="font-semibold text-ink">{t('{n} g protein to go.', { n: toGo })}</b>{' '}
              {sug ? t('{food} covers {n} g.', { food: sug.food.name, n: sug.protein }) : t('Week average {n} g.', { n: Math.round(week.avg.protein) })}
            </>
          ) : (
            <b className="font-semibold text-ink">{t('Protein target reached')}</b>
          )}
        </span>
        {sug && (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1f2235] text-white">
            <Icon name="plus" size={16} />
          </span>
        )}
      </button>
    </div>
  );
}

function MacroTile({ label, value, max, color, unit = '' }: { label: string; value: number; max: number; color: string; unit?: string }) {
  return (
    <div className="tile p-3">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="mt-1">
        <span className="numeral text-[26px]">{fmtG(value)}</span>
        <span className="text-[12px] text-ink-3">
          {' '}
          /{max}
          {unit && ` ${unit}`}
        </span>
      </div>
      <div className="mt-2">
        <Bar value={value} max={max} color={color} height={5} />
      </div>
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
                className={`w-full max-w-7 rounded-md ${isToday ? 'bg-[linear-gradient(180deg,var(--ring-a),var(--ring-b))]' : d.logged ? 'bg-line-strong' : 'bg-track'}`}
                style={{ height: `${h}%`, transition: 'height 600ms var(--ease-out-soft)' }}
              />
              <div className={`size-1.5 rounded-full ${proteinHit ? 'bg-protein' : 'bg-transparent'}`} />
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
