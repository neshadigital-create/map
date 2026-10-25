import { useRef, useState, type ReactNode } from 'react';
import { removeCover, setCover, useCover } from '../lib/covers';
import { useT } from '../lib/i18n';
import { haptic } from '../lib/haptics';
import { Icon, type IconName } from './Icon';

/**
 * A card or tile that shows my cover photo if I set one, otherwise a soft studio backdrop
 * with a quiet icon. Text placed inside sits on a gentle shade for legibility.
 */
export function PhotoCard({
  coverId,
  className = '',
  icon = 'train',
  shade = true,
  children,
  onClick,
}: {
  coverId?: string;
  className?: string;
  icon?: IconName;
  shade?: boolean;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const url = useCover(coverId);
  return (
    <div
      onClick={onClick}
      data-photo={url ? '' : undefined}
      className={`photo ${shade ? 'photo-shade' : ''} ${onClick ? 'tap cursor-pointer' : ''} ${className}`}
      style={url ? { backgroundImage: `url(${url})` } : undefined}
    >
      {!url && <Icon name={icon} size={120} strokeWidth={1} className="pointer-events-none absolute -right-4 top-2 text-white/45" />}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

/** Small square thumbnail for list rows. */
export function Thumb({ coverId, label, size = 60 }: { coverId?: string; label?: string; size?: number }) {
  const url = useCover(coverId);
  return (
    <div
      className="photo grid shrink-0 place-items-center !rounded-[14px] text-[18px] font-semibold"
      style={{ width: size, height: size, ...(url ? { backgroundImage: `url(${url})` } : {}) }}
    >
      {!url && <span className="display text-[24px] text-white/90">{label}</span>}
    </div>
  );
}

/** "Change photo" control: pick from the camera roll, or remove. */
export function CoverButton({ coverId, className = '' }: { coverId: string; className?: string }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const url = useCover(coverId);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          haptic();
          input.current?.click();
        }}
        disabled={busy}
        aria-label={t('Change photo')}
        className={`tap grid size-11 place-items-center rounded-full bg-white/90 text-[#1f2235] shadow-sm backdrop-blur ${className}`}
      >
        <Icon name="camera" size={20} />
      </button>
      {url && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptic();
            removeCover(coverId);
          }}
          aria-label={t('Remove photo')}
          className="tap ml-2 grid size-11 place-items-center rounded-full bg-white/90 text-[#1f2235] shadow-sm"
        >
          <Icon name="trash" size={18} />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            await setCover(coverId, f);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
