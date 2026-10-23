import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { createExercise, createProgram, fillHardSetReps, finishSession, loadYearOnePlan, startSession, updateSet } from '../src/db/train';
import { currentPhase, phaseLabel, phaseWeek } from '../src/lib/training';

describe('Year One plan', () => {
  it('adds Deload 1 then Phase 2 after my existing phase, reusing exercises', async () => {
    const p1 = await createProgram('The Year One Challenge for Women', '2026-08-31', ['Legs', 'Push', 'Pull', 'Upper', 'Glutes']);
    const squat = await createExercise('barbell squat', 'quads');
    const day = (await db.dayTemplates.where('phaseId').equals(p1.id).first())!;
    await db.dayTemplates.update(day.id, { exercises: [{ id: 'x', exerciseId: squat.id, sets: 3, reps: '8-10' }] });
    // a hard set history so the deload can reuse the weight
    const s = await startSession({ day: '2026-10-19', template: (await db.dayTemplates.get(day.id))!, phase: p1 });
    for (const set of await db.sets.where('sessionId').equals(s.id).toArray()) await updateSet(set.id, { weight: 50, reps: 9, done: true });
    await finishSession(s.id);

    expect(await loadYearOnePlan('2026-10-26')).toBe(true);
    expect(await loadYearOnePlan('2026-10-26')).toBe(false); // idempotent

    const phases = await db.phases.orderBy('index').toArray();
    expect(phases.map((p) => [phaseLabel(p), p.startDate, p.weeks])).toEqual([
      ['Phase 1', '2026-08-31', 8],
      ['Deload 1', '2026-10-26', 1],
      ['Phase 2', '2026-11-02', 8],
    ]);
    const deloadDays = await db.dayTemplates.where('phaseId').equals(phases[1].id).sortBy('order');
    expect(deloadDays.map((d) => d.name)).toEqual(['Deload Legs', 'Deload Push', 'Deload Pull']);
    const p2Days = await db.dayTemplates.where('phaseId').equals(phases[2].id).sortBy('order');
    expect(p2Days).toHaveLength(5);
    expect(p2Days[1].exercises).toHaveLength(5);
    // same exercise row reused, so history carries over
    expect(deloadDays[0].exercises[0].exerciseId).toBe(squat.id);
    expect(p2Days[0].exercises[0].exerciseId).toBe(squat.id);
    const plank = (await db.exercises.toArray()).find((e) => e.name === 'Plank');
    expect(plank?.measure).toBe('seconds');
    // hard sets are 8-10, the plank stays a timed hold
    expect(p2Days[0].exercises.map((e) => e.reps)).toEqual(['8-10', '8-10', '8-10', '8-10']);
    expect(p2Days[3].exercises.find((e) => e.exerciseId === plank!.id)?.reps).toBe('');
    // plans loaded before the change get filled in, typed targets are kept
    await db.dayTemplates.update(p2Days[1].id, { exercises: p2Days[1].exercises.map((e, i) => ({ ...e, reps: i === 0 ? '6-8' : '' })) });
    await fillHardSetReps();
    expect((await db.dayTemplates.get(p2Days[1].id))!.exercises.map((e) => e.reps)).toEqual(['6-8', '8-10', '8-10', '8-10', '8-10']);

    // which phase is current
    expect(phaseLabel(currentPhase(phases, '2026-10-24')!.phase)).toBe('Phase 1');
    expect(phaseLabel(currentPhase(phases, '2026-10-28')!.phase)).toBe('Deload 1');
    expect(phaseLabel(currentPhase(phases, '2026-11-12')!.phase)).toBe('Phase 2');
    expect(phaseWeek(phases[2], '2026-11-12')).toBe(2);

    // deload session: warm-up set + 3 x 5 at the last hard-set weight
    const ds = await startSession({ day: '2026-10-26', template: deloadDays[0], phase: phases[1] });
    const sets = (await db.sets.where('sessionId').equals(ds.id).sortBy('setIndex')).filter((x) => x.exerciseId === squat.id);
    expect(sets.map((x) => [x.type, x.weight, x.reps])).toEqual([
      ['warmup', 25, 10],
      ['working', 50, 5],
      ['working', 50, 5],
      ['working', 50, 5],
    ]);
  });

  it('shows an upcoming phase when nothing has started', () => {
    const res = currentPhase([{ startDate: '2026-10-26', index: 1 }], '2026-10-23');
    expect(res?.upcoming).toBe(true);
  });
});
