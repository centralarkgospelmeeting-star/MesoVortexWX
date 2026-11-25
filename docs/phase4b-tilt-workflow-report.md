# Tilt Workflow Report

Date: 2026-11-24  
Baseline commit: `703689da89cfe37eb0df69a1044104c861ec1050`  
Scope: Phase 4B P4 — tilt and volume workflow.

## Objective and boundary

Make tilt selection persistent, capability-derived, and honest about the difference between measured Level II elevations and the fixed renderable IEM codes. No archive loop or 3D volume rendering is claimed.

## What changed

- Tilt is stored in `UserPrefs` with default `0.5`, validated on load from localStorage, initialized from saved preferences, and included in the persistence effect.
- `selectRadarProduct()` resets an unsupported tilt to the first supported code when a product changes. Products with no tilt semantics keep the stored value but display “no tilt” in provenance.
- Tilt controls in `WeatherWiseRadarCard.tsx` come from `getRadarCapability(product)?.tiltSupport`; there is no hardcoded tilt list. TDWR is labeled `TDWR FIXED`.
- `VolumeScanInspector.tsx` was rewritten around `mapMeasuredElevationToTilt()`: measured Level II sweep elevations map to supported renderable codes only within `<= 0.2°`; distant sweeps stay disabled rather than being relabeled.
- The inspector has an explicit close control, live volume metadata, and a moment-selection handler that keeps the inspector open so an operator can continue exploring elevation cuts.
- The frames API returns metadata (`provider`, `product`, `capabilityId`, `tilt`, `network`, `station`, `scanTime`, `playback/archiveSupport`, `verificationLevel`, `loopAvailable: false`) and rejects unsupported tilts.
- Playback fails closed: the card defaults `loopAvailable = false`, play/restart controls are disabled unless the API reports a loop and more than one frame exists, and the compact control labels the metadata as `MASTER TIMELINE PROVENANCE`.

## Browser evidence

- `docs/phase4b-screenshots/02-tilt-volume-inspector.png` — live Level II volume inspector with mapped tilts.
- DOM readback: `LIVE NEXRAD LEVEL II`, `Volume scan · KLZK`, `Little Rock, AR · Scan time 2026-11-25 03:36:15 UTC`, `NOAA NEXRAD Level II on AWS · Live only · 12 sweeps`.
- Mapping readback: measured `0.48° → 0.5°`, `0.88° → 0.9°`, `1.27° → 1.3°`, `1.80° → 1.8°`; sweeps at `2.42°` and above had disabled moment buttons and no mapped tilt.
- Interaction readback: clicking `REF→1.3°720r` kept `data-volume-inspector="open"` and changed the compact control elevation to `1.3°`.
- Frames metadata readback on the radar compact control: `data-frame-metadata-scope="master-timeline"` with `loopAvailable: false`, `playbackSupport: PARTIAL_ARCHIVE`, and `verificationLevel: PARTIALLY_VERIFIED`; play controls were disabled.

## Verification

- `npm run typecheck` — PASS.
- `node scripts/test-tilt-workflow.mjs` — PASS.
- `npm run test:verify` — PASS.
- `npm run build` — PASS.

## Files

- `app/page.tsx`
- `components/WeatherWiseRadarCard.tsx`
- `components/radar/VolumeScanInspector.tsx`
- `app/api/nexrad/frames/route.ts`
- `scripts/test-tilt-workflow.mjs` (new)
