import type { Cardio, DayTemplate, Phase, SetLog } from '../db/types';
import { daysBetween, weekStart } from './dates';

/** Sets that count for volume, PRs and suggestions (warm-ups don't). */
export function isCounted(s: Pick<SetLog, 'type' | 'done'>): boolean {
  return s.done && s.type !== 'warmup';
}

/** Estimated 1RM (Epley). Reps above 12 get unreliable, so they are capped. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 12) / 30);
}

export function volume(sets: Pick<SetLog, 'weight' | 'reps' | 'type' | 'done'>[]): number {
  return sets.filter(isCounted).reduce((s, x) => s + x.weight * x.reps, 0);
}

export interface Best {
  weight: number;
  e1rm: number;
}

export function bestOf(sets: Pick<SetLog, 'weight' | 'reps' | 'type' | 'done'>[]): Best {
  let weight = 0;
  let best = 0;
  for (const s of sets) {
    if (!isCounted(s)) continue;
    weight = Math.max(weight, s.weight);
    best = Math.max(best, e1rm(s.weight, s.reps));
  }
  return { weight, e1rm: best };
}

export type PRKind = 'weight' | 'e1rm';

/**
 * Is this set a personal record compared with everything before it?
 * The first ever session for an exercise doesn't count as a PR.
 */
export function prKinds(set: Pick<SetLog, 'weight' | 'reps' | 'type' | 'done'>, previous: Best | null): PRKind[] {
  if (!previous || !isCounted(set) || set.weight <= 0) return [];
  const out: PRKind[] = [];
  if (set.weight > previous.weight) out.push('weight');
  if (e1rm(set.weight, set.reps) > previous.e1rm + 0.01) out.push('e1rm');
  return out;
}

export function parseRepRange(reps: string | undefined): { min: number; max: number } | null {
  if (!reps) return null;
  const m = reps.match(/(\d+)\s*(?:-|–|to|à)\s*(\d+)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const n = Number(reps.match(/\d+/)?.[0]);
  return Number.isFinite(n) && n > 0 ? { min: n, max: n } : null;
}

export function weightStep(weight: number): number {
  return weight < 10 ? 1 : 2.5;
}

export interface Suggestion {
  last: { weight: number; reps: number };
  tryWeight?: number;
  tryReps?: number;
}

/**
 * Gentle progressive overload from last session's top working set:
 * "last time 40 kg x 10, try 42.5 kg or 12 reps".
 * When the top of the rep range was reached on every working set, only suggest weight.
 */
export function overloadSuggestion(lastSets: SetLog[], reps?: string): Suggestion | null {
  const working = lastSets.filter(isCounted);
  if (!working.length) return null;
  const top = working.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
  const range = parseRepRange(reps);
  const allAtTop = range ? working.every((s) => s.reps >= range.max) : false;
  const tryWeight = top.weight > 0 ? Math.round((top.weight + weightStep(top.weight)) * 100) / 100 : undefined;
  let tryReps: number | undefined = top.reps + 2;
  if (range && range.max > range.min) tryReps = Math.min(range.max, top.reps + 2);
  if (allAtTop || (range && tryReps <= top.reps)) tryReps = undefined;
  return { last: { weight: top.weight, reps: top.reps }, tryWeight, tryReps };
}

/** Rough strength-training energy: MET 5 x body weight x hours. */
export function liftingKcal(minutes: number, bodyKg: number): number {
  return Math.round(5 * bodyKg * (minutes / 60));
}

/**
 * Walking energy (ACSM walking equation, gross): VO2 = 0.1*v + 1.8*v*grade + 3.5 ml/kg/min,
 * v in m/min. Falls back to MET 3.5 when speed is unknown.
 */
export function cardioKcal(c: Pick<Cardio, 'minutes' | 'speedKmh' | 'inclinePct' | 'distanceKm'>, bodyKg: number): number {
  let speed = c.speedKmh;
  if (!speed && c.distanceKm && c.minutes > 0) speed = c.distanceKm / (c.minutes / 60);
  if (!speed || speed <= 0) return Math.round(3.5 * bodyKg * (c.minutes / 60));
  const v = (speed * 1000) / 60;
  const grade = (c.inclinePct ?? 0) / 100;
  const vo2 = 0.1 * v + 1.8 * v * grade + 3.5;
  return Math.round(((vo2 * bodyKg) / 1000) * 5 * c.minutes);
}

/** 1-based week within a phase. Can exceed phase.weeks (time to start a new phase). */
export function phaseWeek(phase: Pick<Phase, 'startDate'>, day: string): number {
  return Math.floor(daysBetween(weekStart(phase.startDate), day) / 7) + 1;
}

/**
 * Next day of the split for this week: the first template without a finished session
 * this week. Returns null when all days are done.
 */
export function nextDayTemplate(
  days: DayTemplate[],
  doneThisWeek: Set<string>,
): DayTemplate | null {
  const sorted = [...days].sort((a, b) => a.order - b.order);
  return sorted.find((d) => !doneThisWeek.has(d.id)) ?? null;
}

export function fmtKg(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function fmtVolume(kg: number): string {
  return Math.round(kg).toLocaleString('en-US').replace(/,/g, ' ');
}

export function phaseLabel(p: Pick<Phase, 'name' | 'index'>): string {
  return p.name?.trim() || `Phase ${p.index}`;
}

/**
 * The phase in effect on `day`: the latest one that has started. If none has started yet,
 * the earliest upcoming one (so a freshly planned block shows as "starts Monday").
 */
export function currentPhase<P extends Pick<Phase, 'startDate' | 'index'>>(phases: P[], day: string): { phase: P; upcoming: boolean } | null {
  if (!phases.length) return null;
  const sorted = [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.index - b.index);
  const started = sorted.filter((p) => weekStart(p.startDate) <= day);
  if (started.length) return { phase: started[started.length - 1], upcoming: false };
  return { phase: sorted[0], upcoming: true };
}

/** Phase that starts after the current one, if any. */
export function nextPhase<P extends Pick<Phase, 'startDate' | 'index'>>(phases: P[], current: P): P | undefined {
  return [...phases]
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.index - b.index)
    .find((p) => p.startDate > current.startDate);
}
