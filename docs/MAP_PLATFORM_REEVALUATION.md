# Map Platform Re-Evaluation — MesoVortexWX

**Date:** 2026-11-24  
**Scope:** Re-evaluate the broken map behavior and compare provider options **before** changing providers. No new map/provider code is implemented by this report.  
**Repository state:** `main` at `c02bf4f` (`Add map platform audit report`).  
**Installed renderer:** `maplibre-gl@6.16.0`.  
**Evidence base:** source inspection, installed MapLibre style spec/typings, a real local browser run at `http://localhost:3000`, captured browser screenshots, observed console/network status, and current provider documentation.

> **Honesty boundary:** screenshots in this report were captured from real browser sessions, but they were **not visually analyzed** by the reporting session. Claims below rely on browser titles, console/network status, and source facts. No frame rates, tile counts, city building counts, or provider quotes were invented; where those were not measured, the report says `DATA UNAVAILABLE`. This is an engineering review, not legal advice.

---

## 1. Best answer first

**Keep MapLibre GL JS. Fix the integration defects first. Then move to an open-first MapLibre stack: a custom dark-navy OSM vector style, Overture or OSM-derived building vectors rendered with `fill-extrusion`, Copernicus Sentinel-2 imagery for the ground “satellite” basemap, and IEM GOES retained only as a separate live weather-satellite data mode.**

That is the best fit for MesoVortexWX because it preserves radar-first readability, avoids vendor lock-in, keeps license fees at $0–low cost, and leaves a verifiable self-hosting exit path. It also matches the existing honesty constraints: real data only, no fabricated capability claims, and `lib/radar/capability-matrix.ts` remains the single radar authority.

If a paid, turnkey, named style and richer building attributes are worth the cost, **MapTiler Dataviz Dark + MapTiler Buildings + MapTiler Satellite** is the strongest commercial alternative. It is not the primary recommendation because exact colors are API-key gated, terms are revocable, weather overlays may affect session billing, and it changes the cost model.

| Requested mode | Recommended target | Why |
|---|---|---|
| Dark Night Map | Custom **vector** style derived from OpenFreeMap Dark / OpenMapTiles or Protomaps, tinted deep navy-black with restrained light-blue accents | Vector labels can be scaled independently; basemap stays subordinate to radar |
| Satellite | Two distinct products: **Copernicus Sentinel-2 data / a mosaic you control** for ground satellite basemap; **IEM GOES** for live weather satellite | Removes the current “satellite means two things” collision. Do not assume EOXCloudless composites are free for commercial use. |
| Globe | Native MapLibre globe declared in the style at construction, with sky/atmosphere styling and a verified `map.getProjection()` | Fixes first-paint flip and silent projection failure |
| Flat Map | Same style, explicit Mercator projection; keep it available and honor saved preference | Preserves user choice while defaulting to globe on first launch |
| Globe + 3D Buildings | **Overture buildings** preferred for broad global footprints; OSM/OpenMapTiles `render_height` as lower-cost interim; MapTiler Buildings as paid turnkey | MapLibre supports `fill-extrusion`; the missing piece is a building vector source |

**Immediate priority:** do not migrate providers yet. The current failures are mostly configuration defects on top of a capable renderer. A provider migration before fixing these defects would move the same bugs to a new endpoint.

---

## 2. What the real browser run confirmed

A real local run loaded `MesoVortexWX | Weather Radar` from `http://localhost:3000`.

### 2.1 Confirmed failures

| Observation | Evidence | Interpretation |
|---|---|---|
| Repeated HTTP `401` console errors for Mapbox tile requests | Browser console; screenshots listed in §10 | Basemap tiles are not being served in this session. Because the app background is dark and the style has no background/fallback layer, failed tiles read as black/blank. |
| Both UI basemap choices resolve to Mapbox raster styles | Source: `components/RadarMap.tsx:134-138`, `:199-222`; screenshots `current-default-satellite-basemap-401.png`, `current-custom-basemap-401.png` | The selector is not a real multi-provider architecture. |
| Map error handler ignores non-radar sources | `components/RadarMap.tsx:515-526` | Basemap `401`/`403` failures are invisible to the UI. |
| IEM GOES tile endpoints returned `200 image/png` | `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes_east_conus_ch02/0/0/0.png`, `.../4/3/5.png`, `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes_east_mesoscale-1_ch02/0/0/0.png`, `.../8/70/96.png` | The live weather feed itself is reachable; the appearance problem is integration, not endpoint absence. |
| OpenFreeMap Dark and Fiord styles reached `READY` in the MapLibre harness | Screenshots `candidate-openfreemap-dark-conus.png`, `candidate-openfreemap-fiord-conus.png`, `candidate-openfreemap-dark-globe.png` | MapLibre can render these styles; this is a candidate, not an implemented provider change. |
| Several guessed OpenFreeMap 3D style URLs returned `404` | `styles/3d`, `styles/liberty-3d`, `styles/liberty_3d`, `styles/3d-buildings`, `styles/dark-3d` | The homepage “3D” option is Liberty with pitch/bearing; Liberty itself contains `building-3d` at z14. Do not depend on a separate 3D style URL. |
| Esri World Imagery tile request returned `200` | Screenshot `candidate-esri-world-imagery-dallas.png`; network list showed Esri tile fetches | Esri imagery is technically reachable, but reachability is not permission for commercial use. |

