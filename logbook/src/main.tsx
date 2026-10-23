import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { db, ensureSeeded } from './db';
import { loadYearOnePlan } from './db/train';

async function boot() {
  try {
    await ensureSeeded();
    // One-time: add my Year One plan (Deload 1 from Mon 26 Oct 2026, then Phase 2).
    if (!(await db.meta.get('plan-yearone-v1'))) {
      await loadYearOnePlan('2026-10-26');
      await db.meta.put({ key: 'plan-yearone-v1', value: Date.now() });
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
