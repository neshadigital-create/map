import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './index';
import type { Cardio, DayTemplate, Exercise, Muscle, Phase, PlannedExercise, Program, Session, SetLog, SetType } from './types';
import { uid } from '../lib/id';
import { bestOf, parseRepRange, phaseWeek, type Best } from '../lib/training';
import { dayKey, weekDays, weekStart } from '../lib/dates';

/* ---------------- Program & phases ---------------- */

export const DEFAULT_PROGRAM = 'The Year One Challenge for Women';

export async function createProgram(name: string, startDate: string, dayNames: string[]) {
  const now = Date.now();
  const program: Program = { id: uid(), name, createdAt: now };
  const phase: Phase = { id: uid(), programId: program.id, index: 1, startDate: weekStart(startDate), weeks: 8, createdAt: now };
  const days: DayTemplate[] = dayNames.map((n, i) => ({ id: uid(), phaseId: phase.id, order: i, name: n.trim() || `Day ${i + 1}`, exercises: [] }));
  await db.transaction('rw', db.programs, db.phases, db.dayTemplates, async () => {
    await db.programs.add(program);
    await db.phases.add(phase);
    await db.dayTemplates.bulkAdd(days);
  });
  return phase;
}

/** New 8-week phase starting this Monday, copying the previous phase's days so exercises can be swapped. */
export async function startNewPhase(today: string) {
  const prev = await db.phases.orderBy('index').last();
  if (!prev) return;
  const days = await db.dayTemplates.where('phaseId').equals(prev.id).sortBy('order');
  const phase: Phase = { ...prev, id: uid(), index: prev.index + 1, startDate: weekStart(today), createdAt: Date.now() };
  await db.transaction('rw', db.phases, db.dayTemplates, async () => {
    await db.phases.add(phase);
    await db.dayTemplates.bulkAdd(
      days.map((d) => ({ ...d, id: uid(), phaseId: phase.id, exercises: d.exercises.map((e) => ({ ...e, id: uid() })) })),
    );
  });
  return phase;
}

export async function updatePhase(id: string, patch: Partial<Phase>) {
  await db.phases.update(id, patch);
}

export async function saveDayTemplate(day: DayTemplate) {
  await db.dayTemplates.put(day);
}

export async function renameProgram(id: string, name: string) {
  await db.programs.update(id, { name });
}

export async function createExercise(name: string, muscle: Muscle): Promise<Exercise> {
  const ex: Exercise = { id: uid(), name: name.trim(), muscle, createdAt: Date.now() };
  await db.exercises.add(ex);
  return ex;
}

export async function updateExercise(id: string, patch: Partial<Exercise>) {
  await db.exercises.update(id, patch);
}

/* ---------------- History lookups ---------------- */

/** Sets from the most recent other session that logged this exercise. */
export async function lastSessionSets(exerciseId: string, excludeSessionId?: string): Promise<SetLog[]> {
  const rows = await db.sets.where('[exerciseId+at]').between([exerciseId, 0], [exerciseId, Infinity]).reverse().toArray();
  const done = rows.filter((r) => r.done && r.sessionId !== excludeSessionId);
  const sid = done[0]?.sessionId;
  if (!sid) return [];
  return done.filter((r) => r.sessionId === sid).sort((a, b) => a.setIndex - b.setIndex);
}

/** Best weight and e1RM from every other session (null when there is no history). */
export async function bestBefore(exerciseId: string, excludeSessionId: string, beforeTs = Infinity): Promise<Best | null> {
  const rows = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  const others = rows.filter((r) => r.sessionId !== excludeSessionId && r.done && r.at < beforeTs);
  if (!others.length) return null;
  return bestOf(others);
}

/* ---------------- Sessions ---------------- */

async function plannedSets(sessionId: string, exerciseId: string, count: number, reps?: string, startIndex = 0): Promise<SetLog[]> {
  const last = (await lastSessionSets(exerciseId, sessionId)).filter((s) => s.type !== 'warmup');
  const range = parseRepRange(reps);
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const ref = last[Math.min(i, last.length - 1)];
    return {
      id: uid(),
      sessionId,
      exerciseId,
      setIndex: startIndex + i,
      type: 'working' as SetType,
      weight: ref?.weight ?? 0,
      reps: ref?.reps ?? range?.min ?? 10,
      done: false,
      at: now + i,
    };
  });
}

export async function startSession(opts: { day: string; template?: DayTemplate; phase?: Phase; name?: string }) {
  const { day, template, phase } = opts;
  const session: Session = {
    id: uid(),
    day,
    name: template?.name ?? opts.name ?? 'Workout',
    phaseId: phase?.id,
    dayTemplateId: template?.id,
    week: phase ? phaseWeek(phase, day) : undefined,
    startedAt: Date.now(),
    exercises: (template?.exercises ?? []).map((e) => ({ exerciseId: e.exerciseId, reps: e.reps })),
  };
  const sets: SetLog[] = [];
  for (const pe of template?.exercises ?? []) sets.push(...(await plannedSets(session.id, pe.exerciseId, pe.sets, pe.reps)));
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.add(session);
    await db.sets.bulkAdd(sets);
  });
  return session;
}

