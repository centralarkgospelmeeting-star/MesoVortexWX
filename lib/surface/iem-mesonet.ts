/**
 * Iowa Environmental Mesonet current-observation adapter.
 *
 * Accepts IEM GeoJSON network payloads and the columnar current.py payload.
 * Only real coordinates and reported fields are emitted; missing readings stay
 * null. No station is invented when coordinates are absent.
 */

export interface MesonetBbox {
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

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function toCelsius(f: number | null): number | null {
  return f === null ? null : Math.round(((f - 32) * 5) / 9 * 10) / 10;
}

function parseIemTime(value: unknown): string | null {
  let raw = text(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) raw = `${raw.replace(' ', 'T')}Z`;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function recordsFromPayload(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const obj = data as any;
  if (Array.isArray(obj.features)) return obj.features;
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.rows)) {
    const headers: string[] = Array.isArray(obj.columns) ? obj.columns.map(String) : [];
    return obj.rows.map((row: unknown) => Array.isArray(row)
      ? Object.fromEntries(headers.map((header, index) => [header, row[index]]))
      : row);
  }
  // Some IEM responses are keyed by station identifier.
  return Object.entries(obj)
    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
    .map(([id, value]) => ({ id, ...(value as object) }));
}

function field(record: any, names: string[]): unknown {
  for (const name of names) {
    if (record?.[name] !== undefined && record?.[name] !== null && record?.[name] !== '') return record[name];
    if (record?.properties?.[name] !== undefined && record?.properties?.[name] !== null && record?.properties?.[name] !== '') return record.properties[name];
  }
  return null;
}

/** Normalize any supported IEM payload into station GeoJSON features. */
export function normalizeIemObservations(data: unknown, network: string, bbox?: MesonetBbox | null): any[] {
  const records = recordsFromPayload(data);
  const features: any[] = [];
  for (const record of records) {
    const stationId = text(field(record, ['station', 'sid', 'stid', 'id', 'stationId']));
    const lat = finite(field(record, ['lat', 'latitude']));
    const lon = finite(field(record, ['lon', 'longitude', 'lng']));
    if (!stationId || lat === null || lon === null) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    if (bbox && (lat < bbox.lat0 || lat > bbox.lat1 || lon < bbox.lon0 || lon > bbox.lon1)) continue;

    const tempF = finite(field(record, ['tmpf', 'tempf', 'temp_f']));
    const dewF = finite(field(record, ['dwpf', 'dewf', 'dewpoint_f']));
    const windKt = finite(field(record, ['sknt', 'wind_kt', 'wspd']));
    const gustKt = finite(field(record, ['gust', 'gust_kt']));
    const altimInHg = finite(field(record, ['alti', 'altimeter']));
    let slpHpa = finite(field(record, ['mslp', 'slp', 'sea_level_pressure']));
    if (slpHpa !== null && slpHpa > 2000) slpHpa /= 10;
    if (slpHpa !== null && (slpHpa < 800 || slpHpa > 1100)) slpHpa = null;
    const valid = parseIemTime(field(record, ['valid', 'obsTime', 'obstime', 'timestamp']));

    features.push({
      type: 'Feature',
      id: stationId,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        stationId,
        lat,
        lon,
        obsTime: valid || parseIemTime(field(record, ['utc_valid'])),
        siteName: text(field(record, ['name', 'sname', 'station_name'])),
        stationType: text(field(record, ['network'])) || 'IEM mesonet station',
        tempC: toCelsius(tempF),
        dewpointC: toCelsius(dewF),
        relativeHumidityPct: finite(field(record, ['relh', 'rh'])),
        windDirDeg: finite(field(record, ['drct', 'wdir', 'wind_dir'])),
        windSpeedKt: windKt,
        windGustKt: gustKt,
        altimeterInHg: altimInHg,
        slp: slpHpa,
        visibilitySm: finite(field(record, ['vsby', 'visibility'])),
        skyCoverCode: text(field(record, ['skyc1', 'skyc2', 'skyc3', 'skyc4', 'skyc'])),
        presentWeatherCodes: text(field(record, ['wxcodes', 'wxString', 'wx'])),
        rawOb: text(field(record, ['raw', 'rawOb'])),
        precipIn: finite(field(record, ['p01i', 'phour'])),
        precipDayIn: finite(field(record, ['pday', 'ob_pday'])),
        sourceLabel: `IEM ${network} current observations`,
        sourceUrl: `https://mesonet.agron.iastate.edu/api/1/currents.geojson?network=${encodeURIComponent(network)}`,
        network,
        raw: { ...(record.properties || record) },
      },
    });
  }
  return features;
}
