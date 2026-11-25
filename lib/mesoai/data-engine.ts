/**
 * MesoAI Weather Data Engine.
 *
 * Normalizes already-verified app payloads into WeatherObservation records.
 * This module performs no network requests and never invents a missing value.
 */

import { getCatalogProduct } from '../radar/product-catalog';
import { SATELLITE_CAPABILITY_MATRIX, getSatelliteCapability } from '../satellite/capability-matrix';
import { getSatelliteProductDef, getSatelliteTileUrl, normalizeSatelliteSelection, type SatelliteSelection } from '../satellite';
import { deriveGlmMetrics } from '../lightning/glm-metrics';
import {
  alertsNearSite,
  lightningToInput,
  spcCategoryAtPoint,
  stormAnalysisToRadarInput,
  type IntensityAlert,
} from '../hazard-severity';
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
  /** Real station features from /api/metar/geojson (includes ASOS subset). */
  surfaceStations?: unknown;
  lsr?: unknown;
  mcd?: unknown;
  includeSatelliteContext?: boolean;
  satelliteSelection?: Partial<SatelliteSelection> | null;
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
  const metrics = deriveGlmMetrics(payload);
  return {
    id: 'obs-lightning-glm',
    domain: 'OBSERVATION',
    source: 'GOES-R GLM',
    productCode: 'flash-density',
    verification: 'VERIFIED',
    observedAt: isoOrNull((payload as { generatedAt?: unknown } | null)?.generatedAt),
    values: {
      flashCount: lightning.flashCount ?? null,
      minutes: lightning.minutes ?? null,
      flashesPerMinute: metrics?.flashesPerMinute ?? null,
      occupiedCells01Deg: metrics?.occupiedCells01Deg ?? null,
      extentLatKm: metrics?.extentLatKm ?? null,
      extentLonKm: metrics?.extentLonKm ?? null,
      meanEnergyJ: metrics?.meanEnergyJ ?? null,
      maxEnergyJ: metrics?.maxEnergyJ ?? null,
    },
    caveats: [
      'Flash counts are a short-window density proxy, not a severe-weather confirmation.',
      'Density, 0.1-degree cell occupancy, extent, and energy values are derived from real GLM flash points; this is not the official GOES Flash Extent Density product.',
      'GLM optical flashes cannot distinguish cloud-to-ground from intra-cloud flashes; no CG strike count or lightning track is claimed.',
    ],
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

/** Maps a UI satellite product id to the capability-matrix source of truth. */
function satelliteCapabilityId(productId: string): string | null {
  if (productId === 'ir') return 'infrared';
  if (productId === 'wv-upper') return 'wv_upper';
  if (productId === 'wv-mid') return 'wv_mid';
  if (productId === 'wv-lower') return 'wv_lower';
  if (productId === 'airmass') return 'airmass_rgb';
  if (productId === 'dust') return 'dust_rgb';
  if (productId === 'day-cloud-phase') return 'cloud_phase';
  if (productId === 'fire-temperature') return 'fire_smoke';
  if (/^ch\d{2}$/.test(productId)) return 'abi_channels';
  return SATELLITE_CAPABILITY_MATRIX.some((entry) => entry.id === productId) ? productId : null;
}

/**
 * The user's current satellite selection is normalized against the same
 * verified URL builder and capability matrix used by the map. Only source
 * status is reported; imagery values are deliberately absent.
 */
function satelliteSelectionObservation(selection: Partial<SatelliteSelection>): WeatherObservation | null {
  const normalized = normalizeSatelliteSelection(selection);
  const def = getSatelliteProductDef(normalized.productId);
  const tile = getSatelliteTileUrl(normalized);
  const capability = getSatelliteCapability(satelliteCapabilityId(normalized.productId) || '');
  const caveats = [
    'Only the tile URL and capability status are verified; no pixel value, cloud-top temperature, or imagery-derived feature is claimed.',
  ];
  if (normalized.sector.startsWith('mesoscale')) {
    caveats.push('Mesoscale sector footprints move, so no fixed bounds or object track is asserted.');
  }
  if (!tile.url) caveats.push(tile.unavailableReason || 'No verified tile source for this selection.');
  if (def.group === 'RGB' || def.id === 'geocolor') {
    caveats.push('RGB and GeoColor imagery are not available from a verified public XYZ source.');
  }
  return {
    id: 'obs-satellite-selection',
    domain: 'SATELLITE',
    source: 'GOES/ABI verified IEM tile feed',
    productCode: def.channel ? `abi-ch${def.channel}` : def.id,
    verification: tile.url ? 'PARTIAL' : 'UNAVAILABLE',
    observedAt: null,
    values: {
      bird: normalized.bird,
      sector: normalized.sector,
      productId: normalized.productId,
      label: def.label,
      channel: def.channel ?? null,
      tileUrlAvailable: Boolean(tile.url),
      capabilityStatus: capability?.availability ?? 'UNVERIFIED',
      reason: tile.unavailableReason ?? null,
    },
    caveats,
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

function surfaceStationsObservation(payload: unknown): WeatherObservation | null {
  const rawFeatures = (payload as { features?: unknown } | null)?.features;
  const features = Array.isArray(rawFeatures) ? rawFeatures : [];
  if (features.length === 0) return null;

  const props = features.map((feature) => (feature as { properties?: unknown })?.properties || {});
  const stations = unique(props.map((p: any) =>
    String(p.stationId || p.icaoId || p.id || '').trim()
  ));
  const asosCount = unique(props
    .map((p: any, index: number) => ({
      id: String(p.stationId || p.icaoId || p.id || `report-${index}`).trim(),
      asos: p.asos === true || /\b(?:AUTO|AO[12])\b/i.test(String(p.rawOb || p.raw || '')),
    }))
    .filter((entry) => entry.asos)
    .map((entry) => entry.id)).length;
  const categories = ['VFR', 'MVFR', 'IFR', 'LIFR']
    .map((category) => `${category}:${props.filter((p: any) =>
      String(p.flightCategory || p.fltcat || '').toUpperCase() === category
    ).length}`);
  const sample = props.slice(0, 3).map((p: any) => {
    const id = String(p.stationId || p.icaoId || p.id || '').trim();
    const temp = p.tempC ?? p.temp;
    const flight = p.flightCategory || p.fltcat;
    return [id, flight, temp != null ? `${temp}C` : null].filter(Boolean).join(' ');
  });

  return {
    id: 'obs-surface-stations',
    domain: 'OBSERVATION',
    source: 'AviationWeather.gov METAR stations (METAR/ASOS subset)',
    productCode: 'geojson',
    verification: 'PARTIAL',
    observedAt: isoOrNull((payload as { _meta?: { fetchedAt?: unknown } } | null)?._meta?.fetchedAt),
    values: {
      stationCount: stations.length || features.length,
      asosCount,
      flightCategories: categories.join(' | '),
      stationSample: sample.join(' | '),
    },
    caveats: [
      'Surface station reports are local observations and do not verify conditions aloft.',
      'ASOS labels come only from AUTO/AO1/AO2 remarks in real METAR reports; no separate ASOS feed is claimed.',
      'Fields omitted by the real report are never inferred.',
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
    input.satelliteSelection
      ? satelliteSelectionObservation(input.satelliteSelection)
      : satelliteObservation(input.includeSatelliteContext === true),
    metarObservation(input.metar),
    surfaceStationsObservation(input.surfaceStations),
    lsrObservation(input.lsr),
    mcdObservation(input.mcd),
  ].filter((observation): observation is WeatherObservation => observation !== null);
}
