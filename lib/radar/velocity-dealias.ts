/**
 * Conservative two-dimensional Doppler velocity dealiasing for NEXRAD Level-II.
 *
 * This is an application-level, region-continuity approximation inspired by
 * WSR-88D 2-D dealiasing concepts. It is NOT the ROC/RPG 2DVDA implementation.
 * Nyquist velocity must be supplied in m/s (the Level-II RAD block stores it
 * in hundredths of m/s in the parser used by this project).
 *
 * The routine preserves the original moment arrays and returns a separate
 * corrected copy. It refuses to guess when Nyquist metadata or local support
 * is inadequate, and reports suspect/unresolved gates rather than forcing
 * every sample into a smooth field.
 */
export type DealiasMoment = {
  moment_data?: Array<number | null>;
  first_gate?: number;
  gate_size?: number;
};
export type DealiasRadial = {
  azimuth?: number;
  velocity?: DealiasMoment;
  radial?: { nyquist_velocity?: number };
};
export type DealiasDiagnostics = {
  available: boolean;
  algorithm: string;
  iterations: number;
  radialCount: number;
  nyquistRadials: number;
  nyquistMissingRadials: number;
  gatesConsidered: number;
  gatesCorrected: number;
  gatesSuspected: number;
  gatesUnresolved: number;
  correctionRate: number;
  quality: "usable" | "partial" | "unavailable";
  limitations: string[];
};
export type DealiasResult<T extends DealiasRadial> = {
  radials: T[];
  diagnostics: DealiasDiagnostics;
};

const MAX_AZIMUTH_GAP_DEG = 3.0;
const MIN_NEIGHBORS = 3;
const MAX_FOLD_ORDER = 4;
const ITERATIONS = 5;

function circularGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function nearestGate(moment: DealiasMoment | undefined, rangeKm: number): number {
  if (!moment?.moment_data?.length || !Number.isFinite(moment.first_gate)
    || !Number.isFinite(moment.gate_size) || !moment.gate_size) return -1;
  const gate = Math.round((rangeKm - moment.first_gate!) / moment.gate_size!);
  return gate >= 0 && gate < moment.moment_data.length ? gate : -1;
}
function robustCost(candidate: number, neighbors: number[], scale: number): number {
  // Huber loss limits the influence of a real, sharp velocity gradient.
  const knee = Math.max(4, scale * 0.45);
  return neighbors.reduce((sum, value) => {
    const d = Math.abs(candidate - value);
    return sum + (d <= knee ? 0.5 * d * d : knee * (d - 0.5 * knee));
  }, 0) / neighbors.length;
}

