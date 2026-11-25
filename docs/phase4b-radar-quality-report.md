# Radar Quality Report

Date: 2026-11-24  
Baseline commit: `703689da89cfe37eb0df69a1044104c861ec1050`  
Scope: Phase 4B P2 — render-quality audit and conservative display settings.

## Objective and boundary

Improve and document the existing radar raster display path without changing sources, claiming raw Level II super-resolution decoding, or asserting a perceptual A/B result that was not measured. This report records an honesty-focused quality outcome, not a release certification.

## Implemented display contract

`lib/radar/render-config.ts` now centralizes raster display settings:

- radar tile size: **256 px**, matching the IEM RIDGE raster tile path actually used;
- radar resampling: **`nearest`**, preserving value edges at overzoom;
- satellite resampling remains `linear` because it is a different source class;
- raster fade duration: **0**, avoiding fade softening between refreshed tiles;
- no radar `maxzoom` cap is set, so overzoom behavior is preserved rather than silently truncated.

`components/RadarMap.tsx` consumes `getRadarRasterRenderConfig({ mode, product })` for both source configuration and paint properties. The render config explicitly states that it is display-only and never changes capability availability, archive support, or verification level.

## Honest claims removed or constrained

- Removed active UI/prose claims of “Super-Resolution” from card, floating panel, quad view, and data-source copy. The capability matrix records `superResolutionSupport: UNKNOWN`/`N/A`, and the app renders IEM-provided raster tiles.
- Added explicit `super_res_ref` and `super_res_vel` catalog entries marked `UNAVAILABLE` with `UNVERIFIED` support so the products are discoverable but not selectable.
- Corrected MRMS/NEXRAD provenance prose in `lib/data-sources.ts`; Composite N0Q is described as the existing national IEM mosaic, not a silent migration of single-site N0B.
- Product banners and legends now state when no verified scale exists instead of falling back to reflectivity.

## Known limitations retained

The read-only audit also observed that the derived `max_ref`/`ref_x` canvas helpers in `lib/max-reflectivity.ts` draw into 512×512 canvases and receive reflectivity frame URLs from the frames API. Those URLs are MapLibre templates containing `{z}/{x}/{y}` when the frame is a live raster tile. Phase 4B did **not** add a new decoded full-domain source or claim that these derived paths are independently verified super-resolution products. They remain tied to the real reflectivity source and are not used as evidence for a quality upgrade.

No perceptual A/B test against another radar workstation was performed. No claim of parity with RadarScope or WeatherWise is made.

## Evidence

- `docs/phase4b-screenshots/01-radar-product-catalog.png` — product drawer and banner with source/grid/elevation readback; radar products show explicit availability and no super-resolution enablement.
- `docs/phase4b-screenshots/04-rotation-overlay.png` — live raster overlays rendered through the same explicit resampling policy; DOM readback reported `MRMS-RotationTrack30min · VERIFIED 2026-11-25 03:44:00 UTC` and the no-track-objects disclaimer.

Static guard evidence: `scripts/test-radar-render-config.mjs` asserts nearest radar resampling, linear satellite resampling, configured tile size, no maxzoom cap in the documented contract, RadarMap consumption of the config, and absence of super-resolution claims in UI/prose files.

## Verification

- `npm run typecheck` — PASS.
- `node scripts/test-radar-render-config.mjs` — PASS.
- `npm run test:verify` — PASS.
- `npm run build` — PASS.

## Files

- `lib/radar/render-config.ts`
- `components/RadarMap.tsx`
- `components/WeatherWiseRadarCard.tsx`
- `components/FloatingProductPanel.tsx`
- `components/SynchronizedQuadView.tsx`
- `lib/data-sources.ts`
- `scripts/test-radar-render-config.mjs`
