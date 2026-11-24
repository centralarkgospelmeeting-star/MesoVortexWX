import { RADAR_SITES, type RadarSite } from '../radar-config';

export type PolarMoment = 'cc' | 'zdr' | 'kdp' | 'sw' | 'gate';

type Moment = { moment_data?: Array<number | null>; gate_size?: number; first_gate?: number };
type Radial = { azimuth?: number; elevation_angle?: number; rho?: Moment; zdr?: Moment; phi?: Moment; spectrum?: Moment; velocity?: Moment };
type Level2Volume = {
  data: Array<Array<{ record?: Radial }> | undefined>;
  listElevations(): number[];
};

export interface PolarTileFrame {
  volume: Level2Volume;
  time: string;
  site: RadarSite;
}

type CacheItem = { at: number; promise: Promise<PolarTileFrame> };
const VOLUME_CACHE = new Map<string, CacheItem>();
const VOLUME_TTL_MS = 45_000;
const LEVEL2 = 'https://unidata-nexrad-level2.s3.amazonaws.com';

function siteFor(id: string): RadarSite | undefined {
  const key = id.toUpperCase();
  return RADAR_SITES.find((site) => site.network === 'NEXRAD' && (site.id === key || site.radarId === key || site.radarId === key.replace(/^K/, '')));
}

function s3Keys(xml: string): string[] {
  return Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g), (match) => match[1]);
}

async function latestObject(site: RadarSite): Promise<{ key: string; time: Date }> {
  const now = new Date();
  for (const dayOffset of [0, 1]) {
    const date = new Date(now.getTime() - dayOffset * 86_400_000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const prefix = `${y}/${m}/${d}/${site.id}/`;
    const url = `${LEVEL2}/?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Level II index returned ${res.status}`);
    const keys = s3Keys(await res.text()).filter((key) => /_V0[0-9]$/.test(key));
    for (const key of keys.reverse()) {
      const match = key.match(/(\d{8})_(\d{6})_V\d+$/);
      if (!match) continue;
      const time = new Date(`${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}T${match[2].slice(0, 2)}:${match[2].slice(2, 4)}:${match[2].slice(4, 6)}Z`);
      if (now.getTime() - time.getTime() <= 20 * 60_000) return { key, time };
    }
  }
  throw new Error(`No Level II volume scan for ${site.id} has arrived in the last 20 minutes`);
}

