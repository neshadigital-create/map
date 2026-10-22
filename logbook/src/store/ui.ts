import { create } from 'zustand';
import type { Lang } from '../db/types';
import { dayKey } from '../lib/dates';

export type Tab = 'today' | 'food' | 'train' | 'progress';

export type SheetState =
  | { kind: 'add'; mealId: string }
  | { kind: 'quick'; mealId: string }
  | { kind: 'scan'; mealId: string }
  | { kind: 'recipes'; mealId: string }
  | { kind: 'entry'; entryId: string }
  | { kind: 'settings' }
  | null;

interface UIState {
  tab: Tab;
  day: string;
  lang: Lang;
  sheet: SheetState;
  toast: { id: number; text: string } | null;
  setTab: (t: Tab) => void;
  setDay: (d: string) => void;
  setLang: (l: Lang) => void;
  open: (s: SheetState) => void;
  close: () => void;
  notify: (text: string) => void;
}

export const useUI = create<UIState>((set) => ({
  tab: 'today',
  day: dayKey(),
  lang: 'en',
  sheet: null,
  toast: null,
  setTab: (tab) => set({ tab }),
  setDay: (day) => set({ day }),
  setLang: (lang) => set({ lang }),
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
  notify: (text) => set({ toast: { id: Date.now(), text } }),
}));
