import { Card, Button } from '../../components/ui';
import { addWater, undoWater } from '../../db/actions';
import { useT } from '../../lib/i18n';
import { haptic } from '../../lib/haptics';

const GLASS = 250;

/** One glass = 250 ml. Tap an empty glass to fill up to it, tap the last full one to undo. */
export function WaterCard({ day, total, goal }: { day: string; total: number; goal: number }) {
  const t = useT();
  const count = Math.min(12, Math.max(4, Math.round(goal / GLASS)));
  const full = Math.floor(total / GLASS);
  async function tap(i: number) {
    haptic();
    if (i < full) {
      if (i === full - 1) await undoWater(day);
      return;
    }
    for (let k = full; k <= i; k++) await addWater(day, GLASS);
  }
  return (
    <Card className="anim-rise p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[16px] font-medium">{t('Water')}</div>
        <div>
          <span className="numeral text-[34px] !font-normal">{(total / 1000).toFixed(2).replace(/0$/, '')}</span>
          <span className="text-[14px] text-ink-3"> / {(goal / 1000).toFixed(1)} L</span>
        </div>
      </div>
      <div className="mt-3.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            aria-label={`${(i + 1) * GLASS} ml`}
            onClick={() => tap(i)}
            className="tap relative h-12 overflow-hidden rounded-b-[10px] rounded-t-[5px] border-[1.5px] border-line-strong bg-raised"
          >
            <span
              className="absolute inset-x-0 bottom-0 bg-carbs/60"
              style={{ height: i < full ? '78%' : '0%', transition: 'height 400ms var(--ease-out-soft)' }}
            />
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[13px] text-ink-3">{t('Tap a glass to add 250 ml')}</span>
        <Button size="sm" icon="plus" onClick={() => addWater(day, 500)}>
          500 ml
        </Button>
      </div>
    </Card>
  );
}
