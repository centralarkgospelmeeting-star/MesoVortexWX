import type { AlertCategory } from './model';

type Tone = {
  frequency: number;
  duration: number;
  gap: number;
  gain: number;
};

const TONE_PATTERNS: Record<AlertCategory, Tone[]> = {
  // NOAA Weather Radio style attention tone for warnings.
  warning: [
    { frequency: 1050, duration: 0.85, gap: 0.2, gain: 0.34 },
    { frequency: 1050, duration: 0.85, gap: 0.2, gain: 0.34 },
    { frequency: 1050, duration: 1.1, gap: 0, gain: 0.34 },
  ],
  watch: [
    { frequency: 880, duration: 0.28, gap: 0.12, gain: 0.22 },
    { frequency: 660, duration: 0.4, gap: 0, gain: 0.22 },
  ],
  advisory: [
    { frequency: 620, duration: 0.22, gap: 0.1, gain: 0.16 },
    { frequency: 620, duration: 0.22, gap: 0, gain: 0.16 },
  ],
  statement: [{ frequency: 523, duration: 0.18, gap: 0, gain: 0.12 }],
  other: [{ frequency: 523, duration: 0.15, gap: 0, gain: 0.1 }],
};

let audioContext: AudioContext | null = null;

/**
 * Must be called from a user gesture (click/keypress) before any alert sound
 * can play. Returns null when the browser does not support Web Audio.
 */
export function unlockAlertAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }
    return audioContext;
  } catch {
    return null;
  }
}

export function playAlertTone(category: AlertCategory): void {
  const context = unlockAlertAudio();
  if (!context) return;

  const start = (): void => {
    const pattern = TONE_PATTERNS[category] || TONE_PATTERNS.other;
    let offset = context.currentTime + 0.02;

    pattern.forEach((tone) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(tone.frequency, offset);

      gain.gain.setValueAtTime(0.0001, offset);
      gain.gain.exponentialRampToValueAtTime(tone.gain, offset + 0.03);
      gain.gain.setValueAtTime(tone.gain, offset + tone.duration - 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, offset + tone.duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(offset);
      oscillator.stop(offset + tone.duration + 0.02);

      offset += tone.duration + tone.gap;
    });
  };

  if (context.state === 'suspended') {
    context.resume().then(start).catch(() => {
      // Autoplay policy still blocking; the enable button is the only fix.
    });
  } else {
    start();
  }
}

export function isAlertAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}
