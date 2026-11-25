/**
 * MesoAI Weather Data Engine.
 *
 * Normalizes already-verified app payloads into WeatherObservation records.
 * This module performs no network requests and never invents a missing value.
 */

import { getCatalogProduct } from '../radar/product-catalog';
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

/** Returns only observations with real, verified source data. */
export function buildObservations(input: RawWeatherInputs): WeatherObservation[] {
  return [
    radarObservation(input.stormAnalysis),
    lightningObservation(input.lightning),
    outlookObservation(input.outlook, input.site),
    alertObservation(input.alerts, input.site),
    productObservation(input.productKey),
  ].filter((observation): observation is WeatherObservation => observation !== null);
}