### 2.2 Evidence files

See §10 for the screenshot inventory. No screenshot in this report is synthetic or generated.

---

## 3. Root-cause classification

The requested categories are all present. The renderer is not the main problem.

| Symptom | Primary category | Contributing categories | Short diagnosis |
|---|---|---|---|
| Black / blank map regions | **Tile source configuration** | Style configuration, globe rendering configuration | Mapbox basemap requests fail with `401`; failures are swallowed; raster-only style has no background/fallback. Weather rasters also lack bounds and effective zoom limits. |
| Incorrect label scaling | **Label scaling configuration** | Tile source configuration, style configuration | Basemap labels are baked into raster tiles; `@2x` is hardcoded; `tileSize: 512` conflicts with retina tile intent; app labels use fixed pixel sizes with no zoom interpolation. |
| Inconsistent zoom behavior | **Zoom configuration** | Tile source configuration, globe rendering configuration | Startup, site fly-to, search, and basemap switching use different zoom values; `jumpTo` sync can interrupt `flyTo`; globe flattens at high zoom. |
| Oversized city labels | **Label scaling configuration** | Tile source configuration, style configuration | City labels are raster-baked and cannot be resized by app code; overzoom changes their apparent size. |
| Incorrect satellite appearance | **Tile source configuration** | Style configuration | “Satellite” means both Mapbox ground imagery and IEM GOES live weather data; GOES shares radar source/layer IDs and radar-derived paint behavior. |
| Poor globe quality | **Globe rendering configuration** | Style configuration, zoom configuration | Projection is applied late and silently; style has no sky/atmosphere; map is recreated on basemap change; sync does not carry projection state. |

---

## 4. Detailed diagnosis

### 4.1 Black / blank regions — tile source and style configuration

Confirmed source facts:

- The active style is generated by `buildMapboxRasterStyle()` at `components/RadarMap.tsx:199-222`.
- It contains exactly one raster source and one raster layer:
  - source `mapbox-basemap-source` at `:207-213`;
  - layer `mapbox-basemap-layer` at `:214-220`.
- There is no `background` layer, vector source, glyphs, sprite, sky, terrain, projection, or fallback imagery.
- The tile URL is a hardcoded Mapbox Styles API raster URL with a hardcoded token fallback at `:126-132` and `:202`. The token value is intentionally not reproduced here; it must be treated as exposed and rotated.
- The map error handler only reacts to `mv-radar-source` and only for `404`/`503` (`:515-526`). A basemap `401` is discarded.
- Weather raster sources are constructed without `bounds`, `minzoom`, or an effective `maxzoom` (`:1313-1322`; `lib/radar/render-config.ts:19-32`). The conditional `maxzoom` assignment at `:1320` never fires because no render config sets `maxzoom`.

**Diagnosis:** the primary blank-map cause in this session is failed basemap tiles plus invisible failure handling. The dark app background (`app/globals.css:13-22; app/page.tsx:816`) makes absent tiles look like intentional black regions. On globe views, regional radar/GOES rasters without bounds can also request tiles outside their real coverage, leaving uncovered sphere areas dark.

**Fix category:** tile source and style configuration. Surface basemap errors, add a background/fallback layer, give regional rasters explicit bounds and zoom limits, and remove the exposed token from the critical path.

---

### 4.2 Label scaling and oversized city labels — label scaling configuration

Confirmed source facts:

- All basemap labels are embedded in Mapbox raster imagery; there is no vector label layer in the active style (`components/RadarMap.tsx:204-221`).
- The URL hardcodes `@2x` (`:202`) instead of MapLibre’s DPR-aware `{ratio}` token.
- The source declares `tileSize: 512` (`:210`) while requesting retina imagery.
- The style declares no `glyphs`/`font-faces`, so app-added symbol layers use local font fallback rather than a deterministic glyph source.
- App labels use fixed numeric `text-size` values, for example MCD label `11` (`:788`), hurricane labels `9`/`11` (`:959`, `:962`), range-ring label `10` (`:1360-1376`), report labels `10`/`11` (`:1547`, `:1552`, `:1555`), and tool label `11` (`:2023`). There is no zoom-interpolated `text-size` expression.

