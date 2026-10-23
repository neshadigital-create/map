import { useEffect, useRef } from 'react';
import { useRest } from '../../store/rest';
import { useNow } from '../../lib/useNow';
import { haptic } from '../../lib/haptics';
import { beep } from '../../lib/sound';
import { useT } from '../../lib/i18n';
import { Icon } from '../../components/Icon';

function fmt(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Floating rest countdown. Vibrates (Android), ticks (iOS) and beeps when done. */
export function RestBar() {
  const t = useT();
  const { endAt, duration, add, stop } = useRest();
  const now = useNow(250);
  const fired = useRef<number | null>(null);
  const remaining = endAt ? (endAt - now.getTime()) / 1000 : 0;

  useEffect(() => {
    if (endAt && remaining <= 0 && fired.current !== endAt) {
      fired.current = endAt;
      haptic('long');
      beep(3);
      const id = setTimeout(stop, 2500);
      return () => clearTimeout(id);
    }
  }, [endAt, remaining, stop]);

  if (!endAt) return null;
  const done = remaining <= 0;
  const pct = Math.min(1, Math.max(0, 1 - remaining / duration));
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-[48] px-4 pt-2">
      <div className="anim-rise mx-auto max-w-xl overflow-hidden rounded-3xl border border-line bg-card shadow-[0_18px_40px_-18px_rgba(31,34,53,0.45)]">
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={() => add(-15)} className="tap h-12 rounded-2xl px-3 text-[14px] text-ink-2 active:bg-raised">
            −15
          </button>
          <div className="flex-1 text-center">
            <div className={`numeral text-[40px] ${done ? 'text-fat' : ''}`}>{done ? t('Go') : fmt(remaining)}</div>
            <div className="mt-0.5 text-[12px] text-ink-3">{t('Rest')}</div>
          </div>
          <button onClick={() => add(15)} className="tap h-12 rounded-2xl px-3 text-[14px] text-ink-2 active:bg-raised">
            +15
          </button>
          <button onClick={stop} aria-label={t('Skip')} className="tap grid size-12 place-items-center rounded-full text-ink-2 active:bg-raised">
            <Icon name="close" />
          </button>
        </div>
        <div className="h-[3px] bg-line">
          <div className="h-full bg-[linear-gradient(90deg,var(--ring-a),var(--ring-b))]" style={{ width: `${pct * 100}%`, transition: 'width 250ms linear' }} />
        </div>
      </div>
    </div>
  );
}
