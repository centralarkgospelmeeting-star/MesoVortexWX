# Phase 4D — Overlay Profile Report

## Model
`lib/overlay-profiles.ts` defines three modes with explicit defaults:

| Mode | Default visible layers |
|---|---|
| Radar | warnings, spotters, reports, observations, boundaries, radar |
| Satellite | warnings, observations, boundaries, satellite |
| Model | boundaries, forecast overlays |

## Behavior
- Users choose per-mode overlays in Settings → "Overlay profiles by mode".
- Profiles are an **outer gate only**: they can hide a layer that a global switch
  would otherwise show; they never enable a layer the global switch or capability
  matrix marks unavailable.
- The active mode follows the workstation tab (Composite counts as Radar;
  Outlooks counts as Model).
- Choices persist in `localStorage` (`mesovortex_overlay_profiles_v1`) and are
  normalized on load so stale/corrupt values cannot enable unknown layers.

## Verification
`test-phase4d.mjs` asserts mode definitions, defaults, gating expressions, and the
Settings surface. Full gate passed.
