/** Short beep for the rest timer. The audio context is unlocked on a user tap (iOS requirement). */
let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* no audio */
  }
}

export function beep(times = 2) {
  try {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      const start = t0 + i * 0.28;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.22);
    }
  } catch {
    /* no audio */
  }
}
