/**
 * Shared normalization for the real AviationWeather.gov METAR feed.
 *
 * Pure module: no network requests, no randomness, no invented readings.
 * ASOS is not treated as a separate feed here. It is identified from the
 * automated-station markers already present in genuine raw METAR remarks
 * (AUTO, AO1, AO2), so the label stays source-scoped and honest.
 */

export type SurfaceSource = 'metar' | 'asos';

export type SurfaceQuery = {
  ids?: string | null;
  bbox?: string | null;
  hours?: string | number | null;
  source?: SurfaceSource | null;
};

function finite(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** True only when the real raw report carries an automated-station marker. */
export function isAsosReport(raw: unknown): boolean {
  return /\b(?:AUTO|AO[12])\b/i.test(String(raw || ''));
}

export function validIds(ids: string | null | undefined): string[] | null {
  if (!ids) return null;
  const cleaned = ids.toUpperCase().split(',').map((id) => id.trim()).filter(Boolean);
  if (cleaned.length === 0 || cleaned.length > 20) return null;
  if (!cleaned.every((id) => /^[A-Z0-9]{3,5}$/.test(id))) return null;
  return cleaned;
}

/** bbox contract: lat0,lon0,lat1,lon1 with real geographic bounds. */
export function validBbox(bbox: string | null | undefined): number[] | null {
  if (!bbox) return null;
  const parts = bbox.split(',').map((part) => finite(part));
  if (parts.length !== 4 || parts.some((n) => n === null)) return null;
  const [lat0, lon0, lat1, lon1] = parts as number[];
  if (lat0 < -90 || lat1 > 90 || lon0 < -180 || lon1 > 180) return null;
  if (lat0 >= lat1 || lon0 >= lon1) return null;
  return [lat0, lon0, lat1, lon1];
}

export function normalizedHours(hours: string | number | null | undefined): number {
  const parsed = finite(hours);
  if (parsed === null) return 3;
  return Math.max(1, Math.min(12, Math.round(parsed)));
}

export function buildUpstreamUrl(query: SurfaceQuery): string | null {
  const ids = validIds(query.ids);
  const bbox = validBbox(query.bbox);
  if (!ids && !bbox) return null;
  const url = new URL('https://aviationweather.gov/api/data/metar');
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('hours', String(normalizedHours(query.hours)));
  if (ids) url.searchParams.set('ids', ids.join(','));
  if (bbox) url.searchParams.set('bbox', bbox.join(','));
  return url.toString();
}

/**
 * Preserves every upstream property and adds explicit, null-safe descriptors.
 * A feature with no usable station id or coordinates is dropped rather than
 * being replaced with a fabricated station.
 */
export function normalizeSurfaceFeature(feature: any, source: SurfaceSource): any | null {
  const p = feature?.properties || feature;
  if (!p) return null;
  const stationId = String(p.icaoId || p.stationId || p.id || feature?.id || '').trim();
  const lon = finite(p.lon ?? p.longitude ?? feature?.geometry?.coordinates?.[0]);
  const lat = finite(p.lat ?? p.latitude ?? feature?.geometry?.coordinates?.[1]);
  if (!stationId || lat === null || lon === null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const rawOb = String(p.rawOb || p.raw_text || p.raw || p.metar || '');
  const asos = isAsosReport(rawOb);
  if (source === 'asos' && !asos) return null;

  const windDirRaw = p.wdir ?? p.wind_dir_degrees;
  // AviationWeather reports ceil in hundreds of feet (ceil 95 == OVC095 == 9500 ft).
  const ceilingRaw = finite(p.ceil ?? p.ceiling);
  return {
    type: 'Feature',
    id: stationId,
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      ...p,
      stationId,
      siteName: p.site || p.siteName || null,
      lat,
      lon,
      tempC: finite(p.temp ?? p.temp_c),
      dewpointC: finite(p.dewp ?? p.dewpoint_c),
      windDirDeg: windDirRaw === 'VRB' ? 'VRB' : finite(windDirRaw),
      windSpeedKt: finite(p.wspd ?? p.wind_speed_kt),
      windGustKt: finite(p.wgst ?? p.wind_gust_kt),
      flightCategory: String(p.fltcat || p.flightCategory || '').trim() || null,
      visibilitySm: String(p.visib || p.visibility || '').trim() || null,
      ceilingFt: ceilingRaw === null ? null : ceilingRaw * 100,
      altimeterInHg: finite(p.altim ?? p.altimeter),
      obsTime: p.obsTime || p.receiptTime || p.reportTime || null,
      rawOb,
      asos,
      sourceLabel: source === 'asos'
        ? 'ASOS (automated station reports classified from real METAR remarks)'
        : 'AviationWeather.gov METAR',
    },
  };
}

export function normalizeCollection(data: unknown, source: SurfaceSource): any[] {
  const rawFeatures = Array.isArray(data)
    ? data
    : Array.isArray((data as { features?: unknown } | null)?.features)
      ? (data as { features: unknown[] }).features
      : [];

  // The AWC feed can return several reports per station for the requested
  // window. Keep only the newest real report so stations are not duplicated
  // on the map or in the panel.
  const latest = new Map<string, any>();
  const timestamp = (feature: any): number => {
    const value = feature?.properties?.obsTime;
    const ms = value ? Date.parse(String(value)) : Number.NaN;
    return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
  };

  for (const raw of rawFeatures) {
    const feature = normalizeSurfaceFeature(raw, source);
    if (!feature) continue;
    const id = String(feature.properties.stationId);
    const existing = latest.get(id);
    if (!existing || timestamp(feature) > timestamp(existing)) latest.set(id, feature);
  }
  return Array.from(latest.values());
}
