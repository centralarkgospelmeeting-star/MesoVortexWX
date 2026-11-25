/**
 * Hazard Severity Index (HSI).
 *
 * Deterministic, source-scoped composite hazard ranking. This module never
 * fetches data and never guesses missing values: callers supply structured
 * inputs from already-verified app sources. HSI is a compact operational
 * summary — not an official rating, probability, forecast, or warning.
 * Unavailable inputs reduce confidence and are reported, never fabricated.
 */

export type HsiScaleId = 'national' | 'regional' | 'state' | 'local' | 'custom';

export const HSI_SCALES: readonly { id: HsiScaleId; label: string; example: string }[] = [
  { id: 'national', label: 'National', example: 'United States HSI' },
  { id: 'regional', label: 'Regional', example: 'Central Plains HSI' },
  { id: 'state', label: 'State', example: 'Arkansas HSI' },
  { id: 'local', label: 'Local', example: 'Pulaski County HSI' },
  { id: 'custom', label: 'Custom', example: 'Custom operational area HSI' },
];

export type IntensityBand = {
  min: number;
  max: number;
  label: string;
  color: string;
  text: string;
};

export const HSI_BANDS: readonly IntensityBand[] = [
  { min: 0, max: 19, label: 'Low', color: '#22c55e', text: 'text-emerald-300' },
  { min: 20, max: 39, label: 'Elevated', color: '#38bdf8', text: 'text-sky-300' },
  { min: 40, max: 59, label: 'Significant', color: '#eab308', text: 'text-yellow-300' },
  { min: 60, max: 79, label: 'Major', color: '#f97316', text: 'text-orange-300' },
  { min: 80, max: 100, label: 'Extreme', color: '#ef4444', text: 'text-red-300' },
] as const;

/** Backwards-compatible band export; HSI_BANDS is canonical. */
export const WEATHER_INTENSITY_BANDS = HSI_BANDS;

export type IntensityAlert = {
  event: string;
  category: string;
  severity?: string;
  areaDesc?: string;
  wfo?: string;
  geometry?: any;
};

export type RadarIntensityInput = {
  available: boolean;
  scanTime?: string | null;
  maxReflectivityDbz?: number | null;
  gatesAtLeast50Dbz?: number | null;
  maxCoupletDeltaKt?: number | null;
  maxShearS1?: number | null;
  maxNrot?: number | null;
  minRhohv?: number | null;
};

export type LightningIntensityInput = {
  available: boolean;
  flashCount?: number | null;
  minutes?: number | null;
};

export type OutlookIntensityInput = {
  available: boolean;
  category?: string | null;
  day?: string | null;
};

export type HsiInput = {
  scale?: HsiScaleId;
  areaLabel?: string | null;
  radar?: RadarIntensityInput | null;
  alerts?: IntensityAlert[];
  mcds?: unknown[] | null;
  lightning?: LightningIntensityInput | null;
  outlook?: OutlookIntensityInput | null;
  /** Future inputs. Null/undefined means unavailable, never zero. */
  cape?: number | null;
  shear?: number | null;
  srh?: number | null;
  tornadoProbability?: number | null;
  hailProbability?: number | null;
  windProbability?: number | null;
  flashFloodRisk?: string | null;
  winterImpact?: string | null;
  tropicalImpact?: string | null;
  populationExposure?: number | null;
};

export type IntensityContributor = {
  id: string;
  label: string;
  detail: string;
  source: string;
  points: number;
};

export type HsiResult = {
  score: number | null;
  band: IntensityBand | null;
  bandLabel: string;
  confidence: number;
  dataIncomplete: boolean;
  contributors: IntensityContributor[];
  unavailable: string[];
  summary: string;
  sourceCount: number;
  areaCount: number;
};

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const maxValues = (values: Array<number | null>): number | null => {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length ? Math.max(...valid) : null;
};

const minValues = (values: Array<number | null>): number | null => {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length ? Math.min(...valid) : null;
};

export function hsiBandForScore(score: number | null): IntensityBand | null {
  if (score === null || !Number.isFinite(score)) return null;
  return HSI_BANDS.find((band) => score >= band.min && score <= band.max) ?? null;
}

/** Backwards-compatible band lookup. */
export const bandForScore = hsiBandForScore;

