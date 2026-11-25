/**
 * Conservative 2-D continuity velocity dealiasing for one NEXRAD Level-II sweep.
 *
 * Uses radial-to-radial continuity plus along-ray continuity, following the
 * broad principles of WSR-88D velocity dealiasing. This is NOT the ROC/RPG
 * 2DVDA implementation. It has no environmental wind-table reference, so the
 * absolute fold offset of a connected region can remain ambiguous.
 *
 * IMPORTANT: radial.nyquist_velocity must be in m/s. The Level-II RAD block
 * decoded by nexrad-level-2-data stores this as hundredths of m/s; callers
 * must divide the parsed integer by 100.
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
  radialCount: number;
  nyquistRadials: number;
  nyquistMissingRadials: number;
  gatesConsidered: number;
  gatesCorrected: number;
  gatesSuspected: number;
  gatesUnresolved: number;
  correctionRate: number;
  maximumFoldOrder: number;
  quality: "usable" | "partial" | "unavailable";
  limitations: string[];
};
export type DealiasResult<T extends DealiasRadial> = {
  radials: T[];
  diagnostics: DealiasDiagnostics;
};

const MAX_AZIMUTH_GAP_DEG = 3;
const MAX_FOLD_ORDER = 5;
const MIN_CORRECTION_MPS = 2.5;

function circularGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}
function nearestGate(moment: DealiasMoment | undefined, rangeKm: number): number {
  if (!moment?.moment_data?.length || !Number.isFinite(moment.first_gate)
    || !Number.isFinite(moment.gate_size) || !moment.gate_size) return -1;
  const index = Math.round((rangeKm - moment.first_gate!) / moment.gate_size!);
  return index >= 0 && index < moment.moment_data.length ? index : -1;
}
function nearestUnfolded(value: number, reference: number, nyquist: number): { value: number; fold: number } {
  const fold = Math.max(-MAX_FOLD_ORDER, Math.min(MAX_FOLD_ORDER,
    Math.round((reference - value) / (2 * nyquist))));
  return { value: value + 2 * nyquist * fold, fold };
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
  const raw = radials.map(r => [...r.velocity!.moment_data!]);
  const corrected = raw.map(row => [...row]);
  const hasNyquist = nyquist.filter(v => v != null).length;
  const limitations = [
    "This is a continuity-based approximation, not the operational WSR-88D ROC/RPG 2DVDA.",
    "No environmental wind-table or storm-motion reference is used; the absolute fold offset can remain ambiguous.",
    "Strong localized shear, range folding, clutter, missing radials, and low-SNR gates can cause unresolved or incorrect folds.",
    "The first usable radial anchors the fold reference for the sweep; a whole connected region may retain an unknown integer-fold offset.",
  ];
  const baseDiagnostics: DealiasDiagnostics = {
    available: false,
    algorithm: "Radial-to-radial and along-ray continuity fold correction",
    radialCount: radials.length,
    nyquistRadials: hasNyquist,
    nyquistMissingRadials: radials.length - hasNyquist,
    gatesConsidered: 0,
    gatesCorrected: 0,
    gatesSuspected: 0,
    gatesUnresolved: 0,
    correctionRate: 0,
    maximumFoldOrder: 0,
    quality: "unavailable",
    limitations,
  };
  if (radials.length < 3 || hasNyquist < 3) return { radials: input, diagnostics: baseDiagnostics };

  let considered = 0;
  let suspected = 0;
  let unresolved = 0;
  let maxFold = 0;

  // Start with the first radial as the sweep's reference. Unwrap it along
  // range, then propagate the reference around the azimuthal sequence.
  const seedNyquist = nyquist[0];
  if (seedNyquist != null) {
    for (let gate = 1; gate < corrected[0].length; gate++) {
      const value = raw[0][gate];
      const previous = corrected[0][gate - 1];
      if (value == null || previous == null || !Number.isFinite(value) || !Number.isFinite(previous)) continue;
      considered++;
      const candidate = nearestUnfolded(value, previous, seedNyquist);
      if (Math.abs(value - previous) > seedNyquist && Math.abs(candidate.value - previous) < Math.abs(value - previous)) {
        corrected[0][gate] = candidate.value;
        if (candidate.fold !== 0) { suspected++; maxFold = Math.max(maxFold, Math.abs(candidate.fold)); }
      }
    }
  }

  for (let ri = 1; ri < radials.length; ri++) {
    const current = radials[ri];
    const previous = radials[ri - 1];
    const nyq = nyquist[ri];
    if (nyq == null || nyquist[ri - 1] == null
      || circularGap(current.azimuth!, previous.azimuth!) > MAX_AZIMUTH_GAP_DEG) {
      unresolved += raw[ri].filter(v => v != null).length;
      continue;
    }
    for (let gi = 0; gi < raw[ri].length; gi++) {
      const observed = raw[ri][gi];
      if (observed == null || !Number.isFinite(observed)) continue;
      const range = current.velocity!.first_gate! + gi * current.velocity!.gate_size!;
      const previousGate = nearestGate(previous.velocity, range);
      const references: number[] = [];
      if (previousGate >= 0 && corrected[ri - 1][previousGate] != null) {
        references.push(corrected[ri - 1][previousGate]!);
      }
      if (gi > 0 && corrected[ri][gi - 1] != null) references.push(corrected[ri][gi - 1]!);
      if (!references.length) { unresolved++; continue; }
      considered++;
      const reference = median(references);
      const candidate = nearestUnfolded(observed, reference, nyq);
      const rawDifference = Math.abs(observed - reference);
      const correctedDifference = Math.abs(candidate.value - reference);
      if (rawDifference > nyq * 0.9) suspected++;
      // Require a meaningful improvement and reject a candidate that still
      // disagrees strongly with the continuity reference.
      if (candidate.fold !== 0
        && rawDifference - correctedDifference >= MIN_CORRECTION_MPS
        && correctedDifference <= Math.max(nyq * 0.9, 8)) {
        corrected[ri][gi] = candidate.value;
        maxFold = Math.max(maxFold, Math.abs(candidate.fold));
      } else if (rawDifference > nyq * 0.9) {
        unresolved++;
      }
    }
  }

  // A second, reverse pass reduces sensitivity to the arbitrary first radial.
  for (let ri = radials.length - 2; ri >= 0; ri--) {
    const current = radials[ri];
    const nextRadial = radials[ri + 1];
    const nyq = nyquist[ri];
    if (nyq == null || nyquist[ri + 1] == null
      || circularGap(current.azimuth!, nextRadial.azimuth!) > MAX_AZIMUTH_GAP_DEG) continue;
    for (let gi = 0; gi < raw[ri].length; gi++) {
      const observed = raw[ri][gi];
      if (observed == null || !Number.isFinite(observed)) continue;
      const range = current.velocity!.first_gate! + gi * current.velocity!.gate_size!;
      const nextGate = nearestGate(nextRadial.velocity, range);
      if (nextGate < 0 || corrected[ri + 1][nextGate] == null) continue;
      const reference = corrected[ri + 1][nextGate]!;
      const candidate = nearestUnfolded(observed, reference, nyq);
      const rawDifference = Math.abs(observed - reference);
      const correctedDifference = Math.abs(candidate.value - reference);
      if (candidate.fold !== 0 && rawDifference - correctedDifference >= MIN_CORRECTION_MPS
        && correctedDifference <= Math.max(nyq * 0.9, 8)) {
        corrected[ri][gi] = candidate.value;
        maxFold = Math.max(maxFold, Math.abs(candidate.fold));
      }
    }
  }

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
  const changed = corrected.reduce((sum, row, ri) => sum + row.reduce((n, value, gi) =>
    n + (value != null && raw[ri][gi] != null && Math.abs(value - raw[ri][gi]!) > 1e-6 ? 1 : 0), 0), 0);
  return {
    radials: output,
    diagnostics: {
      ...baseDiagnostics,
      available: true,
      gatesConsidered: considered,
      gatesCorrected: changed,
      gatesSuspected: suspected,
      gatesUnresolved: unresolved,
      correctionRate: total ? Number((changed / total).toFixed(4)) : 0,
      maximumFoldOrder: maxFold,
      quality: hasNyquist === radials.length ? "usable" : "partial",
    },
  };
}
