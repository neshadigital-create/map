import { useState } from 'react';
import { useSettings } from '../../db/hooks';
import { createProgram, DEFAULT_PROGRAM, useActiveSession, useProgram, useWeekTraining } from '../../db/train';
import { nextDayTemplate, cardioKcal, phaseLabel } from '../../lib/training';
import { PhotoCard, Thumb } from '../../components/Photo';
import { dayCoverId } from '../../lib/covers';
import { dayKey, fmtDuration, fmtShortDate, weekStart } from '../../lib/dates';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { useNow } from '../../lib/useNow';
import { haptic } from '../../lib/haptics';
import { Button, Card, IconButton, Label } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { HistoryCalendar } from './Calendar';
import { startWorkout } from './useStartWorkout';

export function TrainScreen() {
  const t = useT();
  const { open } = useUI();
  const settings = useSettings();
  const today = dayKey(new Date(), settings.timezone);
  const prog = useProgram(today);
  const week = useWeekTraining(today);
  const active = useActiveSession();

  if (!prog.loaded) return null;

  return (
    <div className="space-y-3">
      <header className="flex items-end justify-between px-1 pb-2 pt-1">
        <div className="min-w-0">
          <div className="eyebrow mb-2.5 truncate">{prog.program?.name ?? t('No program yet')}</div>
          <h1 className="display text-[42px]">{t('Train')}</h1>
        </div>
        {prog.phase && <IconButton icon="edit" label={t('Program')} onClick={() => open({ kind: 'program' })} className="-mr-1 bg-raised" />}
      </header>

      {active && <ActiveBanner />}
      {!prog.phase ? (
        <SetupCard today={today} />
      ) : (
        <>
          <PhaseStrip />
          {!prog.next && prog.week > prog.phase.weeks && (
            <Card className="p-5">
              <Label className="mb-2">{t('Phase complete')}</Label>
              <div className="text-[14px] text-ink-2">{t('Week {n} of an {m}-week phase. Ready to swap exercises?', { n: prog.week, m: prog.phase.weeks })}</div>
              <Button className="mt-3 w-full" onClick={() => open({ kind: 'program' })}>
                {t('Start new phase')}
              </Button>
            </Card>
          )}
          <NextCard />
          <div>
            <div className="mb-1 mt-4 flex items-baseline justify-between px-1">
              <div className="text-[17px] font-semibold">{prog.upcoming ? t('Workouts') : t('This week')}</div>
              <span className="text-[13px] text-ink-3">
                {[...week.doneTemplateIds].filter((id) => prog.days.some((d) => d.id === id)).length} / {prog.days.length}
              </span>
            </div>
            {prog.days.map((d) => {
              const done = week.doneTemplateIds.has(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    haptic();
                    open({ kind: 'dayEditor', dayId: d.id });
                  }}
                  className="tap flex w-full items-center gap-4 border-b border-line py-3 text-left last:border-b-0"
                >
                  <Thumb coverId={dayCoverId(d.name)} label={String(d.order + 1)} size={64} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug">{d.name}</span>
                    <span className="mt-0.5 block text-[12px] text-ink-3">
                      {t('Day')} {d.order + 1} · {d.exercises.length} {t(d.exercises.length === 1 ? 'exercise' : 'exercises')}
                    </span>
                  </span>
                  {done ? (
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-btn text-on-btn">
                      <Icon name="check" size={16} />
                    </span>
                  ) : (
                    <Icon name="chevronRight" size={18} className="text-ink-3" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <CardioCard />
      <HistoryCalendar today={today} />
    </div>
  );

  function PhaseStrip() {
    if (!prog.phase) return null;
    const lang = useUI.getState().lang;
    return (
      <div className="flex gap-1.5 text-[12px] font-semibold">
        <span className="rounded-lg bg-raised px-3 py-2 text-ink-2">{t('5-day routine')}</span>
        <span className="rounded-lg bg-btn px-3 py-2 text-on-btn">{phaseLabel(prog.phase)}</span>
        <span className="rounded-lg bg-raised px-3 py-2 text-ink-2">
          {prog.upcoming ? t('starts {d}', { d: fmtShortDate(prog.phase.startDate, lang) }) : `${t('Week')} ${Math.max(1, prog.week)} / ${prog.phase.weeks}`}
        </span>
      </div>
    );
  }

  function NextCard() {
    const next = nextDayTemplate(prog.days, week.doneTemplateIds);
    const lang = useUI.getState().lang;
    return (
      <PhotoCard coverId={next ? dayCoverId(next.name) : undefined} className="min-h-[230px]" onClick={() => next && open({ kind: 'dayEditor', dayId: next.id })}>
        <div className="flex h-full min-h-[230px] flex-col justify-end p-4">
          <span className="chip mb-2 self-start">
            {next ? (prog.phase?.kind === 'deload' ? t('Deload') : `${t('Next')} · ${t('Day')} ${next.order + 1}`) : t('Week complete')}
          </span>
          {next ? (
            <div className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <div className="display text-[36px]">{next.name}</div>
                <div className="mt-1 text-[13px] text-white/90">
                  {prog.upcoming
                    ? t('starts {d}', { d: fmtShortDate(prog.phase!.startDate, lang) })
                    : next.exercises.length
                      ? `${next.exercises.length} ${t(next.exercises.length === 1 ? 'exercise' : 'exercises')}`
                      : t('No exercises yet. Tap to add them.')}
                </div>
              </div>
              {!prog.upcoming && next.exercises.length > 0 && (
                <button
                  aria-label={active ? t('Resume') : t('Start')}
                  onClick={(e) => {
                    e.stopPropagation();
                    haptic('success');
                    startWorkout({ template: next, phase: prog.phase, tz: settings.timezone });
                  }}
                  className="tap grid size-14 shrink-0 place-items-center rounded-full bg-[#1f2235] text-white shadow-lg"
                >
                  <Icon name="play" size={22} fill="currentColor" strokeWidth={0} />
                </button>
              )}
            </div>
          ) : (
            <div className="display text-[30px]">{t('All {n} days done this week. Rest well.', { n: prog.days.length })}</div>
          )}
        </div>
      </PhotoCard>
    );
  }

  function CardioCard() {
    return (
      <Card className="p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <Label>{t('Walking')}</Label>
          <span className="text-[12px] text-ink-3">{t('This week')}</span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="numeral text-[44px]">{week.cardioMinutes}</span>
            <span className="ml-1 text-[13px] text-ink-3">min</span>
            <div className="mt-1 text-[12px] text-ink-3">
              {week.cardio.length} {t('sessions')} · {week.cardio.reduce((s, c) => s + cardioKcal(c, settings.weightKg), 0)} kcal
            </div>
          </div>
          <Button icon="plus" onClick={() => open({ kind: 'cardio' })}>
            {t('Log walk')}
          </Button>
        </div>
      </Card>
    );
  }
}

function ActiveBanner() {
  const t = useT();
  const active = useActiveSession();
  const now = useNow(30_000);
  const setSessionView = useUI((s) => s.setSessionView);
  if (!active) return null;
  return (
    <button onClick={() => setSessionView(active.id)} className="tap card flex w-full items-center gap-4 !border-accent p-4 text-left">
      <span className="relative grid size-3 place-items-center">
        <span className="absolute size-3 animate-ping rounded-full bg-accent opacity-50" />
        <span className="size-2 rounded-full bg-accent" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{active.name}</span>
        <span className="block text-[12px] text-ink-3">
          {t('In progress')} · {fmtDuration((now.getTime() - active.startedAt) / 60000)}
        </span>
      </span>
      <span className="text-[14px] text-accent">{t('Resume')}</span>
    </button>
  );
}

function SetupCard({ today }: { today: string }) {
  const t = useT();
  const [name, setName] = useState(DEFAULT_PROGRAM);
  const [start, setStart] = useState(weekStart(today));
  const [days, setDays] = useState(['', '', '', '', '']);
  return (
    <Card className="space-y-5 p-5">
      <div>
        <Label className="mb-2">{t('Set up your program')}</Label>
        <div className="text-[14px] leading-relaxed text-ink-2">{t('Five days, one body part each. You add your own exercises per day; phases last 8 weeks.')}</div>
      </div>
      <label className="block">
        <Label className="mb-2">{t('Program')}</Label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <Label className="mb-2">{t('Phase 1 starts')}</Label>
        <input type="date" className="field" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
      </label>
      <div className="space-y-2">
        <Label className="mb-2">{t('Days')}</Label>
        {days.map((d, i) => (
          <input
            key={i}
            className="field"
            value={d}
            placeholder={`${t('Day')} ${i + 1}`}
            onChange={(e) => setDays(days.map((x, j) => (j === i ? e.target.value : x)))}
          />
        ))}
      </div>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={async () => {
          await createProgram(name.trim() || DEFAULT_PROGRAM, start, days.map((d, i) => d.trim() || `${t('Day')} ${i + 1}`));
          haptic('success');
        }}
      >
        {t('Create program')}
      </Button>
    </Card>
  );
}
