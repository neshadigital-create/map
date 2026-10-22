import { useState } from 'react';
import { useSettings } from '../../db/hooks';
import { createProgram, DEFAULT_PROGRAM, useActiveSession, useProgram, useWeekTraining } from '../../db/train';
import { nextDayTemplate, cardioKcal } from '../../lib/training';
import { dayKey, fmtDuration, weekStart } from '../../lib/dates';
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
          <Label className="mb-2.5 truncate">
            {prog.phase ? `${t('Phase')} ${prog.phase.index} · ${t('Week')} ${Math.max(1, prog.week)} / ${prog.phase.weeks}` : prog.program?.name ?? t('No program yet')}
          </Label>
          <h1 className="text-[30px] font-light tracking-[-0.03em]">{t('Train')}</h1>
        </div>
        {prog.phase && <IconButton icon="edit" label={t('Program')} onClick={() => open({ kind: 'program' })} className="-mr-2" />}
      </header>

      {active && <ActiveBanner />}
      {!prog.phase ? (
        <SetupCard today={today} />
      ) : (
        <>
          {prog.week > prog.phase.weeks && (
            <Card className="p-5">
              <Label className="mb-2">{t('Phase complete')}</Label>
              <div className="text-[14px] text-ink-2">{t('Week {n} of an {m}-week phase. Ready to swap exercises?', { n: prog.week, m: prog.phase.weeks })}</div>
              <Button className="mt-3 w-full" onClick={() => open({ kind: 'program' })}>
                {t('Start new phase')}
              </Button>
            </Card>
          )}
          <NextCard />
          <Card className="overflow-hidden">
            <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
              <Label>{t('This week')}</Label>
              <span className="text-[12px] text-ink-3">
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
                  className="tap flex min-h-16 w-full items-center gap-4 border-t border-line px-5 text-left active:bg-raised"
                >
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full border ${done ? 'border-accent bg-accent text-white' : 'border-line-strong text-ink-3'}`}>
                    {done ? <Icon name="check" size={16} /> : <span className="text-[11px] tabular-nums">{d.order + 1}</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{d.name}</span>
                    <span className="block text-[12px] text-ink-3">
                      {d.exercises.length} {t('exercises')}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={18} className="text-ink-3" />
                </button>
              );
            })}
          </Card>
        </>
      )}

      <CardioCard />
      <HistoryCalendar today={today} />
    </div>
  );

  function NextCard() {
    const next = nextDayTemplate(prog.days, week.doneTemplateIds);
    return (
      <Card className="p-5">
        <Label className="mb-3">{next ? t('Next') : t('Week complete')}</Label>
        {next ? (
          <>
            <div className="text-[24px] font-light tracking-tight">{next.name}</div>
            <div className="mt-1 text-[13px] text-ink-3">
              {next.exercises.length ? `${next.exercises.length} ${t('exercises')}` : t('No exercises yet. Tap the day below to add them.')}
            </div>
            <Button
              variant="primary"
              size="lg"
              className="mt-4 w-full"
              onClick={() => (next.exercises.length ? startWorkout({ template: next, phase: prog.phase, tz: settings.timezone }) : open({ kind: 'dayEditor', dayId: next.id }))}
            >
              {active ? t('Resume') : next.exercises.length ? t('Start') : t('Add exercises')}
            </Button>
          </>
        ) : (
          <div className="text-[14px] text-ink-2">{t('All {n} days done this week. Rest well.', { n: prog.days.length })}</div>
        )}
      </Card>
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
