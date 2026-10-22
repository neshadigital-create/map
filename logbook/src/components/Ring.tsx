import { useId } from 'react';

interface RingProps {
  value: number;
  max: number;
  size: number;
  stroke?: number;
  color?: string;
  track?: string;
  glow?: boolean;
  /** Fraction of the circle used, e.g. 0.75 for a dashboard arc. */
  sweep?: number;
  children?: React.ReactNode;
}

/** Thin animated arc gauge. Values past max show a second, dimmer lap so overage stays calm. */
export function Ring({
  value,
  max,
  size,
  stroke = 4,
  color = 'var(--color-ink)',
  track = 'var(--color-line)',
  glow = false,
  sweep = 0.75,
  children,
}: RingProps) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2 - (glow ? 4 : 0);
  const c = 2 * Math.PI * r;
  const arc = c * sweep;
  const pct = max > 0 ? Math.max(0, value / max) : 0;
  const main = Math.min(1, pct);
  const extra = Math.min(1, Math.max(0, pct - 1));
  const rotate = 90 + (360 * (1 - sweep)) / 2;
  const common = {
    cx: size / 2,
    cy: size / 2,
    r,
    fill: 'none',
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    transform: `rotate(${rotate} ${size / 2} ${size / 2})`,
  };
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 overflow-visible">
        {glow && (
          <defs>
            <filter id={`g${id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
          </defs>
        )}
        <circle {...common} stroke={track} strokeDasharray={`${arc} ${c}`} />
        {glow && main > 0 && (
          <circle
            {...common}
            stroke={color}
            opacity={0.35}
            filter={`url(#g${id})`}
            strokeDasharray={`${arc * main} ${c}`}
            style={{ transition: 'stroke-dasharray 700ms var(--ease-out-soft)' }}
          />
        )}
        <circle
          {...common}
          stroke={color}
          opacity={main > 0 ? 1 : 0}
          strokeDasharray={`${arc * main} ${c}`}
          style={{ transition: 'stroke-dasharray 700ms var(--ease-out-soft)' }}
        />
        {extra > 0 && (
          <circle
            {...common}
            stroke="var(--color-ink-2)"
            opacity={0.55}
            strokeWidth={stroke * 0.6}
            strokeDasharray={`${arc * extra} ${c}`}
            style={{ transition: 'stroke-dasharray 700ms var(--ease-out-soft)' }}
          />
        )}
      </svg>
      <div className="relative z-10 text-center">{children}</div>
    </div>
  );
}

/** Slim horizontal bar gauge. */
export function Bar({ value, max, color = 'var(--color-ink)', height = 3 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="w-full overflow-hidden rounded-full bg-line" style={{ height }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${pct * 100}%`, background: color, transition: 'width 600ms var(--ease-out-soft)' }}
      />
    </div>
  );
}
