import { getNwsLatestObservation } from './noaa';
import { getOpenMeteoTelemetry } from './openmeteo';
import { CurrentObservation, MinutelyPrecipitation } from './types';

export interface HyperlocalTelemetryResult {
  available: boolean;
  reason?: string;
  observation: CurrentObservation | null;
  minutely: MinutelyPrecipitation[];
  minutelyAvailable: boolean;
}

export async function getHyperlocalTelemetry(
  lat: number,
  lon: number,
  stationId = 'KLZK'
): Promise<HyperlocalTelemetryResult> {
  // 1. Fetch Open-Meteo for high-frequency minutely precipitation & physics metrics
  const omResult = await getOpenMeteoTelemetry(lat, lon);

  // 2. Concurrently fetch official NOAA NWS observation for calibrated airport sensors
  const nwsResult = await getNwsLatestObservation(stationId);

  const hasOmObservation = Boolean(omResult?.observation);
  const hasNwsObservation = Boolean(nwsResult && Object.keys(nwsResult).length > 0);

  // DATA HONESTY: never fabricate baseline observations. If no real source returned data, report unavailable.
  if (!hasOmObservation && !hasNwsObservation) {
    return {
      available: false,
      reason: 'DATA UNAVAILABLE - No verified surface observation sources responded.',
      observation: null,
      minutely: [],
      minutelyAvailable: false,
    };
  }

  // Merge: Prioritize official NWS airport surface data, fill gaps with Open-Meteo real data only.
  const om = omResult?.observation;
  const pickNum = (v: unknown, fallback: number | null): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const tempF = pickNum(nwsResult?.tempF, pickNum(om?.tempF, null));
  const dewPointF = pickNum(nwsResult?.dewPointF, pickNum(om?.dewPointF, null));
  const humidityPct = pickNum(nwsResult?.humidityPct, pickNum(om?.humidityPct, null));
  const pressureMb = pickNum(nwsResult?.pressureMb, pickNum(om?.pressureMb, null));
  const pressureInHg = pickNum(nwsResult?.pressureInHg, pickNum(om?.pressureInHg, null));
  const windSpeedKt = pickNum(nwsResult?.windSpeedKt, pickNum(om?.windSpeedKt, null));
  const windGustKt = pickNum(nwsResult?.windGustKt, pickNum(om?.windGustKt, null));
  const windDirDeg = pickNum(nwsResult?.windDirDeg, pickNum(om?.windDirDeg, null));
  const feelsLikeF = pickNum(nwsResult?.feelsLikeF, pickNum(om?.feelsLikeF, tempF));
  const wetBulbF = pickNum(nwsResult?.wetBulbF, pickNum(om?.wetBulbF, tempF));
  const visibilityMi = pickNum(nwsResult?.visibilityMi, pickNum(om?.visibilityMi, null));

  // If we cannot establish core real fields, do not fabricate.
  if (tempF == null || dewPointF == null || humidityPct == null) {
    return {
      available: false,
      reason: 'DATA UNAVAILABLE - Insufficient verified observation fields from real sources.',
      observation: null,
      minutely: [],
      minutelyAvailable: false,
    };
  }

  const observation: CurrentObservation = {
    tempF,
    feelsLikeF: feelsLikeF ?? tempF,
    dewPointF,
    wetBulbF: wetBulbF ?? tempF,
    humidityPct,
    pressureInHg: pressureInHg ?? 0,
    pressureMb: pressureMb ?? 0,
    windSpeedKt: windSpeedKt ?? 0,
    windGustKt: windGustKt ?? 0,
    windDirDeg: windDirDeg ?? 0,
    visibilityMi: visibilityMi ?? 0,
    conditionText: nwsResult?.conditionText || om?.conditionText || 'Unavailable',
    stationId,
    timestamp: nwsResult?.timestamp || om?.timestamp || new Date().toISOString(),
    provider: hasNwsObservation ? 'NWS' : 'OPEN_METEO',
  };

  const minutely = omResult?.minutely || [];

  return {
    available: true,
    observation,
    minutely,
    minutelyAvailable: Array.isArray(omResult?.minutely) && omResult.minutely.length > 0,
  };
}
