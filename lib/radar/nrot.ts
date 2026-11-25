/**
 * NROT-style normalized azimuthal shear.
 *
 * This is an openly documented approximation, not GR2 Analyst's proprietary
 * NROT implementation. It uses a local quadratic least-squares surface fit
 * over 5x5 polar samples (3x3 fallback), then normalizes azimuthal shear with
 * a published Stumpf-style range curve. It accepts a separate continuity-
 * dealiased velocity field and carries its quality/alias-sensitivity flags.
 */
export type NrotMoment = {
  moment_data?: Array<number | null>;
  first_gate?: number;
  gate_size?: number;
};
export type NrotRadial = {
  azimuth?: number;
  elevation_angle?: number;
  velocity?: NrotMoment;
  reflect?: NrotMoment;
  radial?: { nyquist_velocity?: number };
  velocityDealiased?: boolean;
};
export type NrotPeak = {
  nrot: number;
  azimuthalShearS1: number;
  rangeKm: number;
  bearingDegrees: number;
  elevationDegrees: number | null;
  lat: number;
  lon: number;
  sampleCount: number;
  fitWindow: "5x5" | "3x3";
};
export type NrotResult = {
  available: boolean;
  method: string;
  peaks: NrotPeak[];
  maxCyclonic: number | null;
  maxAnticyclonic: number | null;
  gatesAnalyzed: number;
  gatesExcludedNearRadar: number;
  gatesRejected: number;
  quality: {
    velocityDealiased: boolean;
    nyquistVelocityAvailable: boolean;
    aliasSensitive: boolean;
    minimumRangeKm: number;
  };
};

const EARTH_KM = 6371.0088;
const MIN_RANGE_KM = 8 * 1.609344;
const DEG = Math.PI / 180;

function wrapDelta(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function solve(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map(row => row[n]);
}
function fitQuadratic(samples: Array<{ x: number; y: number; v: number }>): { dx: number; dy: number } | null {
  // v = a + bx + cy + dx² + exy + fy²; coordinates are km from target gate.
  const terms = (x: number, y: number) => [1, x, y, x * x, x * y, y * y];
  const normal = Array.from({ length: 6 }, () => Array(6).fill(0));
  const rhs = Array(6).fill(0);
  for (const sample of samples) {
    const t = terms(sample.x, sample.y);
    for (let i = 0; i < 6; i++) {
      rhs[i] += t[i] * sample.v;
      for (let j = 0; j < 6; j++) normal[i][j] += t[i] * t[j];
    }
  }
  const coefficients = solve(normal, rhs);
  return coefficients ? { dx: coefficients[1], dy: coefficients[2] } : null;
}
function normalizeShear(shearS1: number, rangeKm: number): number {
  // Stumpf-style minimal-mesocyclone shear: 6 m/s/km through 100 km,
  // linearly decreasing to 3 m/s/km at 200 km, then held constant.
  const threshold = rangeKm <= 100 ? 0.006
    : rangeKm >= 200 ? 0.003
      : 0.006 - ((rangeKm - 100) / 100) * 0.003;
  return Math.max(-5, Math.min(5, shearS1 / threshold));
}
function destination(lat: number, lon: number, bearing: number, rangeKm: number) {
  const angular = rangeKm / EARTH_KM;
  const brng = bearing * DEG;
  const lat1 = lat * DEG;
  const lon1 = lon * DEG;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular)
    + Math.cos(lat1) * Math.sin(angular) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(
    Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
    Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
  );
  return {
    lat: Number((lat2 / DEG).toFixed(5)),
    lon: Number((((lon2 / DEG + 540) % 360) - 180).toFixed(5)),
  };
}
function nearestMomentGate(moment: NrotMoment | undefined, rangeKm: number): number {
  if (!moment?.moment_data?.length || !Number.isFinite(moment.first_gate)
    || !Number.isFinite(moment.gate_size) || !moment.gate_size) return -1;
  return Math.round((rangeKm - moment.first_gate!) / moment.gate_size!);
}
function nearestGate(radial: NrotRadial, rangeKm: number): number {
  return nearestMomentGate(radial.velocity, rangeKm);
}

