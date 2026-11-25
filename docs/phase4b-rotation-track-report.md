# Rotation Track Report

Date: 2026-11-24  
Baseline commit: `703689da89cfe37eb0df69a1044104c861ec1050`  
Scope: Phase 4B P3 — rotation-track display.

## Objective and boundary

Expose the existing live MRMS rotation product clearly without inventing mesocyclone IDs, track objects, archive playback, or a new meteorological system. No demo track from `lib/scit-engine.ts` is used as observed data.

## What changed

- `showStormTracks` now drives a dedicated MapLibre raster overlay for the live MRMS `RotationTrack30min` grid through `/api/radar/mrms-tile` and the existing MRMS capability entry.
- The overlay has a compact status/legend surface with `data-rotation-status="mrms"`, product code, verification time, value bins, and an explicit disclaimer: “Rolling grid maximum. No mesocyclone IDs or projected track objects are claimed.”
- When rotation tracks are selected as the base product, the duplicate overlay/status is suppressed.
- The API path retains real GRIB2 decoding and the existing 15-minute staleness gate; no synthetic substitute was added.
- Catalog placement is explicit: rotation tracks are a Composite Product under Rotation Products, not a per-site radar tilt product.

## Browser evidence

- `docs/phase4b-screenshots/04-rotation-overlay.png` — live overlay and status card.
- DOM readback at capture time: `MRMS ROTATION TRACKS`, `30-MIN MAX`, `MRMS-RotationTrack30min · VERIFIED 2026-11-25 03:44:00 UTC`, followed by the no-mesocyclone-IDs/no-track-objects disclaimer.
- Legend title readback included bins for positive and negative 30-minute rotation signal: `+0.002–0.004 s⁻¹`, `+0.004–0.006 s⁻¹`, `+0.006–0.010 s⁻¹`, `≥ +0.010 s⁻¹`, and corresponding negative ranges.

## What is explicitly not claimed

- No individual mesocyclone identity or object trajectory is rendered.
- No historical track playback or archive is provided.
- The 30-minute product is a rolling grid maximum, not a storm-following object track.
- No perceptual or meteorological validation against another workstation was performed.

## Verification

- `npm run typecheck` — PASS.
- `node scripts/test-rotation-workflow.mjs` — PASS.
- `node scripts/test-severe-capabilities.mjs` — PASS.
- `node scripts/test-capability-consistency.mjs` — PASS.
- `npm run test:verify` — PASS.
- `npm run build` — PASS.

## Files

- `components/RadarMap.tsx`
- `app/page.tsx`
- `lib/capabilities/severe-capabilities.ts`
- `lib/radar/capability-matrix.ts`
- `scripts/test-rotation-workflow.mjs` (new)
