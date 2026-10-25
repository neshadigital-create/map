import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Exercise, Session, SessionExercise, SetLog, SetType } from '../../db/types';
import { useSettings } from '../../db/hooks';
import {
  addExerciseToSession,
  addSet,
  bestBefore,
  deleteSet,
  discardSession,
  finishSession,
  lastSessionSets,
  removeExerciseFromSession,
  setExerciseFeedback,
  updateSet,
  useExerciseMap,
  useSessionSets,
} from '../../db/train';
import { e1rm, fmtKg, isCounted, overloadSuggestion, prKinds, weightStep } from '../../lib/training';
import { fmtDuration } from '../../lib/dates';
import { useNow } from '../../lib/useNow';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { useRest } from '../../store/rest';
import { haptic } from '../../lib/haptics';
import { unlockAudio } from '../../lib/sound';
import { Button, Card, IconButton, Label, Segmented, Sheet, Stepper } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Feeling } from './Feeling';
import { ExercisePicker } from './ExercisePicker';

/** Keep the screen awake during a workout where supported. */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const req = async () => {
      try {
        lock = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        /* not allowed */
      }
    };
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => undefined);
    };
  }, []);
}

const TYPE_SHORT: Record<SetType, string> = { warmup: 'W', working: '', drop: 'D', failure: 'F' };

export function SessionScreen({ sessionId }: { sessionId: string }) {
  const t = useT();
  const { setSessionView, open } = useUI();
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const sets = useSessionSets(sessionId);
  const exMap = useExerciseMap();
  const now = useNow(1000);
  const [panel, setPanel] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [finishing, setFinishing] = useState(false);
  useWakeLock();

  if (!session) return null;
  const doneCount = sets.filter((s) => s.done).length;
  const elapsed = (now.getTime() - session.startedAt) / 60000;

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto bg-bg">
      <div className="pt-safe sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-2 pb-2">
          <IconButton icon="chevronDown" label={t('Minimize')} onClick={() => setSessionView(null)} />
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[15px] font-medium">{session.name}</div>
            <div className="text-[12px] tabular-nums text-ink-3">
              {session.week ? `${t('Week')} ${session.week} · ` : ''}
              {fmtDuration(elapsed)}
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => setFinishing(true)} disabled={doneCount === 0} className="!px-4">
            {t('Finish')}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-3 px-4 pb-48 pt-4">
        {session.exercises.map((se) => (
          <ExerciseBlock
            key={se.exerciseId}
            session={session}
            se={se}
            exercise={exMap.get(se.exerciseId)}
            sets={sets.filter((s) => s.exerciseId === se.exerciseId).sort((a, b) => a.setIndex - b.setIndex)}
            onEdit={setPanel}
          />
        ))}
        {session.exercises.length === 0 && (
          <Card className="p-6 text-center text-[14px] text-ink-3">{t('Add the exercises you are doing today.')}</Card>
        )}
        <Button icon="plus" size="lg" className="w-full" onClick={() => setPicker(true)}>
          {t('Add exercise')}
        </Button>
        <Button
          variant="ghost"
          className="w-full !text-ink-3"
          onClick={async () => {
            if (!confirm(t('Discard this workout? Logged sets will be removed.'))) return;
            await discardSession(session.id);
            setSessionView(null);
          }}
        >
          {t('Discard workout')}
        </Button>
      </div>

      {panel && (
        <SetPanel
          set={sets.find((s) => s.id === panel)}
          seconds={exMap.get(sets.find((s) => s.id === panel)?.exerciseId ?? '')?.measure === 'seconds'}
          onClose={() => setPanel(null)}
        />
      )}
      {picker && (
        <ExercisePicker
          exclude={session.exercises.map((e) => e.exerciseId)}
          onClose={() => setPicker(false)}
          onPick={async (e) => {
            await addExerciseToSession(session.id, e.id);
            setPicker(false);
          }}
        />
      )}
      {finishing && (
        <FinishSheet
          session={session}
          onClose={() => setFinishing(false)}
          onDone={() => {
            setSessionView(null);
            useRest.getState().stop();
            open({ kind: 'summary', sessionId: session.id });
          }}
        />
      )}
    </div>
  );
}

function startRest(sec: number) {
  unlockAudio();
  useRest.getState().start(sec);
}

