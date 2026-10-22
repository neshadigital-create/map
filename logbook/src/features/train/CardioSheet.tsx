import { useEffect, useState } from 'react';
import { db } from '../../db';
import type { Cardio, CardioType } from '../../db/types';
import { useSettings } from '../../db/hooks';
import { deleteCardio, saveCardio } from '../../db/train';
import { cardioKcal } from '../../lib/training';
import { dayKey } from '../../lib/dates';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { Button, Label, NumField, Segmented, Sheet, Stepper } from '../../components/ui';

export function CardioSheet({ cardioId }: { cardioId?: string }) {
  const t = useT();
  const { close, notify } = useUI();
  const settings = useSettings();
  const [c, setC] = useState<Omit<Cardio, 'id' | 'at'> & { id?: string; at?: number }>({
    day: dayKey(new Date(), settings.timezone),
    type: 'treadmill',
    minutes: 45,
  });
  useEffect(() => {
    if (cardioId) db.cardio.get(cardioId).then((x) => x && setC(x));
  }, [cardioId]);
  const set = (p: Partial<Cardio>) => setC((cur) => ({ ...cur, ...p }));
  const kcal = cardioKcal(c, settings.weightKg);

  return (
    <Sheet
      title={t('Cardio')}
      onClose={close}
      footer={
        <div className="flex gap-2">
          {cardioId && (
            <Button
              variant="danger"
              icon="trash"
              aria-label={t('Delete')}
              onClick={async () => {
                await deleteCardio(cardioId);
                close();
              }}
            />
          )}
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={!(c.minutes > 0)}
            onClick={async () => {
              await saveCardio(c);
              haptic('success');
              notify(t('Saved'));
              close();
            }}
          >
            {t('Save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pt-2">
        <Segmented<CardioType>
          value={c.type}
          onChange={(type) => set({ type })}
          options={[
            { value: 'treadmill', label: t('Treadmill') },
            { value: 'walk', label: t('Walk') },
          ]}
        />
        <div>
          <Label className="mb-3 text-center">{t('Minutes')}</Label>
          <Stepper value={c.minutes} onChange={(minutes) => set({ minutes })} step={5} unit="min" large decimals={0} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumField label={t('Distance')} unit="km" value={c.distanceKm} onChange={(distanceKm) => set({ distanceKm })} />
          <NumField label={t('Speed')} unit="km/h" value={c.speedKmh} onChange={(speedKmh) => set({ speedKmh })} />
          <NumField label={t('Incline')} unit="%" value={c.inclinePct} onChange={(inclinePct) => set({ inclinePct })} />
          <NumField label={t('Steps')} value={c.steps} onChange={(steps) => set({ steps })} />
        </div>
        <label className="block">
          <Label className="mb-2">{t('Date')}</Label>
          <input type="date" className="field" value={c.day} onChange={(e) => e.target.value && set({ day: e.target.value })} />
        </label>
        <div className="text-center text-[13px] text-ink-3">
          {t('Estimated')} <span className="tabular-nums text-ink-2">{kcal} kcal</span>
        </div>
      </div>
    </Sheet>
  );
}
