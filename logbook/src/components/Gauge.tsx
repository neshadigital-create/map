import { useId } from 'react';

/**
 * Vintage pressure-gauge dial: 270° scale with ticks, a glowing arc and a needle.
 * Past the goal the needle rests on the end stop and a quiet second arc shows the overage.
 */
export function Gauge({ value, max, size = 290, children }: { value: number; max: number; size?: number; children?: React.ReactNode }) {
  const id = useId().replace(/:/g, '');
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 26;
  const start = -225;
  const sweep = 270;
  const frac = max > 0 ? Math.max(0, value / max) : 0;
  const main = Math.min(1, frac);
  const over = Math.min(1, Math.max(0, frac - 1));
  const pt = (deg: number, r: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  const arc = (r: number, a0: number, a1: number) => {
    const [x0, y0] = pt(a0, r);
    const [x1, y1] = pt(a1, r);
    return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const circ = 2 * Math.PI * R;
  const arcLen = (circ * sweep) / 360;
  const needle = start + sweep * main;
  const ticks = Array.from({ length: 41 }, (_, i) => {
    const a = start + (sweep * i) / 40;
    const major = i % 10 === 0;
    const [x0, y0] = pt(a, R - 12);
    const [x1, y1] = pt(a, R - (major ? 24 : 17));
    return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={major ? 'var(--color-ink-2)' : 'var(--color-ink-3)'} strokeWidth={major ? 1.6 : 1} opacity={major ? 1 : 0.55} />;
  });
  const [l0x, l0y] = pt(start, R + 6);
  const [l1x, l1y] = pt(start + sweep, R + 6);
  return (
    <div className="relative" style={{ width: size, height: size * 0.86 }}>
      <svg width={size} height={size} className="absolute inset-x-0 top-0 overflow-visible" aria-hidden="true">
        <defs>
          <filter id={`glow${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <path d={arc(R + 12, start - 4, start + sweep + 4)} fill="none" stroke="var(--color-line)" />
        <path d={arc(R, start, start + sweep)} fill="none" stroke="var(--color-track)" strokeWidth={6} strokeLinecap="round" />
        {/* the arc is drawn as one path and revealed with a dash so it animates smoothly */}
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="var(--glow)"
          strokeWidth={8}
          strokeLinecap="round"
          filter={`url(#glow${id})`}
          strokeDasharray={`${arcLen * main} ${circ}`}
          transform={`rotate(${start} ${cx} ${cy})`}
          opacity={main > 0 ? 1 : 0}
          style={{ transition: 'stroke-dasharray 700ms var(--ease-out-soft)' }}
        />
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${arcLen * main} ${circ}`}
          transform={`rotate(${start} ${cx} ${cy})`}
          opacity={main > 0 ? 1 : 0}
          style={{ transition: 'stroke-dasharray 700ms var(--ease-out-soft)' }}
        />
        {over > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={R - 8}
            fill="none"
            stroke="var(--color-ink-3)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${((2 * Math.PI * (R - 8) * sweep) / 360) * over} ${circ}`}
            transform={`rotate(${start} ${cx} ${cy})`}
          />
        )}
        {ticks}
        <text x={l0x - 12} y={l0y + 16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-3)">
          0
        </text>
        <text x={l1x + 14} y={l1y + 16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-3)">
          {Math.round(max)}
        </text>
        <g style={{ transform: `rotate(${needle + 90}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform 900ms cubic-bezier(.34,1.3,.5,1)' }}>
          <line x1={cx} y1={cy + 10} x2={cx} y2={cy - (R - 34)} stroke="var(--color-accent)" strokeWidth={2.5} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={7} fill="var(--color-card)" stroke="var(--color-accent)" strokeWidth={2} />
      </svg>
      <div className="absolute inset-x-0 text-center" style={{ top: cy + 22 }}>
        {children}
      </div>
    </div>
  );
}
