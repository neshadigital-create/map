import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { getFlag, isIOS, isStandalone, setFlag } from '../../lib/prefs';
import { Card, IconButton, Label } from '../../components/ui';
import { Icon } from '../../components/Icon';

/** iPhone Safari only, until installed or dismissed. */
export function InstallHint() {
  const t = useT();
  const [hidden, setHidden] = useState(() => getFlag('install-hint') || isStandalone() || !isIOS());
  if (hidden) return null;
  return (
    <Card className="anim-rise flex items-start gap-3 p-4">
      <Icon name="upload" size={22} className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-2">
        <div className="mb-0.5 text-[15px] text-ink">{t('Install Logbook')}</div>
        {t('In Safari, tap Share, then Add to Home Screen. It then opens full screen and works offline.')}
      </div>
      <IconButton
        icon="close"
        label={t('Close')}
        className="-mr-2 -mt-2"
        onClick={() => {
          setFlag('install-hint');
          setHidden(true);
        }}
      />
    </Card>
  );
}

/** First-run card. Disappears on its own once there's food, a program and a weight, or when dismissed. */
export function WelcomeCard() {
  const t = useT();
  const { open, setTab } = useUI();
  const [dismissed, setDismissed] = useState(() => getFlag('welcome'));
  const state = useLiveQuery(async () => ({
    food: (await db.entries.count()) > 0,
    program: (await db.programs.count()) > 0,
    weight: (await db.weights.count()) > 0,
  }), []);
  if (dismissed || !state || (state.food && state.program && state.weight)) return null;
  const steps: { done: boolean; label: string; action: () => void }[] = [
    { done: getFlag('targets-checked'), label: t('Check your targets'), action: () => open({ kind: 'settings' }) },
    { done: state.food, label: t('Log your first meal'), action: () => setTab('food') },
    { done: state.program, label: t('Add your 5-day split'), action: () => setTab('train') },
    { done: state.weight, label: t('Log your weight'), action: () => setTab('progress') },
  ];
  return (
    <Card className="anim-rise p-5">
      <div className="mb-3 flex items-center justify-between">
        <Label>{t('Welcome')}</Label>
        <IconButton
          icon="close"
          label={t('Close')}
          className="-my-3 -mr-3"
          onClick={() => {
            setFlag('welcome');
            setDismissed(true);
          }}
        />
      </div>
      {steps.map((s) => (
        <button key={s.label} onClick={s.action} className="tap flex min-h-12 w-full items-center gap-3 border-t border-line text-left first-of-type:border-t-0">
          <span className={`grid size-6 shrink-0 place-items-center rounded-full border ${s.done ? 'border-accent bg-accent text-on-accent' : 'border-line-strong'}`}>
            {s.done && <Icon name="check" size={14} />}
          </span>
          <span className={`flex-1 text-[15px] ${s.done ? 'text-ink-3' : ''}`}>{s.label}</span>
          <Icon name="chevronRight" size={18} className="text-ink-3" />
        </button>
      ))}
    </Card>
  );
}

const DAY = 86_400_000;

/** Data lives only on this phone, so a neutral reminder after two weeks without a backup. */
export function BackupNudge() {
  const t = useT();
  const open = useUI((s) => s.open);
  const info = useLiveQuery(async () => {
    const last = (await db.meta.get('lastBackupAt'))?.value as number | undefined;
    const first = await db.entries.orderBy('loggedAt').first();
    return { last, since: first?.loggedAt };
  }, []);
  if (!info?.since) return null;
  const ref = info.last ?? info.since;
  const days = Math.floor((Date.now() - ref) / DAY);
  if (days < 14) return null;
  return (
    <button onClick={() => open({ kind: 'settings' })} className="tap w-full px-1 py-2 text-center text-[12px] text-ink-3">
      {info.last ? t('Last backup {n} days ago', { n: days }) : t('No backup yet')} · <span className="text-ink-2 underline underline-offset-4">{t('Export JSON')}</span>
    </button>
  );
}

