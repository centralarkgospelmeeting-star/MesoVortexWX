/**
 * National Weather Watcher summary builder.
 *
 * Pure, deterministic deduplication and ranking over Layer 2 detections. The
 * watcher does not scan unverified sources, does not treat the MRMS rotation
 * raster as object tracks, and emits no gated severe summaries.
 */

import type { Detection, DetectionConfidence, WatcherSummary } from './types';
import { stableHash, truncate, unique } from './util';

export type WatcherState = Record<string, number>;

export type WatcherOptions = {
  now?: number;
  state?: WatcherState;
  windowMs?: number;
  limit?: number;
};

const CONFIDENCE_WEIGHT: Record<DetectionConfidence, number> = {
  HIGH: 4,
  MODERATE: 3,
  LOW: 2,
  UNKNOWN: 1,
};

const HEADLINES: Record<string, string> = {
  'strong-reflectivity-core': 'Strong reflectivity sampled',
  'strong-echo-coverage': 'Broad strong echo coverage',
  'velocity-couplet-screening': 'Velocity couplet screening signal',
  'gate-to-gate-shear': 'Elevated adjacent-radial shear',
  'normalized-rotation-proxy': 'Normalized rotation proxy elevated',
  'lower-correlation-coefficient': 'Lower correlation coefficient sampled',
  'lightning-density': 'Concentrated lightning activity',
  'spc-categorical-guidance': 'Elevated categorical guidance',
  'active-official-warning': 'Active official warning',
  'flash-flood-warning-context': 'Flash flood warning context',
};

function recencyScore(detection: Detection, now: number): number {
  const time = Date.parse(detection.observedAt);
  if (!Number.isFinite(time)) return 0;
  const minutes = Math.max(0, (now - time) / 60_000);
  return Math.max(0, 12 - minutes / 5);
}

export function buildWatcherSummaries(
  detections: Detection[],
  options: WatcherOptions = {}
): { summaries: WatcherSummary[]; state: WatcherState } {
  const now = options.now ?? Date.now();
  const windowMs = options.windowMs ?? 10 * 60_000;
  const limit = options.limit ?? 8;
  const state: WatcherState = { ...(options.state ?? {}) };

  const ranked = [...detections]
    .filter((detection) => !/(tvs|debris|tornado on the ground|mesocyclone object|projected path)/i.test(`${detection.kind} ${detection.evidence.join(' ')}`))
    .sort((a, b) => {
      const score = (detection: Detection) =>
        CONFIDENCE_WEIGHT[detection.confidence] * 10
        + recencyScore(detection, now)
        + Math.min(6, detection.evidence.length);
      return score(b) - score(a);
    });

  const summaries: WatcherSummary[] = [];
  for (const detection of ranked) {
    const key = `${detection.kind}:${detection.sourceRef}`;
    const last = state[key];
    if (typeof last === 'number' && now - last < windowMs) continue;
    if (summaries.length >= limit) break;

    summaries.push({
      id: stableHash({ key, observedAt: detection.observedAt, evidence: detection.evidence }),
      headline: HEADLINES[detection.kind] || detection.kind.replace(/-/g, ' '),
      detail: truncate(detection.evidence[0] || detection.sourceRef, 240),
      confidence: detection.confidence,
      sources: unique([detection.sourceRef]),
      observedAt: detection.observedAt,
      caveats: unique([...detection.caveats, 'Watcher summary is not an official warning or an object track.']),
      generatedAt: new Date(now).toISOString(),
    });
    state[key] = now;
  }

  return { summaries, state };
}
