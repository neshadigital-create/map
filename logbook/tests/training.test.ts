import { describe, expect, it } from 'vitest';
import {
  e1rm,
  volume,
  prKinds,
  overloadSuggestion,
  parseRepRange,
  cardioKcal,
  liftingKcal,
  phaseWeek,
  nextDayTemplate,
} from '../src/lib/training';
import type { SetLog, DayTemplate } from '../src/db/types';

const set = (weight: number, reps: number, type: SetLog['type'] = 'working', done = true): SetLog => ({
  id: Math.random().toString(),
  sessionId: 's',
  exerciseId: 'e',
  setIndex: 0,
  type,
  weight,
  reps,
  done,
  at: 0,
});

describe('strength math', () => {
  it('Epley e1RM', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(40, 10)).toBeCloseTo(53.33, 1);
    expect(e1rm(40, 20)).toBeCloseTo(e1rm(40, 12));
    expect(e1rm(0, 10)).toBe(0);
  });
  it('volume skips warm-ups and unfinished sets', () => {
    expect(volume([set(20, 10, 'warmup'), set(40, 10), set(40, 8), set(40, 8, 'working', false)])).toBe(720);
  });
  it('detects PRs only against history', () => {
    expect(prKinds(set(42.5, 8), null)).toEqual([]);
    expect(prKinds(set(42.5, 8), { weight: 40, e1rm: 53.3 })).toEqual(['weight', 'e1rm']);
    expect(prKinds(set(40, 12), { weight: 40, e1rm: 53.3 })).toEqual(['e1rm']);
    expect(prKinds(set(50, 5, 'warmup'), { weight: 40, e1rm: 53.3 })).toEqual([]);
  });
});

describe('progressive overload', () => {
  it('parses rep ranges', () => {
    expect(parseRepRange('8-12')).toEqual({ min: 8, max: 12 });
    expect(parseRepRange('10')).toEqual({ min: 10, max: 10 });
    expect(parseRepRange('')).toBeNull();
  });
  it('suggests more weight or more reps', () => {
    expect(overloadSuggestion([set(40, 10), set(40, 9)], '8-12')).toEqual({
      last: { weight: 40, reps: 10 },
      tryWeight: 42.5,
      tryReps: 12,
    });
  });
  it('only suggests weight at the top of the range', () => {
    const s = overloadSuggestion([set(40, 12), set(40, 12)], '8-12');
    expect(s?.tryWeight).toBe(42.5);
    expect(s?.tryReps).toBeUndefined();
  });
  it('uses 1 kg steps for light dumbbells', () => {
    expect(overloadSuggestion([set(6, 12)], '10-15')?.tryWeight).toBe(7);
  });
  it('ignores warm-ups', () => {
    expect(overloadSuggestion([set(20, 10, 'warmup')], '8-12')).toBeNull();
  });
});

describe('energy estimates', () => {
  it('walking on a treadmill incline costs more than flat', () => {
    const flat = cardioKcal({ minutes: 45, speedKmh: 5 }, 99);
    const hill = cardioKcal({ minutes: 45, speedKmh: 5, inclinePct: 8 }, 99);
    expect(flat).toBeGreaterThan(200);
    expect(flat).toBeLessThan(330);
    expect(hill).toBeGreaterThan(flat * 1.5);
  });
  it('derives speed from distance', () => {
    expect(cardioKcal({ minutes: 60, distanceKm: 5 }, 99)).toBe(cardioKcal({ minutes: 60, speedKmh: 5 }, 99));
  });
  it('lifting estimate', () => {
    expect(liftingKcal(60, 99)).toBe(495);
  });
});

describe('phases and split', () => {
  it('computes the week within a phase (weeks start Sunday)', () => {
    expect(phaseWeek({ startDate: '2026-10-25' }, '2026-10-31')).toBe(1); // Sun..Sat
    expect(phaseWeek({ startDate: '2026-10-25' }, '2026-11-01')).toBe(2);
    expect(phaseWeek({ startDate: '2026-08-30' }, '2026-10-24')).toBe(8);
    expect(phaseWeek({ startDate: '2026-08-30' }, '2026-10-25')).toBe(9);
  });
  it('still supports Monday weeks', () => {
    expect(phaseWeek({ startDate: '2026-10-19' }, '2026-10-25', 1)).toBe(1);
    expect(phaseWeek({ startDate: '2026-10-19' }, '2026-10-26', 1)).toBe(2);
  });
  it('picks the first unfinished day this week', () => {
    const days = [0, 1, 2, 3, 4].map((o) => ({ id: `d${o}`, phaseId: 'p', order: o, name: `Day ${o + 1}`, exercises: [] }) as DayTemplate);
    expect(nextDayTemplate(days, new Set())?.id).toBe('d0');
    expect(nextDayTemplate(days, new Set(['d0', 'd1']))?.id).toBe('d2');
    expect(nextDayTemplate(days, new Set(days.map((d) => d.id)))).toBeNull();
  });
});
