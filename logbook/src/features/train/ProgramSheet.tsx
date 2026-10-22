import { useState } from 'react';
import { renameProgram, startNewPhase, updatePhase, useProgram } from '../../db/train';
import { useSettings } from '../../db/hooks';
import { dayKey, fmtDayLabel, weekStart } from '../../lib/dates';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { Button, Label, Sheet } from '../../components/ui';
import { startWorkout } from './useStartWorkout';

export function ProgramSheet() {
  const t = useT();
  const { close, open, notify, lang } = useUI();
  const settings = useSettings();
  const today = dayKey(new Date(), settings.timezone);
  const { program, phase, days } = useProgram(today);
  const [name, setName] = useState(program?.name ?? '');
  if (!program || !phase) return null;
  return (
    <Sheet title={t('Program')} onClose={close} tall>
      <div className="space-y-6 pt-1">
        <label className="block">
          <Label className="mb-2">{t('Name')}</Label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && renameProgram(program.id, name.trim())} />
        </label>
        <div>
          <Label className="mb-2">
            {t('Phase')} {phase.index} · {t('starts')}
          </Label>
          <input
            type="date"
            className="field"
            value={phase.startDate}
            onChange={(e) => e.target.value && updatePhase(phase.id, { startDate: weekStart(e.target.value) })}
          />
          <div className="mt-2 text-[12px] text-ink-3">
            {fmtDayLabel(phase.startDate, lang)} · {phase.weeks} {t('weeks')}
          </div>
        </div>
        <div>
          <Label className="mb-1">{t('Days')}</Label>
          {days.map((d) => (
            <button key={d.id} className="tap flex min-h-14 w-full items-center justify-between border-b border-line text-left" onClick={() => open({ kind: 'dayEditor', dayId: d.id })}>
              <span className="text-[15px]">{d.name}</span>
              <span className="text-[13px] text-ink-3">
                {d.exercises.length} {t('exercises')}
              </span>
            </button>
          ))}
        </div>
        <Button className="w-full" icon="plus" onClick={() => startWorkout({ tz: settings.timezone, name: t('Workout') })}>
          {t('Start empty workout')}
        </Button>
        <div className="rounded-2xl border border-line p-4">
          <div className="text-[15px]">{t('Start new phase')}</div>
          <div className="mt-1 text-[13px] leading-relaxed text-ink-3">{t('Copies this phase’s days and exercises into phase {n}, starting this Monday, so you can swap exercises.', { n: phase.index + 1 })}</div>
          <Button
            className="mt-3 w-full"
            onClick={async () => {
              if (!confirm(t('Start phase {n}?', { n: phase.index + 1 }))) return;
              await startNewPhase(today);
              haptic('success');
              notify(`${t('Phase')} ${phase.index + 1}`);
            }}
          >
            {t('Start phase {n}', { n: phase.index + 1 })}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
