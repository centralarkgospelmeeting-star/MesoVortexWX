# Supercell-Wx Reference Integration Notes

Date: 2026-11-22  
Source reviewed: https://github.com/dpaulat/supercell-wx (MIT, Copyright 2021-2026 Dan Paulat)  
MesoVortexWX license: MIT (compatible). See `THIRD_PARTY_NOTICES.md`.

## Purpose

Use Supercell-Wx as a **reference architecture/pattern source** for MesoVortexWX radar improvements. This is not a drop-in port: Supercell-Wx is C++/Qt/OpenGL with raw NEXRAD Level 2/3 decoding; MesoVortexWX is Next.js/TypeScript/MapLibre with verified raster tile/API sources.

## Data-Honesty Constraints (non-negotiable)

- `lib/radar/capability-matrix.ts` is the single radar authority.
- Unknown/unverified = `UNAVAILABLE`. No silent substitution, no synthetic/fake data presented as real, no fake playback.
- A product is not enabled until source, units, legend, archive/timestamp, playback, API, and UI are verified end-to-end.
- Any derived product must be labeled derived, include algorithm/provenance, and pass validation before `WORKING`.

## Pattern Mapping

| Supercell-Wx pattern | Observed in Supercell-Wx | MesoVortexWX application | Status |
|---|---|---|---|
| Radar product view separation | `RadarProductView` manages selected time, sweep compute, smoothing, color-table LUT/threshold, load status | Keep render config and product state separate from map layer wiring; centralize radar raster render decisions in `lib/radar/render-config.ts` | Partially applied |
| Explicit load status | `RadarProductLoadStatus` enum | Routes already return `available/reason/playbackSupport/archiveSupport/verificationLevel`; UI should surface them consistently | Existing, can improve |
| Color table LUT / threshold / moment scaling | Color table min/max, threshold, moment offset/scale uniforms | For future decoded-moment pipeline: product-aware legends/units. For current raster tiles: do not fabricate bin values; preserve source legend semantics | Planning only for decoded path |
| Sweep update/retry | `UpdateSweep` defers if locked, schedules retry | `RadarMap.tsx` already has tile error/debounce handling; can add explicit stale-refresh/retry semantics when needed | Existing partial |
| Mouse picking / inspection | Bin level/value/code, distance, beam height estimate with unit settings | Current raster PNG tiles are not authoritative scientific bins. Inspection must be labeled accordingly unless verified value API exists | Blocked for scientific value picking |
| CFP/gate filtering concept | CFP enabled/data buffers in layer | Gate filtering only for verified data with clear semantics; no silent masking | Unavailable until verified pipeline |
| Level 2/3 record metadata | `RadarProductRecord` extracts product code/site/time/group | Useful checklist if MesoVortexWX ever adds raw ingest; current sources are IEM RIDGE/NWS/MRMS APIs | Not implemented |

## Product Feasibility (requested list)

| Product | Current MesoVortexWX status | Supercell-Wx reference value | Blockers before enablement |
|---|---|---|---|
| Correlation Coefficient (CC) | UNAVAILABLE | Generic moment render/LUT/picking pattern | Verified CC source, 0-1 units, legend, QC/gates, archive/playback |
| Differential Reflectivity (ZDR) | UNAVAILABLE | Generic moment render/LUT pattern | Verified ZDR source, dB units, legend, calibration/QA |
| Specific Differential Phase (KDP) | UNAVAILABLE | Generic moment render/LUT pattern | Verified KDP source, deg/km units, smoothing/quality handling |
| Hydrometeor Classification (HCA) | UNAVAILABLE | Categorical product display pattern | Verified HCA source, class legend/mapping, categorical rendering |
| Spectrum Width | UNAVAILABLE | Generic moment render pattern | Verified SW source/code, m/s units, legend |
| Normalized Rotation (NROT) | UNAVAILABLE | Derived/display pattern only; not authoritative source by itself | Authoritative definition/algorithm, derived labeling, validation, never alias to velocity |
| Azimuthal Shear | UNAVAILABLE | Derived/display pattern only | Verified MRMS/source or validated derivation, units/legend, accumulation semantics |
| Reflectivity Cross Sections | UNAVAILABLE (`lib/cross-section.ts` is SYNTHETIC) | Conceptual volume-slice UI only | Real 3D volumetric data pipeline; no synthetic cross-sections as real |
| Maximum Reflectivity | PARTIAL (derived from real reflectivity) | Low | Keep provenance/labeling, perf and QA |
| Min Correlation Coefficient | UNAVAILABLE | Depends on CC | Verified CC volume, explicit min-over-depth/time definition |
| Echo Tops | UNAVAILABLE | Display pattern only | Authoritative NET/EET semantics, units, legend, timestamp/archive integrity |
| VIL | UNAVAILABLE | Display pattern only | Verified VIL/DVL source, kg/m² units, code canonicalization |
| VIL Density | UNAVAILABLE | Derived/display pattern only | Verified derivation/source, g/m³ units, documented limits |
| Hail Detection / Hail Swaths | UNAVAILABLE | Derived/display pattern only | Verified MESH/hail source/algorithm, mm units, swath rules, QA |
| Rotation Tracks | UNAVAILABLE | Derived/display pattern only | Verified accumulation source, time window, units/legend, false-positive QA |
| Reflectivity Gate Filtering | UNAVAILABLE | CFP/gate concept reference | Verified data semantics, transparent controls, no silent masking |
| Precip Rate / QPE | UNAVAILABLE | Display pattern only | Specific product semantics (rate/accum/dual-pol), units/time window, legend |
| Rain/Mix/Snow intensity | UNAVAILABLE | Categorical/derived pattern only | Verified precip-type source, class legend, uncertainty; no guessed p-type |

## Implemented Now (safe)

- Added third-party attribution notice for Supercell-Wx MIT license.
- Added this reference document.
- Centralized radar raster render config (`lib/radar/render-config.ts`) for product-aware resampling/maxzoom defaults, inspired by Supercell-Wx view/render separation.
- Applied render config in `components/RadarMap.tsx` (no unverified product enablement).

## Not Implemented (intentionally)

- No CC/ZDR/KDP/HCA/SW/NROT/AzShear/ET/VIL/VILD/hail/rotation tracks/gate filtering/QPE/rain-mix-snow/cross-section enablement.
- No raw Level II/III decode pipeline.
- No fabricated bin-value picking from raster tiles.
- No capability-matrix status upgrades without end-to-end verification.