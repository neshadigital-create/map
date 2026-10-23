import { lazy, Suspense, useEffect } from 'react';
import { useUI } from './store/ui';
import { useSettings } from './db/hooks';
import { dayKey, setTrainingWeekStartsOn } from './lib/dates';
import { BottomNav } from './components/BottomNav';
import { Toast } from './components/Toast';
import { UpdatePrompt } from './components/UpdatePrompt';
import { TodayScreen } from './features/today/TodayScreen';
import { FoodScreen } from './features/food/FoodScreen';
import { TrainScreen } from './features/train/TrainScreen';
import { AddFoodSheet } from './features/food/AddFoodSheet';
import { QuickTextSheet } from './features/food/QuickTextSheet';
import { ScanSheet } from './features/food/ScanSheet';
import { RecipesSheet } from './features/food/RecipesSheet';
import { EntrySheet } from './features/food/EntrySheet';
import { SettingsSheet } from './features/settings/SettingsSheet';
import { SessionScreen } from './features/train/SessionScreen';
import { RestBar } from './features/train/RestBar';
import { ProgramSheet } from './features/train/ProgramSheet';
import { DayEditorSheet } from './features/train/DayEditorSheet';
import { CardioSheet } from './features/train/CardioSheet';
import { SummarySheet } from './features/train/SummarySheet';
import { CalendarDaySheet } from './features/train/Calendar';
import { QuickAddSheet } from './features/today/QuickAddSheet';

// Charts are loaded only when the Progress tab opens.
const ProgressScreen = lazy(() => import('./features/progress/ProgressScreen'));

export default function App() {
  const { tab, sheet, setLang, setDay, sessionView } = useUI();
  const settings = useSettings();

  // Appearance: auto follows the phone; light/dark are forced.
  useEffect(() => {
    const root = document.documentElement;
    const theme = settings.theme ?? 'auto';
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#11131C' : '#FFFFFF'));
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [settings.theme]);

  useEffect(() => {
    setTrainingWeekStartsOn(settings.trainingWeekStartsOn ?? 0);
  }, [settings.trainingWeekStartsOn]);

  useEffect(() => {
    setLang(settings.lang);
    document.documentElement.lang = settings.lang;
  }, [settings.lang, setLang]);

  // Roll over to the new day when the app comes back to the foreground after midnight.
  useEffect(() => {
    let last = dayKey(new Date(), settings.timezone);
    const check = () => {
      const now = dayKey(new Date(), settings.timezone);
      if (now !== last) {
        if (useUI.getState().day === last) setDay(now);
        last = now;
      }
    };
    const id = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [settings.timezone, setDay]);

  return (
    <div className="pt-safe mx-auto min-h-full max-w-xl px-4 pb-28">
      <main key={tab} className="anim-fade">
        {tab === 'today' && <TodayScreen />}
        {tab === 'food' && <FoodScreen />}
        {tab === 'train' && <TrainScreen />}
        {tab === 'progress' && (
          <Suspense fallback={null}>
            <ProgressScreen />
          </Suspense>
        )}
      </main>
      <BottomNav />
      {sheet?.kind === 'add' && <AddFoodSheet key={`add-${sheet.foodId ?? ''}`} mealId={sheet.mealId} foodId={sheet.foodId} />}
      {sheet?.kind === 'quickAdd' && <QuickAddSheet />}
      {sheet?.kind === 'quick' && <QuickTextSheet mealId={sheet.mealId} />}
      {sheet?.kind === 'scan' && <ScanSheet mealId={sheet.mealId} />}
      {sheet?.kind === 'recipes' && <RecipesSheet mealId={sheet.mealId} />}
      {sheet?.kind === 'entry' && <EntrySheet key={sheet.entryId} entryId={sheet.entryId} />}
      {sessionView && <SessionScreen sessionId={sessionView} />}
      {sheet?.kind === 'settings' && <SettingsSheet />}
      {sheet?.kind === 'program' && <ProgramSheet />}
      {sheet?.kind === 'dayEditor' && <DayEditorSheet key={sheet.dayId} dayId={sheet.dayId} />}
      {sheet?.kind === 'cardio' && <CardioSheet key={sheet.cardioId ?? 'new'} cardioId={sheet.cardioId} />}
      {sheet?.kind === 'summary' && <SummarySheet key={sheet.sessionId} sessionId={sheet.sessionId} />}
      {sheet?.kind === 'calendarDay' && <CalendarDaySheet day={sheet.day} />}
      <RestBar />
      <Toast />
      <UpdatePrompt />
    </div>
  );
}
