import type { Cardio, Entry, Exercise, Muscle, Session, SetLog, Targets, WeightLog } from '../db/types';
import { addDays, weekStart } from './dates';
import { totals } from './macros';
import { bestOf, isCounted, volume } from './training';

export interface WeightPoint {
  day: string;
  kg: number; // that day's average
  trend: number; // 7-day trailing average
}

/** One point per day (average of that day's weigh-ins) with a 7-day trailing average. */
export function weightSeries(logs: Pick<WeightLog, 'day' | 'kg'>[]): WeightPoint[] {
  const byDay = new Map<string, number[]>();
  for (const l of logs) byDay.set(l.day, [...(byDay.get(l.day) ?? []), l.kg]);
  const days = [...byDay.keys()].sort();
  const daily = new Map(days.map((d) => [d, avg(byDay.get(d)!)]));
  return days.map((d) => {
    const window = days.filter((x) => x <= d && x >= addDays(d, -6)).map((x) => daily.get(x)!);
    return { day: d, kg: round1(daily.get(d)!), trend: round1(avg(window)) };
  });
}

/** Trend now vs. trend about a week ago (closest point at or before 7 days back). */
export function weeklyChange(series: WeightPoint[]): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const ref = [...series].reverse().find((p) => p.day <= addDays(last.day, -7));
  if (!ref) return null;
  return round1(last.trend - ref.trend);
}

export interface WeekSummary {
  start: string;
  end: string;
  loggedDays: number;
  avgKcal: number;
  avgProtein: number;
  proteinDays: number;
  workouts: number;
  cardioMinutes: number;
  weightAvg: number | null;
  weightChange: number | null;
}

/** Per-week numbers for the weekly review and charts. Weeks are Monday to Sunday. */
export function weekSummaries(
  input: {
    entries: Pick<Entry, 'day' | 'per100' | 'amount'>[];
    sessions: Pick<Session, 'day' | 'endedAt'>[];
    cardio: Pick<Cardio, 'day' | 'minutes'>[];
    weights: Pick<WeightLog, 'day' | 'kg'>[];
    targets: Pick<Targets, 'protein'>;
  },
  lastDay: string,
  weeks: number,
): WeekSummary[] {
  const out: WeekSummary[] = [];
  let prevWeight: number | null = null;
  const first = addDays(weekStart(lastDay), -7 * (weeks - 1));
  // include the week before the window so the first week has a weight change
  for (let w = -1; w < weeks; w++) {
    const start = addDays(first, 7 * w);
    const end = addDays(start, 6);
    const inWeek = (d: string) => d >= start && d <= end && d <= lastDay;
    const days = new Map<string, Pick<Entry, 'per100' | 'amount'>[]>();
    for (const e of input.entries) if (inWeek(e.day)) days.set(e.day, [...(days.get(e.day) ?? []), e]);
    const dayTotals = [...days.values()].map((list) => totals(list));
    const n = dayTotals.length;
    const ws = input.weights.filter((x) => inWeek(x.day)).map((x) => x.kg);
    const weightAvg = ws.length ? round1(avg(ws)) : null;
    const summary: WeekSummary = {
      start,
      end,
      loggedDays: n,
      avgKcal: n ? Math.round(dayTotals.reduce((s, x) => s + x.kcal, 0) / n) : 0,
      avgProtein: n ? Math.round(dayTotals.reduce((s, x) => s + x.protein, 0) / n) : 0,
      proteinDays: dayTotals.filter((x) => Math.round(x.protein) >= input.targets.protein).length,
      workouts: input.sessions.filter((s) => s.endedAt && inWeek(s.day)).length,
      cardioMinutes: input.cardio.filter((c) => inWeek(c.day)).reduce((s, c) => s + c.minutes, 0),
      weightAvg,
      weightChange: weightAvg !== null && prevWeight !== null ? round1(weightAvg - prevWeight) : null,
    };
    if (weightAvg !== null) prevWeight = weightAvg;
    if (w >= 0) out.push(summary);
  }
  return out;
}

/** Working-set volume (kg x reps) per muscle group since `from`. */
export function volumeByMuscle(sets: SetLog[], exercises: Map<string, Pick<Exercise, 'muscle'>>, from: number): { muscle: Muscle; kg: number }[] {
  const acc = new Map<Muscle, number>();
  for (const s of sets) {
    if (s.at < from || !isCounted(s)) continue;
    const m = exercises.get(s.exerciseId)?.muscle ?? 'other';
    acc.set(m, (acc.get(m) ?? 0) + s.weight * s.reps);
  }
  return [...acc.entries()].map(([muscle, kg]) => ({ muscle, kg: Math.round(kg) })).sort((a, b) => b.kg - a.kg);
}

/** Best estimated 1RM per session for one exercise, oldest first. */
export function strengthSeries(sets: SetLog[], sessions: Map<string, Pick<Session, 'day'>>, exerciseId: string) {
  const bySession = new Map<string, SetLog[]>();
  for (const s of sets) if (s.exerciseId === exerciseId && isCounted(s)) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
  return [...bySession.entries()]
    .map(([sid, list]) => ({ day: sessions.get(sid)?.day ?? '', e1rm: round1(bestOf(list).e1rm), top: bestOf(list).weight, volume: volume(list) }))
    .filter((p) => p.day && p.e1rm > 0)
    .sort((a, b) => a.day.localeCompare(b.day));
}

function avg(list: number[]) {
  return list.reduce((a, b) => a + b, 0) / list.length;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
