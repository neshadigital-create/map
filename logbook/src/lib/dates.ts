/** Day keys are YYYY-MM-DD strings in the user's timezone. Arithmetic is done in UTC on the key. */

export const DEFAULT_TZ = 'Europe/Paris';

export function dayKey(date: Date = new Date(), tz = DEFAULT_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function keyToUTC(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, n: number): string {
  const d = keyToUTC(key);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToKey(d);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayMon0(key: string): number {
  return (keyToUTC(key).getUTCDay() + 6) % 7;
}

/** Monday of the week containing key. */
export function weekStart(key: string): string {
  return addDays(key, -weekdayMon0(key));
}

export function weekDays(key: string): string[] {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((keyToUTC(b).getTime() - keyToUTC(a).getTime()) / 86_400_000);
}

/** Minutes since local midnight in tz. */
export function minutesOfDay(date: Date = new Date(), tz = DEFAULT_TZ): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${String(r).padStart(2, '0')}`;
}

export function fmtTime(ts: number, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(ts);
}

export function fmtDayLabel(key: string, lang: 'en' | 'fr' = 'en'): string {
  const d = keyToUTC(key);
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

export function fmtWeekdayShort(key: string, lang: 'en' | 'fr' = 'en'): string {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'UTC', weekday: 'narrow' }).format(
    keyToUTC(key),
  );
}

export type WindowState =
  | { phase: 'before'; minutesToOpen: number; progress: number }
  | { phase: 'open'; minutesToClose: number; progress: number }
  | { phase: 'after'; minutesToOpen: number; progress: number };

/**
 * Where "now" sits relative to the eating window. Handles windows that cross midnight.
 * progress is the position of now on a 24 h track starting at midnight (0..1).
 */
export function eatingWindowState(nowMin: number, start: string, end: string): WindowState {
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  const progress = nowMin / 1440;
  const crosses = e <= s;
  const inWindow = crosses ? nowMin >= s || nowMin < e : nowMin >= s && nowMin < e;
  if (inWindow) {
    const toClose = (e - nowMin + 1440) % 1440;
    return { phase: 'open', minutesToClose: toClose, progress };
  }
  const toOpen = (s - nowMin + 1440) % 1440;
  if (!crosses && nowMin >= e) return { phase: 'after', minutesToOpen: toOpen, progress };
  return { phase: 'before', minutesToOpen: toOpen, progress };
}

/** Meal to file a quick add under, from the time of day: before 15:00 the first meal, then the second, late evening the last. */
export function mealForTime<T extends { id: string }>(meals: T[], minutes: number): T {
  if (meals.length === 1 || minutes < 15 * 60) return meals[0];
  if (minutes < 22 * 60) return meals[1];
  return meals[meals.length - 1];
}

/** "Mon 26 Oct" */
export function fmtShortDate(key: string, lang: 'en' | 'fr' = 'en'): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/* ---------- Training week ---------- */

/** First day of the training week: 0 = Sunday (my default), 1 = Monday. Food weeks stay Monday-based. */
let trainingDow: 0 | 1 = 0;

export function setTrainingWeekStartsOn(dow: 0 | 1) {
  trainingDow = dow;
}

export function getTrainingWeekStartsOn(): 0 | 1 {
  return trainingDow;
}

/** Start of the week containing key, for a week starting on `dow` (0 Sunday ... 6 Saturday). */
export function weekStartOn(key: string, dow: number): string {
  const sun0 = (weekdayMon0(key) + 1) % 7; // 0 = Sunday
  return addDays(key, -((sun0 - dow + 7) % 7));
}

export function trainingWeekStart(key: string, dow: number = trainingDow): string {
  return weekStartOn(key, dow);
}

export function trainingWeekDays(key: string, dow: number = trainingDow): string[] {
  const start = trainingWeekStart(key, dow);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
