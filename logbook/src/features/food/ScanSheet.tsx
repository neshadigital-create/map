import { useEffect, useRef, useState } from 'react';
import { db } from '../../db';
import type { Food } from '../../db/types';
import { useSettings } from '../../db/hooks';
import { logFood, saveFood } from '../../db/actions';
import { lookupBarcode, OfflineError } from '../../lib/off';
import { useT } from '../../lib/i18n';
import { useUI } from '../../store/ui';
import { haptic } from '../../lib/haptics';
import { Button, Label, Sheet } from '../../components/ui';
import { AmountPanel, EmptyNote, FoodEditor, emptyFood } from './parts';
import { persistIfNeeded } from './AddFoodSheet';

type View =
  | { v: 'scan' }
  | { v: 'loading'; code: string }
  | { v: 'found'; food: Food }
  | { v: 'missing'; code: string; message: string }
  | { v: 'create'; code: string };

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface Detector {
  detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

/** Camera barcode scanning: native BarcodeDetector where available, ZXing elsewhere (iPhone Safari). */
function useScanner(active: boolean, onCode: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let zxingStop: (() => void) | null = null;
    let fired = false;
    const emit = (code: string) => {
      if (fired || stopped) return;
      fired = true;
      cb.current(code);
    };

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('unavailable');
        return;
      }
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      try {
        if (BD) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          if (stopped) return;
          video.srcObject = stream;
          await video.play();
          const det = new BD({ formats: FORMATS });
          const loop = async () => {
            if (stopped) return;
            try {
              const codes = await det.detect(video);
              if (codes[0]?.rawValue) return emit(codes[0].rawValue);
            } catch {
              /* frame not ready */
            }
            raf = requestAnimationFrame(loop);
          };
          loop();
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment' }, audio: false },
            video,
            (result) => {
              if (result) emit(result.getText());
            },
          );
          zxingStop = () => controls.stop();
          if (stopped) zxingStop();
        }
      } catch {
        setError('denied');
      }
    }
    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
      zxingStop?.();
    };
  }, [active]);

  return { videoRef, error };
}

export function ScanSheet({ mealId }: { mealId: string }) {
  const t = useT();
  const { close, notify, day } = useUI();
  const settings = useSettings();
  const meal = settings.meals.find((m) => m.id === mealId) ?? settings.meals[0];
  const [view, setView] = useState<View>({ v: 'scan' });
  const [manual, setManual] = useState('');
  const { videoRef, error } = useScanner(view.v === 'scan', (code) => lookup(code));

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
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-line bg-black">
            {error ? (
              <div className="grid h-full place-items-center px-6 text-center text-[13px] text-ink-3">{t('Camera unavailable')}</div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-x-10 top-1/2 h-px -translate-y-1/2 bg-accent shadow-[0_0_12px_2px_var(--color-accent)]" />
              </>
            )}
          </div>
          <div className="text-center text-[13px] text-ink-3">{t('Point the camera at a barcode')}</div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) lookup(manual);
            }}
          >
            <input inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t('Type the barcode')} className="field" />
            <Button type="submit" variant="secondary" disabled={!manual.trim()}>
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
