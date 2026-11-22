export type AlertCategory = 'warning' | 'watch' | 'advisory' | 'statement' | 'other';

export type AlertCategoryFilters = Record<AlertCategory, boolean>;

export type WeatherAlert = {
  id: string;
  event: string;
  category: AlertCategory;
  severity: string;
  urgency: string;
  certainty: string;
  headline: string;
  areaDesc: string;
  senderName: string;
  wfo: string;
  sent: string | null;
  effective: string | null;
  expires: string | null;
  eventCodes: string[];
  color: string;
  lineColor: string;
  geometry: any | null;
};

export const ALL_ALERT_CATEGORIES: AlertCategory[] = [
  'warning',
  'watch',
  'advisory',
  'statement',
  'other',
];

export const DEFAULT_ALERT_FILTERS: AlertCategoryFilters = {
  warning: true,
  watch: true,
  advisory: true,
  statement: true,
  other: true,
};

export const DEFAULT_AUDIO_CATEGORIES: AlertCategoryFilters = {
  warning: true,
  watch: false,
  advisory: false,
  statement: false,
  other: false,
};

export const ALERT_CATEGORY_META: Record<
  AlertCategory,
  { label: string; singular: string; accent: string; badge: string }
> = {
  warning: {
    label: 'Warnings',
    singular: 'Warning',
    accent: 'text-red-300',
    badge: 'bg-red-600 text-white',
  },
  watch: {
    label: 'Watches',
    singular: 'Watch',
    accent: 'text-amber-300',
    badge: 'bg-amber-500 text-slate-950',
  },
  advisory: {
    label: 'Advisories',
    singular: 'Advisory',
    accent: 'text-sky-300',
    badge: 'bg-sky-600 text-white',
  },
  statement: {
    label: 'Statements',
    singular: 'Statement',
    accent: 'text-violet-300',
    badge: 'bg-violet-600 text-white',
  },
  other: {
    label: 'Other',
    singular: 'Alert',
    accent: 'text-slate-300',
    badge: 'bg-slate-600 text-white',
  },
};

const CATEGORY_RANK: Record<AlertCategory, number> = {
  warning: 4,
  watch: 3,
  advisory: 2,
  statement: 1,
  other: 0,
};

const SEVERITY_RANK: Record<string, number> = {
  extreme: 4,
  severe: 3,
  moderate: 2,
  minor: 1,
  unknown: 0,
};

/**
 * NWS alerts are a single feed that mixes warnings, watches, advisories,
 * statements and miscellaneous products. The event name is the only reliable
 * cross-product field, so category is derived from it in this order.
 */
export function classifyAlertEvent(event: string): AlertCategory {
  const value = String(event || '').toLowerCase();
  if (value.includes('warning')) return 'warning';
  if (value.includes('watch')) return 'watch';
  if (value.includes('advisory')) return 'advisory';
  if (
    value.includes('statement') ||
    value.includes('outlook') ||
    value.includes('discussion') ||
    value.includes('short term forecast')
  ) {
    return 'statement';
  }
  return 'other';
}

const WARNING_COLORS: Array<[RegExp, string, string]> = [
  [/tornado/i, '#dc2626', '#f87171'],
  [/severe thunderstorm/i, '#f59e0b', '#fbbf24'],
  [/flash flood/i, '#10b981', '#34d399'],
  [/flood/i, '#22c55e', '#4ade80'],
  [/winter storm|blizzard|ice storm/i, '#38bdf8', '#7dd3fc'],
  [/extreme wind|high wind|wind/i, '#f97316', '#fdba74'],
];

export function alertColors(event: string, category: AlertCategory): { color: string; lineColor: string } {
  if (category === 'warning') {
    for (const [pattern, color, lineColor] of WARNING_COLORS) {
      if (pattern.test(event)) return { color, lineColor };
    }
    return { color: '#dc2626', lineColor: '#f87171' };
  }

  switch (category) {
    case 'watch':
      return /tornado/i.test(event)
        ? { color: '#eab308', lineColor: '#facc15' }
        : { color: '#f59e0b', lineColor: '#fbbf24' };
    case 'advisory':
      return { color: '#0ea5e9', lineColor: '#7dd3fc' };
    case 'statement':
      return { color: '#8b5cf6', lineColor: '#c4b5fd' };
    default:
      return { color: '#64748b', lineColor: '#cbd5e1' };
  }
}

