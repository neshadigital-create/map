/**
 * One shared camera stream for barcode scanning.
 * iPhone home-screen apps can ask for camera permission again every time the camera is
 * reopened, so after a scan the stream is kept for a short while: scanning several items
 * in a row asks once. It is released after `KEEP_MS` without use (the camera light goes off).
 */
const KEEP_MS = 2 * 60 * 1000;

let stream: MediaStream | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

function live(s: MediaStream | null): s is MediaStream {
  return !!s && s.getVideoTracks().some((t) => t.readyState === 'live');
}

export async function getCameraStream(): Promise<MediaStream> {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (live(stream)) return stream;
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  return stream;
}

/** Keep the camera warm for a bit, then turn it off. */
export function releaseCameraSoon(ms = KEEP_MS) {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(releaseCameraNow, ms);
}

export function releaseCameraNow() {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

// Turn the camera off when the app goes to the background.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') releaseCameraNow();
  });
}

interface Detector {
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

function nativeDetector(): Detector | null {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  try {
    return BD ? new BD({ formats: FORMATS }) : null;
  } catch {
    return null;
  }
}

/** Reads a barcode from a still photo (no camera permission needed: the iPhone camera app takes it). */
export async function readBarcodeFromFile(file: Blob): Promise<string | null> {
  const det = nativeDetector();
  if (det) {
    try {
      const bmp = await createImageBitmap(file);
      const codes = await det.detect(bmp);
      if (codes[0]?.rawValue) return codes[0].rawValue;
    } catch {
      /* fall through to ZXing */
    }
  }
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const reader = new BrowserMultiFormatReader();
  const url = URL.createObjectURL(file);
  try {
    return (await reader.decodeFromImageUrl(url)).getText();
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Scans frames from a playing video until a code is found or `signal` aborts. */
export async function scanVideo(video: HTMLVideoElement, signal: AbortSignal): Promise<string | null> {
  const det = nativeDetector();
  const { BrowserMultiFormatReader } = det ? { BrowserMultiFormatReader: null } : await import('@zxing/browser');
  const reader = BrowserMultiFormatReader ? new BrowserMultiFormatReader() : null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, det ? 120 : 220));
    if (video.readyState < 2 || !video.videoWidth) continue;
    try {
      if (det) {
        const codes = await det.detect(video);
        if (codes[0]?.rawValue) return codes[0].rawValue;
      } else if (reader && ctx) {
        // Read the middle band where the guide line is, at a modest size, to keep it quick.
        const w = Math.min(960, video.videoWidth);
        const h = Math.round((w / video.videoWidth) * video.videoHeight);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        return reader.decodeFromCanvas(canvas).getText();
      }
    } catch {
      /* no code in this frame */
    }
  }
  return null;
}
