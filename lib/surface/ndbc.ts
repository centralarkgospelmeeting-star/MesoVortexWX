/**
 * NOAA NDBC latest-observations adapter.
 *
 * Reads the public columnar latest_obs.txt feed. Coordinates and values come
 * only from the upstream table; rows without usable coordinates are dropped.
 * Units follow the documented NDBC realtime convention: wind m/s, temperature
 * Celsius, pressure hPa, waves metres, visibility nautical miles.
 */

export type NdbcNetwork = 'buoy' | 'marine';

export interface NdbcBbox {
  lat0: number;
  lon0: number;
  lat1: number;
  lon1: number;
}

const MISSING = new Set(['MM', 'MMMM', 'M', '-', '', 'N/A', 'NA', 'NULL']);

function clean(token: string | null | undefined): string | null {
  const value = String(token ?? '').trim();
  return MISSING.has(value.toUpperCase()) ? null : value || null;
}

function number(token: string | null | undefined): number | null {
  const value = clean(token);
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coordinate(token: string | null | undefined, hemisphere?: string | null): number | null {
  let value = clean(token);
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const direction = (hemisphere || '').trim().toUpperCase();
  if (direction === 'S' || direction === 'W') return -Math.abs(numeric);
  if (direction === 'N' || direction === 'E') return Math.abs(numeric);
  // Some NDBC tables encode the direction inside the value, e.g. "42.37 N".
  const embedded = value.match(/^([+-]?\d+(?:\.\d+)?)\s*([NSEW])$/i);
  if (embedded) {
    const magnitude = Math.abs(Number(embedded[1]));
    const dir = embedded[2].toUpperCase();
    return dir === 'S' || dir === 'W' ? -magnitude : magnitude;
  }
  return numeric;
}

function isoTime(parts: Record<string, string | null>): string | null {
  for (const key of ['time', 'TIME', 'TIMESTAMP']) {
    const value = clean(parts[key]);
    if (value) {
      const ms = Date.parse(value);
      if (Number.isFinite(ms)) return new Date(ms).toISOString();
    }
  }
  const y = number(parts.YEAR ?? parts.YYYY ?? parts.yyyy);
  const mo = number(parts.MONTH ?? parts.MM ?? parts.mm);
  const d = number(parts.DAY ?? parts.DD ?? parts.dd);
  const h = number(parts.HOUR ?? parts.hh ?? parts.HH);
  const min = number(parts.MINUTE ?? parts.mm ?? parts.MI);
  if ([y, mo, d, h, min].some((v) => v === null)) return null;
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? iso : null;
}

function findColumn(headers: string[], names: string[]): number {
  const cleanHeaders = headers.map((header) => header.replace(/^#/, '').trim());
  // Exact case first: NDBC uses `MM` for month and `mm` for minute.
  for (const name of names) {
    const index = cleanHeaders.indexOf(name);
    if (index >= 0) return index;
  }
  const normalized = cleanHeaders.map((header) => header.toUpperCase());
  for (const name of names) {
    const index = normalized.indexOf(name.toUpperCase());
    if (index >= 0) return index;
  }
  return -1;
}

function valueAt(cells: string[], index: number): string | null {
  return index >= 0 ? clean(cells[index]) : null;
}

export function isBuoyStationId(id: string): boolean {
  return /^\d{5}$/.test(id);
}

/** Convert the latest_obs table to normalized station GeoJSON features. */
export function parseLatestObservations(text: string, network: NdbcNetwork, bbox?: NdbcBbox | null): any[] {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /^#/.test(line) && /\b(?:STN|STNID)\b/i.test(line));
  if (headerIndex < 0 || headerIndex >= lines.length - 1) return [];
  const headers = lines[headerIndex].replace(/^#/, '').trim().split(/\s+/);
  const index = (names: string[]) => findColumn(headers, names);
  const columns = {
    id: index(['STN', 'STNID', 'ID', 'STATION']),
    lat: index(['LAT', 'LATITUDE']),
    latHemi: index(['LAT_HEMI', 'NS', 'LATNS']),
    lon: index(['LON', 'LONGITUDE', 'LNG']),
    lonHemi: index(['LON_HEMI', 'EW', 'LONEW']),
    year: index(['YYYY', 'YEAR']),
    month: index(['MM', 'MONTH']),
    day: index(['DD', 'DAY']),
    hour: index(['hh', 'HH', 'HOUR']),
    minute: index(['mm', 'MI', 'MINUTE']),
    wdir: index(['WDIR']),
    wspd: index(['WSPD']),
    gust: index(['GST']),
    waveHeight: index(['WVHT']),
    dominantPeriod: index(['DPD']),
    averagePeriod: index(['APD']),
    pressure: index(['PRES']),
    pressureTendency: index(['PTDY']),
    airTemp: index(['ATMP']),
    waterTemp: index(['WTMP']),
    dewpoint: index(['DEWP']),
    visibility: index(['VIS']),
  };
  if (columns.id < 0 || columns.lat < 0 || columns.lon < 0) return [];

  const features: any[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || /^#/.test(line)) continue;
    const cells = line.trim().split(/\s+/);
    const id = valueAt(cells, columns.id);
    if (!id || !/^[A-Z0-9_]{3,10}$/i.test(id)) continue;
    if (isBuoyStationId(id) !== (network === 'buoy')) continue;
    const lat = coordinate(valueAt(cells, columns.lat) ?? undefined, valueAt(cells, columns.latHemi));
    const lon = coordinate(valueAt(cells, columns.lon) ?? undefined, valueAt(cells, columns.lonHemi));
    if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    if (bbox && (lat < bbox.lat0 || lat > bbox.lat1 || lon < bbox.lon0 || lon > bbox.lon1)) continue;

    const observedAt = isoTime({
      YYYY: valueAt(cells, columns.year),
      MM: valueAt(cells, columns.month),
      DD: valueAt(cells, columns.day),
      hh: valueAt(cells, columns.hour),
      mm: valueAt(cells, columns.minute),
    });
    const windMs = number(valueAt(cells, columns.wspd) ?? undefined);
    const gustMs = number(valueAt(cells, columns.gust) ?? undefined);
    const slpHpa = number(valueAt(cells, columns.pressure) ?? undefined);
    const visibilityNm = number(valueAt(cells, columns.visibility) ?? undefined);
    const dewpointC = number(valueAt(cells, columns.dewpoint) ?? undefined);
    const airTempC = number(valueAt(cells, columns.airTemp) ?? undefined);

    features.push({
      type: 'Feature',
      id,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        stationId: id,
        lat,
        lon,
        obsTime: observedAt,
        stationType: network === 'buoy' ? 'NDBC buoy' : 'NDBC marine station',
        windDirDeg: number(valueAt(cells, columns.wdir) ?? undefined),
        windSpeedKt: windMs === null ? null : Math.round(windMs * 1.94384 * 10) / 10,
        windGustKt: gustMs === null ? null : Math.round(gustMs * 1.94384 * 10) / 10,
        tempC: airTempC,
        dewpointC,
        slp: slpHpa,
        pressureTendency: valueAt(cells, columns.pressureTendency),
        waveHeightM: number(valueAt(cells, columns.waveHeight) ?? undefined),
        dominantPeriodS: number(valueAt(cells, columns.dominantPeriod) ?? undefined),
        averagePeriodS: number(valueAt(cells, columns.averagePeriod) ?? undefined),
        waterTempC: number(valueAt(cells, columns.waterTemp) ?? undefined),
        visibilityNm,
        sourceLabel: network === 'buoy' ? 'NOAA NDBC buoy observations' : 'NOAA NDBC marine observations',
        sourceUrl: 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt',
        raw: Object.fromEntries(headers.map((header, i) => [header.replace(/^#/, ''), cells[i] ?? ''])),
      },
    });
  }
  return features;
}
