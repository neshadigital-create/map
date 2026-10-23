import { useUI, type Tab } from '../store/ui';
import { useT } from '../lib/i18n';
import { haptic } from '../lib/haptics';
import { Icon, type IconName } from './Icon';

const LEFT: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'today', icon: 'home', label: 'Today' },
  { id: 'food', icon: 'food', label: 'Food' },
];
const RIGHT: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'train', icon: 'train', label: 'Train' },
  { id: 'progress', icon: 'progress', label: 'Progress' },
];

/** Black steel bar with a brass / rust + in the middle for quick logging. */
export function BottomNav() {
  const t = useT();
  const { tab, setTab, open } = useUI();
  const item = (x: (typeof LEFT)[number]) => {
    const active = tab === x.id;
    return (
      <button
        key={x.id}
        onClick={() => {
          haptic();
          setTab(x.id);
          window.scrollTo({ top: 0 });
        }}
        aria-current={active ? 'page' : undefined}
        className={`tap flex min-h-16 flex-col items-center justify-center gap-1 ${active ? 'text-[#f3eadc]' : 'text-[#8d857b]'}`}
      >
        <Icon name={x.icon} size={24} />
        <span className="text-[11px] font-medium">{t(x.label)}</span>
        <span className={`h-[3px] w-5 rounded-full transition-colors duration-200 ${active ? 'bg-accent' : 'bg-transparent'}`} />
      </button>
    );
  };
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-plate">
      <div className="mx-auto grid max-w-xl grid-cols-[1fr_1fr_76px_1fr_1fr] items-center px-2">
        {LEFT.map(item)}
        <button
          aria-label={t('Add')}
          onClick={() => {
            haptic();
            open({ kind: 'quickAdd' });
          }}
          className="tap mx-auto -mt-7 grid size-[60px] place-items-center rounded-full bg-accent text-on-accent shadow-[0_10px_22px_-8px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.3)]"
        >
          <Icon name="plus" size={28} strokeWidth={2.2} />
        </button>
        {RIGHT.map(item)}
      </div>
    </nav>
  );
}
