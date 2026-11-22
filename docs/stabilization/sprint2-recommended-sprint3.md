# Recommended Sprint 3 - Stabilization

## Priority 1 - Data Honesty Closure
- Audit `lib/adapters/weather-gateway.ts` fallback observation behavior; remove fabricated baseline values on failure.
- Audit any remaining UI telemetry paths for "offline cache"/baseline fake values.
- Add automated guardrails: CI grep/test for forbidden fake-data patterns in production paths.

## Priority 2 - Reflectivity Migration Decision (Evidence-Gated)
- Run exhaustive N0Q/N1Q/N2Q/N3Q verification: nationwide CONUS+AK+PR+HI+GU, multiple time windows, archive timestamps, tilt semantics, legend parity.
- Only if evidence passes: plan controlled N0Q migration with rollback and visual QA.
- If evidence fails: document and keep N0B.

## Priority 3 - Verified Product Enablement (One at a Time)
- MESH: verify MRMS MESH semantics/legend/units/archive/update cadence; integrate through capability matrix only after end-to-end proof.
- Echo Tops (NET): verify semantics/units/archive and map correctly before enabling.
- Dual-pol CC/ZDR/KDP: investigate NOAA/IEM/AWS sources with end-to-end verification; no substitutes.

## Priority 4 - Radar Quality
- Evaluate `raster-resampling: 'nearest'` toggle for radar layers; A/B compare against current linear.
- Confirm tileSize/source zoom behavior and reduce blur on overzoom.
- Visual QA against WeatherWise/RadarScope for REF/VEL/SRV.

## Priority 5 - Archive Integrity
- Build archive probe harness for supported products; record real archive availability over time.
- Only mark REAL_ARCHIVE when repeatedly verified.

## Non-Goals
- No MRMS expansion beyond verified single-product enablement.
- No 3D radar/globe/models/soundings/cross-sections expansion.
- No fake playback or synthetic operational data.
