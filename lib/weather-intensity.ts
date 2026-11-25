/**
 * Deterministic Weather Intensity Score.
 *
 * This module never fetches data and never guesses missing values. Callers
 * supply structured observations from already-verified app sources. The score
 * is a compact summary, not an official rating, probability, or warning.
 */

export type IntensityBand = {
  min: number;
  max: number;
  label: string;
  color: string;
  text: string;
};

export const WEATHER_INTENSITY_BANDS: readonly IntensityBand[] = [
  { min: 0, max: 20, label: 'Minimal impact', color: '#22c55e', text: 'text-emerald-300' },
  { min: 21, max: 40, label: 'General precipitation', color: '#38bdf8', text: 'text-sky-300' },
  { min: 41, max: 60, label: 'Strong thunderstorms', color: '#eab308', text: 'text-yellow-300' },
  { min: 61, max: 80, label: 'Severe concerns', color: '#f97316', text: 'text-orange-300' },
  { min: 81, max: 100, label: 'High-impact weather', color: '#ef4444', text: 'text-red-300' },
] as const;

export type IntensityAlert = {
  event: string;
  category: string;
  severity?: string;
  areaDesc?: string;
  wfo?: string;
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

export type WeatherIntensityInput = {
  radar?: RadarIntensityInput | null;
  alerts?: IntensityAlert[];
  lightning?: LightningIntensityInput | null;
  outlook?: OutlookIntensityInput | null;
};

export type IntensityContributor = {
  id: string;
  label: string;
  detail: string;
  source: string;
  points: number;
};

export type WeatherIntensityResult = {
  score: number | null;
  band: IntensityBand | null;
  contributors: IntensityContributor[];
  unavailable: string[];
  summary: string;
  sourceCount: number;
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

export function bandForScore(score: number | null): IntensityBand | null {
  if (score === null || !Number.isFinite(score)) return null;
  return WEATHER_INTENSITY_BANDS.find((band) => score >= band.min && score <= band.max) ?? null;
}

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

export function calculateWeatherIntensity(input: WeatherIntensityInput): WeatherIntensityResult {
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

  if (sourceCount === 0) {
    return {
      score: null,
      band: null,
      contributors: [],
      unavailable: ['No verified intensity inputs available'],
      summary: 'Waiting for verified radar, alert, lightning, or outlook input.',
      sourceCount: 0,
    };
  }

  const score = Math.min(100, contributors.reduce((sum, item) => sum + item.points, 0));
  const band = bandForScore(score);
  const top = contributors.filter((item) => item.points > 0).slice(0, 3);
  const summary = top.length
    ? `${band?.label ?? 'Unclassified'}: ${top.map((item) => item.label.toLowerCase()).join(', ')}.`
    : `${band?.label ?? 'Unclassified'}: observed inputs are below intensity thresholds.`;

  return {
    score,
    band,
    contributors,
    unavailable: groups
      .map((group, index) => ({ group, label: ['Radar', 'Alerts', 'Lightning', 'Outlook'][index] || 'Input' }))
      .filter(({ group }) => !group.available)
      .map(({ label }) => label),
    summary,
    sourceCount,
  };
}

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
