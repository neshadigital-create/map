import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ensureSeeded } from './db';

async function boot() {
  try {
    await ensureSeeded();
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