export function dealiasVelocity<T extends DealiasRadial>(input: T[]): DealiasResult<T> {
  const ordered = input.map((radial, originalIndex) => ({ radial, originalIndex }))
    .filter(item => Number.isFinite(item.radial.azimuth) && item.radial.velocity?.moment_data?.length)
    .sort((a, b) => a.radial.azimuth! - b.radial.azimuth!);
  const radials = ordered.map(item => item.radial);
  const nyquist = radials.map(r => {
    const value = r.radial?.nyquist_velocity;
    return Number.isFinite(value) && (value || 0) > 0 ? value! : null;
  });
  const corrected = radials.map(r => [...r.velocity!.moment_data!]);
  const raw = radials.map(r => [...r.velocity!.moment_data!]);
  const hasNyquist = nyquist.filter(v => v != null).length;
  let considered = 0;
  let suspected = 0;
  let correctedCount = 0;
  let unresolved = 0;

  const emptyDiagnostics: DealiasDiagnostics = {
    available: false,
    algorithm: "Conservative 2-D local-continuity fold selection; not ROC/RPG 2DVDA",
    iterations: 0,
    radialCount: radials.length,
    nyquistRadials: hasNyquist,
    nyquistMissingRadials: radials.length - hasNyquist,
    gatesConsidered: 0,
    gatesCorrected: 0,
    gatesSuspected: 0,
    gatesUnresolved: 0,
    correctionRate: 0,
    quality: "unavailable",
    limitations: [
      "No environmental wind-table or storm-motion reference is applied; absolute fold offset can remain ambiguous.",
      "Sharp shear, range-folded echoes, clutter, and sparse radial coverage can defeat local-continuity methods.",
      "This is not the operational WSR-88D ROC/RPG 2DVDA algorithm.",
    ],
  };
  if (radials.length < 3 || hasNyquist < 3) {
    return { radials: input, diagnostics: emptyDiagnostics };
  }

  const neighborGates = (ri: number, gi: number): number[] => {
    const current = radials[ri].velocity!;
    const range = current.first_gate! + gi * current.gate_size!;
    const neighbors: number[] = [];
    // Along-ray continuity.
    if (gi > 0 && corrected[ri][gi - 1] != null) neighbors.push(corrected[ri][gi - 1]!);
    if (gi + 1 < corrected[ri].length && corrected[ri][gi + 1] != null) neighbors.push(corrected[ri][gi + 1]!);
    // Adjacent-ray continuity at approximately the same physical range.
    for (const offset of [-1, 1]) {
      const rIndex = (ri + offset + radials.length) % radials.length;
      if (circularGap(radials[ri].azimuth!, radials[rIndex].azimuth!) > MAX_AZIMUTH_GAP_DEG) continue;
      const gate = nearestGate(radials[rIndex].velocity, range);
      if (gate >= 0 && corrected[rIndex][gate] != null) neighbors.push(corrected[rIndex][gate]!);
    }
    return neighbors;
  };

  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const next = corrected.map(values => [...values]);
    let changed = 0;
    for (let ri = 0; ri < radials.length; ri++) {
      const radialNyquist = nyquist[ri];
      if (radialNyquist == null) continue;
      const velocity = raw[ri];
      for (let gi = 1; gi < velocity.length - 1; gi++) {
        const observed = velocity[gi];
        if (observed == null || !Number.isFinite(observed)) continue;
        const neighbors = neighborGates(ri, gi);
        if (neighbors.length < MIN_NEIGHBORS) continue;
        considered++;
        const center = median(neighbors);
        const mad = median(neighbors.map(v => Math.abs(v - center)));
        const spreadLimit = Math.max(8, radialNyquist * 0.65);
        if (mad > spreadLimit) {
          if (Math.abs(observed - center) > radialNyquist * 0.9) suspected++;
          unresolved++;
          continue;
        }
        const baseline = robustCost(observed, neighbors, radialNyquist);
        if (Math.abs(observed - center) <= radialNyquist * 0.9) continue;
        suspected++;
        const baseFold = Math.round((center - observed) / (2 * radialNyquist));
        let best = observed;
        let bestCost = baseline;
        for (let fold = Math.max(-MAX_FOLD_ORDER, baseFold - 1);
          fold <= Math.min(MAX_FOLD_ORDER, baseFold + 1); fold++) {
          const candidate = observed + 2 * radialNyquist * fold;
          const cost = robustCost(candidate, neighbors, radialNyquist);
          if (cost < bestCost) {
            best = candidate;
            bestCost = cost;
          }
        }
        const requiredImprovement = Math.max(2, radialNyquist * 0.12);
        if (best !== observed && baseline - bestCost >= requiredImprovement) {
          next[ri][gi] = best;
          changed++;
        } else {
          unresolved++;
        }
      }
    }
    for (let ri = 0; ri < corrected.length; ri++) corrected[ri] = next[ri];
    correctedCount += changed;
    if (changed === 0) break;
  }

  // Preserve original radial order and all original fields; replace only the
  // velocity moment array on a cloned radial object.
  const output = input.map(radial => ({ ...radial }));
  for (let sortedIndex = 0; sortedIndex < ordered.length; sortedIndex++) {
    const originalIndex = ordered[sortedIndex].originalIndex;
    const sourceMoment = input[originalIndex].velocity!;
    output[originalIndex] = {
      ...output[originalIndex],
      velocity: { ...sourceMoment, moment_data: corrected[sortedIndex] },
    };
  }
  const total = corrected.reduce((sum, row) => sum + row.filter(v => v != null).length, 0);
  const changedGates = corrected.reduce((sum, row, ri) => sum + row.reduce((n, v, gi) =>
    n + (v != null && raw[ri][gi] != null && Math.abs(v - raw[ri][gi]!) > 1e-6 ? 1 : 0), 0), 0);
  const diagnostics: DealiasDiagnostics = {
    ...emptyDiagnostics,
    available: true,
    iterations: ITERATIONS,
    gatesConsidered: considered,
    gatesCorrected: changedGates,
    gatesSuspected: suspected,
    gatesUnresolved: unresolved,
    correctionRate: total ? Number((changedGates / total).toFixed(4)) : 0,
    quality: hasNyquist === radials.length ? "usable" : "partial",
  };
  return { radials: output, diagnostics };
}
