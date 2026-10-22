import { haptic } from '../../lib/haptics';
import { useT } from '../../lib/i18n';

const WORDS = ['Rough', 'Hard', 'OK', 'Good', 'Strong'];

/** 1-5 "how did it feel" scale. Neutral styling, no colours that judge. */
export function Feeling({ value, onChange, size = 'md' }: { value?: number; onChange: (v: number) => void; size?: 'md' | 'lg' }) {
  const t = useT();
  const h = size === 'lg' ? 'h-14' : 'h-12';
  return (
    <div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => {
              haptic();
              onChange(n);
            }}
            aria-label={`${n} ${t(WORDS[n - 1])}`}
            className={`tap ${h} flex-1 rounded-2xl border text-[17px] font-light tabular-nums transition-colors duration-200 ${
              value === n ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-2'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between px-1 text-[11px] text-ink-3">
        <span>{t('Rough')}</span>
        <span>{value ? t(WORDS[value - 1]) : ''}</span>
        <span>{t('Strong')}</span>
      </div>
    </div>
  );
}
