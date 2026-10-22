/** Small per-device flags (dismissed hints). Storage can be unavailable; never throw. */
export function getFlag(key: string): boolean {
  try {
    return localStorage.getItem(`logbook-${key}`) === '1';
  } catch {
    return false;
  }
}

export function setFlag(key: string) {
  try {
    localStorage.setItem(`logbook-${key}`, '1');
  } catch {
    /* ignore */
  }
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}