const DATA_INCOMPLETE = 'DATA INCOMPLETE';
const CONFIDENCE_THRESHOLD = 0.6;

const FUTURE_INPUT_LABELS: Array<{ key: keyof HsiInput; label: string }> = [
  { key: 'mcds', label: 'MCDs' },
  { key: 'cape', label: 'CAPE' },
  { key: 'shear', label: 'Shear' },
  { key: 'srh', label: 'SRH' },
  { key: 'tornadoProbability', label: 'Tornado probability' },
  { key: 'hailProbability', label: 'Hail probability' },
  { key: 'windProbability', label: 'Wind probability' },
  { key: 'flashFloodRisk', label: 'Flash flood risk' },
  { key: 'winterImpact', label: 'Winter storm impacts' },
  { key: 'tropicalImpact', label: 'Tropical impacts' },
  { key: 'populationExposure', label: 'Population exposure' },
];

function radarContributors(radar: RadarIntensityInput | null | undefined): {
  contributors: IntensityContributor[];
  available: boolean;
} {
  if (!radar?.available) return { contributors: [], available: false };

  const contributors: IntensityContributor[] = [];
  const dbz = finite(radar.maxReflectivityDbz);
  if (dbz !== null) {
    const points = dbz >= 65 ? 18 : dbz >= 60 ? 15 : dbz >= 55 ? 11 : dbz >= 50 ? 8 : dbz >= 40 ? 4 : 0;
    contributors.push({
      id: 'reflectivity',
      label: 'Reflectivity',
      detail: `Max ${dbz.toFixed(0)} dBZ${points === 0 ? '; below severe threshold' : ''}`,
      source: 'NEXRAD Level II',
      points,
    });
  }

  const gates50 = finite(radar.gatesAtLeast50Dbz);
  if (gates50 !== null && gates50 > 0) {
    contributors.push({
      id: 'reflectivity-depth',
      label: 'Strong echo coverage',
      detail: `${gates50.toLocaleString()} gates ≥ 50 dBZ`,
      source: 'NEXRAD Level II',
      points: gates50 >= 500 ? 6 : gates50 >= 100 ? 4 : 2,
    });
  }

  const deltaV = finite(radar.maxCoupletDeltaKt);
  if (deltaV !== null) {
    const points = deltaV >= 70 ? 20 : deltaV >= 50 ? 15 : deltaV >= 35 ? 10 : deltaV >= 20 ? 5 : 0;
    contributors.push({
      id: 'couplet',
      label: 'Velocity couplet',
      detail: `Peak ΔV ${deltaV.toFixed(0)} kt; screening only`,
      source: 'NEXRAD Level II',
      points,
    });
  }

  const shear = finite(radar.maxShearS1);
  if (shear !== null) {
    contributors.push({
      id: 'shear',
      label: 'Gate-to-gate shear',
      detail: `${shear.toFixed(4)} s⁻¹; adjacent-radial estimate`,
      source: 'NEXRAD Level II',
      points: shear >= 0.01 ? 8 : shear >= 0.005 ? 5 : shear >= 0.002 ? 2 : 0,
    });
  }

  const nrot = finite(radar.maxNrot);
  if (nrot !== null) {
    const magnitude = Math.abs(nrot);
    contributors.push({
      id: 'nrot',
      label: 'Normalized rotation',
      detail: `NROT-style ${nrot >= 0 ? '+' : ''}${nrot.toFixed(2)}; research aid`,
      source: 'NEXRAD Level II',
      points: magnitude >= 2.5 ? 12 : magnitude >= 1 ? 8 : magnitude >= 0.5 ? 4 : 0,
    });
  }

  const rhohv = finite(radar.minRhohv);
  if (rhohv !== null && rhohv < 0.9) {
    contributors.push({
      id: 'rhohv',
      label: 'Lower correlation coefficient',
      detail: `Min CC ${rhohv.toFixed(2)}; mixed or non-meteorological targets possible`,
      source: 'NEXRAD Level II',
      points: rhohv < 0.8 ? 4 : 2,
    });
  }

  return { contributors, available: contributors.length > 0 };
}

