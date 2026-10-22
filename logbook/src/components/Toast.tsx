import { useEffect, useState } from 'react';
import { useUI } from '../store/ui';

export function Toast() {
  const toast = useUI((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
    >
      <div
        className="rounded-full border border-line-strong bg-raised px-4 py-2.5 text-[13px] text-ink shadow-2xl transition-all duration-300"
        style={{ opacity: visible ? 1 : 0, transform: `translateY(${visible ? 0 : -8}px)` }}
      >
        {toast.text}
      </div>
    </div>
  );
}