async function loadVolume(site: RadarSite): Promise<PolarTileFrame> {
  const cached = VOLUME_CACHE.get(site.id);
  if (cached && Date.now() - cached.at < VOLUME_TTL_MS) return cached.promise;

  const promise = (async () => {
    const { key, time } = await latestObject(site);
    const res = await fetch(`${LEVEL2}/${key.split('/').map(encodeURIComponent).join('/')}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`Level II scan download returned ${res.status}`);
    if (Number(res.headers.get('content-length') || 0) > 50_000_000) throw new Error('Level II scan exceeds the 50 MB safety limit');
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 50_000_000) throw new Error('Level II scan exceeds the 50 MB safety limit');

    // nexrad-level-2-data is CommonJS and has no bundled TypeScript declarations.
    // It decodes NOAA Level II RHO, ZDR, and PHI moments; KDP is calculated below.
    const { Level2Radar } = require('nexrad-level-2-data') as {
      Level2Radar: new (file: Buffer, options: { logger: false }) => Level2Volume;
    };
    const volume = new Level2Radar(buffer, { logger: false });
    if (!volume.listElevations().length) throw new Error('Downloaded Level II volume contains no radar elevations');
    return { volume, time: time.toISOString(), site };
  })();

  VOLUME_CACHE.set(site.id, { at: Date.now(), promise });
  try {
    return await promise;
  } catch (error) {
    VOLUME_CACHE.delete(site.id);
    throw error;
  }
}

function bestElevation(volume: Level2Volume, degrees: number): Radial[] {
  let best: Radial[] = [];
  let bestDifference = Number.POSITIVE_INFINITY;
  for (const elevation of volume.listElevations()) {
    const radials = (volume.data[elevation] || []).map((item) => item.record).filter((record): record is Radial => Boolean(record));
    const angles = radials.map((radial) => radial.elevation_angle).filter((angle): angle is number => Number.isFinite(angle));
    if (!angles.length) continue;
    const angle = angles.reduce((sum, value) => sum + value, 0) / angles.length;
    const difference = Math.abs(angle - degrees);
    if (difference < bestDifference) {
      bestDifference = difference;
      best = radials;
    }
  }
  return best;
}

function momentFor(radial: Radial, product: PolarMoment): Moment | undefined {
  if (product === 'cc') return radial.rho;
  if (product === 'zdr') return radial.zdr;
  if (product === 'sw') return radial.spectrum;
  if (product === 'gate') return radial.velocity;
  return radial.phi;
}

function unwrapPhase(data: Array<number | null>): Float64Array {
  const output = new Float64Array(data.length);
  output.fill(Number.NaN);
  let offset = 0;
  let previous: number | undefined;
  for (let i = 0; i < data.length; i++) {
    const raw = data[i];
    if (raw == null || !Number.isFinite(raw)) {
      previous = undefined;
      offset = 0;
      continue;
    }
    let current = raw + offset;
    if (previous !== undefined) {
      const delta = current - previous;
      if (delta > 180) { offset -= 360; current -= 360; }
      else if (delta < -180) { offset += 360; current += 360; }
    }
    output[i] = current;
    previous = current;
  }
  return output;
}

function deriveKdp(phase: Array<number | null>, gateSizeKm: number): Float32Array {
  const unwrapped = unwrapPhase(phase);
  const result = new Float32Array(phase.length);
  result.fill(Number.NaN);
  const halfWindow = 3; // 7 gates = 1.75 km at 250 m gate spacing.
  for (let center = halfWindow; center < phase.length - halfWindow; center++) {
    let count = 0, sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
    for (let i = center - halfWindow; i <= center + halfWindow; i++) {
      if (!Number.isFinite(unwrapped[i])) continue;
      const x = (i - center) * gateSizeKm;
      const y = unwrapped[i];
      count++; sumX += x; sumY += y; sumXX += x * x; sumXY += x * y;
    }
    const denominator = count * sumXX - sumX * sumX;
    if (count < 5 || denominator === 0) continue;
    const slope = (count * sumXY - sumX * sumY) / denominator;
    const kdp = slope / 2;
    if (Number.isFinite(kdp) && kdp >= -10 && kdp <= 20) result[center] = kdp;
  }
  return result;
}

function nearestRadial(radials: Radial[], bearing: number): Radial | undefined {
  let low = 0, high = radials.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((radials[middle].azimuth || 0) < bearing) low = middle + 1;
    else high = middle;
  }
  const candidates = [radials[(low - 1 + radials.length) % radials.length], radials[low % radials.length]];
  let best: Radial | undefined;
  let bestDifference = 360;
  for (const radial of candidates) {
    if (!radial || !Number.isFinite(radial.azimuth)) continue;
    const raw = Math.abs((radial.azimuth as number) - bearing);
    const difference = Math.min(raw, 360 - raw);
    if (difference < bestDifference) { best = radial; bestDifference = difference; }
  }
  return bestDifference <= 1.1 ? best : undefined;
}

function destination(lat: number, lon: number, targetLat: number, targetLon: number) {
  const rad = Math.PI / 180;
  const dLat = (targetLat - lat) * rad;
  const dLon = (targetLon - lon) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(targetLat * rad) * Math.sin(dLon / 2) ** 2;
  const distanceKm = 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const yy = Math.sin(dLon) * Math.cos(targetLat * rad);
  const xx = Math.cos(lat * rad) * Math.sin(targetLat * rad) - Math.sin(lat * rad) * Math.cos(targetLat * rad) * Math.cos(dLon);
  const bearing = (Math.atan2(yy, xx) / rad + 360) % 360;
  return { distanceKm, bearing };
}

export function level2RgbaTile(frame: PolarTileFrame, product: PolarMoment, tilt: number, z: number, x: number, y: number, size = 256): Uint8Array {
  const radials = bestElevation(frame.volume, tilt).filter((radial) => Number.isFinite(radial.azimuth)).sort((a, b) => (a.azimuth || 0) - (b.azimuth || 0));
  const first = radials.find((radial) => momentFor(radial, product)?.moment_data?.length);
  const firstMoment = first && momentFor(first, product);
  if (!first || !firstMoment?.moment_data) throw new Error(`${product.toUpperCase()} is not present in the ${tilt}° Level II scan`);
  const gateSizeKm = firstMoment.gate_size || 0.25;
  const firstGateKm = firstMoment.first_gate || 2.125;
  const extent = Math.pow(2, z);
  const rgba = new Uint8Array(size * size * 4);
  const samples = new Map<Radial, Float32Array>();

  for (let py = 0; py < size; py++) {
    const tileY = y + (py + 0.5) / size;
    const lat = (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / extent)));
    for (let px = 0; px < size; px++) {
      const tileX = x + (px + 0.5) / size;
      const lon = tileX / extent * 360 - 180;
      const { distanceKm, bearing } = destination(frame.site.lat, frame.site.lon, lat, lon);
      if (distanceKm < firstGateKm - gateSizeKm / 2 || distanceKm > 460) continue;
      const radial = nearestRadial(radials, bearing);
      if (!radial) continue;
      const moment = momentFor(radial, product);
      if (!moment?.moment_data) continue;
      const gate = Math.round((distanceKm - firstGateKm) / gateSizeKm);
      if (gate < 0 || gate >= moment.moment_data.length) continue;
      let values = samples.get(radial);
      if (!values) {
        values = product === 'kdp' ? deriveKdp(moment.moment_data, moment.gate_size || gateSizeKm) : Float32Array.from(moment.moment_data, (value) => value == null ? Number.NaN : value);
        samples.set(radial, values);
      }
      const value = values[gate];
      if (product === 'kdp') {
        const rho = radial.rho?.moment_data?.[gate];
        // Suppress noisy phase-gradient estimates where polarimetric echoes are
        // poorly correlated; KDP from clear-air/noise gates is not useful.
        if (rho == null || !Number.isFinite(rho) || rho < 0.8) continue;
      }
      const gateShearKt = product === 'gate' && Number.isFinite(values[gate + 1])
        ? Math.abs(values[gate + 1] - value) * 1.94384
        : Number.NaN;
      const color = product === 'cc' ? ccColor(value) : product === 'zdr' ? zdrColor(value) : product === 'sw' ? spectrumWidthColor(value) : product === 'gate' ? gateShearColor(gateShearKt) : kdpColor(value);
      const offset = (py * size + px) * 4;
      rgba[offset] = color[0]; rgba[offset + 1] = color[1]; rgba[offset + 2] = color[2]; rgba[offset + 3] = color[3];
    }
  }
  return rgba;
}

function spectrumWidthColor(value: number): [number, number, number, number] {
  if (!Number.isFinite(value) || value < 0 || value > 30) return [0, 0, 0, 0];
  if (value < 1) return [40, 90, 210, 150];
  if (value < 2) return [0, 190, 220, 170];
  if (value < 4) return [0, 200, 80, 180];
  if (value < 8) return [220, 220, 0, 190];
  if (value < 12) return [255, 140, 0, 195];
  if (value < 20) return [230, 30, 20, 200];
  return [190, 0, 200, 205];
}

function gateShearColor(value: number): [number, number, number, number] {
  if (!Number.isFinite(value) || value < 10) return [0, 0, 0, 0];
  if (value < 20) return [0, 190, 220, 170];
  if (value < 30) return [0, 200, 80, 185];
  if (value < 40) return [230, 220, 0, 195];
  if (value < 50) return [255, 130, 0, 205];
  if (value < 60) return [230, 20, 20, 210];
  return [190, 0, 200, 215];
}

function ccColor(value: number): [number, number, number, number] {
  if (!Number.isFinite(value) || value < 0.5 || value > 1.05) return [0, 0, 0, 0];
  if (value >= 0.99) return [255, 255, 255, 220];
  if (value >= 0.97) return [0, 255, 255, 210];
  if (value >= 0.95) return [0, 100, 255, 205];
  if (value >= 0.90) return [0, 190, 0, 200];
  if (value >= 0.85) return [255, 220, 0, 195];
  if (value >= 0.80) return [255, 128, 0, 190];
  return [220, 0, 0, 180];
}

function zdrColor(value: number): [number, number, number, number] {
  if (!Number.isFinite(value) || value < -8 || value > 8) return [0, 0, 0, 0];
  if (value < -1) return [130, 70, 200, 170];
  if (value < 0) return [40, 120, 255, 175];
  if (value < 0.5) return [0, 190, 220, 180];
  if (value < 1) return [0, 200, 0, 185];
  if (value < 2) return [180, 230, 0, 190];
  if (value < 3) return [255, 200, 0, 195];
  if (value < 4) return [255, 100, 0, 200];
  if (value < 5) return [230, 0, 0, 205];
  return [190, 0, 210, 210];
}

function kdpColor(value: number): [number, number, number, number] {
  if (!Number.isFinite(value) || value < -2 || value > 10) return [0, 0, 0, 0];
  if (value < -0.5) return [120, 0, 180, 180];
  if (value < 0) return [60, 80, 230, 180];
  if (value < 0.5) return [0, 180, 220, 180];
  if (value < 1) return [0, 200, 0, 185];
  if (value < 2) return [190, 230, 0, 190];
  if (value < 3) return [255, 200, 0, 195];
  if (value < 5) return [255, 100, 0, 200];
  return [220, 0, 0, 205];
}

export async function fetchLevel2Frame(siteId: string): Promise<PolarTileFrame> {
  const site = siteFor(siteId);
  if (!site) throw new Error(`Unknown NEXRAD site "${siteId}"`);
  return loadVolume(site);
}