**Diagnosis:** raster-baked city labels cannot be resized independently. Their apparent size changes with tile zoom/overzoom and hardcoded retina tiles, while app-added labels remain fixed CSS pixels. That mismatch is the code-supported cause of inconsistent and oversized labels.

**Fix category:** label scaling configuration. Use a vector basemap with independent symbol layers, set explicit glyphs, and interpolate label size by zoom. If any raster labels remain, use `{ratio}` and declare tile size correctly.

---

### 4.3 Inconsistent zoom — zoom configuration

Confirmed source facts:

- Every map starts at `[-98.5795, 39.8283]`, zoom `4.4` (`components/RadarMap.tsx:502-508`).
- No `minZoom`, `maxZoom`, or `maxBounds` are supplied.
- Site fly-to uses zoom `7.5` (`:1841-1854`).
- Search focus uses zoom `6`, `8`, `9`, and `10` (`app/page.tsx:699-703`).
- Basemap changes remove and recreate the map (`components/RadarMap.tsx:494-565`), resetting camera to CONUS/4.4.
- Multi-pane sync uses immediate `jumpTo` (`lib/map-sync.ts:28-54`), which can interrupt a sibling `flyTo`.
- Installed MapLibre transitions globe toward Mercator around zoom `11–12`, so crossing that range changes projection behavior without a UI explanation.
- Basemap raster `tileSize: 512` and weather raster `tileSize: 256` cause basemap and overlay tiles to be requested at different integer zooms for the same camera zoom.
- Pitch is clamped to `0..75` inside a silent `try/catch` (`components/RadarMap.tsx:440-444`) while the UI slider offers `0..60` (`app/page.tsx:1516`).

**Diagnosis:** there is no single zoom policy. Startup, site selection, search, basemap switching, pane sync, and globe transitions each impose their own behavior. The result reads as inconsistent zoom rather than one identifiable bug.

**Fix category:** zoom configuration. Define one zoom policy, preserve camera across style changes, avoid `jumpTo` interrupting animations, and expose globe-to-flat transition behavior honestly.

---

### 4.4 Incorrect satellite appearance — tile source configuration

There are two different “satellite” meanings in the app:

1. **Ground satellite basemap:** header button selects Mapbox `satellite-streets-v12` (`components/RadarMap.tsx:138`, `:199-202`; `app/page.tsx:841-861`).
2. **Live weather satellite:** main Satellite tab selects IEM GOES data (`app/page.tsx:893-908`; `components/RadarMap.tsx:1137-1148`).

Confirmed source facts:

- IEM GOES uses single-channel products such as `ch02`, `ch13`, `ch08`, etc. (`lib/satellite.ts:67-96`, `:124-149`). GeoColor, AirMass, Sandwich, Cloud Phase, Fire Temperature, and Dust are explicitly unavailable as verified XYZ feeds.
- GOES tiles are rendered through the same source and layer IDs as radar: `mv-radar-source` / `mv-radar-layer` (`components/RadarMap.tsx:140-141`, `:1266-1332`).
- Satellite paint is applied to that shared layer: `raster-saturation: 0.18`, `raster-contrast: 0.18`, `raster-brightness-min: 0.02`, `raster-brightness-max: 1` (`:1278-1281`).
- Resampling is `linear` for satellite and `nearest` for radar (`lib/radar/render-config.ts:22-32`).
- Availability is probed by rewriting the URL to `0/0/0` (`components/RadarMap.tsx:1149-1164`). A sector-specific product can be unavailable at z0 even when tiles exist at valid regional zooms.
- The selected GOES feed remains underneath the Mapbox Satellite Streets basemap because basemap choice and data mode are independent state.

**Diagnosis:** the weather-satellite mode is not a ground imagery switch. GOES is stretched into a radar-shaped raster layer with radar-derived identity, no bounds, no zoom cap, linear resampling, and a weak availability probe. That explains washed-out, mis-scaled, or misleading satellite appearance.

**Fix category:** tile source configuration. Separate the two meanings in source IDs and UI labels. Keep GOES as live weather data with sector-aware probing; use Sentinel-2 or another licensed imagery product for the ground basemap.

---

### 4.5 Poor globe quality — globe rendering configuration

Confirmed source facts:

