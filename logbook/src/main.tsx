import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { db, ensureSeeded } from './db';
import { alignPhasesToWeekStart, fillHardSetReps, loadYearOnePlan } from './db/train';
import { setTrainingWeekStartsOn } from './lib/dates';

async function boot() {
  try {
    await ensureSeeded();
    const s = await db.settings.get('settings');
    setTrainingWeekStartsOn(s?.trainingWeekStartsOn ?? 0);
    // One-time: add my Year One plan (Deload 1 from Sun 25 Oct 2026, then Phase 2 from Sun 1 Nov).
    if (!(await db.meta.get('plan-yearone-v1'))) {
      await loadYearOnePlan('2026-10-25');
      await db.meta.put({ key: 'plan-yearone-v1', value: Date.now() });
    }
    // One-time: my training week starts on Sunday, so phases begin on Sundays.
    if (!(await db.meta.get('week-sunday-v1'))) {
      await alignPhasesToWeekStart();
      await db.meta.put({ key: 'week-sunday-v1', value: Date.now() });
    }
    // One-time: hard sets are 8-10 reps.
    if (!(await db.meta.get('plan-yearone-reps-v2'))) {
      await fillHardSetReps();
      await db.meta.put({ key: 'plan-yearone-reps-v2', value: Date.now() });
    }
    // Ask the browser not to evict local data (important on iOS home-screen apps).
    await navigator.storage?.persist?.();
  } catch (e) {
    console.error('Startup failed', e);
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
boot();
