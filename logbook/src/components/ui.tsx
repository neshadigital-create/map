import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { haptic } from '../lib/haptics';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white active:bg-[#3560cf]',
  secondary: 'bg-raised text-ink border border-line active:bg-line',
  ghost: 'text-ink-2 active:bg-raised',
  danger: 'text-warn border border-line active:bg-raised',
};

export function Button({
  variant = 'secondary',
  icon,
  className = '',
  children,
  onClick,
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; size?: 'md' | 'lg' | 'sm' }) {
  const h = size === 'lg' ? 'min-h-14 text-[15px] px-5' : size === 'sm' ? 'min-h-10 text-[13px] px-3' : 'min-h-12 text-[14px] px-4';
  return (
    <button
      {...rest}
      onClick={(e) => {
        haptic();
        onClick?.(e);
      }}
      className={`tap inline-flex items-center justify-center gap-2 rounded-2xl font-medium tracking-tight disabled:opacity-40 disabled:active:scale-100 ${h} ${VARIANTS[variant]} ${className}`}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className = '',
  onClick,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; active?: boolean }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      onClick={(e) => {
        haptic();
        onClick?.(e);
      }}
      className={`tap grid size-12 shrink-0 place-items-center rounded-full ${active ? 'text-accent' : 'text-ink-2'} active:bg-raised ${className}`}
    >
      <Icon name={icon} size={22} fill={active && icon === 'star' ? 'currentColor' : 'none'} />
    </button>
  );
}

export function Card({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`card ${className}`}>
      {children}
    </div>
  );
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`label ${className}`}>{children}</div>;
}

/** Bottom sheet with backdrop. Full-height variant for pickers. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  tall = false,
  right,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
  right?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className={`anim-sheet relative mx-auto flex w-full max-w-xl flex-col rounded-t-[28px] border-t border-line bg-card ${tall ? 'h-[94dvh]' : 'max-h-[92dvh]'}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line-strong" />
        <div className="flex items-center gap-2 px-5 pb-2 pt-2">
          <div className="min-w-0 flex-1 truncate text-[17px] font-medium tracking-tight">{title}</div>
          {right}
          <IconButton icon="close" label="Close" onClick={onClose} className="-mr-3" />
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Segmented control. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex rounded-2xl border border-line bg-bg p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => {
            haptic();
            onChange(o.value);
          }}
          className={`tap min-h-10 flex-1 rounded-xl px-2 text-[13px] font-medium ${o.value === value ? 'bg-raised text-ink' : 'text-ink-3'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Numeric stepper: big - / + buttons around an editable value. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100000,
  unit,
  decimals = 1,
  large = false,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  large?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(Math.round(value * 10 ** decimals) / 10 ** decimals));
  }, [value, decimals]);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 10 ** decimals) / 10 ** decimals));
  const bump = (d: number) => {
    haptic();
    onChange(clamp(value + d));
  };
  const btn = large ? 'size-16' : 'size-12';
  return (
    <div className="flex items-center gap-3">
      <button aria-label="Decrease" onClick={() => bump(-step)} className={`tap grid ${btn} shrink-0 place-items-center rounded-full border border-line bg-raised text-ink active:bg-line`}>
        <Icon name="minus" />
      </button>
      <label className="flex min-w-0 flex-1 items-baseline justify-center gap-1.5">
        <input
          inputMode="decimal"
          value={text}
          onFocus={(e) => {
            focused.current = true;
            e.target.select();
          }}
          onBlur={() => {
            focused.current = false;
            setText(String(value));
          }}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value.replace(',', '.'));
            if (Number.isFinite(n)) onChange(clamp(n));
          }}
          className={`numeral w-full min-w-0 bg-transparent text-center outline-none ${large ? 'text-[56px]' : 'text-[34px]'}`}
          style={{ fontSize: large ? 56 : 34 }}
        />
        {unit && <span className="shrink-0 text-[15px] text-ink-3">{unit}</span>}
      </label>
      <button aria-label="Increase" onClick={() => bump(step)} className={`tap grid ${btn} shrink-0 place-items-center rounded-full border border-line bg-raised text-ink active:bg-line`}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => {
        haptic();
        onChange(!checked);
      }}
      className="tap flex min-h-12 w-full items-center justify-between gap-4 text-left text-[15px]"
    >
      <span>{label}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-line-strong'}`}>
        <span
          className="absolute top-0.5 size-6 rounded-full bg-white transition-transform duration-200"
          style={{ transform: `translateX(${checked ? 22 : 2}px)` }}
        />
      </span>
    </button>
  );
}

export function NumField({
  label,
  value,
  onChange,
  unit,
  step = 'any',
  lazy = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  step?: string;
  /** Commit only on blur / Enter (for values that are clamped or trigger recalculation). */
  lazy?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === undefined ? '' : String(value));
  }, [value]);
  const parse = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));
  const commit = () => {
    const n = parse(text);
    if (n === undefined || Number.isFinite(n)) onChange(n);
  };
  return (
    <label className="block">
      <Label className="mb-2">{label}</Label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          data-step={step}
          value={text}
          onFocus={(e) => {
            focused.current = true;
            e.target.select();
          }}
          onBlur={() => {
            focused.current = false;
            if (lazy) commit();
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          onChange={(e) => {
            setText(e.target.value);
            if (!lazy) {
              const n = parse(e.target.value);
              if (n === undefined || Number.isFinite(n)) onChange(n);
            }
          }}
          className="field pr-12 tabular-nums"
        />
        {unit && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">{unit}</span>}
      </div>
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      {label && <Label className="mb-2">{label}</Label>}
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="field" />
    </label>
  );
}

