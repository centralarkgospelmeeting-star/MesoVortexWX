# Sprint 2 - Radar Quality Report

Date: 2026-11-22  
Scope: Code-level rendering pipeline inspection (Reflectivity/Velocity/SRV). No pixel-perfect visual comparison capture was automated in this run; findings are based on source inspection.

## Pipeline Observed

- **Source**: IEM RIDGE raster tiles via `app/api/nexrad/frames` / `app/api/radar/tile` and direct tile templates.
- **Map renderer**: MapLibre GL raster layer (`components/RadarMap.tsx`).
- **Tile size**: radar raster source added with `tileSize: 256` (main radar path). Some other sources in file use 256/512.
- **Raster paint**: `raster-fade-duration: 0`, opacity controlled by UI; satellite mode adjusts saturation/contrast/brightness. No `raster-resampling` explicitly set.
- **Resampling**: MapLibre default is `linear` when `raster-resampling` is unspecified. Linear resampling smooths/blurs pixel edges when tiles are scaled.
- **CSS/image-rendering**: No `image-rendering: pixelated/crisp-edges` found in repo CSS/TSX for radar canvas.

## Comparison vs WeatherWise / RadarScope (expected differences)

| Area | MesoVortexWX (observed) | WeatherWise/RadarScope (typical expectation) | Impact |
|---|---|---|---|
| Source resolution | IEM RIDGE 256px tiles (Level III raster) | RadarScope often uses higher-fidelity/rendered products; WeatherWise varies | Can look softer/coarser depending on source |
| Tile size / zoom | 256px tileSize, overzoomed with linear resampling | Crisp nearest/pixel-preserving or higher-res tiles often used | **Likely softness at zoom** |
| Resampling/interpolation | Default linear (implicit) | Nearest/pixelated for radar often preferred to preserve gate edges | Softens edges, can blur gradients |
| Smoothing | No explicit smoothing filter, but linear resampling smooths | Varies | Perceived softness |
| Opacity/fade | `raster-fade-duration: 0` (good for crisp updates) | Varies | Neutral |
| Color table | App color logic/palettes; not verified identical to NWS/RadarScope | RadarScope has calibrated tables | Possible perceived difference |

## Likely Causes of Softer Appearance

1. **Implicit linear raster resampling** on 256px tiles during overzoom - most likely contributor.
2. **Source tile resolution/format** (IEM RIDGE Level III PNG) vs native high-res render pipelines.
3. **No explicit `raster-resampling: 'nearest'`** option for users who prefer crisp gates.
4. **Browser/canvas scaling** behavior through MapLibre.

## Recommendations (Sprint 3+ candidates, not implemented now)

- Evaluate `raster-resampling: 'nearest'` option (with user toggle) for reflectivity/velocity/SRV.
- Verify tileSize matches source native size at all zooms; consider 512 where available.
- Compare N0B vs N0Q visual crispness only after N0Q verification/migration decision.
- Add A/B screenshot comparison harness (manual) before any visual-quality change.
