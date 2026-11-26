import { alertSoundForEvent, formatAlertSpeech, profileAllowsTone, type AlertSettings, type AlertSoundProfile } from './settings';
import { alertTypeForEvent } from './categories';
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

function playAudioFile(src: string): boolean {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;
  try {
    const audio = new Audio(src);
    audio.volume = 0.9;
    void audio.play().catch(() => {
      // Browser may require another gesture; never fabricate a fallback tone.
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Single audio dispatcher for new alerts and test buttons. It honors the
 * selected sound profile before any sound is produced, including custom files.
 */
export function playAlertAudio(event: string, category: AlertCategory, settings: AlertSettings): void {
  if (!profileAllowsTone(settings.soundProfile)) return;
  const type = alertTypeForEvent(event);
  const pref = type ? settings.categoryPrefs?.[type.id] : null;
  if (pref && !pref.enabled) return;
  const uploaded = alertSoundForEvent(event, settings);
  const sound = uploaded || pref?.sound;
  // Bundled default recordings contain their own announcement; do not layer
  // synthesized speech on top of them. Uploaded sounds honor voice settings.
  const bundled = !uploaded && typeof sound === 'string' && sound.startsWith('/alerts/');
  const speak = !bundled && (pref ? pref.voice && settings.speech.enabled : settings.speech.enabled);
  const after = type?.id === 'tornado-emergency' ? () => { if (profileAllowsTone(settings.soundProfile)) playSiren(10, true); } : undefined;

  if (sound && typeof sound === 'string' && playAudioFile(sound)) {
    if (speak) speakAlertText(type?.phrase || formatAlertSpeech(event), settings, after);
    return;
  }

  if (type) playEventTone(type.tone, type.label, settings);
  else playAlertTone(category, settings.soundProfile);
  if (speak) speakAlertText(type?.phrase || formatAlertSpeech(event), settings, after);
}

/** Air-raid-style siren with a slow alternation and short, limited duration. */
function playSiren(seconds: number, enhanced: boolean): void {
  const ctx = unlockAlertAudio();
  if (!ctx) return;
  const start = ctx.currentTime + 0.02;
  const count = Math.ceil(seconds / 0.5);
  for (let i = 0; i < count; i += 1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = start + i * 0.5;
    osc.type = 'sine';
    osc.frequency.setValueAtTime((enhanced ? 820 : 720) + (i % 2) * (enhanced ? 260 : 280), at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(enhanced ? 0.42 : 0.34, at + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.46);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.48);
  }
}

/** Short non-continuous reminder used only while a Tornado Emergency is active. */
export function playEmergencyReminder(settings: AlertSettings): void {
  if (!profileAllowsTone(settings.soundProfile)) return;
  playSiren(1.5, false);
}

function playEventTone(tone: string, event: string, settings: AlertSettings): void {
  if (tone === 'siren') { playSiren(event === 'Tornado Emergency' ? 7 : 3, false); return; }
  if (tone === 'enhanced') { playSiren(event === 'Confirmed Tornado Warning' ? 3 : 5, true); return; }
  if (tone === 'flood') {
    playAlertTone('warning', settings.soundProfile === 'silent' ? 'minimal' : 'classic');
    return;
  }
  if (tone === 'emergency-flood') {
    const ctx = unlockAlertAudio();
    if (!ctx) return;
    [0, 0.45, 0.9].forEach((offset, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + 0.02 + offset;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(index === 1 ? 620 : 494, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.38, at + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(at); osc.stop(at + 0.42);
    });
    return;
  }
  playAlertTone(tone === 'attention' ? 'advisory' : 'warning', settings.soundProfile === 'silent' ? 'minimal' : 'broadcast');
}

/** Speak real alert text; silent mode and disabled speech produce no audio. */
export function speakAlertText(text: string, settings: AlertSettings, onEnd?: () => void): void {
  if (!settings.speech.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.voiceRate;
    utterance.pitch = settings.voicePitch;
    utterance.volume = Math.max(0, Math.min(1, settings.speech.volume));
    const voices = window.speechSynthesis.getVoices();
    if (settings.voiceURI) {
      const chosen = voices.find((voice) => voice.voiceURI === settings.voiceURI);
      if (chosen) utterance.voice = chosen;
    } else {
      // Default: deep, calm, commanding male-style voice when the platform
      // exposes one; never a cheerful or conversational voice.
      const preferred = voices.find((voice) => /male|david|daniel|alex|google us english/i.test(voice.name) && /^en(-|_)/i.test(voice.lang))
        || voices.find((voice) => /^en(-|_)/i.test(voice.lang));
      if (preferred) utterance.voice = preferred;
    }
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech may be blocked; never fabricate a fallback announcement.
  }
}

/** Test the exact configured tone + voice for a without waiting for a real alert. */
export function playTestAlert(test: { event: string; tone: string; phrase: string }, settings: AlertSettings): void {
  const type = alertTypeForEvent(test.event);
  const uploaded = alertSoundForEvent(test.event, settings);
  const sound = uploaded || settings.categoryPrefs?.[type?.id || '']?.sound;
  if (sound && typeof sound === 'string' && playAudioFile(sound)) {
    if (uploaded) speakAlertText(test.phrase, settings);
    return;
  }
  if (settings.soundProfile !== 'silent') playEventTone(test.tone, test.event, settings);
  const after = test.event === 'Tornado Emergency'
    ? () => { if (settings.soundProfile !== 'silent') playSiren(10, true); }
    : undefined;
  speakAlertText(test.phrase, settings, after);
  if (after && !settings.speech.enabled && settings.soundProfile !== 'silent') {
    // No speech to wait for; still play the promised follow-on siren.
    setTimeout(after, 1200);
  }
}

export function isAlertAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}