const EVENT_SCORES: Array<{ match: RegExp; warning: number; watch: number; label: string }> = [
  { match: /tornado/i, warning: 38, watch: 12, label: 'Tornado' },
  { match: /hurricane|typhoon/i, warning: 32, watch: 12, label: 'Tropical cyclone' },
  { match: /tropical storm/i, warning: 20, watch: 8, label: 'Tropical storm' },
  { match: /severe thunderstorm/i, warning: 24, watch: 8, label: 'Severe thunderstorm' },
  { match: /flash flood/i, warning: 22, watch: 7, label: 'Flash flood' },
  { match: /flood/i, warning: 12, watch: 4, label: 'Flood' },
  { match: /ice storm|freezing rain/i, warning: 16, watch: 6, label: 'Ice accretion' },
  { match: /high wind|wind advisory/i, warning: 12, watch: 4, label: 'Wind' },
  { match: /winter storm|blizzard/i, warning: 12, watch: 4, label: 'Winter storm' },
  { match: /extreme heat|excessive heat/i, warning: 12, watch: 4, label: 'Heat' },
];

function alertContributors(alerts: IntensityAlert[] | undefined): {
  contributors: IntensityContributor[];
  available: boolean;
} {
  if (!Array.isArray(alerts)) return { contributors: [], available: false };
  const warnings = alerts.filter((a) => String(a.category).toLowerCase() === 'warning');
  const watches = alerts.filter((a) => String(a.category).toLowerCase() === 'watch');
  if (warnings.length === 0 && watches.length === 0) return { contributors: [], available: false };

  const contributors: IntensityContributor[] = [];
  for (const rule of EVENT_SCORES) {
    const warning = warnings.find((a) => rule.match.test(a.event));
    const watch = !warning ? watches.find((a) => rule.match.test(a.event)) : undefined;
    const alert = warning || watch;
    if (!alert) continue;
    const points = warning ? rule.warning : rule.watch;
    contributors.push({
      id: `alert-${rule.label.toLowerCase().replace(/\s+/g, '-')}`,
      label: `${rule.label} ${warning ? 'warning' : 'watch'}`,
      detail: alert.event,
      source: 'NWS alerts',
      points,
    });
  }
  return { contributors, available: contributors.length > 0 };
}

function lightningContributors(lightning: LightningIntensityInput | null | undefined): {
  contributors: IntensityContributor[];
  available: boolean;
} {
  if (!lightning?.available) return { contributors: [], available: false };
  const count = finite(lightning.flashCount);
  if (count === null) return { contributors: [], available: false };
  const minutes = finite(lightning.minutes) ?? 5;
  const points = count >= 50 ? 10 : count >= 20 ? 7 : count >= 5 ? 4 : count >= 1 ? 2 : 0;
  return {
    contributors: [{
      id: 'lightning',
      label: 'Lightning density',
      detail: `${count.toLocaleString()} flashes / ${minutes.toFixed(0)} min`,
      source: 'GOES-R GLM',
      points,
    }],
    available: true,
  };
}

function outlookContributors(outlook: OutlookIntensityInput | null | undefined): {
  contributors: IntensityContributor[];
  available: boolean;
} {
  if (!outlook?.available || !outlook.category) return { contributors: [], available: false };
  const category = outlook.category.trim().toUpperCase();
  const points = category === 'HIGH' ? 18 : category === 'MDT' ? 14 : category === 'ENH' ? 10 : category === 'SLGT' ? 6 : category === 'MRGL' ? 3 : category === 'TSTM' ? 1 : 0;
  return {
    contributors: [{
      id: 'outlook',
      label: 'SPC categorical outlook',
      detail: `Day ${outlook.day || '1'} ${category}; guidance, not observation`,
      source: 'SPC outlook',
      points,
    }],
    available: true,
  };
}

