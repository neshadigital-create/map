# Logbook

Personal workout + nutrition tracker. Mobile-first PWA (React, Vite, Tailwind, Dexie/IndexedDB). Offline-first; all data stays on the device. Back it up with Settings → Export JSON.

## Run

```bash
cd logbook
npm install
npm run dev       # local dev server
npm test          # unit tests (macro math, parser, targets, dates, backup)
npm run build     # production build in dist/ (static, deploy anywhere over HTTPS)
```

To install on iPhone: open the deployed HTTPS URL in Safari → Share → Add to Home Screen.

## Structure

```
src/
  db/          Dexie schema, seed foods, actions, backup export/import, live-query hooks
  lib/         pure logic: macros, quick-text parser, targets, dates, Open Food Facts, i18n
  components/  design system: Ring/Bar gauges, Sheet, Stepper, Segmented, nav
  features/    today/, food/, train/, progress/, settings/
tests/         vitest unit tests
```

## Stages

1. Design system, Today dashboard, Food logging
2. Train tab (program / phase / week / day, sessions, rest timer, cardio) ← current
3. Progress tab + Sunday weekly review
4. Polish, animations, PWA install

## Deploy

`.github/workflows/pages.yml` builds on every push to `main` and publishes to GitHub Pages:
the map at `/`, Logbook at `/logbook/`. One-time setup: repo Settings → Pages → Source: **GitHub Actions**.
