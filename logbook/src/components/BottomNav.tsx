import { useUI, type Tab } from '../store/ui';
import { useT } from '../lib/i18n';
import { haptic } from '../lib/haptics';
import { Icon, type IconName } from './Icon';

const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'today', icon: 'today', label: 'Today' },
  { id: 'food', icon: 'food', label: 'Food' },
  { id: 'train', icon: 'train', label: 'Train' },
  { id: 'progress', icon: 'progress', label: 'Progress' },
];

export function BottomNav() {
  const t = useT();
  const { tab, setTab } = useUI();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl">
      <div className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map((x) => {
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
              className={`tap flex min-h-16 flex-col items-center justify-center gap-1.5 ${active ? 'text-ink' : 'text-ink-3'}`}
            >
              <Icon name={x.icon} size={24} />
              <span className="text-[10px] font-medium uppercase tracking-[0.14em]">{t(x.label)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