export function calculateHsi(input: HsiInput): HsiResult {
  const groups = [
    radarContributors(input.radar),
    alertContributors(input.alerts),
    lightningContributors(input.lightning),
    outlookContributors(input.outlook),
  ];

  const contributors = groups
    .flatMap((group) => group.contributors)
    .sort((a, b) => b.points - a.points);
  const sourceCount = groups.filter((group) => group.available).length;

  const availableFuture = FUTURE_INPUT_LABELS.filter(({ key }) => {
    const value = input[key];
    return value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0);
  });
  const totalInputs = groups.length + FUTURE_INPUT_LABELS.length;
  const confidence = totalInputs === 0 ? 0 : Math.round((sourceCount + availableFuture.length) / totalInputs * 100) / 100;
  const unavailable = [
    ...groups.map((group, index) => ({ available: group.available, label: ['Radar', 'Alerts', 'Lightning', 'SPC outlooks'][index] || 'Input' }))
      .filter((group) => !group.available).map((group) => group.label),
    ...FUTURE_INPUT_LABELS.filter(({ key }) => {
      const value = input[key];
      return value === null || value === undefined || (Array.isArray(value) && value.length === 0);
    }).map(({ label }) => label),
  ];
  const areaCount = new Set(
    (Array.isArray(input.alerts) ? input.alerts : [])
      .map((alert) => alert.areaDesc || alert.wfo)
      .filter((value): value is string => Boolean(value))
  ).size;
  if (areaCount > 1) {
    contributors.push({
      id: 'spatial-extent',
      label: 'Spatial extent',
      detail: `${areaCount} reported areas in scope`,
      source: 'NWS alerts',
      points: areaCount >= 10 ? 6 : areaCount >= 4 ? 4 : 2,
    });
    contributors.sort((a, b) => b.points - a.points);
  }

  const dataIncomplete = unavailable.length > 0 || confidence < CONFIDENCE_THRESHOLD;
  const areaLabel = input.areaLabel?.trim() || 'selected area';

  if (sourceCount === 0) {
    return {
      score: null,
      band: null,
      bandLabel: DATA_INCOMPLETE,
      confidence,
      dataIncomplete: true,
      contributors: [],
      unavailable,
      summary: `${DATA_INCOMPLETE} — no verified hazard inputs available for ${areaLabel}.`,
      sourceCount: 0,
      areaCount,
    };
  }

  const score = Math.min(100, contributors.reduce((sum, item) => sum + item.points, 0));
  const band = hsiBandForScore(score);
  const bandLabel = dataIncomplete ? DATA_INCOMPLETE : band?.label ?? DATA_INCOMPLETE;
  const top = contributors.filter((item) => item.points > 0).slice(0, 3);
  const cause = top.length
    ? top.map((item) => item.label.toLowerCase()).join(', ')
    : 'reported inputs below hazard thresholds';
  const summary = `${bandLabel} for ${areaLabel}: ${cause}.${dataIncomplete ? ` ${unavailable.length} input(s) unavailable; confidence ${Math.round(confidence * 100)}%.` : ''}`;

  return {
    score,
    band,
    bandLabel,
    confidence,
    dataIncomplete,
    contributors,
    unavailable,
    summary,
    sourceCount,
    areaCount,
  };
}

/** Backwards-compatible alias retained for historical callers only. */
export const calculateWeatherIntensity = calculateHsi;

export function stormAnalysisToRadarInput(payload: any): RadarIntensityInput {
  const sweeps = Array.isArray(payload?.sweeps) ? payload.sweeps : [];
  const reflectivity = sweeps.map((sweep: any) => sweep?.reflectivity).filter(Boolean);
  const couplets = Array.isArray(payload?.rotationCouplets) ? payload.rotationCouplets : [];
  const nrotPeaks = Array.isArray(payload?.nrotPeaks) ? payload.nrotPeaks : [];
  return {
    available: sweeps.length > 0,
    scanTime: typeof payload?.scanTime === 'string' ? payload.scanTime : null,
    maxReflectivityDbz: maxValues(reflectivity.map((item: any) => finite(item.max))),
    gatesAtLeast50Dbz: maxValues(reflectivity.map((item: any) => finite(item.gatesAtLeast50DbZ))),
    maxCoupletDeltaKt: maxValues(couplets.map((item: any) => finite(item?.deltaVelocityKt))),
    maxShearS1: maxValues(couplets.map((item: any) => finite(item?.azimuthalShearS1))),
    maxNrot: maxValues(nrotPeaks.map((item: any) => {
      const value = finite(item?.nrot);
      return value === null ? null : Math.abs(value);
    })),
    minRhohv: minValues(sweeps.map((sweep: any) => finite(sweep?.dualPol?.rhohv?.min))),
  };
}

