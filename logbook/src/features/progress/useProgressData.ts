import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSettings } from '../../db/hooks';
import { weekSummaries, type WeekSummary } from '../../lib/progress';
import { addDays, weekStart } from '../../lib/dates';

/** Week summaries ending with the week containing `lastDay`. */
export function useWeekSummaries(lastDay: string, weeks: number): WeekSummary[] | undefined {
  const settings = useSettings();
  const protein = settings.targets.protein;
  return useLiveQuery(async () => {
    const from = addDays(weekStart(lastDay), -7 * weeks);
    const [entries, sessions, cardio, weights] = await Promise.all([
      db.entries.where('day').between(from, lastDay, true, true).toArray(),
      db.sessions.where('day').between(from, lastDay, true, true).toArray(),
      db.cardio.where('day').between(from, lastDay, true, true).toArray(),
      db.weights.where('day').between(from, lastDay, true, true).toArray(),
    ]);
    return weekSummaries({ entries, sessions, cardio, weights, targets: { protein } }, lastDay, weeks);
  }, [lastDay, weeks, protein]);
}
