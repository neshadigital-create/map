import { db } from '../../db';
import type { DayTemplate, Phase } from '../../db/types';
import { startSession } from '../../db/train';
import { dayKey } from '../../lib/dates';
import { useUI } from '../../store/ui';

/** Start a workout (or resume the one in progress) and open it full screen. */
export async function startWorkout(opts: { template?: DayTemplate; phase?: Phase; tz: string; name?: string }) {
  const recent = await db.sessions.orderBy('startedAt').reverse().limit(5).toArray();
  const active = recent.find((s) => !s.endedAt);
  if (active) {
    useUI.getState().setSessionView(active.id);
    return;
  }
  const s = await startSession({ day: dayKey(new Date(), opts.tz), template: opts.template, phase: opts.phase, name: opts.name });
  useUI.getState().close();
  useUI.getState().setSessionView(s.id);
}
