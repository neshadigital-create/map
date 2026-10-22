import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSettings } from '../../db/hooks';
import { bestBefore, discardSession, useExerciseMap, useSessionSets } from '../../db/train';
import { e1rm, fmtKg, fmtVolume, isCounted, liftingKcal, prKinds, volume } from '../../lib/training';
import { fmtDayLabel, fmtDuration } from '../../lib/dates';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { Button, Label, Sheet } from '../../components/ui';

/** Session summary: duration, volume, PRs, estimated kcal, feeling average. */
export function SummarySheet({ sessionId }: { sessionId: string }) {
  const t = useT();
  const { close, lang } = useUI();
  const settings = useSettings();
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const sets = useSessionSets(sessionId);
  const exMap = useExerciseMap();
  const prs = useLiveQuery(async () => {
    if (!session) return [];
    const out: { exerciseId: string; weight: number; reps: number; kinds: string[] }[] = [];
    for (const se of session.exercises) {
      const best = await bestBefore(se.exerciseId, session.id, session.startedAt);
      let top: (typeof out)[number] | null = null;
      for (const s of sets.filter((x) => x.exerciseId === se.exerciseId)) {
        const kinds = prKinds(s, best);
        if (kinds.length && (!top || e1rm(s.weight, s.reps) > e1rm(top.weight, top.reps))) top = { exerciseId: s.exerciseId, weight: s.weight, reps: s.reps, kinds };
      }
      if (top) out.push(top);
    }
    return out;
  }, [session, sets]);

  if (!session) return null;
  const minutes = ((session.endedAt ?? Date.now()) - session.startedAt) / 60000;
  const vol = volume(sets);
  const feelings = [...session.exercises.map((e) => e.feeling), session.feeling].filter((f): f is number => !!f);
  const feelingAvg = feelings.length ? feelings.reduce((a, b) => a + b, 0) / feelings.length : undefined;

  return (
    <Sheet title={session.name} onClose={close} tall>
      <Label className="mb-5 pt-1">
        {fmtDayLabel(session.day, lang)}
        {session.week ? ` · ${t('Week')} ${session.week}` : ''}
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Big label={t('Duration')} value={fmtDuration(minutes)} />
        <Big label={t('Volume')} value={`${fmtVolume(vol)}`} unit="kg" />
        <Big label={t('Est. burn')} value={`${liftingKcal(minutes, settings.weightKg)}`} unit="kcal" />
        <Big label={t('Feeling')} value={feelingAvg ? feelingAvg.toFixed(1) : '—'} unit={feelingAvg ? '/ 5' : ''} />
      </div>

      {prs && prs.length > 0 && (
        <div className="mt-6">
          <Label className="mb-2">{t('Personal records')}</Label>
          {prs.map((p) => (
            <div key={p.exerciseId} className="flex items-center justify-between border-b border-line py-3 last:border-b-0">
              <span className="text-[15px]">{exMap.get(p.exerciseId)?.name}</span>
              <span className="flex items-center gap-2 text-[14px] tabular-nums">
                {fmtKg(p.weight)} kg × {p.reps}
                <span className="rounded-full border border-accent px-2 py-0.5 text-[10px] tracking-[0.12em] text-accent">PR</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Label className="mb-2">{t('Exercises')}</Label>
        {session.exercises.map((se) => {
          const list = sets.filter((s) => s.exerciseId === se.exerciseId && s.done).sort((a, b) => a.setIndex - b.setIndex);
          return (
            <div key={se.exerciseId} className="border-b border-line py-3 last:border-b-0">
              <div className="flex justify-between text-[15px]">
                <span>{exMap.get(se.exerciseId)?.name}</span>
                {se.feeling && <span className="text-[13px] text-ink-3">{se.feeling}/5</span>}
              </div>
              <div className="mt-1 text-[13px] tabular-nums text-ink-3">
                {list.map((s) => `${isCounted(s) ? '' : 'W '}${fmtKg(s.weight)}×${s.reps}`).join('  ·  ') || '—'}
              </div>
              {se.note && <div className="mt-1 text-[13px] text-ink-2">{se.note}</div>}
            </div>
          );
        })}
      </div>
      {session.note && <div className="mt-4 rounded-2xl border border-line p-4 text-[14px] text-ink-2">{session.note}</div>}
      <Button
        variant="ghost"
        className="mt-6 w-full !text-ink-3"
        onClick={async () => {
          if (!confirm(t('Delete this workout?'))) return;
          await discardSession(session.id);
          close();
        }}
      >
        {t('Delete workout')}
      </Button>
    </Sheet>
  );
}

function Big({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div>
        <span className="numeral text-[36px]">{value}</span>
        {unit && <span className="ml-1 text-[13px] text-ink-3">{unit}</span>}
      </div>
      <Label className="mt-2">{label}</Label>
    </div>
  );
}
