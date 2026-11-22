# Sprint 2 - Data Honesty Follow-up Report

Date: 2026-11-22  
Scope: Repo grep for `fallback|mock|fake|synthetic|demo` outside approved demo modules and known-honest comments. No behavior changes made.

## Approved/Explicitly Labeled Areas (no change)

- `lib/cross-section.ts` - explicitly SYNTHETIC/DEMO, returns `dataHonesty: 'SYNTHETIC'`.
- `components/CrossSectionModal.tsx` - displays SYNTHETIC warning.
- `lib/forecast-engine.ts` - explicitly SYNTHETIC_DEMO, outputs marked `dataHonesty: 'SYNTHETIC_DEMO'`; no production callers found.
- `lib/radar/capability-matrix.ts` - contains data-honesty fields by design.

## Findings (reviewed, no behavior change in Sprint 2)

| File | Match | Assessment | Action |
|---|---|---|---|
| `lib/api-utils.ts` | `errorPayload<T extends object>(fallback...)` | Naming only; generic error helper | No change now; consider rename to `defaults` later |
| `lib/adapters/weather-gateway.ts` | `fallbackObservation` | Possible fabricated baseline observation on failure - needs verification | **Flag for Sprint 3 audit** |
| `lib/alerts/use-fast-alerts.ts` | `fallback` filter defaults | Benign default-state naming | No change |
| `components/SkewTSoundingModal.tsx` | "doesn't look fake" comment | Benign comment | No change |
| `components/RadarMap.tsx` | "Do not fake values" comment | Honest guard | Keep |
| `components/SpotterNetworkPanel.tsx` | "public fallback layer" / "fallback failed" | Naming; verify no fabricated data shown as real | Review in Sprint 3 |
| `app/page.tsx` | "fallback" comments, "No synthetic lightning..." | Mostly benign; confirm no synthetic data display | Keep under review |
| `app/api/spotter/route.ts` | `fallback = description...` | Benign parsing fallback | No change |
| `app/api/radar/tile/route.ts` | "No substitutes, no unrelated fallbacks" comment | Honest guard | Keep |

## Recommendation

Sprint 3 should audit `lib/adapters/weather-gateway.ts` and any UI path that renders fallback observations/telemetry to ensure failures become `DATA UNAVAILABLE`, not fabricated baseline values.
