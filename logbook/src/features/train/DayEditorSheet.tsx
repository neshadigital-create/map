import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { DayTemplate } from '../../db/types';
import { newPlanned, saveDayTemplate, useExerciseMap } from '../../db/train';
import { useSettings } from '../../db/hooks';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { Button, IconButton, Label, Sheet } from '../../components/ui';
import { CoverButton, PhotoCard, Thumb } from '../../components/Photo';
import { dayCoverId, exerciseCoverId } from '../../lib/covers';
import { fmtKg, phaseLabel } from '../../lib/training';
import { lastSessionSets } from '../../db/train';
import type { PlannedExercise } from '../../db/types';
import { ExercisePicker } from './ExercisePicker';
import { startWorkout } from './useStartWorkout';

/** Edit one day of the split: name and the exercises I do on it. Changes save as I go. */
export function DayEditorSheet({ dayId }: { dayId: string }) {
  const t = useT();
  const { close } = useUI();
  const settings = useSettings();
  const stored = useLiveQuery(() => db.dayTemplates.get(dayId), [dayId]);
  const phase = useLiveQuery(async () => (stored ? db.phases.get(stored.phaseId) : undefined), [stored?.phaseId]);
  const exMap = useExerciseMap();
  const [day, setDay] = useState<DayTemplate | null>(null);
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (stored && !day) setDay(stored);
  }, [stored, day]);

  if (!day) return null;
  const update = (d: DayTemplate) => {
    setDay(d);
    saveDayTemplate(d);
  };
  const move = (i: number, dir: -1 | 1) => {
    const list = [...day.exercises];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    update({ ...day, exercises: list });
  };

  if (picker) {
    return (
      <ExercisePicker
        exclude={day.exercises.map((e) => e.exerciseId)}
        onClose={() => setPicker(false)}
        onPick={(e) => {
          update({ ...day, exercises: [...day.exercises, newPlanned(e.id)] });
          setPicker(false);
        }}
      />
    );
  }

  return (
    <Sheet
      title={phase ? `${phaseLabel(phase)} · ${t('Day')} ${day.order + 1}` : day.name}
      onClose={close}
      tall
      right={
        <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
          {editing ? t('Done') : t('Edit')}
        </Button>
      }
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={day.exercises.length === 0} onClick={() => startWorkout({ template: day, phase, tz: settings.timezone })}>
          {t('Start training')}
        </Button>
      }
    >
      <PhotoCard coverId={dayCoverId(day.name)} className="h-[190px]">
        <div className="flex h-full flex-col justify-between p-3.5">
          <div className="flex justify-end">
            <CoverButton coverId={dayCoverId(day.name)} />
          </div>
          <div className="display text-[34px]">{day.name}</div>
        </div>
      </PhotoCard>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <span>
          {day.exercises.length} {t(day.exercises.length === 1 ? 'exercise' : 'exercises')}
        </span>
        <span>{day.exercises.reduce((n, e) => n + e.sets + (e.warmup ? 1 : 0), 0)} {t('sets')}</span>
        {phase?.kind === 'deload' && <span>{t('Deload: 3 × 5 at your last hard-set weight')}</span>}
      </div>

      {!editing ? (
        <div className="mt-3">
          {day.exercises.map((pe, i) => (
            <ExerciseRow key={pe.id} pe={pe} index={i} name={exMap.get(pe.exerciseId)?.name ?? '…'} seconds={exMap.get(pe.exerciseId)?.measure === 'seconds'} />
          ))}
          {day.exercises.length === 0 && <div className="py-6 text-center text-[14px] text-ink-3">{t('Tap Edit to add the exercises for this day.')}</div>}
        </div>
      ) : (
      <div className="space-y-5 pt-1">
        <label className="block">
          <Label className="mb-2">{t('Name')}</Label>
          <input className="field" value={day.name} placeholder="Legs" onChange={(e) => update({ ...day, name: e.target.value })} />
        </label>
        <div>
          <Label className="mb-1">{t('Exercises')}</Label>
          {day.exercises.length === 0 && <div className="py-4 text-[13px] text-ink-3">{t('Add the exercises for this day from your program.')}</div>}
          {day.exercises.map((pe, i) => (
            <div key={pe.id} className="border-b border-line py-3">
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px]">{exMap.get(pe.exerciseId)?.name ?? '…'}</div>
                  <div className="text-[12px] capitalize text-ink-3">{t(exMap.get(pe.exerciseId)?.muscle ?? '')}</div>
                </div>
                <IconButton icon="chevronLeft" label={t('Move up')} className="rotate-90" onClick={() => move(i, -1)} disabled={i === 0} />
                <IconButton icon="chevronRight" label={t('Move down')} className="rotate-90" onClick={() => move(i, 1)} disabled={i === day.exercises.length - 1} />
                <IconButton icon="close" label={t('Delete')} className="-mr-3" onClick={() => update({ ...day, exercises: day.exercises.filter((x) => x.id !== pe.id) })} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <span className="label w-10">{t('Sets')}</span>
                  <input
                    inputMode="numeric"
                    className="field !min-h-11 tabular-nums"
                    value={pe.sets}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(10, Number(e.target.value) || 1));
                      update({ ...day, exercises: day.exercises.map((x) => (x.id === pe.id ? { ...x, sets: n } : x)) });
                    }}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="label w-10">{t('reps')}</span>
                  <input
                    className="field !min-h-11 tabular-nums"
                    value={pe.reps}
                    placeholder={t('hard')}
                    onChange={(e) => update({ ...day, exercises: day.exercises.map((x) => (x.id === pe.id ? { ...x, reps: e.target.value } : x)) })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <Button icon="plus" className="w-full" onClick={() => setPicker(true)}>
          {t('Add exercise')}
        </Button>
      </div>
      )}
    </Sheet>
  );
}

/** Read-only row: thumbnail, name, plan, and what I lifted last time. */
function ExerciseRow({ pe, index, name, seconds }: { pe: PlannedExercise; index: number; name: string; seconds: boolean }) {
  const t = useT();
  const last = useLiveQuery(() => lastSessionSets(pe.exerciseId), [pe.exerciseId]);
  const top = (last ?? []).filter((s) => s.type !== 'warmup').reduce<null | { weight: number; reps: number }>(
    (a, s) => (!a || s.weight > a.weight || (s.weight === a.weight && s.reps > a.reps) ? { weight: s.weight, reps: s.reps } : a),
    null,
  );
  const plan = `${pe.warmup ? `${t('Warm-up')} + ` : ''}${pe.sets} × ${pe.reps || t('hard')}${seconds && pe.reps ? ' s' : ''}`;
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <Thumb coverId={exerciseCoverId(pe.exerciseId)} label={String(index + 1)} size={56} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold leading-snug">{name}</div>
        <div className="mt-0.5 text-[12px] text-ink-3">
          {plan}
          {top ? ` · ${t('last')} ${seconds ? `${top.reps} s` : `${fmtKg(top.weight)} kg × ${top.reps}`}` : ''}
        </div>
        {pe.note && <div className="mt-0.5 text-[12px] text-peach-ink">{t(pe.note)}</div>}
      </div>
      <CoverButton coverId={exerciseCoverId(pe.exerciseId)} className="!size-9 !bg-raised !text-ink-2 !shadow-none" />
    </div>
  );
}
