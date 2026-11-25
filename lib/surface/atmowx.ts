/**
 * Verified keyless PWS adapter (atmowx AT Protocol station feed).
 *
 * This is a sparse public network, not a global PWS aggregator. Only fields
 * present in a station's latest observation are emitted; vendor networks that
 * require API keys (Weather Underground, Tempest, Davis) remain UNAVAILABLE.
 */

export interface PwsBbox {
  lat0: number;
  lon0: number;
  lat1: number;
  lon1: number;
}

function finite(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function scaled(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const raw = finite((value as any).value);
  const scale = finite((value as any).scale) ?? 0;
  return raw === null ? null : raw * 10 ** scale;
}

function stationId(station: any, index: number): string {
  const uri = String(station?.uri || '');
  const slug = uri.split('/').filter(Boolean).pop();
  return String(slug || station?.did || station?.name || `ATMOWX-${index}`).slice(0, 24);
}

/** Convert the atmowx queryStations response to canonical station GeoJSON. */
export function normalizeAtmowxStations(data: unknown, bbox?: PwsBbox | null): any[] {
  const stations = Array.isArray((data as any)?.stations) ? (data as any).stations : [];
  const features: any[] = [];
  for (const [index, station] of stations.entries()) {
    const lat = finite(station?.latitude);
    const lon = finite(station?.longitude);
    if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    if (bbox && (lat < bbox.lat0 || lat > bbox.lat1 || lon < bbox.lon0 || lon > bbox.lon1)) continue;
    const latest = station?.latest && typeof station.latest === 'object' ? station.latest : null;
    const observedAt = latest ? String(latest.observedAt || '') : '';
    const obsTimeMs = observedAt ? Date.parse(observedAt) : Number.NaN;
    const windSpeedMs = scaled(latest?.wind?.speed);
    const windGustMs = scaled(latest?.wind?.gust);
    const pressureHpa = scaled(latest?.pressureSeaLevel) ?? scaled(latest?.pressureStation);

    features.push({
      type: 'Feature',
      id: stationId(station, index),
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        stationId: stationId(station, index),
        lat,
        lon,
        obsTime: Number.isFinite(obsTimeMs) ? new Date(obsTimeMs).toISOString() : null,
        siteName: String(station?.name || '').trim() || null,
        stationType: station?.kind ? `PWS (${station.kind})` : 'Personal weather station',
        elevationM: finite(station?.elevation),
        tempC: scaled(latest?.temperature),
        dewpointC: scaled(latest?.dewPoint),
        relativeHumidityPct: scaled(latest?.relativeHumidity),
        windDirDeg: finite(latest?.wind?.direction),
        windSpeedKt: windSpeedMs === null ? null : Math.round(windSpeedMs * 1.94384 * 10) / 10,
        windGustKt: windGustMs === null ? null : Math.round(windGustMs * 1.94384 * 10) / 10,
        slp: pressureHpa !== null && pressureHpa >= 800 && pressureHpa <= 1100 ? pressureHpa : null,
        precipMm: scaled(latest?.precipitation?.hour),
        sourceLabel: 'atmowx public PWS network (sparse coverage)',
        sourceUrl: 'https://atmowx.net/xrpc/net.atmowx.queryStations',
        raw: latest || {},
      },
    });
  }
  return features;
}
