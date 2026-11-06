import { mealForTime, minutesOfDay } from '../../lib/dates';
import { useEffect, useRef, useState } from 'react';
import { db } from '../../db';
import type { Food } from '../../db/types';
import { useSettings } from '../../db/hooks';
import { logFood, saveFood } from '../../db/actions';
import { lookupBarcode, OfflineError } from '../../lib/off';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { Button, Label, Segmented, Sheet } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { getCameraStream, readBarcodeFromFile, releaseCameraNow, releaseCameraSoon, scanVideo } from '../../lib/camera';
import { AmountPanel, EmptyNote, FoodEditor, emptyFood } from './parts';
import { persistIfNeeded } from './AddFoodSheet';

type View =
  | { v: 'scan' }
  | { v: 'loading'; code: string }
  | { v: 'found'; food: Food }
  | { v: 'missing'; code: string; message: string }
  | { v: 'create'; code: string };

type ScanMode = 'live' | 'photo';

function loadMode(): ScanMode {
  try {
    return localStorage.getItem('logbook-scan-mode') === 'photo' ? 'photo' : 'live';
  } catch {
    return 'live';
  }
}
function saveMode(m: ScanMode) {
  try {
    localStorage.setItem('logbook-scan-mode', m);
  } catch {
    /* ignore */
  }
}

/** Live camera scanning on the shared stream (kept warm between scans, see lib/camera). */
function useScanner(active: boolean, onCode: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    (async () => {
      const video = videoRef.current;
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) return setError('unavailable');
      try {
        const stream = await getCameraStream();
        if (ctrl.signal.aborted) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        const code = await scanVideo(video, ctrl.signal);
        if (code && !ctrl.signal.aborted) cb.current(code);
      } catch {
        setError('denied');
      }
    })();
    return () => {
      ctrl.abort();
      if (videoRef.current) videoRef.current.srcObject = null;
      releaseCameraSoon();
    };
  }, [active]);

  return { videoRef, error };
}

export function ScanSheet({ mealId }: { mealId: string }) {
  const t = useT();
  const { close, notify, day } = useUI();
  const settings = useSettings();
  const meal = settings.meals.find((m) => m.id === mealId) ?? mealForTime(settings.meals, minutesOfDay(new Date(), settings.timezone));
  const [view, setView] = useState<View>({ v: 'scan' });
  const [manual, setManual] = useState('');
  const [mode, setModeState] = useState<ScanMode>(loadMode);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const setMode = (m: ScanMode) => {
    setModeState(m);
    saveMode(m);
    if (m === 'photo') releaseCameraNow();
  };
  const { videoRef, error } = useScanner(view.v === 'scan' && mode === 'live', (code) => lookup(code));

  async function lookup(code: string) {
    haptic('success');
    const clean = code.replace(/\D/g, '');
    setView({ v: 'loading', code: clean });
    const local = await db.foods.where('barcode').equals(clean).first();
    if (local) return setView({ v: 'found', food: local });
    try {
      const food = await lookupBarcode(clean);
      if (food) setView({ v: 'found', food });
      else setView({ v: 'missing', code: clean, message: t('Product not found') });
    } catch (e) {
      setView({
        v: 'missing',
        code: clean,
        message: e instanceof OfflineError ? t('Offline. Open Food Facts search needs a connection.') : t('Could not reach Open Food Facts'),
      });
    }
  }

  return (
    <Sheet title={view.v === 'found' ? view.food.name : t('Scan')} onClose={close} tall>
      {view.v === 'scan' && (
        <div className="space-y-5 pt-1">
          <Segmented<ScanMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'live', label: t('Live camera') },
              { value: 'photo', label: t('Photo') },
            ]}
          />
          {mode === 'live' ? (
            <>
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-line bg-black">
                {error ? (
                  <div className="grid h-full place-items-center px-6 text-center text-[13px] text-white/70">
                    {t('Camera not allowed. Use Photo mode, or allow the camera in iPhone Settings.')}
                  </div>
                ) : (
                  <>
                    <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                    <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 rounded bg-accent shadow-[0_0_12px_2px_var(--color-accent)]" />
                  </>
                )}
              </div>
              <div className="text-center text-[13px] text-ink-3">{t('Point the camera at a barcode')}</div>
            </>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => {
                  haptic();
                  setPhotoMsg(null);
                  photoInput.current?.click();
                }}
                className="tap tile flex w-full flex-col items-center gap-3 px-6 py-10 text-center"
              >
                <span className="grid size-16 place-items-center rounded-full bg-accent text-on-accent">
                  <Icon name="camera" size={28} />
                </span>
                <span className="text-[16px] font-semibold">{t('Take a photo of the barcode')}</span>
                <span className="text-[13px] leading-relaxed text-ink-3">{t('Uses the iPhone camera directly, so no permission pop-up. Fill the frame with the barcode.')}</span>
              </button>
              {photoMsg && <div className="text-center text-[13px] text-peach-ink">{photoMsg}</div>}
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setPhotoMsg(t('Reading…'));
                  const code = await readBarcodeFromFile(f);
                  if (code) {
                    setPhotoMsg(null);
                    lookup(code);
                  } else setPhotoMsg(t('Couldn’t read a barcode. Try again closer, straight on, in good light.'));
                }}
              />
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) lookup(manual);
            }}
          >
            <input inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t('Type the barcode')} className="field" />
            <Button type="submit" variant="secondary" disabled={!manual.trim()} className="shrink-0 whitespace-nowrap">
              {t('Look up')}
            </Button>
          </form>
        </div>
      )}
      {view.v === 'loading' && <EmptyNote>{t('Looking up…')} {view.code}</EmptyNote>}
      {view.v === 'missing' && (
        <div className="space-y-3 pt-4 text-center">
          <Label>{view.code}</Label>
          <div className="text-[15px] text-ink-2">{view.message}</div>
          <div className="flex gap-2 pt-3">
            <Button className="flex-1" onClick={() => setView({ v: 'scan' })}>
              {t('Scan')}
            </Button>
            <Button className="flex-1" variant="primary" onClick={() => setView({ v: 'create', code: view.code })}>
              {t('Create food')}
            </Button>
          </div>
        </div>
      )}
      {view.v === 'create' && (
        <FoodEditor
          initial={{ ...emptyFood(), barcode: view.code }}
          onSave={async (f) => setView({ v: 'found', food: await saveFood(f) })}
        />
      )}
      {view.v === 'found' && (
        <div className="pt-2">
          {view.food.brand && <Label className="mb-4 text-center">{view.food.brand}</Label>}
          <AmountPanel
            food={view.food}
            confirmLabel={t('Add to {meal}', { meal: meal.name })}
            onConfirm={async (amount) => {
              const stored = await persistIfNeeded(view.food);
              await logFood(stored, amount, day, meal.id);
              haptic('success');
              notify(`${t('Added')} · ${stored.name}`);
              close();
            }}
          />
        </div>
      )}
    </Sheet>
  );
}
