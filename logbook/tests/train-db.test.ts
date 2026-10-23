import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import {
  addSet,
  createExercise,
  createProgram,
  finishSession,
  lastSessionSets,
  saveDayTemplate,
  startNewPhase,
  startSession,
  updateSet,
} from '../src/db/train';

describe('training data', () => {
  it('runs a phase: plan, log, prefill, new phase', async () => {
    const phase = await createProgram('Year One', '2026-10-22', ['Legs', 'Back', 'Glutes', 'Shoulders', 'Arms']);
    expect(phase.startDate).toBe('2026-10-18'); // weeks start on Sunday
    const days = await db.dayTemplates.where('phaseId').equals(phase.id).sortBy('order');
    expect(days.map((d) => d.name)).toEqual(['Legs', 'Back', 'Glutes', 'Shoulders', 'Arms']);

    const squat = await createExercise('Goblet squat', 'quads');
    await saveDayTemplate({ ...days[0], exercises: [{ id: 'p1', exerciseId: squat.id, sets: 3, reps: '8-12' }] });
    const legs = (await db.dayTemplates.get(days[0].id))!;

    // First session: no history, reps default to bottom of range
    const s1 = await startSession({ day: '2026-10-19', template: legs, phase });
    let sets = await db.sets.where('sessionId').equals(s1.id).sortBy('setIndex');
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ weight: 0, reps: 8, done: false });
    expect(s1.week).toBe(1);
    for (const [i, s] of sets.entries()) await updateSet(s.id, { weight: 20, reps: 12 - i, done: i < 2 });
    await addSet(s1.id, squat.id);
    await finishSession(s1.id, 4, 'felt strong');
    sets = await db.sets.where('sessionId').equals(s1.id).toArray();
    expect(sets).toHaveLength(2); // unticked sets are dropped
    expect((await db.sessions.get(s1.id))?.endedAt).toBeTruthy();

    // Second session is prefilled from the first
    const s2 = await startSession({ day: '2026-10-26', template: legs, phase });
    const pre = await db.sets.where('sessionId').equals(s2.id).sortBy('setIndex');
    expect(pre.map((s) => [s.weight, s.reps])).toEqual([
      [20, 12],
      [20, 11],
      [20, 11],
    ]);
    expect(s2.week).toBe(2);
    expect((await lastSessionSets(squat.id, s2.id)).map((s) => s.reps)).toEqual([12, 11]);

    // New phase copies days and exercises with fresh ids
    const p2 = (await startNewPhase('2026-12-16'))!;
    expect(p2.index).toBe(2);
    expect(p2.startDate).toBe('2026-12-13');
    const days2 = await db.dayTemplates.where('phaseId').equals(p2.id).sortBy('order');
    expect(days2).toHaveLength(5);
    expect(days2[0].exercises[0].exerciseId).toBe(squat.id);
    expect(days2[0].id).not.toBe(days[0].id);
  });
});
