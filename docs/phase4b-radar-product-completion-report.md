# Radar Product Completion Report

Date: 2026-11-24  
Baseline commit: `703689da89cfe37eb0df69a1044104c861ec1050`  
Scope: Phase 4B P1 — finish product metadata and separate products by actual source.

## Objective and boundary

Complete the radar product workstation without adding a new meteorological system, provider, model framework, or experimental AI feature. Phase 4A conclusions remain trusted and were not re-audited. The authoritative source of truth remains `lib/radar/capability-matrix.ts`; the source-based catalog only reorganizes and describes existing products.

## What changed

### Shared source-based catalog

Added `lib/radar/product-catalog.ts` as the single catalog consumed by both `components/WeatherWiseRadarCard.tsx` and `components/FloatingProductPanel.tsx`.

Every entry now declares a domain before any meteorological family:

- **Radar Products** — generated directly from an individual radar site. Categories: Reflectivity, Velocity, Polarimetric Products, Classification Products, Severe Analysis, Tilt Products, and Unverified / Not Claimed.
- **Composite Products** — national mosaic or multi-radar/MRMS processing. Categories: National Mosaic, Rotation Products, Hail Products, Echo Tops, VIL Products, and QPE Products.

Availability, partial status, reason text, and warning text are derived from `getRadarCapability()`, so reorganizing the catalog cannot silently enable a product. National/multi-radar products (`comp_ref`, `azshear`, `rotation_tracks`, `mesh`, `hail_detection`, `tops`, `vil`, `vil_density`, `qpe`, `precip_rate`, `rain_mix_snow`) are not listed under Radar Products. Single-site products (`ref`, `vel`, `srvel`, `cc`, `min_cc`, `zdr`, `kdp`, `sw`, `hhc`, tilt entries, etc.) are not listed under Composite Products.

### Honest composite identity

`comp_ref` continues to resolve to the already-existing national IEM N0Q mosaic through `composite_n0q`. It is documented as a national raster source with no per-site tilt semantics and no verified archive loop; it is not silently migrated from single-site N0B. Entering Composite mode resets the product to `comp_ref`; returning to Radar mode resets it to `ref`. The compact control and `ProductInfoBanner` now both follow the selected product.

### Product metadata and legends

- `ProductInfoBanner.tsx` now reports a `DOMAIN` value (`SINGLE RADAR`, `MULTI-RADAR / MRMS`, or `UNVERIFIED`) from capability source data.
- Legend definitions and descriptions were aligned in `UniversalLegend.tsx`; aliases resolve specialized products before generic reflectivity rules.
- HHC uses a neutral categorical legend rather than an unverified dBZ claim.
- Super-resolution labels and prose were removed from the active UI because `superResolutionSupport` is `UNKNOWN` and the app renders IEM raster tiles. `super_res_ref` and `super_res_vel` are discoverable in the catalog but explicitly unavailable.

## Browser evidence

Captured in the connected Chromium browser at 581×579 with DOM readbacks taken at the same time as each image.

- `docs/phase4b-screenshots/01-radar-product-catalog.png` — expanded Radar drawer. DOM readback: one `RADAR` domain group with 22 entries and categories `Reflectivity`, `Velocity`, `Polarimetric Products`, `Classification Products`, `Severe Analysis`, `Tilt Products`, `Unverified / Not Claimed`. Banner readback: `DOMAIN: SINGLE RADAR`, source `Iowa Environmental Mesonet (IEM) / NOAA NEXRAD`, grid `N0B/N1B/N2B/N3B (NEXRAD), TZL (TDWR)`, elevation `0.5°`.
- `docs/phase4b-screenshots/03-composite-product-catalog.png` — expanded Composite drawer after selecting Rotation Tracks. DOM readback: one `COMPOSITE` group with 11 entries and categories `National Mosaic`, `Rotation Products`, `Hail Products`, `Echo Tops`, `VIL Products`, `QPE Products`; compact control `SELECTION rotation_tracks`; banner `Rotation Tracks`, `DOMAIN: MULTI-RADAR / MRMS`, `SOURCE: NOAA MRMS 30-minute rotation track`, `GRID: RotationTrack30min`, `ELEVATION: National grid / no tilt`.

## Verification

- `npm run typecheck` — PASS.
- `npm run test:verify` — PASS, including `test-product-catalog.mjs`, `test-legend-integrity.mjs`, `test-capability-consistency.mjs`, and `test-capability-matrix.mjs`.
- `npm run build` — PASS.

`npm run test:verify` is a static contract suite; the browser readbacks and retained screenshots above are the UI evidence for this report.

## Files

- `lib/radar/product-catalog.ts` (new)
- `components/WeatherWiseRadarCard.tsx`
- `components/FloatingProductPanel.tsx`
- `components/ProductInfoBanner.tsx`
- `components/UniversalLegend.tsx`
- `lib/radar/capability-matrix.ts`
- `lib/data-sources.ts`
- `app/page.tsx`
- `scripts/test-product-catalog.mjs` (new)
- `scripts/test-legend-integrity.mjs`
- `package.json`