function readEventCodes(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const codes: string[] = [];
  Object.values(value as Record<string, unknown>).forEach((entry) => {
    if (Array.isArray(entry)) {
      entry.forEach((code) => {
        if (typeof code === 'string' && code) codes.push(code);
      });
    } else if (typeof entry === 'string' && entry) {
      codes.push(entry);
    }
  });
  return codes.slice(0, 12);
}

function safeIso(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? value : null;
}

export function normalizeNwsAlert(feature: any): WeatherAlert | null {
  const properties = feature?.properties;
  if (!properties) return null;

  const event = String(properties.event || 'Weather Alert');
  const category = classifyAlertEvent(event);
  const colors = alertColors(event, category);
  const id = String(feature?.id || properties.id || `${event}-${properties.sent || ''}-${properties.areaDesc || ''}`);

  return {
    id,
    event,
    category,
    severity: String(properties.severity || 'Unknown'),
    urgency: String(properties.urgency || 'Unknown'),
    certainty: String(properties.certainty || 'Unknown'),
    headline: String(properties.headline || properties.description || event).slice(0, 600),
    areaDesc: String(properties.areaDesc || ''),
    senderName: String(properties.senderName || ''),
    wfo: String(properties.senderName || '').replace(/^NWS\s+/i, '').slice(0, 40),
    sent: safeIso(properties.sent),
    effective: safeIso(properties.effective) || safeIso(properties.onset),
    expires: safeIso(properties.expires) || safeIso(properties.ends),
    eventCodes: readEventCodes(properties.eventCode),
    color: colors.color,
    lineColor: colors.lineColor,
    geometry: feature?.geometry || null,
  };
}

export function normalizeNwsCollection(collection: any): WeatherAlert[] {
  const features = Array.isArray(collection?.features) ? collection.features : [];
  return sortAlerts(
    features
      .map(normalizeNwsAlert)
      .filter((alert: WeatherAlert | null): alert is WeatherAlert => Boolean(alert))
  );
}

export function alertPriority(alert: WeatherAlert): number {
  const category = CATEGORY_RANK[alert.category] ?? 0;
  const severity = SEVERITY_RANK[String(alert.severity).toLowerCase()] ?? 0;
  return category * 10 + severity;
}

export function sortAlerts(alerts: WeatherAlert[]): WeatherAlert[] {
  return [...alerts].sort((a, b) => {
    const priority = alertPriority(b) - alertPriority(a);
    if (priority !== 0) return priority;
    const aTime = a.sent ? Date.parse(a.sent) : 0;
    const bTime = b.sent ? Date.parse(b.sent) : 0;
    return bTime - aTime;
  });
}

export function alertsToFeatureCollection(alerts: WeatherAlert[]) {
  return {
    type: 'FeatureCollection' as const,
    features: alerts
      .filter((alert) => Boolean(alert.geometry))
      .map((alert) => ({
        type: 'Feature' as const,
        id: alert.id,
        geometry: alert.geometry,
        properties: {
          id: alert.id,
          event: alert.event,
          category: alert.category,
          severity: alert.severity,
          urgency: alert.urgency,
          certainty: alert.certainty,
          headline: alert.headline,
          areaDesc: alert.areaDesc,
          senderName: alert.senderName,
          wfo: alert.wfo,
          sent: alert.sent,
          effective: alert.effective,
          expires: alert.expires,
          color: alert.color,
          lineColor: alert.lineColor,
        },
      })),
  };
}

export function categoryCounts(alerts: WeatherAlert[]): Record<AlertCategory, number> {
  const counts: Record<AlertCategory, number> = {
    warning: 0,
    watch: 0,
    advisory: 0,
    statement: 0,
    other: 0,
  };
  alerts.forEach((alert) => {
    counts[alert.category] += 1;
  });
  return counts;
}

export function alertCountsByCategory(alerts: WeatherAlert[]): Record<AlertCategory, number> {
  return categoryCounts(alerts);
}

export function formatAlertTime(iso: string | null): string {
  if (!iso) return 'Unavailable';
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return 'Unavailable';
  return new Date(parsed).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return Math.round((parsed - Date.now()) / 60000);
}

export function alertExpiryLabel(alert: WeatherAlert): string {
  const minutes = minutesUntil(alert.expires);
  if (minutes === null) return 'Expiration unavailable';
  if (minutes <= 0) return 'Expired';
  if (minutes < 60) return `Expires in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `Expires in ${hours}h ${remainder}m` : `Expires in ${hours}h`;
}
