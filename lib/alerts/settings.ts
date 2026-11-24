export type AlertSoundProfile = 'classic' | 'nws' | 'broadcast' | 'minimal' | 'silent';

export type AlertSpeechSettings = {
  enabled: boolean;
  warnings: boolean;
  statements: boolean;
  watches: boolean;
};

export type AlertCustomSounds = {
  global?: string; // data URL
  tornadoWarning?: string;
  severeThunderstormWarning?: string;
  flashFloodWarning?: string;
};

export type AlertColorSettings = {
  tornadoWarning: string;
  severeThunderstormWarning: string;
  flashFloodWarning: string;
  severeWeatherStatement: string;
  tornadoWatch: string;
  severeThunderstormWatch: string;
  advisory: string;
  statement: string;
};

export type AlertDisplayBehavior = 'banner-and-sidebar' | 'sidebar-only' | 'banner-only';

export type AlertSettings = {
  colors: AlertColorSettings;
  soundProfile: AlertSoundProfile;
  speech: AlertSpeechSettings;
  customSounds: AlertCustomSounds;
  sidebarPinned: boolean;
  sidebarAutoHide: boolean;
  outlineThickness: number;
  filterMode: 'all' | 'warnings' | 'watches' | 'statements';
  sortMode: 'priority' | 'newest' | 'expiring';
  warningDisplayBehavior: AlertDisplayBehavior;
};

export const ALERT_SETTINGS_KEY = 'mesovortex_alert_settings_v1';

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  colors: {
    tornadoWarning: '#dc2626',
    severeThunderstormWarning: '#f59e0b',
    flashFloodWarning: '#10b981',
    severeWeatherStatement: '#8b5cf6',
    tornadoWatch: '#eab308',
    severeThunderstormWatch: '#f59e0b',
    advisory: '#0ea5e9',
    statement: '#8b5cf6',
  },
  soundProfile: 'classic',
  speech: {
    enabled: false,
    warnings: true,
    statements: false,
    watches: false,
  },
  customSounds: {},
  sidebarPinned: false,
  sidebarAutoHide: false,
  outlineThickness: 2,
  filterMode: 'all',
  sortMode: 'priority',
  warningDisplayBehavior: 'banner-and-sidebar',
};

export function loadAlertSettings(): AlertSettings {
  if (typeof window === 'undefined') return DEFAULT_ALERT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(ALERT_SETTINGS_KEY);
    if (!raw) return DEFAULT_ALERT_SETTINGS;
    const parsed = JSON.parse(raw);
    const filterMode = ['all','warnings','watches','statements'].includes(parsed?.filterMode) ? parsed.filterMode : DEFAULT_ALERT_SETTINGS.filterMode;
    const sortMode = ['priority','newest','expiring'].includes(parsed?.sortMode) ? parsed.sortMode : DEFAULT_ALERT_SETTINGS.sortMode;
    const warningDisplayBehavior = ['banner-and-sidebar','sidebar-only','banner-only'].includes(parsed?.warningDisplayBehavior) ? parsed.warningDisplayBehavior : DEFAULT_ALERT_SETTINGS.warningDisplayBehavior;
    return {
      ...DEFAULT_ALERT_SETTINGS,
      ...parsed,
      colors: { ...DEFAULT_ALERT_SETTINGS.colors, ...(parsed?.colors || {}) },
      speech: { ...DEFAULT_ALERT_SETTINGS.speech, ...(parsed?.speech || {}) },
      customSounds: { ...DEFAULT_ALERT_SETTINGS.customSounds, ...(parsed?.customSounds || {}) },
      soundProfile: parsed?.soundProfile || DEFAULT_ALERT_SETTINGS.soundProfile,
      sidebarPinned: typeof parsed?.sidebarPinned === 'boolean' ? parsed.sidebarPinned : DEFAULT_ALERT_SETTINGS.sidebarPinned,
      sidebarAutoHide: typeof parsed?.sidebarAutoHide === 'boolean' ? parsed.sidebarAutoHide : DEFAULT_ALERT_SETTINGS.sidebarAutoHide,
      outlineThickness: Number.isFinite(parsed?.outlineThickness) ? Math.max(1, Math.min(6, Number(parsed.outlineThickness))) : DEFAULT_ALERT_SETTINGS.outlineThickness,
      filterMode,
      sortMode,
      warningDisplayBehavior,
    } as AlertSettings;
  } catch {
    return DEFAULT_ALERT_SETTINGS;
  }
}

