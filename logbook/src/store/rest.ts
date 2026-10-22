import { create } from 'zustand';

/** Rest timer keyed to an absolute end time so it survives the app going to the background. */
interface RestState {
  endAt: number | null;
  duration: number;
  start: (sec: number) => void;
  add: (sec: number) => void;
  stop: () => void;
}

const KEY = 'logbook-rest';

function load(): { endAt: number | null; duration: number } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v.endAt === 'number' && v.endAt > Date.now()) return v;
  } catch {
    /* storage unavailable */
  }
  return { endAt: null, duration: 90 };
}

function save(v: { endAt: number | null; duration: number }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export const useRest = create<RestState>((set, get) => ({
  ...load(),
  start: (sec) => {
    const v = { endAt: Date.now() + sec * 1000, duration: sec };
    save(v);
    set(v);
  },
  add: (sec) => {
    const { endAt, duration } = get();
    if (!endAt) return;
    const v = { endAt: Math.max(Date.now() + 1000, endAt + sec * 1000), duration: Math.max(5, duration + sec) };
    save(v);
    set(v);
  },
  stop: () => {
    const v = { endAt: null, duration: get().duration };
    save(v);
    set(v);
  },
}));
