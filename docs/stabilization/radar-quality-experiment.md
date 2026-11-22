# Phase 3 - Radar Image Quality Experiment Report

Date: 2026-11-22  
Scope: Controlled MapLibre raster quality experiment. **No merge, no behavior change on main.**

## Objective

Investigate whether radar image sharpness can be improved without changing sources, by testing raster rendering options: `raster-resampling`, overzoom/maxzoom behavior, `tileSize`, and related MapLibre raster paint/layout options.

## Controlled Experiment (branch, not merged)

- **Branch:** `exp/phase3-raster-quality` (local only, not merged, not pushed)
- **Commit:** `2fc0456` — `EXPERIMENT: phase3 raster-resampling nearest (do not merge)`
- **File changed:** `components/RadarMap.tsx`
- **Change:** added `raster-resampling: 'nearest'` to `rasterPaint` for radar raster layer.

```diff
       const rasterPaint: any = {
         'raster-opacity': radarOpacity,
         'raster-fade-duration': 0,
+        // PHASE 3 EXPERIMENT (not merged): nearest resampling reduces blur at overzoom.
+        'raster-resampling': 'nearest',
         'raster-saturation': isSatelliteMode ? 0.18 : 0,
         'raster-contrast': isSatelliteMode ? 0.18 : 0,
         'raster-brightness-min': isSatelliteMode ? 0.02 : 0,
         'raster-brightness-max': isSatelliteMode ? 1 : 1,
       };
```

## Baseline (main, current)

| Setting | Value | Location |
|---|---|---|
| `tileSize` | 256 | `components/RadarMap.tsx` radar source (`addSource` RADAR_SOURCE_ID) |
| `raster-fade-duration` | 0 | raster paint |
| `raster-resampling` | unset (MapLibre default: `linear`) | no property set |
| `maxzoom` on radar source | unset | no property set |
| source type | raster XYZ PNG tiles | IEM/NOAA tile endpoints via app API routes |

## Hypotheses

1. **`raster-resampling: nearest`** will produce crisper pixel edges at overzoom, reducing blur for radar reflectivity/velocity gates. Tradeoff: blockier/pixelated appearance, especially on smooth gradients or satellite imagery.
2. **Explicit `maxzoom`** near source-native max can reduce excessive overzoom blur by constraining upscale. Tradeoff: may limit deep zoom detail if source supports higher.
3. **`tileSize` change** only beneficial if mismatched to source; current 256 is typical for IEM tiles. Changing to 512 without source support can worsen quality or request wrong tiles.
4. **Product-aware resampling** may be optimal: nearest for radar products, linear for satellite/clouds.

## Measurements / Evidence

| Dimension | Status | Evidence / Notes |
|---|---|---|
| Code-level experiment | **Done** (branch only) | `exp/phase3-raster-quality` commit `2fc0456` |
| Visual screenshot comparison | **Not captured in-session** | Requires running app + browser side-by-side at same zoom/center/product. No automated screenshot harness in repo; manual QA needed. |
| Performance impact | **Not benchmarked in-session** | `nearest` is typically cheaper/equal vs linear GPU sampling; real impact expected negligible, but must be measured on target devices/browsers. |
| Build/type safety | **Not run on branch** | Change is a simple paint property; low risk, but build should be run before any merge candidate. |

## Expected Visual Impact (to validate manually)

- **Reflectivity/Velocity/SRV/TDWR:** likely sharper at zoom levels beyond native tile resolution; gate edges clearer; possible aliasing/jaggies.
- **Satellite:** likely worse (blocky clouds) - argues for product-aware resampling.
- **Labels/legends:** unaffected (UI overlay).

## Risks / Guardrails

- Do not merge experiment without side-by-side visual QA across REF/VEL/SRV/TDWR/Satellite.
- Do not claim parity with WeatherWise/RadarScope.
- Do not change sources.
- If adopted, consider `raster-resampling` by mode/product (nearest for radar, linear for satellite).
- Verify MapLibre style-spec support in deployed version (`raster-resampling` supported in MapLibre v2+; confirm current dependency).

## Recommendation

Do **not** merge the experiment as-is. Create a controlled QA sprint: A/B screenshots at fixed zoom/center/product, test all WORKING radar products and satellite, measure FPS/paint on low-end device, then decide product-aware resampling policy. Keep default behavior on main until validated.