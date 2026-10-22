import { Card, Label } from '../../components/ui';
import { useT } from '../../lib/i18n';

export function ProgressScreen() {
  const t = useT();
  return (
    <div className="space-y-3">
      <header className="px-1 pb-2 pt-1">
        <Label className="mb-2.5">{t('Coming in stage 3')}</Label>
        <h1 className="text-[30px] font-light tracking-[-0.03em]">{t('Progress')}</h1>
      </header>
      <Card className="p-6 text-[15px] leading-relaxed text-ink-2">
        {t('Weight trend, measurements, charts and the Sunday review arrive in stage 3.')}
      </Card>
    </div>
  );
}