- Globe is the default saved preference (`app/page.tsx:92-94`), but `RadarMap`’s own prop fallback is Mercator (`components/RadarMap.tsx:359`).
- The generated style has no root `projection` key (`components/RadarMap.tsx:204-221`). The installed style spec supports `projection: { type: ... }` (`node_modules/@maplibre/maplibre-gl-style-spec/dist/index.d.ts:8527`, `:8793-8803`).
- Projection is applied after load with `as any`, and failures are swallowed (`components/RadarMap.tsx:430-438`).
- No sky/atmosphere is configured. The installed style spec supports root `sky` and `setSky` (`node_modules/maplibre-gl/dist/maplibre-gl.d.ts:16176-16197`).
- Basemap changes recreate the map, repeating projection setup and discarding tile/camera state (`:494-565`).
- Sync mirrors only center, zoom, bearing, and pitch — not projection (`lib/map-sync.ts:28-54`).
- MapLibre’s globe path uses different transform/render behavior and internally flattens at high zoom.

**Diagnosis:** the primary globe defect is late, silent projection setup on a raster-only style that is repeatedly torn down. Quality is further reduced by no sky/atmosphere, regional weather rasters without bounds, pitch handling not designed for globe, and `jumpTo` sync fighting animated camera moves.

**Fix category:** globe rendering configuration. Declare projection in the style at construction, verify `map.getProjection()`, add atmosphere, stop recreating the map for basemap changes, and carry projection through pane sync.

---

## 5. Recommended target architecture

No implementation is proposed here. This is the target to approve before code changes.

| Layer | Recommended target | Fallback / alternative | Notes |
|---|---|---|---|
| Renderer | MapLibre GL JS 6.16.0 | None needed | BSD-3-Clause, native globe/flat/raster/vector/terrain/fill-extrusion. |
| Dark/flat vector basemap | Custom dark-navy style from OpenFreeMap Dark or OpenMapTiles schema | Protomaps PMTiles self-hosted; MapTiler Dataviz Dark if paid | Fork the style; do not use opaque raster styles for labels. |
| Label system | Vector symbol layers with `glyphs`, zoom-interpolated `text-size` | — | Radar labels must stay readable without oversized city names. |
| Ground satellite basemap | Copernicus Sentinel-2 data / self-derived mosaic | Licensed Esri World Imagery only if budget/terms accepted; EOXCloudless only with paid commercial license | A mosaic is not live weather. Label freshness explicitly. Raw Sentinel data is open; derived composite products can add licenses. |
| Live weather satellite | Existing IEM GOES products | — | Keep separate from basemap; do not upgrade capability claims. |
| 3D buildings | Overture buildings vector tiles | OSM/OpenMapTiles `render_height`; MapTiler Buildings paid | Use `fill-extrusion`; suppress heightless features instead of inventing heights. |
| Globe atmosphere | MapLibre `sky`/atmosphere styling | — | Required for a non-flat globe presentation. The style spec marks sky as experimental and GL JS-only; verify in the installed 6.16.0 runtime. |
| Camera sync | Guarded sync that does not cancel active `flyTo` | — | Include projection state. |
| Credentials | No hardcoded fallback token; fail explicitly | — | Rotate the exposed Mapbox token regardless of future provider choice. |

### 5.1 Dark Night Map specification

The target is a restrained weather-workstation style, not a decorative “cyber night” map.

| Role | Suggested color | Use |
|---|---|---|
| Canvas / ocean deep background | `#050B14` | Matches existing app background; failed tiles should not become pure black voids unnoticed. |
| Land | `#0A1422` | Very dark navy, slightly lighter than canvas. |
| Water | `#071B2B` | Dark blue, quiet. |
| Minor roads | `#142338` | Low contrast. |
| Major roads | `#1B2C42` | Slightly brighter structure. |
| Boundaries | `#263A52` | Gray-blue. |
| Small labels | `#71889E` | Muted. |
| City labels | `#A9BED1` | Light gray-blue, not white. |
| Accent | `#5FA8D3` | Sparse: water lines, selected site, neutral UI emphasis. Do not use for radar intensity. |

Avoid: glassmorphism, neon cyan/purple, glowing road networks, heavy halos, and bright landcover fills. The radar/satellite overlay must remain the visual primary layer.

Named-style evidence:

- OpenFreeMap `Dark` is near-black neutral gray (`rgb(12,12,12)` background), not navy.
- OpenFreeMap `Fiord` is muted blue/slate but too medium-tone (`#45516E` background).
- Protomaps `DARK`/`BLACK` are dark neutral charcoal/black, not navy-dominant.
- CARTO Dark Matter is very dark neutral charcoal, good restraint but not the requested palette.
- MapTiler `dataviz-v4-dark` is documented for dark UIs and meteorological/statistical data, but exact colors are API-key gated and were not verified in this session.

**Conclusion:** no verified off-the-shelf named style exactly matches the requested palette. A custom tint of OpenFreeMap Dark is the most practical open path; MapTiler Dataviz Dark is the best paid named starting point.

---

## 6. Options A–E evaluated

