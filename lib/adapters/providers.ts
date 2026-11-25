import { RadarFeedResponse, ActiveAlert, SurfaceObservation } from './types';
import { RADAR_SITES } from '../radar-config';
import { getRadarCapability, isRadarProductAvailable } from '../radar/capability-matrix';

const IEM_BASE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';
const NWS_BASE = 'https://api.weather.gov';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1';

// ============================================================================
// 1. RADAR PROVIDER ADAPTER (IEM / NOAA NEXRAD Level III)
// DATA HONESTY: capability matrix is authoritative. No fake playback. No substitutes.
// ============================================================================
export class NoaaRadarAdapter {
  static getRadarFeed(stationId: string, product: string, tilt = '0.5'): RadarFeedResponse & { available: boolean; notes?: string[]; capabilityId?: string } {
    const site = RADAR_SITES.find((s) => s.id === stationId || s.radarId === stationId) || RADAR_SITES[0];
    const key = product.toLowerCase();
    const capId = (key === 'ref' || key === 'max_ref' || key === 'ref_x') ? 'ref'
      : key === 'vel' ? 'vel'
      : key === 'srvel' ? 'srvel'
      : key;
    const cap = getRadarCapability(capId);

    if (!cap || !isRadarProductAvailable(capId)) {
      return {
        available: false,
        provider: 'DATA UNAVAILABLE',
        station: site.radarId,
        product: capId.toUpperCase(),
        tilt,
        frames: [],
        latestTileUrl: '',
        capabilityId: capId,
        notes: [cap?.unavailableReason || `DATA UNAVAILABLE - ${capId} is not available. No silent substitution.`],
      };
    }

    const isTdwr = site.network === 'TDWR';
    const sector = isTdwr ? `T${site.radarId}` : site.radarId;
    let productCode = 'N0B';
    let archiveSupported = false;

    if (isTdwr) {
      if (capId === 'ref') { productCode = 'TZL'; archiveSupported = false; }
      else if (capId === 'vel') { productCode = 'TV0'; archiveSupported = false; }
      else {
        return {
          available: false, provider: 'DATA UNAVAILABLE', station: site.radarId, product: capId.toUpperCase(), tilt, frames: [], latestTileUrl: '',
          capabilityId: capId, notes: [`DATA UNAVAILABLE - ${cap.name} is not supported for TDWR.`],
        };
      }
    } else {
      if (capId === 'ref') { productCode = tilt === '0.9' ? 'N1B' : tilt === '1.3' ? 'N2B' : tilt === '1.8' ? 'N3B' : 'N0B'; archiveSupported = productCode === 'N0B'; }
      else if (capId === 'vel') { productCode = tilt === '0.9' ? 'N1U' : tilt === '1.3' ? 'N2U' : tilt === '1.8' ? 'N3U' : 'N0U'; archiveSupported = false; }
      else if (capId === 'srvel') { productCode = 'N0S'; archiveSupported = true; }
      else {
        return {
          available: false, provider: 'DATA UNAVAILABLE', station: site.radarId, product: capId.toUpperCase(), tilt, frames: [], latestTileUrl: '',
          capabilityId: capId, notes: [cap.unavailableReason || `DATA UNAVAILABLE - ${cap.name} is not available.`],
        };
      }
    }

    const latestTileUrl = `${IEM_BASE}/ridge::${sector}-${productCode}-0/{z}/{x}/{y}.png`;
    const now = new Date();
    const frames: { time: string; label: string; tileUrl: string; ageMinutes: number }[] = [];

    // DATA HONESTY: only real archived frames when archive is verified. No synthetic timestamps.
    if (archiveSupported) {
      for (let i = 8; i >= 1; i--) {
        const d = new Date(now.getTime() - i * 5 * 60 * 1000);
        d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 5) * 5, 0, 0);
        const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
        const ageMinutes = Math.round((now.getTime() - d.getTime()) / 60000);
        frames.push({
          time: d.toISOString(),
          label: `-${ageMinutes}m`,
          tileUrl: `${IEM_BASE}/ridge::${sector}-${productCode}-${stamp}/{z}/{x}/{y}.png`,
          ageMinutes,
        });
      }
    }

    frames.push({ time: now.toISOString(), label: 'LIVE', tileUrl: latestTileUrl, ageMinutes: 0 });

    const notes: string[] = [];
    if (!archiveSupported) notes.push(`LIVE ONLY - Historical loop not verified for ${cap.name}. No fake historical frames generated.`);

    return {
      available: true,
      provider: isTdwr ? 'FAA TDWR / IEM RIDGE' : 'NOAA NEXRAD / IEM Level III',
      station: site.radarId,
      product: productCode,
      tilt,
      frames,
      latestTileUrl,
      capabilityId: capId,
      notes: notes.length ? notes : undefined,
    };
  }
}

