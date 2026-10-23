import { useId, type ReactNode } from 'react';

/** Progress ring with the blue-to-pink gradient. Past 100% a thin navy lap shows the extra. */
export function GradientRing({ value, max, size = 132, stroke = 11, track = 'var(--ring-track)', children }: { value: number; max: number; size?: number; stroke?: number; track?: string; children?: ReactNode }) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, value / max) : 0;
  const main = Math.min(1, pct);
  const over = Math.min(1, Math.max(0, pct - 1));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={`rg${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--ring-a)" />
            <stop offset="1" stopColor="var(--ring-b)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#rg${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * main} ${c}`}
          opacity={main > 0 ? 1 : 0}
          style={{ transition: 'stroke-dasharray 700ms var(--ease-out-soft)' }}
        />
        {over > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r - stroke} fill="none" stroke="var(--color-ink)" strokeWidth={3} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * (r - stroke) * over} ${c}`} opacity={0.5} />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
