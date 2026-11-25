/**
 * MesoAI Weather Data Engine.
 *
 * Normalizes already-verified app payloads into WeatherObservation records.
 * This module performs no network requests and never invents a missing value.
 */

import { getCatalogProduct } from '../radar/product-catalog';
import { SATELLITE_CAPABILITY_MATRIX } from '../satellite/capability-matrix';
import {
  alertsNearSite,
  lightningToInput,
  spcCategoryAtPoint,
  stormAnalysisToRadarInput,
  type IntensityAlert,
} from '../weather-intensity';
import type { AnalysisSite, ProductContext, WeatherObservation } from './types';
import { isoOrNull, unique } from './util';

export type RawWeatherInputs = {
  site: AnalysisSite;
  stormAnalysis?: unknown;
  lightning?: unknown;
  outlook?: unknown;
  alerts?: IntensityAlert[] | null;
  productKey?: string | null;
  mrms?: unknown;
  metar?: unknown;
  lsr?: unknown;
  mcd?: unknown;
  includeSatelliteContext?: boolean;
};

export function productContext(key: string | null | undefined): ProductContext | null {
  if (!key) return null;
  const found = getCatalogProduct(key);
  if (!found) {
    return {
      key,
      label: key,
      domain: 'UNVERIFIED',
      available: false,
      reason: 'DATA UNAVAILABLE — product is not in the verified catalog.',
    };
  }
  return {
    key: found.key,
    label: found.label,
    domain: found.domain,
    available: found.available,
    reason: found.reason,
    warning: found.warning,
  };
}

function radarObservation(payload: unknown): WeatherObservation | null {
  const radar = stormAnalysisToRadarInput((payload as object | null) ?? {});
  if (!radar.available) return null;
  return {
    id: 'obs-radar-level2',
    domain: 'RADAR',
    source: 'NEXRAD Level II',
    productCode: 'storm-analysis',
    verification: 'VERIFIED',
    observedAt: isoOrNull(radar.scanTime),
    values: {
      maxDbz: radar.maxReflectivityDbz ?? null,
      gates50: radar.gatesAtLeast50Dbz ?? null,
      coupletDeltaKt: radar.maxCoupletDeltaKt ?? null,
      shearS1: radar.maxShearS1 ?? null,
      nrot: radar.maxNrot ?? null,
      minRhohv: radar.minRhohv ?? null,
    },
    caveats: [
      'Single-radar sample; Doppler velocity and shear values are screening proxies.',
      'No tornado, debris, mesocyclone-object, or projected-path claim is made.',
    ],
  };
}

function lightningObservation(payload: unknown): WeatherObservation | null {
  const lightning = lightningToInput((payload as object | null) ?? {});
  if (!lightning.available) return null;
  return {
    id: 'obs-lightning-glm',
    domain: 'OBSERVATION',
    source: 'GOES-R GLM',
    productCode: 'flash-density',
    verification: 'VERIFIED',
    observedAt: null,
    values: {
      flashCount: lightning.flashCount ?? null,
      minutes: lightning.minutes ?? null,
    },
    caveats: ['Flash counts are a short-window density proxy, not a severe-weather confirmation.'],
  };
}

function outlookObservation(payload: unknown, site: AnalysisSite): WeatherObservation | null {
  const category = spcCategoryAtPoint((payload as object | null) ?? {}, site.lat, site.lon);
  if (!category) return null;
  return {
    id: 'obs-spc-outlook',
    domain: 'MODEL',
    source: 'SPC categorical outlook',
    productCode: 'day-1',
    verification: 'PARTIAL',
    observedAt: null,
    values: { category, day: '1' },
    caveats: ['Outlook category is guidance, not an observation or a warning.'],
  };
}

function alertObservation(alerts: IntensityAlert[] | null | undefined, site: AnalysisSite): WeatherObservation | null {
  const near = alertsNearSite(alerts ?? [], site.name).filter((alert) => {
    const category = String(alert.category || '').toLowerCase();
    return category === 'warning' || category === 'watch';
  });
  if (near.length === 0) return null;
  const events = unique(near.map((alert) => String(alert.event || '')));
  return {
    id: 'obs-nws-alerts',
    domain: 'ALERT',
    source: 'NWS alerts',
    productCode: 'active',
    verification: 'VERIFIED',
    observedAt: isoOrNull((near[0] as { sent?: unknown })?.sent),
    values: {
      count: near.length,
      events: events.join(' | '),
      hasWarning: near.some((alert) => String(alert.category).toLowerCase() === 'warning'),
      hasFlashFlood: events.some((event) => /flash flood/i.test(event)),
    },
    caveats: ['Official NWS product. MesoAI restates it and does not issue or upgrade warnings.'],
  };
}

function productObservation(key: string | null | undefined): WeatherObservation | null {
  const context = productContext(key);
  if (!context) return null;
  return {
    id: 'obs-product-catalog',
    domain: context.domain === 'COMPOSITE' ? 'COMPOSITE' : 'RADAR',
    source: 'Verified product catalog',
    productCode: context.key,
    verification: context.available ? 'VERIFIED' : 'UNAVAILABLE',
    observedAt: null,
    values: {
      available: context.available,
      reason: context.reason ?? null,
      warning: context.warning ?? null,
    },
    caveats: [context.reason || context.warning || 'Source domain comes from the shared product catalog.'],
  };
}

/**
 * Satellites contribute verified source context, not numeric fields. The
 * capability matrix is the single source of truth, so no imagery values are
 * invented here.
 */