export function calculateNrot(
  input: NrotRadial[],
  radarLat: number,
  radarLon: number,
): NrotResult {
  const radials = input
    .filter(r => Number.isFinite(r.azimuth) && r.velocity?.moment_data?.length
      && Number.isFinite(r.velocity.first_gate) && Number.isFinite(r.velocity.gate_size)
      && (r.velocity.gate_size || 0) > 0)
    .slice()
    .sort((a, b) => (a.azimuth || 0) - (b.azimuth || 0));
  const empty: NrotResult = {
    available: false,
    method: "Local quadratic least-squares azimuthal shear (5x5; 3x3 fallback) on reflectivity >=20 dBZ gates, normalized by a Stumpf-style range threshold. Not GR2 Analyst NROT.",
    peaks: [],
    maxCyclonic: null,
    maxAnticyclonic: null,
    gatesAnalyzed: 0,
    gatesExcludedNearRadar: 0,
    gatesRejected: 0,
    quality: {
      velocityDealiased: radials.length > 0 && radials.every(r => r.velocityDealiased === true),
      nyquistVelocityAvailable: radials.some(r => Number.isFinite(r.radial?.nyquist_velocity)
        && (r.radial?.nyquist_velocity || 0) > 0),
      aliasSensitive: !(radials.length > 0 && radials.every(r => r.velocityDealiased === true)),
      minimumRangeKm: Number(MIN_RANGE_KM.toFixed(2)),
    },
  };
  if (radials.length < 5) return empty;

  const candidates: NrotPeak[] = [];
  let analyzed = 0;
  let near = 0;
  let rejected = 0;
  for (let ri = 0; ri < radials.length; ri++) {
    const center = radials[ri];
    const centerMoment = center.velocity!;
    const gateSize = centerMoment.gate_size!;
    const count = centerMoment.moment_data!.length;
    // Process every second gate to bound CPU cost while preserving useful spatial detail.
    for (let gi = 2; gi < count - 2; gi += 2) {
      const rangeKm = centerMoment.first_gate! + gi * gateSize;
      const reflectGate = nearestMomentGate(center.reflect, rangeKm);
      const reflectivity = reflectGate >= 0 ? center.reflect?.moment_data?.[reflectGate] : null;
      // Focus on meteorological echoes instead of fitting clear-air/noise gates.
      if (reflectivity == null || !Number.isFinite(reflectivity) || reflectivity < 20) continue;
      if (rangeKm < MIN_RANGE_KM) { near++; continue; }
      const bearing = center.azimuth!;
      const rawSamples: Array<{ x: number; y: number; v: number; radialOffset: number; gateOffset: number }> = [];
      for (let ro = -2; ro <= 2; ro++) {
        const rIndex = (ri + ro + radials.length) % radials.length;
        const radial = radials[rIndex];
        const deltaAz = wrapDelta(radial.azimuth!, bearing);
        if (Math.abs(deltaAz) > 2.6) continue;
        const moment = radial.velocity!;
        for (let go = -2; go <= 2; go++) {
          const targetRange = rangeKm + go * gateSize;
          const gate = nearestGate(radial, targetRange);
          if (gate < 0 || gate >= moment.moment_data!.length) continue;
          const velocity = moment.moment_data![gate];
          if (velocity == null || !Number.isFinite(velocity)) continue;
          const sampleRange = moment.first_gate! + gate * moment.gate_size!;
          const az = radial.azimuth! * DEG;
          const x = sampleRange * Math.sin(az) - rangeKm * Math.sin(bearing * DEG);
          const y = sampleRange * Math.cos(az) - rangeKm * Math.cos(bearing * DEG);
          rawSamples.push({ x, y, v: velocity, radialOffset: ro, gateOffset: go });
        }
      }
      const centerValue = centerMoment.moment_data![gi];
      if (centerValue == null || !Number.isFinite(centerValue)) { rejected++; continue; }
      const localMedian = median(rawSamples.map(s => s.v));
      const clean = rawSamples.filter(s => Math.abs(s.v - localMedian) <= 12);
      let samples = clean;
      let fitWindow: "5x5" | "3x3" = "5x5";
      if (samples.length < 15) {
        fitWindow = "3x3";
        samples = clean.filter(s => Math.abs(s.radialOffset) <= 1 && Math.abs(s.gateOffset) <= 1);
      }
      if (samples.length < 7) { rejected++; continue; }
      const gradient = fitQuadratic(samples);
      if (!gradient) { rejected++; continue; }
      // Positive azimuthal derivative is cyclonic in the Northern Hemisphere.
      const theta = bearing * DEG;
      const tangentDerivativeMpsPerKm = gradient.dx * Math.cos(theta) - gradient.dy * Math.sin(theta);
      const shearS1 = tangentDerivativeMpsPerKm / 1000;
      if (!Number.isFinite(shearS1) || Math.abs(shearS1) > 0.1) { rejected++; continue; }
      const nrot = normalizeShear(shearS1, rangeKm);
      const position = destination(radarLat, radarLon, bearing, rangeKm);
      candidates.push({
        nrot: Number(nrot.toFixed(3)),
        azimuthalShearS1: Number(shearS1.toFixed(5)),
        rangeKm: Number(rangeKm.toFixed(2)),
        bearingDegrees: Number(bearing.toFixed(1)),
        elevationDegrees: Number.isFinite(center.elevation_angle) ? Number(center.elevation_angle!.toFixed(2)) : null,
        ...position,
        sampleCount: samples.length,
        fitWindow,
      });
      analyzed++;
    }
  }

  candidates.sort((a, b) => Math.abs(b.nrot) - Math.abs(a.nrot));
  const peaks: NrotPeak[] = [];
  for (const candidate of candidates) {
    if (peaks.some(p => Math.abs(p.rangeKm - candidate.rangeKm) < 2
      && Math.abs(wrapDelta(p.bearingDegrees, candidate.bearingDegrees)) < 3)) continue;
    peaks.push(candidate);
    if (peaks.length >= 20) break;
  }
  const cyclonic = candidates.filter(p => p.nrot > 0);
  const anticyclonic = candidates.filter(p => p.nrot < 0);
  return {
    ...empty,
    available: candidates.length > 0,
    method: empty.method + (empty.quality.velocityDealiased ? ' Velocity was continuity-dealiased.' : ' Velocity was not fully dealiased.'),
    peaks,
    maxCyclonic: cyclonic.length ? Number(Math.max(...cyclonic.map(p => p.nrot)).toFixed(3)) : null,
    maxAnticyclonic: anticyclonic.length ? Number(Math.min(...anticyclonic.map(p => p.nrot)).toFixed(3)) : null,
    gatesAnalyzed: analyzed,
    gatesExcludedNearRadar: near,
    gatesRejected: rejected,
  };
}
