import { useLiveQuery } from 'dexie-react-hooks';
import { db, defaultSettings } from './index';
import type { Entry, Nutrients, Settings } from './types';
import { totals, ZERO } from '../lib/macros';
import { trainingWeekDays } from '../lib/dates';

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('settings'), []) ?? defaultSettings();
}

export function useDayEntries(day: string): Entry[] {
  return useLiveQuery(() => db.entries.where('day').equals(day).sortBy('loggedAt'), [day]) ?? [];
}

export function useWaterTotal(day: string): number {
  return (
    useLiveQuery(async () => {
      const rows = await db.water.where('day').equals(day).toArray();
      return rows.reduce((s, r) => s + r.ml, 0);
    }, [day]) ?? 0
  );
}

export interface DayStat {
  day: string;
  totals: Nutrients;
  logged: boolean;
}

export interface WeekStats {
  days: DayStat[];
  loggedDays: number;
  avg: Nutrients;
}

/** Stats for my week (Sunday-Saturday by default) containing `day`. Averages only count days with food logged, up to `day`. */
export function useWeekStats(day: string): WeekStats {
  const dow = useSettings().trainingWeekStartsOn ?? 0;
  return (
    useLiveQuery(async () => {
      const keys = trainingWeekDays(day, dow);
      const rows = await db.entries.where('day').anyOf(keys).toArray();
      const days: DayStat[] = keys.map((k) => {
        const list = rows.filter((r) => r.day === k);
        return { day: k, totals: totals(list), logged: list.length > 0 };
      });
      const counted = days.filter((d) => d.logged && d.day <= day);
      const sum = totals([]);
      for (const d of counted) {
        sum.kcal += d.totals.kcal;
        sum.protein += d.totals.protein;
        sum.carbs += d.totals.carbs;
        sum.fat += d.totals.fat;
      }
      const n = counted.length || 1;
      return {
        days,
        loggedDays: counted.length,
        avg: { kcal: sum.kcal / n, protein: sum.protein / n, carbs: sum.carbs / n, fat: sum.fat / n },
      };
    }, [day, dow]) ?? { days: [], loggedDays: 0, avg: { ...ZERO } }
  );
}

/** Timestamp of the most recent food entry (any day), for the fasting timer. */
export function useLastMealAt(): number | undefined {
  return useLiveQuery(async () => (await db.entries.orderBy('loggedAt').last())?.loggedAt, []);
}
