import { Card, Label, Button, IconButton } from '../../components/ui';
import { Bar } from '../../components/Ring';
import { addWater, undoWater } from '../../db/actions';
import { useT } from '../../lib/i18n';

export function WaterCard({ day, total, goal }: { day: string; total: number; goal: number }) {
  const t = useT();
  return (
    <Card className="anim-rise p-5">
      <div className="mb-3 flex items-center justify-between">
        <Label>{t('Water')}</Label>
        {total > 0 && <IconButton icon="undo" label={t('Undo')} onClick={() => undoWater(day)} className="-my-3 -mr-3" />}
      </div>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="numeral text-[44px]">{(total / 1000).toFixed(total % 1000 === 0 ? 1 : 2)}</span>
        <span className="text-[14px] text-ink-3">/ {(goal / 1000).toFixed(1)} L</span>
      </div>
      <Bar value={total} max={goal} color="var(--color-ink-2)" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button icon="plus" onClick={() => addWater(day, 250)}>
          250 ml
        </Button>
        <Button icon="plus" onClick={() => addWater(day, 500)}>
          500 ml
        </Button>
      </div>
    </Card>
  );
}
