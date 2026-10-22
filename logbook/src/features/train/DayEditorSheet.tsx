import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { DayTemplate } from '../../db/types';
import { newPlanned, saveDayTemplate, useExerciseMap } from '../../db/train';
import { useSettings } from '../../db/hooks';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { Button, IconButton, Label, Sheet } from '../../components/ui';
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
      title={day.name}
      onClose={close}
      tall
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={day.exercises.length === 0} onClick={() => startWorkout({ template: day, phase, tz: settings.timezone })}>
          {t('Start')} · {day.name}
        </Button>
      }
    >
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
                    placeholder="8-12"
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
    </Sheet>
  );
}