export function lightningToInput(payload: any): LightningIntensityInput {
  const available = payload?.available !== false && !String(payload?.reason || '').startsWith('DATA UNAVAILABLE');
  const features = Array.isArray(payload?.features?.features) ? payload.features.features : [];
  const count = finite(payload?.flashCount) ?? features.length;
  return {
    available: available && count > 0,
    flashCount: available ? count : null,
    minutes: finite(payload?.minutes) ?? finite(payload?.windowMinutes),
  };
}

function stateFromSiteName(siteName: string): string {
  const parts = siteName.split(',').map((part) => part.trim());
  const last = parts[parts.length - 1] || '';
  return /^[A-Z]{2}$/.test(last) ? last : '';
}

export function alertsNearSite(alerts: IntensityAlert[] | undefined, siteName: string): IntensityAlert[] {
  if (!Array.isArray(alerts)) return [];
  const state = stateFromSiteName(siteName);
  if (!state) return alerts;
  return alerts.filter((alert) => {
    const haystack = `${alert.areaDesc || ''} ${alert.wfo || ''}`.toUpperCase();
    return haystack.includes(state);
  });
}

/** GeoJSON point-in-polygon for SPC categorical outlook features. */
export function spcCategoryAtPoint(payload: any, lat: number, lon: number): string | null {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const point: [number, number] = [lon, lat];
  for (const feature of features) {
    const geometry = feature?.geometry;
    if (!geometry) continue;
    const polygons = geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];
    const inside = polygons.some((polygon: any) => {
      const ring = Array.isArray(polygon?.[0]) ? polygon[0] : [];
      let hit = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = Number(ring[i]?.[0]);
        const yi = Number(ring[i]?.[1]);
        const xj = Number(ring[j]?.[0]);
        const yj = Number(ring[j]?.[1]);
        if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
        const intersects = yi > point[1] !== yj > point[1]
          && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
        if (intersects) hit = !hit;
      }
      return hit;
    });
    if (!inside) continue;

    const props = feature?.properties || {};
    const raw = [props.DAY1, props.DAY, props.CATEGORY, props.LABEL, props.category, props.label]
      .map((value) => String(value ?? ''))
      .join(' ');
    const match = raw.match(/\b(HIGH|MDT|ENH|SLGT|MRGL|TSTM)\b/i);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

/** Scale-aware area label used by the HSI panel and copied summaries. */
export function hsiAreaLabel(scope: { scale: HsiScaleId; text?: string | null }): string {
  const def = HSI_SCALES.find((item) => item.id === scope.scale) || HSI_SCALES[0];
  const text = scope.text?.trim();
  if (text) return `${text} ${def.label.toLowerCase()} HSI`;
  return def.example;
}

function alertCoordinate(alert: IntensityAlert): [number, number] | null {
  const geometry = alert.geometry;
  const coordinates = geometry?.type === 'Polygon'
    ? geometry.coordinates?.[0]?.[0]
    : geometry?.type === 'MultiPolygon'
      ? geometry.coordinates?.[0]?.[0]?.[0]
      : null;
  const lon = Number(coordinates?.[0]);
  const lat = Number(coordinates?.[1]);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

function pointInRing(point: [number, number], ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.[0]);
    const yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]);
    const yj = Number(ring[j]?.[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = yi > point[1] !== yj > point[1]
      && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Scope alerts to a national/regional/state/local/custom area. Custom areas
 * use an emergency manager's drawn polygon; area matching is approximate and
 * is never represented as a legal boundary or official jurisdiction.
 */
export function alertsForHsiScope(
  alerts: IntensityAlert[] | undefined,
  scope: { scale: HsiScaleId; text?: string | null; polygon?: Array<[number, number]> | null }
): IntensityAlert[] {
  if (!Array.isArray(alerts)) return [];
  if (scope.scale === 'national') return alerts;
  if (scope.scale === 'custom' && Array.isArray(scope.polygon) && scope.polygon.length >= 3) {
    return alerts.filter((alert) => {
      const point = alertCoordinate(alert);
      return point !== null && pointInRing(point, scope.polygon as Array<[number, number]>);
    });
  }
  const text = (scope.text || '').trim().toUpperCase();
  if (!text) return alerts;
  return alerts.filter((alert) => `${alert.areaDesc || ''} ${alert.wfo || ''}`.toUpperCase().includes(text));
}
