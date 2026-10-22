import { Card, Label } from '../../components/ui';
import { useT } from '../../lib/i18n';

export function TrainScreen() {
  const t = useT();
  return (
    <div className="space-y-3">
      <header className="px-1 pb-2 pt-1">
        <Label className="mb-2.5">{t('Coming in stage 2')}</Label>
        <h1 className="text-[30px] font-light tracking-[-0.03em]">{t('Train')}</h1>
      </header>
      <Card className="p-6 text-[15px] leading-relaxed text-ink-2">{t('Workout logging, phases and rest timer arrive in the next stage.')}</Card>
    </div>
  );
}
