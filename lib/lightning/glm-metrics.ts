/**
 * Derived metrics from real GOES-R GLM flash points.
 *
 * This module performs no network requests, uses no randomness, and never
 * invents a flash where the source has none. Every value is computed from the
 * coordinates/energy already present in /api/lightning/glm's FeatureCollection.
 *
 * Honesty boundary: these are app-derived descriptors of optical flashes. They
 * are NOT the official GOES Flash Extent Density (FED) product, cannot tell
 * cloud-to-ground from intra-cloud flashes, and do not form lightning tracks.
 */

export type GlmDerivedMetrics = {
  flashCount: number;
  minutes: number;
  flashesPerMinute: number | null;
  /** Unique 0.1-degree lat/lon cells containing at least one real flash. */
  occupiedCells01Deg: number | null;
  extentLatKm: number | null;
  extentLonKm: number | null;
  meanEnergyJ: number | null;
  maxEnergyJ: number | null;
};

type GlmFeature = {
  geometry?: { coordinates?: unknown };
  properties?: { energy_j?: unknown };
};

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function featureCollection(payload: unknown): GlmFeature[] {
  const data = (payload as Record<string, unknown> | null) ?? {};
  const features = (data.features as { features?: unknown } | undefined)?.features;
  return Array.isArray(features) ? (features as GlmFeature[]) : [];
}

/** Returns null when the source is unavailable or has no usable time window. */
export function deriveGlmMetrics(payload: unknown): GlmDerivedMetrics | null {
  const data = (payload as Record<string, unknown> | null) ?? {};
  if (data.available !== true) return null;

  const minutes = finiteNumber(data.minutes ?? data.windowMinutes);
  if (minutes === null || minutes <= 0) return null;

  const features = featureCollection(data);
  const flashCount = finiteNumber(data.flashCount ?? data.count) ?? features.length;
  if (flashCount < 0) return null;

  const cells = new Set<string>();
  let pointCount = 0;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let energyCount = 0;
  let energySum = 0;
  let maxEnergy = -Infinity;

  for (const feature of features) {
    const coordinates = feature?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const lon = finiteNumber(coordinates[0]);
    const lat = finiteNumber(coordinates[1]);
    if (lon === null || lat === null) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    pointCount += 1;
    cells.add(`${Math.floor(lat / 0.1)}:${Math.floor(lon / 0.1)}`);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);

    const energy = finiteNumber(feature?.properties?.energy_j);
    if (energy !== null && energy >= 0) {
      energyCount += 1;
      energySum += energy;
      maxEnergy = Math.max(maxEnergy, energy);
    }
  }

  const meanLat = pointCount > 0 ? (minLat + maxLat) / 2 : null;
  return {
    flashCount,
    minutes,
    flashesPerMinute: round(flashCount / minutes, 2),
    occupiedCells01Deg: pointCount > 0 ? cells.size : null,
    extentLatKm: pointCount >= 2 ? round((maxLat - minLat) * 111.32, 1) : null,
    extentLonKm: pointCount >= 2 && meanLat !== null
      ? round((maxLon - minLon) * 111.32 * Math.cos((meanLat * Math.PI) / 180), 1)
      : null,
    meanEnergyJ: energyCount > 0 ? round(energySum / energyCount, 2) : null,
    maxEnergyJ: energyCount > 0 ? round(maxEnergy, 2) : null,
  };
}

/**
 * Normalizes the Python GLM payload (`windowMinutes`/`count`) into the fields
 * all downstream consumers already expect (`minutes`/`flashCount`), then adds
 * derived descriptors. Unavailable payloads pass through untouched.
 */
export function normalizeGlmResponse(payload: unknown, requestedMinutes: number): Record<string, unknown> {
  const data = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  if (data.available !== true) return data;

  const minutes = finiteNumber(data.minutes ?? data.windowMinutes) ?? requestedMinutes;
  const features = featureCollection(data);
  const flashCount = finiteNumber(data.flashCount ?? data.count) ?? features.length;
  const normalized = { ...data, minutes, flashCount, windowMinutes: minutes };
  return { ...normalized, metrics: deriveGlmMetrics(normalized) };
}
