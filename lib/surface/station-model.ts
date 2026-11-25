/**
 * Pure conversion from normalized upstream GeoJSON features to the canonical
 * station plot used by the map renderer, panel and MesoAI. No network calls,
 * no randomness, no invented readings.
 */

import {
  type FieldValue,
  type ObservationQuality,
  type PresentWeatherCode,
  type StationPlot,
  type SurfaceLayerId,
  type SurfaceNetworkId,
} from './types';

export const DATA_UNAVAILABLE = 'DATA UNAVAILABLE';
export const DEFAULT_STALE_MINUTES = 60;

export interface NormalizeOptions {
  layer: SurfaceLayerId;
  network: SurfaceNetworkId;
  sourceLabel: string;
  sourceUrl?: string | null;
  attribution?: string | null;
  nowMs?: number;
  staleMinutes?: number;
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

function parseTime(value: unknown): { iso: string | null; ms: number | null } {
  if (!value || typeof value !== 'string') return { iso: null, ms: null };
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return { iso: null, ms: null };
  return { iso: new Date(ms).toISOString(), ms };
}

/** Magnus approximation, explicitly marked as derived from real T/Td. */
export function relativeHumidity(tempC: number | null, dewpointC: number | null): FieldValue<number> {
  if (tempC === null || dewpointC === null) return { value: null, source: 'unavailable' };
  const t = 17.625 * tempC / (243.04 + tempC);
  const d = 17.625 * dewpointC / (243.04 + dewpointC);
  const rh = 100 * Math.exp(d - t);
  return { value: Math.max(0, Math.min(100, Math.round(rh))), source: 'derived' };
}

const WEATHER_TOKENS: Array<[RegExp, PresentWeatherCode]> = [
  [/\b\+?FZRA\b/, 'FZRA'], [/\bFZRA\b/, 'FZRA'],
  [/\bTS(?:RA|SN|GR|GS)?\b/, 'TS'],
  [/\bRA\b/, 'RA'], [/\bSN\b/, 'SN'], [/\bFG\b/, 'FG'],
  [/\bDZ\b/, 'DZ'], [/\bHZ\b/, 'HZ'], [/\bFU\b/, 'FU'],
  [/\bBR\b/, 'BR'], [/\bSH(?:RA|SN)?\b/, 'SH'],
  [/\bGR\b/, 'GR'], [/\bGS\b/, 'GS'], [/\bPL\b/, 'PL'],
  [/\bIC\b/, 'IC'], [/\bSG\b/, 'SG'], [/\bUP\b/, 'UP'],
];

/** Decode only weather groups present in the real report; never infer conditions. */
export function presentWeatherCodes(raw: unknown, upstream?: unknown): PresentWeatherCode[] {
  const rawText = `${text(upstream) || ''} ${text(raw) || ''}`.toUpperCase();
  if (!rawText.trim()) return [];
  const codes: PresentWeatherCode[] = [];
  for (const [pattern, code] of WEATHER_TOKENS) {
    if (pattern.test(rawText) && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

const SKY_OKTA: Record<string, number> = {
  SKC: 0, CLR: 0, NSC: 0, NCD: 0,
  FEW: 2, SCT: 4, BKN: 6, OVC: 8, VV: 8,
};

/** Sky cover from a real sky-cover field or real raw groups, on the 0-8 okta scale. */
export function skyCoverOkta(raw: unknown, upstream?: unknown): number | null {
  const direct = finite(upstream);
  if (direct !== null && direct >= 0 && direct <= 8) return Math.round(direct);
  const rawText = `${text(upstream) || ''} ${text(raw) || ''}`.toUpperCase();
  let okta = 0;
  let found = false;
  for (const [token, value] of Object.entries(SKY_OKTA)) {
    if (new RegExp(`\\b${token}\\d{3}\\b`).test(rawText) || new RegExp(`\\b${token}\\b`).test(rawText)) {
      okta = Math.max(okta, value);
      found = true;
    }
  }
  return found ? okta : null;
}

function pressureDescriptor(feature: any): StationPlot['pressure'] {
  const p = feature?.properties || feature || {};
  const slpRaw = finite(p.slp ?? p.mslp ?? p.seaLevelPressure);
  if (slpRaw !== null) {
    const hpa = slpRaw > 2000 ? slpRaw / 10 : slpRaw;
    if (hpa >= 800 && hpa <= 1100) {
      return { kind: 'slp', value: hpa, display: String(Math.round(hpa * 10)) };
    }
  }
  const altim = finite(p.altimeterInHg ?? p.altim ?? p.altimeter);
  if (altim !== null && altim >= 20 && altim <= 35) {
    return { kind: 'altimeter', value: altim, display: `A${String(Math.round(altim * 100)).padStart(4, '0')}` };
  }
  return { kind: 'unavailable', value: null, display: null };
}

function qualityFor(ms: number | null, nowMs: number, staleMinutes: number): ObservationQuality {
  if (ms === null) return 'unavailable';
  const age = Math.max(0, (nowMs - ms) / 60000);
  return age <= staleMinutes ? 'fresh' : 'stale';
}

/** Convert normalized GeoJSON features into canonical station plots. */
export function normalizeStationPlots(features: unknown, options: NormalizeOptions): StationPlot[] {
  const list = Array.isArray(features) ? features : Array.isArray((features as any)?.features) ? (features as any).features : [];
  const nowMs = options.nowMs ?? Date.now();
  const staleMinutes = options.staleMinutes ?? DEFAULT_STALE_MINUTES;
  const plots: StationPlot[] = [];

  for (const feature of list) {
    const p = feature?.properties || feature || {};
    const layer = (text(p.surfaceLayer) as SurfaceLayerId | null) ?? options.layer;
    const network = (text(p.surfaceNetwork) as SurfaceNetworkId | null) ?? options.network;
    const stationId = text(p.stationId || p.icaoId || p.id || feature?.id);
    const lon = finite(p.lon ?? feature?.geometry?.coordinates?.[0]);
    const lat = finite(p.lat ?? feature?.geometry?.coordinates?.[1]);
    if (!stationId || lat === null || lon === null) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const time = parseTime(p.obsTime || p.time || p.reportTime);
    const ageMinutes = time.ms === null ? null : Math.max(0, Math.round((nowMs - time.ms) / 60000));
    const rawOb = text(p.rawOb || p.raw || p.raw_text || p.metar);
    const tempC = finite(p.tempC ?? p.temp ?? p.tmpc);
    const dewpointC = finite(p.dewpointC ?? p.dewp ?? p.dwpc);
    const reportedHumidity = finite(p.relativeHumidityPct ?? p.relh ?? p.rh);
    const windDirRaw = p.windDirDeg ?? p.wdir ?? p.drct;
    const windDirDeg = windDirRaw === 'VRB' ? 'VRB' : finite(windDirRaw);
    const weatherCodes = presentWeatherCodes(rawOb, p.wx ?? p.wxString ?? p.presentWeatherCodes ?? p.wxcodes);
    const pressure = pressureDescriptor(feature);

    plots.push({
      id: `${layer}:${network}:${stationId}`,
      stationId,
      name: text(p.siteName || p.site),
      network,
      layer,
      stationType: text(p.stationType || p.type) || (p.asos === true ? 'Automated METAR report (AUTO/AO1/AO2 remarks)' : null),
      lat,
      lon,
      elevationM: finite(p.elev ?? p.elevation ?? p.elevationM),
      observedAt: time.iso,
      observedAtMs: time.ms,
      ageMinutes,
      quality: qualityFor(time.ms, nowMs, staleMinutes),
      tempC,
      dewpointC,
      humidityPct: reportedHumidity !== null
        ? { value: Math.max(0, Math.min(100, Math.round(reportedHumidity))), source: 'reported' }
        : relativeHumidity(tempC, dewpointC),
      windDirDeg,
      windSpeedKt: finite(p.windSpeedKt ?? p.wspd ?? p.sknt),
      windGustKt: finite(p.windGustKt ?? p.wgst ?? p.gst),
      visibilitySm: text(p.visibilitySm ?? p.visib ?? p.visibility),
      pressure,
      pressureTendency: text(p.pressureTendency ?? p.ptndy ?? p.PTDY),
      waveHeightM: finite(p.waveHeightM ?? p.WVHT),
      wavePeriodS: finite(p.dominantPeriodS ?? p.dominantPeriod ?? p.DPD),
      waterTempC: finite(p.waterTempC ?? p.WTMP),
      skyCoverOkta: skyCoverOkta(rawOb, p.skyCoverOkta ?? p.cov ?? p.cover ?? p.skyCoverCode ?? p.skyCover),
      ceilingFt: finite(p.ceilingFt ?? p.ceil),
      presentWeather: weatherCodes,
      weatherConditions: weatherCodes.length ? weatherCodes.join(' ') : null,
      rawOb,
      reportType: text(p.reportType ?? p.metarType) || (/^SPECI\b/i.test(rawOb || '') ? 'SPECI' : /^METAR\b/i.test(rawOb || '') ? 'METAR' : null),
      sourceLabel: text(p.sourceLabel) ?? options.sourceLabel,
      sourceUrl: options.sourceUrl ?? text(p.sourceUrl) ?? null,
      attribution: options.attribution ?? text(p.attribution) ?? null,
      raw: { ...p },
    });
  }
  return plots;
}

export function formatMinutes(ageMinutes: number | null): string {
  if (ageMinutes === null) return DATA_UNAVAILABLE;
  if (ageMinutes < 1) return '<1 min';
  if (ageMinutes < 60) return `${ageMinutes} min`;
  const hours = Math.floor(ageMinutes / 60);
  return `${hours}h ${ageMinutes % 60}m`;
}

export function formatTemp(tempC: number | null): string {
  if (tempC === null) return DATA_UNAVAILABLE;
  return `${Math.round(tempC)}°C / ${Math.round(tempC * 9 / 5 + 32)}°F`;
}

export function formatWind(plot: StationPlot): string {
  if (plot.windSpeedKt === null) return DATA_UNAVAILABLE;
  const dir = plot.windDirDeg === null ? 'VRB' : plot.windDirDeg === 'VRB' ? 'VRB' : `${Math.round(plot.windDirDeg)}°`;
  return `${dir} ${Math.round(plot.windSpeedKt)} kt${plot.windGustKt !== null ? ` G${Math.round(plot.windGustKt)}` : ''}`;
}

export interface StationDetailField {
  label: string;
  value: string;
  source: FieldValue<unknown>['source'];
}

/** Dense, uniform detail rows for click popups and future side panels. */
export function stationDetailFields(plot: StationPlot): StationDetailField[] {
  const row = (label: string, value: string | null, source: StationDetailField['source'] = 'reported'): StationDetailField => ({
    label,
    value: value ?? DATA_UNAVAILABLE,
    source: value === null ? 'unavailable' : source,
  });
  return [
    row('Observation age', formatMinutes(plot.ageMinutes)),
    row('Report type', plot.reportType),
    row('Station type', plot.stationType),
    row('Network', plot.network.toUpperCase()),
    row('Elevation', plot.elevationM === null ? null : `${Math.round(plot.elevationM)} m`),
    row('Wind', plot.windSpeedKt === null ? null : formatWind(plot)),
    row('Temperature', plot.tempC === null ? null : formatTemp(plot.tempC)),
    row('Dew point', plot.dewpointC === null ? null : formatTemp(plot.dewpointC)),
    row('Humidity', plot.humidityPct.value === null ? null : `${plot.humidityPct.value}% (${plot.humidityPct.source})`, plot.humidityPct.source),
    row('Pressure', plot.pressure.display === null ? null : `${plot.pressure.display} (${plot.pressure.kind === 'slp' ? 'SLP' : 'altimeter'})`),
    row('Pressure tendency', plot.pressureTendency === null ? null : `${plot.pressureTendency} hPa`),
    row('Wave height', plot.waveHeightM === null ? null : `${plot.waveHeightM} m`),
    row('Wave period', plot.wavePeriodS === null ? null : `${plot.wavePeriodS} s`),
    row('Water temperature', plot.waterTempC === null ? null : formatTemp(plot.waterTempC)),
    row('Visibility', plot.visibilitySm === null ? null : `${plot.visibilitySm} sm`),
    row('Ceiling', plot.ceilingFt === null ? null : `${Math.round(plot.ceilingFt)} ft`),
    row('Sky cover', plot.skyCoverOkta === null ? null : `${plot.skyCoverOkta}/8 okta${plot.quality === 'stale' ? ' (stale)' : ''}`),
    row('Weather conditions', plot.weatherConditions),
    row('Source', plot.sourceLabel),
  ];
}