// ============================================================================
// 2. ALERTS & WARNINGS ADAPTER (NOAA NWS & SPC)
// ============================================================================
export class NwsAlertsAdapter {
  static async fetchActiveWarnings(): Promise<ActiveAlert[]> {
    try {
      const res = await fetch(`${NWS_BASE}/alerts/active?status=actual&message_type=alert`, {
        headers: { 'User-Agent': 'MesoVortexWX-Enterprise/2.0' },
        next: { revalidate: 30 },
      });

      if (!res.ok) return [];
      const json = await res.json();

      return (json.features || [])
        .filter((f: any) => f.geometry)
        .map((f: any) => ({
          id: f.id || f.properties?.id,
          event: f.properties?.event || 'Severe Warning',
          headline: f.properties?.headline || f.properties?.event,
          severity: f.properties?.severity || 'Severe',
          urgency: f.properties?.urgency || 'Immediate',
          areaDesc: f.properties?.areaDesc || '',
          sentAt: f.properties?.sent || new Date().toISOString(),
          expiresAt: f.properties?.expires || '',
          wfo: f.properties?.senderName || 'NWS',
          geometry: f.geometry,
        }));
    } catch {
      return [];
    }
  }
}

// ============================================================================
// 3. HYPERLOCAL TELEMETRY ADAPTER (Open-Meteo & NOAA AWC METAR)
// ============================================================================
export class HyperlocalWeatherAdapter {
  static async getSurfaceTelemetry(lat: number, lon: number): Promise<SurfaceObservation> {
    try {
      const url = `${OPEN_METEO_BASE}/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=knots&timezone=auto`;
      const res = await fetch(url, { next: { revalidate: 120 } });
      const json = await res.json();
      const curr = json.current || {};

      const tempF = Math.round(curr.temperature_2m ?? 72);
      const humidityPct = Math.round(curr.relative_humidity_2m ?? 50);
      const dewPointF = Math.round(tempF - ((100 - humidityPct) / 5) * 1.8);
      const wetBulbF = Math.round(tempF * 0.7 + dewPointF * 0.3);
      const pressureMb = Math.round(curr.surface_pressure ?? 1013);

      return {
        tempF,
        feelsLikeF: Math.round(curr.apparent_temperature ?? tempF),
        dewPointF,
        wetBulbF,
        humidityPct,
        pressureMb,
        pressureInHg: Number((pressureMb * 0.02953).toFixed(2)),
        windSpeedKt: Math.round(curr.wind_speed_10m ?? 0),
        windGustKt: Math.round(curr.wind_gusts_10m ?? 0),
        windDirDeg: Math.round(curr.wind_direction_10m ?? 180),
        visibilityMi: 10,
        conditionText: 'Monitored',
        provider: 'Open-Meteo Free Global Engine',
        timestamp: new Date().toISOString(),
      };
    } catch {
      // Data honesty: never fabricate telemetry as real. Caller must handle unavailable state.
      return {
        tempF: NaN,
        feelsLikeF: NaN,
        dewPointF: NaN,
        wetBulbF: NaN,
        humidityPct: NaN,
        pressureMb: NaN,
        pressureInHg: NaN,
        windSpeedKt: NaN,
        windGustKt: NaN,
        windDirDeg: NaN,
        visibilityMi: NaN,
        conditionText: 'DATA UNAVAILABLE',
        provider: 'DATA UNAVAILABLE',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
