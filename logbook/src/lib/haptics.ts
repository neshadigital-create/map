/**
 * Light tap feedback. Android uses the Vibration API. iOS Safari (17.4+) has no
 * vibrate(), but toggling a native switch input produces a system haptic, so we use that.
 */
let iosSwitch: HTMLLabelElement | null = null;

function iosTick() {
  if (typeof document === 'undefined') return;
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9px;top:-9px';
    label.ariaHidden = 'true';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(kind: 'tap' | 'success' | 'long' = 'tap') {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
      navigator.vibrate(kind === 'tap' ? 8 : kind === 'success' ? [10, 40, 14] : [200, 100, 200]);
      return;
    }
    iosTick();
  } catch {
    /* no haptics available */
  }
}
