import { describe, expect, it } from 'vitest';
import { weightSeries, weeklyChange, weekSummaries, volumeByMuscle, strengthSeries } from '../src/lib/progress';
import type { SetLog } from '../src/db/types';

describe('weight trend', () => {
  const logs = [
    { day: '2026-10-01', kg: 100 },
    { day: '2026-10-02', kg: 99 },
    { day: '2026-10-02', kg: 99.4 },
    { day: '2026-10-05', kg: 99.6 },
    { day: '2026-10-09', kg: 98.6 },
    { day: '2026-10-10', kg: 98.4 },
  ];
  it('averages same-day weigh-ins and smooths over 7 days', () => {
    const s = weightSeries(logs);
    expect(s.map((p) => p.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-09', '2026-10-10']);
    expect(s[1].kg).toBe(99.2);
    expect(s[2].trend).toBe(99.6); // (100 + 99.2 + 99.6) / 3
    expect(s[4].trend).toBe(98.9); // 10-04..10-10: 99.6, 98.6, 98.4
  });
  it('weekly change compares trends a week apart', () => {
    expect(weeklyChange(weightSeries(logs))).toBe(-0.7); // 98.9 - 99.6 (10-02 trend)
    expect(weeklyChange(weightSeries(logs.slice(0, 2)))).toBeNull();
  });
});

describe('week summaries', () => {
  const per100 = { kcal: 100, protein: 10, fat: 0, carbs: 0 };
  it('builds Monday-to-Sunday weeks', () => {
    const res = weekSummaries(
      {
        entries: [
          { day: '2026-10-19', per100, amount: 1800 }, // 1800 kcal, 180 g
          { day: '2026-10-20', per100, amount: 2200 },
          { day: '2026-10-21', per100, amount: 1000 },
        ],
        sessions: [{ day: '2026-10-19', endedAt: 1 }, { day: '2026-10-20' }],
        cardio: [{ day: '2026-10-21', minutes: 40 }, { day: '2026-10-12', minutes: 30 }],
        weights: [
          { day: '2026-10-13', kg: 100 },
          { day: '2026-10-20', kg: 99 },
        ],
        targets: { protein: 125 },
      },
      '2026-10-25',
      2,
    );
    expect(res.map((w) => w.start)).toEqual(['2026-10-12', '2026-10-19']);
    const wk = res[1];
    expect(wk).toMatchObject({ loggedDays: 3, avgKcal: 1667, avgProtein: 167, proteinDays: 2, workouts: 1, cardioMinutes: 40, weightAvg: 99, weightChange: -1 });
    expect(res[0].cardioMinutes).toBe(30);
  });
});

describe('training progress', () => {
  const set = (sessionId: string, exerciseId: string, weight: number, reps: number, at = 10, type: SetLog['type'] = 'working'): SetLog => ({
    id: Math.random().toString(),
    sessionId,
    exerciseId,
    setIndex: 0,
    type,
    weight,
    reps,
    done: true,
    at,
  });
  it('sums volume per muscle and skips warm-ups and old sets', () => {
    const ex = new Map([
      ['a', { muscle: 'glutes' as const }],
      ['b', { muscle: 'back' as const }],
    ]);
    const res = volumeByMuscle([set('s', 'a', 40, 10), set('s', 'a', 20, 10, 10, 'warmup'), set('s', 'b', 30, 10), set('s', 'a', 100, 10, 1)], ex, 5);
    expect(res).toEqual([
      { muscle: 'glutes', kg: 400 },
      { muscle: 'back', kg: 300 },
    ]);
  });
  it('builds an e1RM line per session', () => {
    const sessions = new Map([
      ['s1', { day: '2026-10-19' }],
      ['s2', { day: '2026-10-26' }],
    ]);
    const res = strengthSeries([set('s2', 'a', 42.5, 10), set('s1', 'a', 40, 10), set('s1', 'a', 40, 8)], sessions, 'a');
    expect(res.map((p) => p.day)).toEqual(['2026-10-19', '2026-10-26']);
    expect(res[0].e1rm).toBe(53.3);
    expect(res[1].e1rm).toBe(56.7);
  });
});