export async function addExerciseToSession(sessionId: string, exerciseId: string, sets = 3, reps = '8-12') {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const rows = await plannedSets(sessionId, exerciseId, sets, reps);
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.update(sessionId, { exercises: [...s.exercises, { exerciseId, reps }] });
    await db.sets.bulkAdd(rows);
  });
}

export async function removeExerciseFromSession(sessionId: string, exerciseId: string) {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.update(sessionId, { exercises: s.exercises.filter((e) => e.exerciseId !== exerciseId) });
    await db.sets.where('sessionId').equals(sessionId).filter((x) => x.exerciseId === exerciseId).delete();
  });
}

export async function addSet(sessionId: string, exerciseId: string) {
  const existing = (await db.sets.where('sessionId').equals(sessionId).toArray())
    .filter((x) => x.exerciseId === exerciseId)
    .sort((a, b) => a.setIndex - b.setIndex);
  const ref = existing[existing.length - 1];
  await db.sets.add({
    id: uid(),
    sessionId,
    exerciseId,
    setIndex: (ref?.setIndex ?? -1) + 1,
    type: ref?.type === 'warmup' ? 'working' : (ref?.type ?? 'working'),
    weight: ref?.weight ?? 0,
    reps: ref?.reps ?? 10,
    done: false,
    at: Date.now(),
  });
}

export async function updateSet(id: string, patch: Partial<SetLog>) {
  await db.sets.update(id, patch.done ? { ...patch, at: Date.now() } : patch);
}

export async function deleteSet(id: string) {
  await db.sets.delete(id);
}

export async function setExerciseFeedback(sessionId: string, exerciseId: string, patch: { feeling?: number; note?: string }) {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  await db.sessions.update(sessionId, {
    exercises: s.exercises.map((e) => (e.exerciseId === exerciseId ? { ...e, ...patch } : e)),
  });
}

/** Ends the session. Sets that were never ticked are removed so history stays clean. */
export async function finishSession(id: string, feeling?: number, note?: string) {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(id).filter((x) => !x.done).delete();
    const s = await db.sessions.get(id);
    const logged = new Set((await db.sets.where('sessionId').equals(id).toArray()).map((x) => x.exerciseId));
    await db.sessions.update(id, {
      endedAt: Date.now(),
      feeling,
      note: note?.trim() || undefined,
      exercises: (s?.exercises ?? []).filter((e) => logged.has(e.exerciseId)),
    });
  });
}

export async function discardSession(id: string) {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

/* ---------------- Cardio ---------------- */

export async function saveCardio(c: Omit<Cardio, 'id' | 'at'> & Partial<Pick<Cardio, 'id' | 'at'>>) {
  await db.cardio.put({ ...c, id: c.id ?? uid(), at: c.at ?? Date.now() });
}

export async function deleteCardio(id: string) {
  await db.cardio.delete(id);
}

/* ---------------- Hooks ---------------- */

export interface ProgramState {
  loaded: boolean;
  program?: Program;
  phase?: Phase;
  days: DayTemplate[];
  week: number;
}

export function useProgram(today = dayKey()): ProgramState {
  return (
    useLiveQuery(async () => {
      const phase = await db.phases.orderBy('index').last();
      const program = phase ? await db.programs.get(phase.programId) : await db.programs.toCollection().first();
      const days = phase ? await db.dayTemplates.where('phaseId').equals(phase.id).sortBy('order') : [];
      return { loaded: true, program, phase, days, week: phase ? phaseWeek(phase, today) : 0 };
    }, [today]) ?? { loaded: false, days: [], week: 0 }
  );
}

export function useExercises(): Exercise[] {
  return useLiveQuery(() => db.exercises.orderBy('name').toArray(), []) ?? [];
}

export function useExerciseMap(): Map<string, Exercise> {
  const list = useExercises();
  return new Map(list.map((e) => [e.id, e]));
}

export function useActiveSession(): Session | undefined {
  return useLiveQuery(async () => {
    const recent = await db.sessions.orderBy('startedAt').reverse().limit(5).toArray();
    return recent.find((s) => !s.endedAt);
  }, []);
}

export function useSessionSets(sessionId: string | undefined): SetLog[] {
  return useLiveQuery(async () => (sessionId ? db.sets.where('sessionId').equals(sessionId).toArray() : []), [sessionId]) ?? [];
}

export interface WeekTraining {
  sessions: Session[];
  cardio: Cardio[];
  doneTemplateIds: Set<string>;
  cardioMinutes: number;
}

export function useWeekTraining(day: string): WeekTraining {
  return (
    useLiveQuery(async () => {
      const keys = weekDays(day);
      const sessions = (await db.sessions.where('day').anyOf(keys).toArray()).filter((s) => s.endedAt);
      const cardio = await db.cardio.where('day').anyOf(keys).toArray();
      return {
        sessions,
        cardio,
        doneTemplateIds: new Set(sessions.map((s) => s.dayTemplateId).filter(Boolean) as string[]),
        cardioMinutes: cardio.reduce((s, c) => s + c.minutes, 0),
      };
    }, [day]) ?? { sessions: [], cardio: [], doneTemplateIds: new Set(), cardioMinutes: 0 }
  );
}

export function newPlanned(exerciseId: string): PlannedExercise {
  return { id: uid(), exerciseId, sets: 3, reps: '8-12' };
}
