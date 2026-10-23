import { create } from 'zustand';
import type { Lang } from '../db/types';
import { dayKey } from '../lib/dates';

export type Tab = 'today' | 'food' | 'train' | 'progress';

export type SheetState =
  | { kind: 'add'; mealId: string; foodId?: string }
  | { kind: 'quickAdd' }
  | { kind: 'quick'; mealId: string }
  | { kind: 'scan'; mealId: string }
  | { kind: 'recipes'; mealId: string }
  | { kind: 'entry'; entryId: string }
  | { kind: 'settings' }
  | { kind: 'program' }
  | { kind: 'dayEditor'; dayId: string }
  | { kind: 'cardio'; cardioId?: string }
  | { kind: 'summary'; sessionId: string }
  | { kind: 'calendarDay'; day: string }
  | null;

interface UIState {
  tab: Tab;
  day: string;
  lang: Lang;
  sheet: SheetState;
  toast: { id: number; text: string } | null;
  /** Id of the workout session shown full screen, if any */
  sessionView: string | null;
  setSessionView: (id: string | null) => void;
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
  sessionView: null,
  setSessionView: (sessionView) => set({ sessionView }),
  setTab: (tab) => set({ tab }),
  setDay: (day) => set({ day }),
  setLang: (lang) => set({ lang }),
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
  notify: (text) => set({ toast: { id: Date.now(), text } }),
}));
