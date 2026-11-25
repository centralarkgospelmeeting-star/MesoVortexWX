import { alertSoundForEvent, profileAllowsTone, type AlertSettings, type AlertSoundProfile } from './settings';
import type { AlertCategory } from './model';

type Tone = {
  frequency: number;
  duration: number;
  gap: number;
  gain: number;
};

const BASE_TONE_PATTERNS: Record<AlertCategory, Tone[]> = {
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

const PROFILE_TONE_PATTERNS: Record<AlertSoundProfile, Record<AlertCategory, Tone[]>> = {
  classic: BASE_TONE_PATTERNS,
  nws: {
    warning: [
      { frequency: 1050, duration: 0.9, gap: 0.12, gain: 0.4 },
      { frequency: 1050, duration: 0.9, gap: 0.12, gain: 0.4 },
      { frequency: 1050, duration: 1.2, gap: 0, gain: 0.4 },
    ],
    watch: [
      { frequency: 880, duration: 0.35, gap: 0.1, gain: 0.26 },
      { frequency: 660, duration: 0.45, gap: 0, gain: 0.26 },
    ],
    advisory: BASE_TONE_PATTERNS.advisory,
    statement: BASE_TONE_PATTERNS.statement,
    other: BASE_TONE_PATTERNS.other,
  },
  broadcast: {
    warning: [
      { frequency: 784, duration: 0.32, gap: 0.12, gain: 0.3 },
      { frequency: 1047, duration: 0.32, gap: 0.12, gain: 0.3 },
      { frequency: 784, duration: 0.32, gap: 0.12, gain: 0.3 },
      { frequency: 1047, duration: 0.5, gap: 0, gain: 0.3 },
    ],
    watch: [
      { frequency: 740, duration: 0.24, gap: 0.1, gain: 0.22 },
      { frequency: 587, duration: 0.34, gap: 0, gain: 0.22 },
    ],
    advisory: BASE_TONE_PATTERNS.advisory,
    statement: BASE_TONE_PATTERNS.statement,
    other: BASE_TONE_PATTERNS.other,
  },
  minimal: {
    warning: [{ frequency: 880, duration: 0.18, gap: 0, gain: 0.16 }],
    watch: [{ frequency: 700, duration: 0.14, gap: 0, gain: 0.13 }],
    advisory: [{ frequency: 620, duration: 0.1, gap: 0, gain: 0.1 }],
    statement: [{ frequency: 523, duration: 0.1, gap: 0, gain: 0.09 }],
    other: [{ frequency: 523, duration: 0.08, gap: 0, gain: 0.08 }],
  },
  silent: {
    warning: [],
    watch: [],
    advisory: [],
    statement: [],
    other: [],
  },
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

/**
 * Play a built-in tone using a named profile. `silent` is a real no-op.
 */
export function playAlertTone(category: AlertCategory, profile: AlertSoundProfile = 'classic'): void {
  if (!profileAllowsTone(profile)) return;
  const pattern = PROFILE_TONE_PATTERNS[profile]?.[category] || [];
  if (!pattern.length) return;

  const context = unlockAlertAudio();
  if (!context) return;

  const start = (): void => {
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

/**
 * Single audio dispatcher for new alerts and test buttons. It honors the
 * selected sound profile before any sound is produced, including custom files.
 */
export function playAlertAudio(event: string, category: AlertCategory, settings: AlertSettings): void {
  if (!profileAllowsTone(settings.soundProfile)) return;

  const custom = alertSoundForEvent(event, settings);
  if (custom && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
    try {
      const audio = new Audio(custom);
      audio.volume = 0.9;
      void audio.play().catch(() => {
        // Browser may require another gesture; never fabricate a fallback tone.
      });
      return;
    } catch {
      return;
    }
  }

  playAlertTone(category, settings.soundProfile);
}

export function isAlertAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}