Costs are planning figures as of 2026-11-24. Verify before purchase.

| Option | Cost | License / attribution | Globe support | 3D buildings | Satellite quality | Weather-overlay suitability | Verdict |
|---|---|---|---|---|---|---|---|
| **A. MapTiler** | Free $0 is for testing/PoC/prototyping/personal/**non-commercial** use: 5k sessions/mo, 100k API requests, 2k 3D sessions; quota pauses until next month. Flex **$30/month** adds commercial use, 25k sessions, 500k API requests, 10k 3D sessions; overage $2.50/1k sessions, $0.15/1k API requests, $6/1k 3D sessions. 99.9% SLA is Custom-only. | Cloud license is revocable/non-transferable; own API keys; no server-side caching/proxy without agreement. Attribution `© MapTiler © OpenStreetMap contributors`; logo required on Free and for 3D sessions on Flex/Custom. | Yes; MapTiler styles are consumed by MapLibre and support globe projection. | Strong. MapTiler Buildings includes `height`, `height_min`, `roof_shape`, facade/roof colors; documented z12–15 with overzoom. | Strong global aerial/satellite; dark satellite variants available. Local imagery can be very high resolution. | Best named fit: `dataviz-v4-dark`. Caveat: pricing counts Map & Weather sessions; dedicated weather-API terms were not independently verified. | **Best paid turnkey.** Choose if exact API-key-gated style colors and richer building attributes justify cost/terms. |
| **B. OpenFreeMap** | Public instance **$0**, no key, no published view/request cap, commercial use allowed; weekly planet exports for self-hosting. As-is, no SLA. Offline download cap 3,000 tiles / 50 MB with max 4 parallel requests. | Project MIT; OSM ODbL; OpenMapTiles schema CC-BY / implementation BSD. Attribution `OpenFreeMap © OpenMapTiles — Data from OpenStreetMap`. | Yes; styles are MapLibre-compatible and can render on globe. | Working styles: `liberty`, `bright`, `positron`, `dark`, `fiord`. Liberty includes `building-3d` at minzoom 14 using `render_height`/`render_min_height`. The homepage “3D” button is Liberty with pitch/bearing, not a separate `/styles/3d` endpoint; those URLs returned `404`. | **None.** It is a vector basemap, not an imagery provider. | Good if tinted darker; labels and roads must stay subordinate to radar. | **Best zero-cost development/fallback style source.** Pair with Sentinel-2 and Overture. |
| **C. OpenMapTiles** | Open-source stack; $0 to self-host; hosting via providers such as MapTiler is paid. | Schema CC-BY, implementation BSD, OSM data ODbL. Visible attribution required. | Yes, through MapLibre styles; no inherent projection blocker. | OSM-derived `building` layer starts at z14 with `render_height`, `render_min_height`, `colour`, `hide_3d`; quality follows local OSM height tagging. | **None.** | Style-dependent; Dark Matter and Fiord-like styles are good data-backdrop concepts. | **Good middle ground** if you want schema control and self-hosting; weaker where OSM heights are sparse. |
| **D. Esri World Imagery** | Item is under the Esri Master License Agreement. With an ArcGIS Online subscription, Esri-owned items may be used with Esri software for internal or external projects; public accounts are noncommercial. Living Atlas commercial use in an app/product requires contacting Esri. No standalone commercial price was found. | Current attribution: `Esri, Vantor, Earthstar Geographics, and the GIS User Community`; provider-specific `copyrightText` must be shown. May not harvest, redistribute, or self-host tiles. | Raster-on-globe is generally possible in MapLibre; Esri plugin globe behavior was not verified here. | **Not a building source.** It can sit under extrusions from another vector source. | Strongest conventional aerial imagery, generally 1 m or better with lower-resolution worldwide coverage; typical currency 3–5 years. | Visually noisy under radar; useful only as an explicit contextual basemap toggle. | **Do not use as default.** Use only if licensed and intentionally chosen. |
| **E. Overture buildings** | Data $0; pay only for your tiling/storage/hosting pipeline. | Buildings theme is **ODbL** because it includes OSM; attribution `© OpenStreetMap contributors, Overture Maps Foundation`. | Data is projection-agnostic; render through MapLibre vector tiles on globe. | Strongest open coverage goal: global footprints from OSM, Esri Community Maps, authoritative datasets, and ML roofprints; `height`, `num_floors`, `min_height`, `has_parts`, `building_part`. Height is optional, not guaranteed per feature. | **None.** | Neutral data layer; combine with any restrained dark basemap. | **Best open building source** when global footprint consistency matters. Requires a tiling pipeline and quality filtering. |

### 6.1 A–E ranking for this project

1. **OpenFreeMap / OpenMapTiles-style vector basemap + Overture buildings + Sentinel-2 imagery** — best overall fit under the project’s cost and honesty constraints.
2. **MapTiler Dataviz Dark + Buildings + Satellite** — best paid turnkey; choose only after accepting cost and terms.
3. **Protomaps/OpenMapTiles self-hosted PMTiles** — strongest self-hosting exit path; building heights still follow OSM.
4. **Esri World Imagery** — excellent imagery, not suitable as the unlicensed default.
5. **Current hardcoded Mapbox raster path** — not recommended; exposed token, opaque style, raster-only labels, no buildings.

---

## 7. Satellite source recommendation

### 7.1 Ground satellite basemap

**Primary recommendation:** use **Copernicus Sentinel-2 data directly, or a mosaic you derive from it**, served as raster tiles or pre-tiled PMTiles. Do **not** assume every “Sentinel-2 cloudless” product carries the same open license as the raw Sentinel data.

Reasons:

- Copernicus Sentinel data are free, full, and open, including commercial use, with attribution and no warranty.
- Self-derived mosaics avoid proprietary per-tile imagery licensing.
- Global consistency is better than mixing opaque commercial styles.
- It is a real, documented satellite-derived basemap rather than a weather-satellite product.

Critical licensing split:

| Product | Status |
|---|---|
| Raw Copernicus Sentinel-2 data | Free, full, open; cite `Contains modified Copernicus Sentinel data [Year]` when modified. |
| EOXCloudless 2016 vintage | CC BY 4.0; commercial embedding allowed with attribution. |
| EOXCloudless 2018+ public WMS/WMTS | CC BY-NC-SA 4.0; **noncommercial only**. Commercial production use requires an EOX license. |
| EOXCloudless commercial license | Reported as €6,000 ex VAT for the latest global mosaic, €5,000 for 2018–2024, or €6,000/year for hosted WMTS with production SLA; annual updates are separate. Verify before purchase. |

Caveats:

- Sentinel-2 composites are not live. Freshness must be labeled.
- 10 m native resolution is lower than premium aerial imagery in many metros.
- EOX attribution must remain visible wherever imagery appears, including screenshots/video/print, if that product is used.
- Direct COG access, proxying, tiling, CORS, and egress should be tested before committing. No latency benchmark was measured for this report: `DATA UNAVAILABLE`.

### 7.2 Live weather satellite

**Keep IEM GOES** as the live weather-satellite data mode.

Required changes when implementation is approved:

- Rename UI: “Satellite Basemap (ground imagery)” vs “Weather Satellite (GOES live)”.
- Use distinct source/layer IDs; stop reusing `mv-radar-source`.
- Probe availability at a sector/zoom appropriate to the selected product; replace the z0-only probe.
- Keep `DATA UNAVAILABLE` and `LIVE ONLY` behavior truthful.
- Do not advertise GeoColor/RGB products until a verified real XYZ endpoint exists.

---

## 8. 3D buildings: coverage, zoom, performance, and city behavior

MapLibre 6.16.0 supports `fill-extrusion`. MesoVortexWX has no building source or building layer today. The correct fix is a vector building source, not tilting a raster map.

### 8.1 Source comparison

| Source | Footprint coverage | Height data | Practical zoom behavior | Performance risk |
|---|---|---|---|---|
| OSM / OpenMapTiles | Global but density varies with local mapping | `render_height` / `render_min_height` derived from OSM `height` or levels; sparse where unmapped | OpenMapTiles building layer starts at z14; OpenFreeMap Liberty `building-3d` starts at z14 with `hide_3d` filtering | Low in rural areas, moderate in metros; dense downtowns produce many features |
| Overture | Global by design; fuses OSM, Esri Community Maps, government data, and ML roofprints | `height`, `num_floors`, `min_height` optional and merged where sources match; not guaranteed everywhere | Determine in your own tile pipeline; use minzoom and height presence filters | Highest feature counts in dense metros; needs simplification/filtering |
| MapTiler Buildings | Strong global Planet v4 + dedicated buildings tileset | Rich `height`, `height_min`, `roof_shape`, facade/roof colors | Documented z12–15 with overzoom | Vendor-managed tiles; cost/session limits apply |
| Esri World Imagery | Not a building source | None | N/A | N/A |

### 8.2 City expectations

No city benchmarks, feature counts, or frame-time measurements were run in this audit: `DATA UNAVAILABLE` for quantitative claims. The following is a qualitative expectation from each dataset’s documented characteristics, not a measured result.

| City | OSM-derived buildings | Overture buildings | MapTiler Buildings | Rendering guidance |
|---|---|---|---|---|
| Little Rock | Core and suburban footprints likely present; height tags likely sparse outside commercial/core structures | Broader footprint consistency expected from multi-source fusion; height still variable | Likely strongest ready-to-render attributes | Keep minzoom ~14–15; suppress heightless features; low visual clutter expected |
| Dallas | Good coverage in core/inner suburbs; height tagging variable by neighborhood and vintage | Broad footprints; height mixed across merged sources | Strongest paid option for consistent attributes | Moderate feature density; use viewport-aware filters and avoid extruding every tiny outbuilding |
| NYC | Best OSM height coverage of the three due to dense mapping; very high feature count | Very high footprint count; height merged from multiple sources | Richest attributes; high feature count | Highest performance risk. Use minzoom 15, height filters, building-part handling, and pitch caps. Verify on real hardware before claiming performance |

**City behavior rule:** never invent a height for a footprint. If `height` is missing, render a flat footprint or omit the extrusion. This preserves the project’s honesty constraint.

---

## 9. Cost and licensing summary

### 9.1 Planning costs

| Component | Open-first recommendation | Paid alternative |
|---|---|---|
| MapLibre GL JS | $0, BSD-3-Clause | $0 |
| Vector basemap | OpenFreeMap public $0 / self-host hosting only; Protomaps hosted $0 noncommercial or about $14/month commercial sponsor tier | MapTiler Flex listed at $30/month plus overages/storage |
| Sentinel-2 imagery | Raw Copernicus data $0; optional proxy/tiler/egress. EOXCloudless 2018+ commercial license not included | EOXCloudless €6,000 reported for latest global mosaic / €6,000 per year hosted WMTS; Esri licensing if chosen |
| Buildings | Overture data $0 plus your tiling/hosting; OSM/OpenMapTiles $0 self-host | MapTiler Buildings included under applicable plan |
| IEM GOES / NWS / radar feeds | No per-tile license fee in current usage; respect provider volume | Not applicable |
| Self-host example from prior audit | Cloudflare example about $11.45/month at 10M requests / 1TB egress / 110GB storage; AWS example about $119.56/month at same load | — |

**Practical totals:**

- **Open-first:** $0/month in license/API fees when using raw Sentinel-2 data you derive yourself, accepting OpenFreeMap as-is reliability risk or paying modest hosting for self-hosted PMTiles/imagery.
- **Controlled low-cost:** roughly $14/month for a commercial Protomaps-style basemap tier plus optional imagery/egress.
- **Paid turnkey:** MapTiler Flex $30/month baseline plus overages/storage; verify exact session and weather-session counting before launch.
- **EOXCloudless:** only if its separate commercial license is purchased; public 2018+ WMS/WMTS is noncommercial.
- **Esri:** only after account-specific commercial terms and attribution are confirmed.

### 9.2 Licensing obligations

| Component | Obligation |
|---|---|
| MapLibre | Keep BSD notices if redistributed. |
| OpenFreeMap | Show `OpenFreeMap © OpenMapTiles — Data from OpenStreetMap`; public instance is as-is. |
| OpenMapTiles | Show `© OpenMapTiles © OpenStreetMap contributors`; schema CC-BY, implementation BSD, OSM ODbL. |
| Overture | ODbL; show `© OpenStreetMap contributors, Overture Maps Foundation`; understand ODbL share-alike implications for derived data. |
| Sentinel-2 / Copernicus | Attribute Copernicus/Sentinel data; modified data notice `Contains modified Copernicus Sentinel data [Year]`; do not call composites live weather. |
| EOXCloudless | Separate product license. 2016 CC BY 4.0; 2018+ CC BY-NC-SA 4.0 noncommercial; commercial use requires EOX license. Attribution must remain visible wherever imagery appears. |
| MapTiler | Show `© MapTiler © OpenStreetMap contributors`; logo required on Free and for 3D sessions on Flex/Custom; respect revocable terms and no-proxy/caching constraints. |
| Esri | Show service-specific `copyrightText`; no tile harvesting/redistribution/self-hosting; commercial use requires appropriate agreement. |
| Existing Mapbox path | Rotate the exposed token. Do not reproduce or continue relying on a hardcoded fallback. |

No statement here overrides legal review.

---

## 10. Screenshot inventory

All files are under `docs/screenshots/`.

| File | What it evidences | Caveat |
|---|---|---|
| [current-default-satellite-basemap-401.png](screenshots/current-default-satellite-basemap-401.png) | Default Mapbox Satellite Streets run with console `401` errors | Captured from real browser; not visually analyzed here |
| [current-custom-basemap-401.png](screenshots/current-custom-basemap-401.png) | Custom Mapbox style run with console `401` errors | Captured from real browser; not visually analyzed here |
| [current-flat-custom-401.png](screenshots/current-flat-custom-401.png) | Flat projection with custom basemap failure | Captured from real browser; not visually analyzed here |
| [current-globe-custom-401.png](screenshots/current-globe-custom-401.png) | Globe projection with custom basemap failure | Captured from real browser; not visually analyzed here |
| [current-weather-satellite-mode.png](screenshots/current-weather-satellite-mode.png) | IEM GOES weather-satellite mode | Feed endpoints were `200 image/png`; visual appearance not analyzed here |
| [candidate-openfreemap-dark-conus.png](screenshots/candidate-openfreemap-dark-conus.png) | OpenFreeMap Dark style reached `READY` in MapLibre harness at CONUS zoom | Candidate only; no provider change made |
| [candidate-openfreemap-fiord-conus.png](screenshots/candidate-openfreemap-fiord-conus.png) | OpenFreeMap Fiord style reached `READY` in MapLibre harness at CONUS zoom | Candidate only; no provider change made |
| [candidate-openfreemap-dark-globe.png](screenshots/candidate-openfreemap-dark-globe.png) | OpenFreeMap Dark style reached `READY` under globe projection in harness | Candidate only; not the app’s current globe style |
| [candidate-esri-world-imagery-dallas.png](screenshots/candidate-esri-world-imagery-dallas.png) | Esri World Imagery tile fetches returned `200` near Dallas | Reachability is not license permission |

---

## 11. Sources consulted

- [MapLibre GL JS docs](https://maplibre.org/maplibre-gl-js/docs/)
- [MapLibre globe example](https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-vector-map/)
- [MapLibre Style Spec — Sources](https://maplibre.org/maplibre-style-spec/sources/)
- [MapLibre Style Spec — Sky](https://maplibre.org/maplibre-style-spec/sky/)
- [MapTiler Cloud pricing](https://www.maptiler.com/cloud/pricing/)
- [MapTiler dark basemaps](https://www.maptiler.com/maps/dark/)
- [MapTiler attribution guide](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/)
- [OpenFreeMap](https://openfreemap.org/)
- [OpenFreeMap quick start](https://openfreemap.org/quick_start/)
- [OpenFreeMap terms](https://openfreemap.org/tos/)
- [OpenMapTiles schema](https://openmaptiles.org/docs/schema/)
- [OpenMapTiles attribution](https://openmaptiles.org/docs/terminology/attribution/)
- [Overture Buildings guide](https://docs.overturemaps.org/guides/buildings/)
- [Overture Building schema](https://docs.overturemaps.org/schema/reference/buildings/building/)
- [Overture attribution and licensing](https://docs.overturemaps.org/attribution/)
- [Esri World Imagery item](https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=json)
- [Esri terms summary](https://goto.arcgis.com/termsofuse/viewsummary)
- [Copernicus Sentinel online data](https://sentinels.copernicus.eu/web/sentinel/data-products)
- [Sentinel Data Legal Notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice)
- [EOXCloudless license](https://cloudless.eox.at/documentation/license)
- [EOXCloudless FAQ / pricing](https://cloudless.eox.at/documentation/faq)
- Prior repository report: `docs/MAP_PLATFORM_AUDIT.md`

---

## 12. Preservation constraints for any future implementation

When this report is approved and implementation begins, preserve all of the following:

1. `lib/radar/capability-matrix.ts` remains the single radar authority.
2. Real data only; no fabricated imagery, screenshots, counts, or validation claims.
3. Unavailable data remains `DATA UNAVAILABLE`; live-only products remain `LIVE ONLY`.
4. Dark navy workstation identity remains; no glassmorphism, cyberpunk neon, or glowing futuristic map treatment.
5. Radar-first layout remains primary.
6. Persisted preferences remain functional.
7. Globe remains the default on first launch; saved user preference is honored.
8. Flat Map remains available.
9. Psalm footer banner remains intact.
10. No capability status changes until end-to-end verification succeeds.

---

## 13. Bottom line

The current map is broken primarily because of **configuration**, not because MapLibre lacks features. The highest-confidence causes are:

1. failed Mapbox basemap requests with `401` that the UI ignores;
2. a raster-only style with baked labels, hardcoded `@2x`, and no fallback layer;
3. late/silent globe projection setup and no atmosphere;
4. shared radar/GOES source identity and a weak z0 satellite probe;
5. multiple hardcoded zoom targets plus `jumpTo` sync and map recreation;
6. no vector building source for `fill-extrusion`.

**Approve the open-first target stack, but fix these integration defects before any provider migration.** MapTiler is the best paid turnkey fallback; Esri is imagery-only and should not be an unlicensed default; EOXCloudless is not a free commercial shortcut; Mapbox should leave the critical basemap path and its exposed token should be rotated.