function satelliteObservation(enabled: boolean): WeatherObservation | null {
  if (!enabled) return null;
  const usable = SATELLITE_CAPABILITY_MATRIX.filter(
    (entry) => entry.availability === 'WORKING' || entry.availability === 'PARTIAL'
  );
  if (usable.length === 0) return null;
  const names = unique(usable.map((entry) => entry.name));
  return {
    id: 'obs-satellite-capability',
    domain: 'SATELLITE',
    source: 'GOES/ABI verified capability matrix',
    productCode: 'abi-context',
    verification: 'PARTIAL',
    observedAt: null,
    values: {
      verifiedEntryCount: usable.length,
      channels: names.join(' | '),
    },
    caveats: [
      'Satellite context is source availability only; no pixel value, cloud-top temperature, or imagery-derived feature is claimed.',
      'Mesoscale sector footprints move, so no fixed bounds or object track is asserted.',
    ],
  };
}

/** MRMS AWS is a real bucket listing; decoded GRIB2 fields are not available. */
function mrmsObservation(payload: unknown): WeatherObservation | null {
  const data = (payload as Record<string, unknown> | null) ?? {};
  if (data.available !== true) return null;
  const objects = Array.isArray(data.objects) ? data.objects : [];
  if (objects.length === 0) return null;
  const first = objects[0] as { key?: unknown; lastModified?: unknown };
  return {
    id: 'obs-mrms-aws-listing',
    domain: 'MRMS',
    source: String(data.source || 'NOAA MRMS AWS Open Data'),
    productCode: String(data.prefix || 'unknown-prefix'),
    verification: 'PARTIAL',
    observedAt: isoOrNull(first?.lastModified),
    values: {
      objectCount: objects.length,
      sampleKey: isoOrNull(first?.key),
      pipelineStatus: String(data.pipelineStatus || 'SCAFFOLD'),
    },
    caveats: [
      'Real S3 object listing only; the GRIB2 decode, hail, rotation-track, and QPE tile pipeline is not implemented.',
      'No MRMS numeric field or national object track is claimed from this listing.',
    ],
  };
}

function metarObservation(payload: unknown): WeatherObservation | null {
  const data = (payload as Record<string, unknown> | null) ?? {};
  const observations = Array.isArray(data.observations) ? data.observations : [];
  if (data._meta && typeof data._meta === 'object' && (data._meta as { ok?: unknown }).ok === false) return null;
  if (observations.length === 0) return null;
  const stations = observations
    .map((item) => String((item as { station?: unknown })?.station || ''))
    .filter(Boolean);
  const sample = observations[0] as { text?: unknown; temp?: unknown; dewpoint?: unknown; wind?: unknown };
  return {
    id: 'obs-surface-metar',
    domain: 'OBSERVATION',
    source: 'NWS surface observations (METAR)',
    productCode: 'latest',
    verification: 'PARTIAL',
    observedAt: isoOrNull((data._meta as { fetchedAt?: unknown } | undefined)?.fetchedAt),
    values: {
      stationCount: stations.length,
      stations: stations.join(' | '),
      sampleConditions: [sample?.text, sample?.temp, sample?.dewpoint, sample?.wind].filter(Boolean).join(', '),
    },
    caveats: [
      'The shared METAR route samples fixed regional stations; these are not site-specific observations.',
      'Surface conditions are context and do not confirm or refute a severe feature aloft.',
    ],
  };
}

function lsrObservation(payload: unknown): WeatherObservation | null {
  const features = Array.isArray((payload as { features?: unknown })?.features)
    ? (payload as { features: unknown[] }).features
    : [];
  if (features.length === 0) return null;
  return {
    id: 'obs-storm-reports',
    domain: 'OBSERVATION',
    source: 'IEM local storm reports',
    productCode: 'lsr-geojson',
    verification: 'PARTIAL',
    observedAt: isoOrNull((payload as { _meta?: { fetchedAt?: unknown } })?._meta?.fetchedAt),
    values: { reportCount: features.length },
    caveats: [
      'National report feed; no report is associated with the selected site without geometry verification.',
      'Storm reports are sparse and are not a substitute for radar or official warnings.',
    ],
  };
}

function mcdObservation(payload: unknown): WeatherObservation | null {
  const features = Array.isArray((payload as { features?: unknown })?.features)
    ? (payload as { features: unknown[] }).features
    : [];
  if (features.length === 0) return null;
  const names = unique(features.map((feature) =>
    String((feature as { properties?: { name?: unknown } })?.properties?.name || '')
  ));
  const issueTimes = unique(features.map((feature) =>
    isoOrNull((feature as { properties?: { issueTime?: unknown } })?.properties?.issueTime)
  ));
  return {
    id: 'obs-spc-mcd',
    domain: 'MODEL',
    source: 'SPC mesoscale discussions',
    productCode: 'mcd',
    verification: 'PARTIAL',
    observedAt: issueTimes[issueTimes.length - 1] ?? null,
    values: {
      discussionCount: features.length,
      discussions: names.join(' | '),
    },
    caveats: [
      'Mesoscale discussions are expert guidance on a mesoscale area, not a point observation or a warning.',
      'No discussion is associated with the selected site without geometry verification.',
    ],
  };
}

/** Returns only observations with real, verified source data. */
export function buildObservations(input: RawWeatherInputs): WeatherObservation[] {
  return [
    radarObservation(input.stormAnalysis),
    lightningObservation(input.lightning),
    outlookObservation(input.outlook, input.site),
    alertObservation(input.alerts, input.site),
    productObservation(input.productKey),
    mrmsObservation(input.mrms),
    satelliteObservation(input.includeSatelliteContext === true),
    metarObservation(input.metar),
    lsrObservation(input.lsr),
    mcdObservation(input.mcd),
  ].filter((observation): observation is WeatherObservation => observation !== null);
}