export function saveAlertSettings(settings: AlertSettings) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

export function eventColorOverride(event: string, category: string, settings: AlertSettings): string | null {
  const e = String(event || '').toLowerCase();
  const c = settings.colors;
  if (category === 'warning') {
    if (e.includes('tornado')) return c.tornadoWarning;
    if (e.includes('severe thunderstorm')) return c.severeThunderstormWarning;
    if (e.includes('flash flood')) return c.flashFloodWarning;
  }
  if (category === 'statement') {
    if (e.includes('severe weather statement')) return c.severeWeatherStatement;
    return c.statement;
  }
  if (category === 'watch') {
    if (e.includes('tornado')) return c.tornadoWatch;
    if (e.includes('severe thunderstorm')) return c.severeThunderstormWatch;
  }
  if (category === 'advisory') return c.advisory;
  return null;
}

export function applyAlertSettingsToAlert<T extends { event: string; category: string; color: string; lineColor: string }>(alert: T, settings: AlertSettings): T {
  const override = eventColorOverride(alert.event, alert.category, settings);
  if (!override) return alert;
  // lighten for lineColor
  const line = override;
  return { ...alert, color: override, lineColor: line };
}

export function shouldSpeakAlert(event: string, category: string, settings: AlertSettings): boolean {
  if (!settings.speech.enabled) return false;
  const e = String(event || '').toLowerCase();
  const isTornadoWarning = e.includes('tornado warning');
  const isSvrTstormWarning = e.includes('severe thunderstorm warning');
  const isFlashFloodWarning = e.includes('flash flood warning');
  const isSvs = e.includes('severe weather statement');
  const isTornadoWatch = e.includes('tornado watch');
  const isSvrWatch = e.includes('severe thunderstorm watch');

  const isWarning = category === 'warning' && (isTornadoWarning || isSvrTstormWarning || isFlashFloodWarning);
  const isStatement = isSvs;
  const isWatch = category === 'watch' && (isTornadoWatch || isSvrWatch);

  // Explicitly exclude fog/admin/routine non-convective per request
  if (e.includes('fog') || e.includes('administrative') || e.includes('routine')) return false;

  if (isWarning) return settings.speech.warnings;
  if (isStatement) return settings.speech.statements;
  if (isWatch) return settings.speech.watches;
  return false;
}

export function formatAlertSpeech(event: string, areaDesc?: string, senderName?: string): string {
  const office = (senderName || '').replace(/^NWS\s+/i, '').trim();
  const place = office || (areaDesc ? areaDesc.split(';')[0].trim() : '');
  if (place) return `The National Weather Service ${place} has issued a ${event}.`;
  return `The National Weather Service has issued a ${event}.`;
}

export function alertSoundForEvent(event: string, settings: AlertSettings): string | null {
  const e = String(event || '').toLowerCase();
  if (e.includes('tornado warning') && settings.customSounds.tornadoWarning) return settings.customSounds.tornadoWarning;
  if (e.includes('severe thunderstorm warning') && settings.customSounds.severeThunderstormWarning) return settings.customSounds.severeThunderstormWarning;
  if (e.includes('flash flood warning') && settings.customSounds.flashFloodWarning) return settings.customSounds.flashFloodWarning;
  if (settings.customSounds.global) return settings.customSounds.global;
  return null; // fall back to profile/tone
}

export function profileAllowsTone(profile: AlertSoundProfile): boolean {
  return profile !== 'silent';
}
