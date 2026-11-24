# Map Platform Fix Results

Date: 2026-11-24

## Scope

This pass fixes the **base map only**. It does not add UI, controls, weather products, radar features, or provider migration work.

The root cause was identified in `docs/MAP_PLATFORM_AUDIT.md` and `docs/MAP_PLATFORM_REEVALUATION.md` before code changes began.

## Root causes addressed

| Root cause | Fix |
|---|---|
| Mapbox basemap requests returned `401`; errors were ignored by the UI. | Removed the Mapbox raster-style builder and hardcoded token fallback from `components/RadarMap.tsx`. The base map now uses keyless OpenFreeMap vectors plus a licensed/credited imagery source. |
| Raster-only style used baked labels and a hardcoded `@2x` URL. | Added `lib/map/basemap-styles.ts` with explicit vector sources, glyphs, symbols, roads, boundaries, water labels and building layers. No `@2x` template remains in the base map. |
| Labels stayed oversized at higher zoom. | Label text sizes now interpolate by zoom and cap at 11–12 px for place labels; road names cap at 11 px. |
| Globe mode was set late and silently, with no atmosphere. | Both base styles declare `projection` in the style JSON and include a restrained dark sky/atmosphere block. Runtime `setProjection` remains only as a fallback. |
| No vector source existed for `fill-extrusion`. | Added a `mv-buildings-3d` layer using OpenFreeMap/OSM `render_height` and `render_min_height`. Buildings without a rendered height are filtered out; no height is invented. |
| Radar and weather-satellite modes shared one raster source identity. | Split IDs into `mv-radar-source` / `mv-radar-layer` and `mv-satellite-source` / `mv-satellite-layer`. Switching modes removes the stale pair. |
| GOES tiles were requested outside useful coverage and probed only at z0. | Added `getSatelliteTileBounds`, `getSatelliteTileMaxzoom`, and `getSatelliteProbeTile` in `lib/satellite.ts`. Fixed sectors now bound requests and cap native zoom; moving mesoscale sectors remain unbounded. |
| Satellite imagery became pixelated too early. | GOES z0-only probing was replaced with an in-sector probe. GOES native zoom is capped so MapLibre overzooms real tiles rather than requesting upscaled tiles. The ground satellite basemap uses imagery tiles to z19. |

## Resulting base maps

| Existing control | Result |
|---|---|
| `Satellite` | Satellite hybrid: MapTiler Satellite when `NEXT_PUBLIC_MAPTILER_KEY` is present, otherwise Esri World Imagery, under a restrained OpenFreeMap vector overlay for roads, boundaries, place names and buildings. |
| `Custom` | Dark Night Map: near-black navy background, dark blue-gray land/water, gray roads, muted blue accents and light-blue place labels. |
| `Globe` / `Flat Map` | The selected projection is declared in the style at creation time and retained by the saved preference. |
| `Globe` + pitch | 3D buildings appear from z14 where OSM/OpenFreeMap height data exists. |

No new UI was introduced. The existing `Satellite` and `Custom` buttons now select the two repaired base styles.

## Files changed

- `components/RadarMap.tsx`
  - Removed Mapbox style/token path.
  - Uses `buildBasemapStyle(basemap, projectionMode)` on map creation.
  - Separate radar and GOES raster source/layer IDs.
  - GOES bounds, native maxzoom and in-sector probe.
  - Error and source-loaded handlers now recognize both raster IDs.
- `lib/map/basemap-styles.ts` (new)
  - Dark Night Map style.
  - Satellite Hybrid style.
  - Globe projection and dark sky/atmosphere.
  - Zoom-capped label layers and z14 building extrusion.
- `lib/satellite.ts`
  - Added satellite tile bounds, maxzoom and probe helpers.

## Screenshots

All screenshots are real captures from the running app at `http://localhost:3000`. They were not visually analyzed by the assistant; they are supplied as evidence only.

- [Satellite hybrid, CONUS](screenshots/fixed-satellite-hybrid-conus.png)
- [Dark Night Map, flat](screenshots/fixed-dark-night-custom.png)
- [Dark Night Map, globe](screenshots/fixed-dark-night-globe.png)
- [Satellite hybrid, globe](screenshots/fixed-satellite-hybrid-globe.png)
- [Globe + 3D buildings, New York](screenshots/fixed-globe-3d-buildings-nyc.png)
- [Globe + 3D buildings, Dallas](screenshots/fixed-globe-3d-buildings-dallas.png)
- [Globe + 3D buildings, Little Rock](screenshots/fixed-globe-3d-buildings-little-rock.png)

Captured browser evidence:

- Mapbox raster basemap requests: **0**
- Mapbox raster `401` responses: **0**
- OpenFreeMap/glyph/sprite requests: observed in the browser resource log; public endpoints returned **200** in direct checks
- MapTiler Satellite tile requests: observed in the browser resource log; public endpoints returned **200** in direct checks
- Base-map tile errors: **none observed**. Unrelated `404` glyph requests used non-base-map `Open Sans` font stacks, and `/api/spotters/reports` returned `404`.

Two non-base-map issues remain visible in the console and are outside this fix:

- `/api/spotters/reports` returns `404`.
- Search geocoding still calls Mapbox with the public env token and returned `401` for the typed queries. Raw lat/lon search worked and was used for the city captures.

## Build and verification

```text
npm run typecheck        PASS
npm run build            PASS
npm run test:verify      PASS
```

`test:verify` covered 27 capability entries, 31 satellite capability entries, 43 observation entries, 43 severe entries, 23 aviation/marine entries, 72 platform entries, 251 sounding entries, radar render config, fake-data guards and archive integrity.

Style-spec validation was run against the generated styles:

```text
dark mercator    errors 0
hybrid mercator  errors 0
dark globe       errors 0
hybrid globe     errors 0
```

## Licensing and attribution notes

- OpenFreeMap attribution is present: `OpenFreeMap © OpenMapTiles — Data from OpenStreetMap`.
- When the MapTiler key is configured, imagery attribution is `© MapTiler`. This is a client-side key from the environment, not a hardcoded secret.
- When the key is absent, Esri World Imagery is used with `Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community`. Esri commercial terms still require separate confirmation before production use.
- Buildings use only height values present in the source data. Missing heights are not fabricated.

## Not changed

- No UI redesign or new controls.
- No radar products or weather products added.
- No `lib/radar/capability-matrix.ts` changes.
- No capability status upgrades.
- Multiple existing camera zoom targets and `jumpTo` synchronization remain unchanged; they are not base-map rendering defects.
- The exposed Mapbox token in `.env.local` should still be rotated because search geocoding still uses it.
