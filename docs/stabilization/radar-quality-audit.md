# Phase 2 - Radar Quality Audit (Task 5)

Date: 2026-11-22
Scope: `components/RadarMap.tsx` and MapLibre raster rendering. **No behavior changes made.**

## Observed Settings

| Area | Current | Evidence | Quality Impact |
|---|---|---|---|
| Source type | Raster tiles (`type: 'raster'`) | `RadarMap.tsx` addSource RADAR_SOURCE_ID | Standard WebMercator raster rendering |
| Tile size | `tileSize: 256` | `map.addSource(RADAR_SOURCE_ID, { ..., tileSize: 256 })` | Matches common 256 tiles; overzoom can blur |
| Raster resampling | Not set (MapLibre default `linear`) | No `raster-resampling` in codebase | **Likely softening** when overzoomed/scaled |
| Fade duration | `raster-fade-duration: 0` | paint includes `raster-fade-duration: 0` | Good for crisp updates/no fade blur |
| Maxzoom/overzoom | Not explicitly set on radar source | No `maxzoom` in radar source | MapLibre overzooms; with linear resampling appears softer |
| Opacity/brightness/contrast/saturation | Dynamic paint | `rasterPaint` from `rasterPaint(opacity, ...)` | Can affect perceived crispness but not geometric sharpness |
| Client interpolation | `interpolateReflectivityFrames` for ref_x/max workflows | import/use in RadarMap | Different from tile resampling; can soften if used |
| Source format | IEM RIDGE PNG tiles | API routes/templates | Source-limited; cannot exceed source pixels |

## Can Quality Improve Without Changing Sources?

**Yes, likely partially, with no source change** - but changes require careful validation and should be treated as controlled behavior change (not done in this phase).

### Candidate Improvements (for future controlled sprint)
1. **`raster-resampling: 'nearest'`** for radar products where crisp gate/pixel edges are preferred. Pros: sharper at overzoom. Cons: blockier/pixelated look; may be undesirable for some users. Recommend A/B toggle.
2. **Explicit `maxzoom`/overzoom policy** aligned to source tile availability. Prevents excessive upscale blur.
3. **Verify tileSize matches source native tiles** (256 is typical for IEM; confirm). Wrong tileSize causes scaling artifacts.
4. **Optional `raster-resampling` by product** - nearest for reflectivity/velocity, linear for satellite.
5. **Avoid unnecessary client-side interpolation** except explicitly requested feature paths; ensure it doesn't affect normal radar.

## Risks / Guardrails
- Do not claim WeatherWise/RadarScope parity without side-by-side visual QA.
- Do not change sources during quality tuning.
- Any resampling change should be capability/product-aware and tested on reflectivity, velocity, SRV, TDWR.

## Conclusion

Primary likely cause of softness is **default linear raster resampling on 256px tiles during overzoom**. Quality can likely be improved without changing sources by evaluating nearest-neighbor resampling and overzoom settings, but this is a controlled visual change and was **not implemented** in Phase 2.
