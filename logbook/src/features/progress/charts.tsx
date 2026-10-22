import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, Label } from '../../components/ui';

/** Shared minimal dark chart styling: hairline solid grid, muted ticks, no axis lines. */
const tick = { fill: 'var(--color-ink-3)', fontSize: 11 };
const grid = <CartesianGrid vertical={false} stroke="var(--color-line)" strokeWidth={1} />;

export function shortDate(day: string) {
  const [, m, d] = day.split('-');
  return `${Number(d)}/${Number(m)}`;
}

export function ChartCard({ title, right, children, footer }: { title: string; right?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <Label>{title}</Label>
        {right}
      </div>
      {children}
      {footer && <div className="mt-3">{footer}</div>}
    </Card>
  );
}

export function TipBox({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-line-strong bg-raised px-3 py-2 text-[12px] shadow-xl">
      <div className="mb-1 text-ink-3">{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 tabular-nums">
          <span className="text-ink-2">{k}</span>
          <span className="text-ink">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="grid h-40 place-items-center px-6 text-center text-[13px] text-ink-3">{children}</div>;
}

/** Daily weigh-ins as quiet dots, 7-day average as the line that matters. */
export function WeightChart({ data, labels }: { data: { day: string; kg: number; trend: number }[]; labels: { daily: string; trend: string } }) {
  const vals = data.flatMap((d) => [d.kg, d.trend]);
  const min = Math.floor(Math.min(...vals) - 0.5);
  const max = Math.ceil(Math.max(...vals) + 0.5);
  return (
    <>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            {grid}
            <XAxis dataKey="day" tickFormatter={shortDate} tick={tick} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis domain={[min, max]} tick={tick} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
            <Tooltip
              cursor={{ stroke: 'var(--color-line-strong)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TipBox
                    title={shortDate(String(payload[0].payload.day))}
                    rows={[
                      [labels.daily, `${payload[0].payload.kg} kg`],
                      [labels.trend, `${payload[0].payload.trend} kg`],
                    ]}
                  />
                ) : null
              }
            />
            <Scatter dataKey="kg" fill="var(--color-ink-3)" shape={(p: { cx?: number; cy?: number }) => <circle cx={p.cx} cy={p.cy} r={3.5} fill="var(--color-ink-3)" stroke="var(--color-card)" strokeWidth={2} />} isAnimationActive={false} />
            <Line dataKey="trend" type="monotone" stroke="var(--color-ink)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--color-ink)', stroke: 'var(--color-card)', strokeWidth: 2 }} animationDuration={500} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-5 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink-3" /> {labels.daily}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-ink" /> {labels.trend}
        </span>
      </div>
    </>
  );
}

/** Weekly averages as columns with a neutral target line. */
export function WeeklyColumns({ data, target, color, unit }: { data: { label: string; value: number | null; days: number }[]; target: number; color: string; unit: string }) {
  const raw = Math.max(target * 1.15, ...data.map((d) => d.value ?? 0));
  const step = raw > 1500 ? 1000 : raw > 300 ? 100 : 50;
  const top = Math.ceil(raw / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          {grid}
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
          <YAxis domain={[0, top]} ticks={ticks} tick={tick} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
          <Tooltip
            cursor={{ fill: 'var(--color-raised)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox
                  title={String(payload[0].payload.label)}
                  rows={[
                    ['avg', payload[0].payload.value ? `${payload[0].payload.value} ${unit}` : '—'],
                    ['days', String(payload[0].payload.days)],
                  ]}
                />
              ) : null
            }
          />
          <ReferenceLine y={target} stroke="var(--color-ink-3)" strokeDasharray="0" strokeWidth={1}  />
          <Bar dataKey="value" fill={color} barSize={18} radius={[4, 4, 0, 0]} animationDuration={500} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MuscleBars({ data, label }: { data: { name: string; kg: number }[]; label: (n: string) => string }) {
  return (
    <div style={{ height: Math.max(80, data.length * 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" tickFormatter={label} tick={{ ...tick, fontSize: 12 }} axisLine={false} tickLine={false} width={92} />
          <Tooltip cursor={{ fill: 'var(--color-raised)' }} content={({ active, payload }) => (active && payload?.length ? <TipBox title={label(String(payload[0].payload.name))} rows={[['kg × reps', `${payload[0].payload.kg.toLocaleString('en-US')}`]]} /> : null)} />
          <Bar
            dataKey="kg"
            fill="var(--color-ink-2)"
            barSize={16}
            radius={[0, 4, 4, 0]}
            animationDuration={500}
            label={{ position: 'right', fill: 'var(--color-ink-3)', fontSize: 11, formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v) }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StrengthChart({ data }: { data: { day: string; e1rm: number; top: number }[] }) {
  const vals = data.map((d) => d.e1rm);
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          {grid}
          <XAxis dataKey="day" tickFormatter={shortDate} tick={tick} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis domain={[Math.floor(Math.min(...vals) * 0.9), Math.ceil(Math.max(...vals) * 1.05)]} tick={tick} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ stroke: 'var(--color-line-strong)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox
                  title={shortDate(String(payload[0].payload.day))}
                  rows={[
                    ['e1RM', `${payload[0].payload.e1rm} kg`],
                    ['top set', `${payload[0].payload.top} kg`],
                  ]}
                />
              ) : null
            }
          />
          <Line dataKey="e1rm" type="monotone" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-accent)', stroke: 'var(--color-card)', strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={500} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
