import { NextResponse } from 'next/server';
import {
  ALL_ALERT_CATEGORIES,
  alertsToFeatureCollection,
  categoryCounts,
  normalizeNwsCollection,
  normalizeNwsAlert,
} from '@/lib/alerts/model';

export const dynamic = 'force-dynamic';

const NWS_ACTIVE_ALERTS =
  'https://api.weather.gov/alerts/active?status=actual&message_type=alert';

// In-memory cache for NWS zone geometry + real zone names (TTL 10 min).
const zoneCache = new Map<string, { geometry: any | null; name: string | null; expires: number }>();
const ZONE_TTL_MS = 10 * 60 * 1000;

async function fetchZone(url: string): Promise<{ geometry: any | null; name: string | null } | null> {
  const cached = zoneCache.get(url);
  if (cached && cached.expires > Date.now()) return cached;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MesoVortexWX/2.0 (mesovortexwx@example.com)', Accept: 'application/geo+json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const entry = {
      geometry: data?.geometry || null,
      name: typeof data?.properties?.name === 'string' ? data.properties.name.trim() : null,
      expires: Date.now() + ZONE_TTL_MS,
    };
    zoneCache.set(url, entry);
    return entry;
  } catch {
    return null;
  }
}

async function resolveZoneGeometry(feature: any): Promise<any | null> {
  const zones: string[] = Array.isArray(feature?.properties?.affectedZones)
    ? feature.properties.affectedZones
    : [];
  if (zones.length === 0) return null;
  const entries = await Promise.all(zones.map((z) => fetchZone(z)));
  const polys: any[] = [];
  for (const entry of entries) {
    const g = entry?.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') polys.push(g.coordinates);
    else if (g.type === 'MultiPolygon') polys.push(...g.coordinates);
  }
  if (polys.length === 0) return null;
  if (polys.length === 1) return { type: 'Polygon', coordinates: polys[0] };
  return { type: 'MultiPolygon', coordinates: polys };
}

/** Real NWS forecast-zone names for an alert's affectedZones. No city guessing. */
async function resolveZonePlaces(feature: any): Promise<string[]> {
  const zones: string[] = Array.isArray(feature?.properties?.affectedZones)
    ? feature.properties.affectedZones
    : [];
  const entries = await Promise.all(zones.map((z) => fetchZone(z)));
  const names = entries
    .map((entry) => entry?.name)
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(names)).slice(0, 40);
}

// Resolve missing geometries in bounded batches to avoid hammering NWS.
async function resolveMissingGeometries(features: any[]): Promise<any[]> {
  const missing = features.filter((f) => !f?.geometry);
  // Unique zone URLs across all missing features.
  const zoneUrls = new Set<string>();
  for (const f of missing) {
    for (const z of f?.properties?.affectedZones || []) zoneUrls.add(z);
  }
  // Fetch all unique zones with limited concurrency.
  const urls = Array.from(zoneUrls);
  const CONC = 8;
  for (let i = 0; i < urls.length; i += CONC) {
    await Promise.all(urls.slice(i, i + CONC).map((u) => fetchZone(u)));
  }
  // Now assign geometry to each missing feature.
  for (const f of missing) {
    const geom = await resolveZoneGeometry(f);
    if (geom) f.geometry = geom;
  }
  return features;
}

export async function GET() {
  try {
    const response = await fetch(NWS_ACTIVE_ALERTS, {
      headers: {
        'User-Agent': 'MesoVortexWX/2.0 (mesovortexwx@example.com)',
        Accept: 'application/geo+json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          type: 'FeatureCollection',
          features: [],
          _meta: {
            ok: false,
            error: `NWS alert feed returned HTTP ${response.status}`,
            fetchedAt: new Date().toISOString(),
            source: NWS_ACTIVE_ALERTS,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const payload = await response.json();
    const rawFeatures = Array.isArray(payload?.features) ? payload.features : [];
    await resolveMissingGeometries(rawFeatures);
    // Zone names are real NWS forecast-zone labels for affectedZones, never
    // inferred city names. Resolve for polygon and non-polygon alerts alike.
    for (const feature of rawFeatures) {
      const places = await resolveZonePlaces(feature);
      if (places.length) feature.properties = { ...(feature.properties || {}), places };
    }

    const alerts = normalizeNwsCollection({ ...payload, features: rawFeatures });
    const counts = categoryCounts(alerts);
    const collection = alertsToFeatureCollection(alerts);

    return NextResponse.json(
      {
        ...collection,
        _meta: {
          ok: true,
          source: NWS_ACTIVE_ALERTS,
          fetchedAt: new Date().toISOString(),
          total: alerts.length,
          rendered: collection.features.length,
          counts,
          zonesResolved: rawFeatures.filter((f: any) => f.geometry).length,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: [],
        _meta: {
          ok: false,
          error: err?.message || 'Alert feed unavailable',
          fetchedAt: new Date().toISOString(),
          source: NWS_ACTIVE_ALERTS,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}