import { useRegisterSW } from 'virtual:pwa-register/react';
import { useT } from '../lib/i18n';
import { useUI } from '../store/ui';

/** Quiet bar when a new version is ready. Hidden during a workout so nothing reloads mid-set. */
export function UpdatePrompt() {
  const t = useT();
  const inWorkout = useUI((s) => !!s.sessionView);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for a new version every hour while the app is open.
      if (reg) setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
    },
  });
  if (!needRefresh || inWorkout) return null;
  return (
    <div className="pt-safe fixed inset-x-0 top-0 z-[58] px-4">
      <div className="anim-rise mx-auto mt-2 flex max-w-xl items-center gap-3 rounded-2xl border border-line-strong bg-raised py-2 pl-4 pr-2 shadow-2xl">
        <span className="flex-1 text-[13px] text-ink-2">{t('A new version is ready.')}</span>
        <button onClick={() => setNeedRefresh(false)} className="tap min-h-10 rounded-xl px-3 text-[13px] text-ink-3">
          {t('Later')}
        </button>
        <button onClick={() => updateServiceWorker(true)} className="tap min-h-10 rounded-xl bg-accent px-4 text-[13px] font-medium text-white">
          {t('Update')}
        </button>
      </div>
    </div>
  );
}