function ExerciseBlock({
  session,
  se,
  exercise,
  sets,
  onEdit,
}: {
  session: Session;
  se: SessionExercise;
  exercise?: Exercise;
  sets: SetLog[];
  onEdit: (id: string) => void;
}) {
  const t = useT();
  const settings = useSettings();
  const [note, setNote] = useState(se.note ?? '');
  const history = useLiveQuery(
    async () => ({ last: await lastSessionSets(se.exerciseId, session.id), best: await bestBefore(se.exerciseId, session.id) }),
    [se.exerciseId, session.id],
  );
  const last = history?.last ?? [];
  const lastWorking = last.filter((s) => s.type !== 'warmup');
  const seconds = exercise?.measure === 'seconds';
  // During a deload the plan says what to lift; no "try more" nudges.
  const sug = se.planNote ? null : overloadSuggestion(last, se.reps);

  // Show one PR badge per exercise: on the best set that beats history.
  const prSet = useMemo(() => {
    const best = history?.best ?? null;
    let top: SetLog | null = null;
    for (const s of sets) {
      if (!prKinds(s, best).length) continue;
      if (!top || e1rm(s.weight, s.reps) > e1rm(top.weight, top.reps)) top = s;
    }
    return top;
  }, [sets, history?.best]);

  let workingNo = 0;
  const anyDone = sets.some((s) => s.done);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-2 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] tracking-tight">{exercise?.name ?? '…'}</div>
          <div className="mt-1 text-[12px] text-ink-3">
            <span className="capitalize">{exercise ? t(exercise.muscle) : ''}</span>
            {se.reps ? ` · ${se.reps} ${seconds ? 's' : t('reps')}` : ''}
            {history?.best?.e1rm ? ` · e1RM ${Math.round(history.best.e1rm)} kg` : ''}
          </div>
        </div>
        <IconButton
          icon="trash"
          label={t('Remove exercise')}
          className="-mr-3 -mt-2 !text-ink-3"
          onClick={() => {
            if (!sets.some((s) => s.done) || confirm(t('Remove this exercise and its sets?'))) removeExerciseFromSession(session.id, se.exerciseId);
          }}
        />
      </div>
      {se.planNote && (
        <div className="mx-5 mt-3 rounded-xl bg-peach px-3 py-2.5 text-[13px] leading-snug text-peach-ink">{t(se.planNote)}</div>
      )}
      {sug && (
        <div className="mx-5 mt-3 rounded-xl border border-line px-3 py-2.5 text-[13px] leading-snug text-ink-2">
          {t('Last time')} {fmtKg(sug.last.weight)} kg × {sug.last.reps}
          {(sug.tryWeight || sug.tryReps) && (
            <>
              {' · '}
              <span className="text-ink">
                {t('try')} {sug.tryWeight ? `${fmtKg(sug.tryWeight)} kg` : ''}
                {sug.tryWeight && sug.tryReps ? ` ${t('or')} ` : ''}
                {sug.tryReps ? `${sug.tryReps} ${t('reps')}` : ''}
              </span>
            </>
          )}
        </div>
      )}

      <div className="mt-3">
        <div className="grid grid-cols-[2.5rem_1fr_5rem_3.5rem] items-center gap-2 px-5 pb-1.5">
          <Label>{t('Set')}</Label>
          <Label>{seconds ? t('seconds') : `kg × ${t('reps')}`}</Label>
          <Label className="text-right">{t('Last')}</Label>
          <span />
        </div>
        {sets.map((s) => {
          const no = s.type === 'working' ? ++workingNo : 0;
          const ref = s.type === 'warmup' ? undefined : lastWorking[no ? no - 1 : 0];
          return (
            <div key={s.id} className={`grid grid-cols-[2.5rem_1fr_5rem_3.5rem] items-center gap-2 border-t border-line pl-5 pr-3 transition-colors duration-200 ${s.done ? 'bg-raised' : ''}`}>
              <button onClick={() => onEdit(s.id)} className={`tap h-14 text-left text-[15px] tabular-nums ${s.type === 'working' ? 'text-ink-2' : 'text-fat'}`}>
                {TYPE_SHORT[s.type] || no}
              </button>
              <button onClick={() => onEdit(s.id)} className="tap flex h-14 items-center gap-2 text-left">
                <span className={`numeral text-[26px] ${s.done ? 'text-ink' : 'text-ink-2'}`}>
                  {seconds ? (
                    <>
                      {s.reps}
                      <span className="ml-1 text-[16px] text-ink-3">s</span>
                      {s.weight > 0 && <span className="ml-2 text-[16px] text-ink-3">+{fmtKg(s.weight)} kg</span>}
                    </>
                  ) : (
                    <>
                      {fmtKg(s.weight)}
                      <span className="mx-1.5 text-[16px] text-ink-3">×</span>
                      {s.reps}
                    </>
                  )}
                </span>
                {prSet?.id === s.id && (
                  <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-on-accent">PR</span>
                )}
              </button>
              <div className="text-right text-[12px] tabular-nums text-ink-3">{ref ? (seconds ? `${ref.reps} s` : `${fmtKg(ref.weight)}×${ref.reps}`) : '—'}</div>
              <button
                aria-label={s.done ? t('Undo') : t('Log set')}
                onClick={async () => {
                  const done = !s.done;
                  haptic(done ? 'success' : 'tap');
                  await updateSet(s.id, { done });
                  if (done) startRest(settings.restTimerSec);
                }}
                className={`tap mx-auto grid size-11 place-items-center rounded-full border transition-colors duration-200 ${
                  s.done ? 'border-accent bg-accent text-on-accent' : 'border-line-strong text-ink-3'
                }`}
              >
                <Icon name="check" size={20} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="border-t border-line px-3 py-2">
        <Button variant="ghost" icon="plus" size="sm" className="w-full" onClick={() => addSet(session.id, se.exerciseId)}>
          {t('Add set')}
        </Button>
      </div>
      {anyDone && (
        <div className="anim-rise space-y-3 border-t border-line px-5 pb-5 pt-4">
          <Label>{t('How did it feel')}</Label>
          <Feeling value={se.feeling} onChange={(feeling) => setExerciseFeedback(session.id, se.exerciseId, { feeling })} />
          <input
            className="field !min-h-11 text-[14px]"
            placeholder={t('Note, e.g. left knee tight')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (se.note ?? '') && setExerciseFeedback(session.id, se.exerciseId, { note: note.trim() || undefined })}
          />
        </div>
      )}
    </Card>
  );
}

function SetPanel({ set, onClose, seconds = false }: { set?: SetLog; onClose: () => void; seconds?: boolean }) {
  const t = useT();
  const settings = useSettings();
  const [weight, setWeight] = useState(set?.weight ?? 0);
  const [reps, setReps] = useState(set?.reps ?? 10);
  const [type, setType] = useState<SetType>(set?.type ?? 'working');
  if (!set) return null;
  const step = weightStep(weight);
  return (
    <Sheet
      title={t('Set')}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button
            variant="danger"
            icon="trash"
            aria-label={t('Delete')}
            onClick={async () => {
              await deleteSet(set.id);
              onClose();
            }}
          />
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={async () => {
              haptic('success');
              const wasDone = set.done;
              await updateSet(set.id, { weight, reps, type, done: true });
              if (!wasDone) startRest(settings.restTimerSec);
              onClose();
            }}
          >
            {set.done ? t('Save') : t('Log set')}
          </Button>
        </div>
      }
    >
      <div className="space-y-7 pt-2">
        <div>
          <Label className="mb-3 text-center">{t('Weight')}</Label>
          <Stepper value={weight} onChange={setWeight} step={step} unit="kg" large decimals={2} />
          <div className="mt-3 flex justify-center gap-2">
            {[-5, -step, step, 5].map((d, i) => (
              <button
                key={i}
                onClick={() => {
                  haptic();
                  setWeight(Math.max(0, Math.round((weight + d) * 100) / 100));
                }}
                className="tap min-h-10 rounded-full border border-line px-4 text-[13px] tabular-nums text-ink-2"
              >
                {d > 0 ? '+' : '−'}
                {Math.abs(d)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="mb-3 text-center">{seconds ? t('seconds') : t('reps')}</Label>
          <Stepper value={reps} onChange={setReps} step={seconds ? 5 : 1} unit={seconds ? 's' : undefined} large decimals={0} />
        </div>
        <Segmented<SetType>
          value={type}
          onChange={setType}
          options={[
            { value: 'warmup', label: t('Warm-up') },
            { value: 'working', label: t('Working') },
            { value: 'drop', label: t('Drop') },
            { value: 'failure', label: t('Failure') },
          ]}
        />
      </div>
    </Sheet>
  );
}

function FinishSheet({ session, onClose, onDone }: { session: Session; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [feeling, setFeeling] = useState<number | undefined>(session.feeling);
  const [note, setNote] = useState(session.note ?? '');
  const sets = useSessionSets(session.id);
  const counted = sets.filter(isCounted).length;
  return (
    <Sheet
      title={t('Finish workout')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={async () => {
            await finishSession(session.id, feeling, note);
            haptic('success');
            onDone();
          }}
        >
          {t('Finish')}
        </Button>
      }
    >
      <div className="space-y-5 pt-2">
        <div className="text-[14px] text-ink-2">{t('{n} sets logged', { n: counted })}</div>
        <div>
          <Label className="mb-3">{t('How did the session feel')}</Label>
          <Feeling value={feeling} onChange={setFeeling} size="lg" />
        </div>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('Note, e.g. felt strong')}
          className="field resize-none !py-3 text-[15px]"
        />
      </div>
    </Sheet>
  );
}
