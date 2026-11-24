# Map Platform Audit — MesoVortexWX

**Date:** 2026-11-24  
**Scope:** Audit the current map stack only. Do **not** replace MapLibre and do **not** implement new providers.  
**Repository state audited:** `main` at `0917888` (`Fix WarningCard onSelect handler`).  
**Installed renderer:** `maplibre-gl@6.16.0` (`package.json:32`, `node_modules/maplibre-gl/package.json:3`).

> No runtime browser profiling or screenshots were captured in this headless session. Findings are based on source inspection, installed API typings, and current provider documentation. “Likely” below means a code-supported diagnosis that still needs visual confirmation in the browser.

---

## 1. Executive conclusion

**Do not migrate the map engine.** MapLibre GL JS 6.16.0 already supports every requested mode at the library level:

| Requested mode | Engine support in MapLibre 6.16.0 | Current app state | Verdict |
|---|---|---|---|
| Globe | Native `setProjection({ type: 'globe' })`; globe shaders/meshes, projection transitions, globe terrain support | Toggle/default exist but are applied after load, errors are swallowed, no globe atmosphere style, no tests | **PARTIAL** |
| Flat map | Native Mercator default | Toggle exists; component fallback also Mercator | **IMPLEMENTED / PARTIAL** |
| Satellite | Native raster tile layers | Two conflicting meanings: Mapbox “Satellite Streets” basemap and IEM GOES weather-satellite mode | **PARTIAL** |
| Dark map | Arbitrary raster/vector style layers | Active UI relies on an opaque Mapbox style ID; real Carto dark tiles exist only in dead code | **PARTIAL / UNVERIFIED** |
| 3D buildings | Native `fill-extrusion` with vector `height`/`min_height` | No vector source, no building layer, no extrusion; only camera pitch | **UNAVAILABLE in app** |

The glitches are integration problems, not a MapLibre capability gap. The main causes are: projection applied after first paint, silent projection failure, raster-only basemap, map teardown on basemap change, camera sync using `jumpTo`, ambiguous provider/layer ownership, and a z0-only satellite probe.

**Recommended stack:** keep MapLibre GL JS; use an OSM-derived vector basemap (Protomaps self-hosted or hosted API, with OpenFreeMap as a zero-key option) for dark/flat/buildings; use open Copernicus Sentinel-2 data for a true satellite basemap; keep IEM GOES strictly as a live weather-satellite data mode; remove Mapbox from the critical basemap path after the token is rotated.

---

## 2. Architecture report

### 2.1 Renderer and worker

- One `maplibregl.Map` per `RadarMap` instance (`components/RadarMap.tsx:502-508`).
- MapLibre’s worker is served from `/public` because webpack breaks the package-relative worker URL (`components/RadarMap.tsx:16-20`; `scripts/copy-maplibre-worker.mjs:1-8`).
- The worker deployed in `public/maplibre/maplibre-gl-worker.mjs` was verified byte-identical to the package worker during this audit; it is not the source of the globe problem.

### 2.2 Basemap style construction

`buildMapboxRasterStyle()` (`components/RadarMap.tsx:199-222`) creates a minimal style:

- `version: 8`
- one `raster` source: `mapbox-basemap-source`
- one `raster` layer: `mapbox-basemap-layer`
- tile URL: `https://api.mapbox.com/styles/v1/{stylePath}/tiles/512/{z}/{x}/{y}@2x?access_token=...`
- `attribution: '© Mapbox © OpenStreetMap'`

There is:

- no `vector` source,
- no glyphs/sprite,
- no `fill-extrusion`,
- no terrain/`raster-dem`,
- no sky/atmosphere,
- no `projection` key in the style.

That is why 3D buildings and a verified independent dark style are absent even though the renderer supports them.

### 2.3 Lifecycle

- The map is removed and recreated whenever `basemap` changes (`components/RadarMap.tsx:494-508`, cleanup `:553-565`, dependency `:565`).
- This discards camera, tile cache, imperatively added layers, markers, and projection state. Layers are re-added on `load` (`:542-551`).
- `setProjection()` runs in a separate effect keyed on `[mapReady, projectionMode]` (`:430-438`), so every basemap switch repeats the projection transition.
- `setPitch()` clamps to `0..75` (`:440-444`); the UI slider offers `0..60` (`app/page.tsx:1516`).

### 2.4 Operational layers

All weather/operational overlays are added imperatively after `load` using fixed IDs declared at `components/RadarMap.tsx:140-198`:

- warnings/MCD,
- range rings,
- sweep,
- spotters and reports,
- hurricane cones/tracks/radii,
- GLM lightning,
- model raster,
- radar/satellite raster,
- local drawing/measurement tools.

Layer order is managed with `beforeId` (for example `:580-583`, `:1104`, `:1267`).

### 2.5 Camera sync

- Active sync: `lib/map-sync.ts:8-63`.
- Each pane registers with `registerSyncedMap(syncGroup, map)` (`components/RadarMap.tsx:1788-1792`).
- Sync mirrors `center`, `zoom`, `bearing`, and `pitch` with immediate `jumpTo` (`lib/map-sync.ts:28-54`).
- Projection is **not** synchronized. That is acceptable only because `projectionMode` is global, but a failed per-map projection call would leave panes in mixed projections.
- `jumpTo` can interrupt in-flight `flyTo` animations from `components/RadarMap.tsx:1849` and `:1860`, producing jumps rather than smooth synchronized motion.

### 2.6 State and persistence

- Active basemap/projection state lives in `app/page.tsx:210-211` and `:238-240`, and is forwarded to every pane through `paneProps` (`:549-591`).
- Globe is the default saved preference (`app/page.tsx:92-94`); `RadarMap`’s own prop fallback is Mercator (`:359`). The main page passes the prop explicitly, but the mismatch is a latent bug for any other caller.
- There are two projection persistence paths:
  - unified `mesovortex_preferences_v1` (`app/page.tsx:278-310`),
  - legacy `mesovortex_projection_mode` read on startup (`app/page.tsx:384-394`).
  The legacy value can overwrite the newer unified preference if both exist.
- Basemap persistence accepts only `satellite-streets` and `custom-weather` (`app/page.tsx:384-389`), even though `BasemapType` declares four values (`components/RadarMap.tsx:23`).

---

## 3. Requested investigation findings

### 3.1 Current map issues

1. **Basemap selector is not a real multi-style architecture.** `BasemapType` has four values, but the style builder has only two outcomes: `custom-weather`/`mapbox` map to the custom style; everything else maps to `mapbox/satellite-streets-v12` (`components/RadarMap.tsx:23`, `:134-138`, `:199-202`). The active UI exposes only two buttons (`app/page.tsx:841-862`).
2. **“Dark map” is label-only in the active path.** The active “dark” choice is an opaque Mapbox style ID (`components/RadarMap.tsx:134-138`). Real Carto dark tiles exist only in unused code (`components/SynchronizedQuadView.tsx:38-61`) and the legacy root `index.html`.
3. **Hardcoded Mapbox token fallback.** A real-looking token is embedded in source (`components/RadarMap.tsx:126-132`) and duplicated in local `.env.local`. The repo’s own source registry flags this (`lib/data-sources.ts:264-271`). This must be treated as exposed and rotated.
4. **Unused MapTiler key.** `.env.example:8-9` and `.env.local` define `NEXT_PUBLIC_MAPTILER_KEY`, but no TS/JS code reads it.
5. **Basemap failures are invisible.** The map `error` handler ignores every source except `RADAR_SOURCE_ID` (`components/RadarMap.tsx:515-526`).
6. **Late radar failures are suppressed.** `radarSourceHealthyRef` becomes true on the first successful radar load and then suppresses later 404/503 banners (`:528-537`, `:1257-1264`).
7. **Silent projection/pitch failures.** Both calls are wrapped in `try/catch` with `as any` (`:430-444`). UI state can say “Globe” while the map remains Mercator.
8. **Map starts at CONUS, not the selected site.** Every map starts at `[-98.5795, 39.8283]`, zoom `4.4` (`:502-508`).
9. **Site changes do not always move the camera.** The fly-to only runs when radar visuals plus range rings are enabled (`:1841-1854`), while the default preference has `showRangeRings: false` (`app/page.tsx:92-94`).
10. **Two “satellite” meanings collide.** A header button selects Mapbox Satellite Streets basemap; the main Satellite tab selects IEM GOES data mode (`app/page.tsx:843-861`, `:894`, `:1126-1139`).
11. **Dead/duplicate systems remain.** `leaflet`/`react-leaflet` dependencies are unused in app code (`package.json:31`, `:37`); `SynchronizedQuadView` and `SettingsWorkspace` are not imported by the active app; `lib/layers/registry.ts` is only consumed by unused `LayerManagerPanel`.
12. **No map-specific tests.** Existing test scripts cover capability matrices, fake-data guards, archive integrity, and radar render config, but not projection, basemap switching, or camera sync (`package.json:16-26`).

### 3.2 Why globe mode is glitching

MapLibre itself supports globe in 6.16.0: `setProjection()`/`getProjection()` exist (`node_modules/maplibre-gl/dist/maplibre-gl.d.ts:8920-8921`), the style spec accepts a projection (`node_modules/@maplibre/maplibre-gl-style-spec/dist/index.d.ts:8527`, `:8793-8802`), and globe uses subdivided meshes plus a Mercator↔globe transition (`maplibre-gl.d.ts:4510-4550`, `:4636-4644`).

Likely causes in this app:

1. **Projection is applied after first paint.** The generated style contains no `projection`; the app waits for `mapReady`, then calls `setProjection()` (`components/RadarMap.tsx:204-221`, `:430-438`). MapLibre fires a projection transition and reloads tiles when projection changes, so the first paint can flip or pop.
2. **Every basemap change recreates the map**, forcing the projection transition again (`:494-565`).
3. **Failures are swallowed**, so the UI may claim Globe while the runtime is still Mercator (`:433-437`).
4. **Zoom targets cross the automatic globe→Mercator transition.** MapLibre hides globe at high zoom for float precision (`maplibre-gl.d.ts:4538-4546`, `:4643`). Site fly-to uses zoom 7.5 (`components/RadarMap.tsx:1849`); search uses 6–10 (`app/page.tsx:699-703`). Users can perceive this as globe “turning off” or suddenly flattening.
5. **Raster-only, regional tiles on a whole-earth view.** Radar and GOES tiles are regional Web Mercator rasters (`components/RadarMap.tsx:1134-1148`; `lib/satellite.ts:124-149`). MapLibre can reproject raster tiles onto a globe, but the documentation notes seams and subdivision complexity, especially at mixed zoom levels and poles. Coverage gaps and stretched edges are expected unless the source is designed for globe use.
6. **No atmosphere/sky styling.** MapLibre supports `setSky`/atmosphere (`maplibre-gl.d.ts:16184-16187`; style spec `:8740-8785`), but the active style defines none. The globe can look “flat” or abruptly clipped.
7. **Pitch interaction.** Globe has different camera behavior, and the app applies up to 75° pitch (`components/RadarMap.tsx:443`) with no globe-specific guard.
8. **Multi-pane sync fights animation.** `jumpTo` sync (`lib/map-sync.ts:36-54`) can cancel sibling `flyTo` calls while tiles are reloading under the new projection.

**Most probable primary cause:** a late `setProjection()` on a raster-only style that is repeatedly torn down, with silent failure and no atmosphere styling. This should be fixed before considering any provider migration.

### 3.3 Why multiple map providers are conflicting

There is no single provider abstraction. Hardcoded providers live in separate modules and compete for naming and layer identity:

| Provider/source | Role | Evidence |
|---|---|---|
| Mapbox Styles API raster tiles | Active basemap for both UI choices | `components/RadarMap.tsx:126-138`, `:199-221`, `:502-508` |
| Mapbox Geocoding | Search | `app/page.tsx:670-674` |
| IEM RIDGE / GOES tiles | Radar, composite, live satellite overlays | `components/RadarMap.tsx:1134-1148`; `lib/satellite.ts:124-149` |
| ECCC WMS | Model overlay | `components/RadarMap.tsx:1103-1114` |
| Carto `dark_all` | Dead quad view + legacy Leaflet page | `components/SynchronizedQuadView.tsx:43-59`; root `index.html` |
| MapTiler | Env-only, unused | `.env.example:8-9`; `.env.local` |
| EOX Sentinel-2, NASA GIBS, Mapzen terrain, Census/us-atlas | Registered as not implemented | `lib/data-sources.ts:208-217`, `:237-261` |

Specific conflicts:

- **Shared mutable layer ID:** `mv-radar-source` / `mv-radar-layer` carry both radar and GOES satellite tiles (`components/RadarMap.tsx:140-141`, `:1134-1148`, `:1266-1332`). Radar and satellite cannot coexist in one pane.
- **Vocabulary drift:** `lib/layers/registry.ts:23-52` uses legacy GOES paths such as `goes-east-vis-1km-900913`; `lib/satellite.ts:132-149` uses `goes_east_conus_ch02`. Only the latter is active.
- **Name collision:** “Satellite” means both a Mapbox ground-imagery basemap and an IEM weather-satellite data mode.
- **Opaque style:** `mapbox` and `custom-weather` both resolve to one external style ID whose contents are not documented in the repo.
- **Token drift:** Mapbox token is in source, local env, and used for geocoding; MapTiler key is unused.
- **Two sync implementations:** active `lib/map-sync.ts` vs unused `SynchronizedQuadView` global boolean sync.

At runtime the app is not simultaneously rendering many basemap providers. The conflict is architectural and operational: naming, ownership, credentials, dead code, and shared layer IDs.

### 3.4 Existing satellite layers

**Active live weather satellite mode**

- Product/bird/sector model: `lib/satellite.ts:1-65`.
- GeoColor, AirMass, Sandwich, Cloud Phase, Fire Temperature, and Dust are explicitly unavailable (`:67-80`).
- Visible/IR/water-vapor and Ch01–Ch16 are exposed only where a verified IEM channel URL exists (`:81-149`).
- Selected URL is probed once by rewriting `{z}/{x}/{y}` to `0/0/0` (`components/RadarMap.tsx:1149-1164`). Sector-specific products may not have a valid z0 tile, so this can falsely report `DATA UNAVAILABLE`.
- Rendered through the shared radar layer with satellite-specific saturation/contrast/brightness (`:1269-1282`).
- Archive is explicitly unavailable: `archiveAvailable = false` (`:1141`), consistent with `lib/satellite/capability-matrix.ts:53`.

**Satellite basemap**

- The header “Satellite” button selects Mapbox `satellite-streets-v12` raster tiles (`components/RadarMap.tsx:138`, `:199-202`; `app/page.tsx:843-861`). This is commercial ground imagery, not a weather-satellite product.

**Inactive registry**

- `sat.visible`, `sat.ir`, and `sat.waterVapor` are defined in `lib/layers/registry.ts:23-52` but only consumed by unused `LayerManagerPanel`.

### 3.5 Existing building layers

There are none.

- Repository-wide search of `app/`, `components/`, and `lib/` found no `fill-extrusion`, no vector source, no `setTerrain`, no `setSky`, and no building layer.
- Terrain and elevation are explicitly `UNAVAILABLE` in `lib/capabilities/platform-capabilities.ts:15`, `:19`.
- `lib/data-sources.ts:237-244` lists Mapzen/Terrain Tiles as `NOT_IMPLEMENTED`.
- The only “3D” implementation is camera pitch (`components/RadarMap.tsx:440-444`, `app/page.tsx:1516`), which tilts a flat raster map.
- `3D Radar` remains in type definitions (`components/RadarMap.tsx:22`) and dead settings UI (`components/SettingsWorkspace.tsx:147`) but is not an active tab (`app/page.tsx:893-908`). Capability truth says it is not volumetric radar (`lib/capabilities/feature-capabilities.ts:28`).

MapLibre can render buildings: `FillExtrusionLayerSpecification` and `fill-extrusion-height`/`fill-extrusion-base` exist in the installed style spec (`node_modules/@maplibre/maplibre-gl-style-spec/dist/index.d.ts:10347`, `:10451`, `:10456`, `:10903`). The missing piece is the vector source/style, not the renderer.

---

## 4. Recommended provider stack

No provider implementation is proposed here. This is the target architecture for a later approved phase.

| Layer | Recommended choice | Why | Current action |
|---|---|---|---|
| Map renderer | **MapLibre GL JS 6.16.0** | BSD-3-Clause, no license fee, native globe/flat/raster/vector/terrain/fill-extrusion, community governed | Keep |
| Dark/flat basemap | **Protomaps OSM PMTiles** (self-hosted or hosted API), dark flavor | OSM-derived, open source, dark style, building `height`/`min_height`, explicit escape hatch to self-host | Evaluate; no implementation yet |
| Zero-key alternative | **OpenFreeMap** Dark/Fiord/3D styles | No key, no published request cap, commercial use allowed, MIT project; public instance is “as-is” | Evaluate for development/fallback |
| Satellite basemap | **Copernicus Sentinel-2 L2A / cloudless mosaics** from open data | Free, full and open access including commercial use; no proprietary imagery license | Evaluate; keep IEM GOES separate |
| Live weather satellite | **IEM GOES** current verified channels/sectors | Real live feed already wired and capability-gated | Keep, but separate from basemap |
| Weather overlays | Existing NWS/IEM/NOAA routes | Real data, attribution already recorded | Keep |
| Terrain (optional 3D context) | Terrain Tiles on AWS / Copernicus DEM, via `raster-dem` | Open elevation data; MapLibre supports terrain and globe+terrain | Defer until buildings are verified |
| Geocoding | Keep current provider temporarily, then decide independently | Search is not a map-style provider; avoid coupling it to basemap migration | Rotate/review token |
| Avoid as critical path | Mapbox raster basemap, Esri World Imagery for commercial use, Carto raster without key | Proprietary/usage cost or noncommercial-only/key-required constraints | Plan removal/quarantine |

**Most free and sustainable answer:** MapLibre + OSM-derived vector tiles (Protomaps self-hosted, or OpenFreeMap public/self-hosted) + Copernicus Sentinel-2 open imagery. This avoids proprietary renderer terms, avoids per-tile vendor lock-in, and preserves an exit path to self-hosting.

---

## 5. Monthly cost estimate

Estimates are planning figures, not vendor quotes. Actual traffic determines cloud cost.

| Stack item | Free / low-cost option | Commercial or scale option |
|---|---|---|
| MapLibre GL JS | **$0** license (BSD-3-Clause) | $0 |
| OpenFreeMap public styles | **$0**, no key, no published request cap; as-is service, may discontinue | Self-host from weekly planet exports; pay hosting only |
| Protomaps hosted API | **$0** non-commercial, soft cap ~1M tile requests/month | **$14/month** commercial sponsor up to ~1M requests; no overage fee, may be contacted if consistently over |
| Protomaps self-hosted | Cloudflare example from provider calculator: about **$11.45/month** at 10M requests / 1TB egress / 110GB storage | AWS example: about **$119.56/month** at same load; regional/desktop traffic is usually far lower |
| Sentinel-2 / cloudless mosaics | **$0** data license; public COGs over HTTPS | Pay only optional proxy/tiler/storage/egress. At ~1TB egress, Cloudflare R2 has $0 egress; AWS CloudFront example is ~$100/TB egress plus requests |
| IEM GOES / NEXRAD / NWS feeds | No per-tile license fee in current usage; verify provider usage policy | Not applicable unless a provider changes terms |
| Existing Mapbox basemap | Unknown from repo; token-based billing | No billing data in repository. Existing token must be rotated regardless |
| Carto raster basemaps | Free with API key: 5M requests/month non-commercial, 1M commercial | **$500/month** commercial up to 10M; **$1,500/month** up to 50M. Raster tiles require a key since 2026-09-25 |
| Esri World Imagery | Public non-commercial use only, with attribution and restrictions | Commercial license required; quote-based. Not suitable for a free/sustainable commercial stack |

**Recommended planning totals**

- **Lowest vendor spend:** OpenFreeMap public style + Sentinel-2 open COGs + IEM/NWS overlays + MapLibre = **$0/month** in license/API fees, with availability/performance risk accepted.
- **Low-cost controlled:** Protomaps hosted commercial API + Sentinel-2 open data + MapLibre = **~$14/month** at up to ~1M basemap tile requests, plus optional imagery proxy/egress.
- **Self-hosted controlled:** Protomaps PMTiles on Cloudflare/R2 + Sentinel-2 open data + MapLibre = typically **single-digit dollars/month** at small scale; provider calculator example about **$11.45/month** at 10M requests, or about **$119.56/month** on AWS at the same load.

---

## 6. Licensing review

This is an engineering review, not legal advice. Terms should be rechecked before launch.

| Component | License / terms | Obligations and risk |
|---|---|---|
| MapLibre GL JS | BSD-3-Clause | No license fee, no account. Retain notices if redistributed. Community governed. |
| Protomaps code/styles | Code BSD-3; visual design CC0; PMTiles spec public domain | Retain code notices. Attribution requested but not required for style use. |
| Protomaps tiles / OSM data | ODbL Produced Work | Visible `© OpenStreetMap contributors` attribution required. Hosted API commercial use requires GitHub Sponsor. |
| OpenFreeMap | Project MIT; OSM ODbL; public instance terms updated 2026-11-24 | Attribution required: `OpenFreeMap © OpenMapTiles — Data from OpenStreetMap`. Public service is “as-is” and may discontinue without notice. Commercial use allowed. |
| Copernicus Sentinel-2 | Free, full and open access, including commercial use; commonly expressed as CC-BY-SA-3.0-IGO for Sentinel data | Cite Copernicus/Sentinel and identify derived products as modified Copernicus Sentinel data. Quarterly cloudless mosaics are monthly/quarterly composites, not live imagery. |
| IEM GOES/NEXRAD | NOAA/NESDIS/IEM public data path already used | Keep existing attribution: NOAA/NESDIS via IEM, IEM/NOAA/NWS. Respect IEM usage volume. |
| Mapbox current basemap | Proprietary Mapbox Terms; token and usage billing | Hardcoded public token in tracked source (`components/RadarMap.tsx:126-132`) must be rotated. Raster style is not a vector source; no 3D buildings. |
| CARTO dark tiles | CARTO Basemap Terms; OSM ODbL | Free with key: 5M non-commercial / 1M commercial monthly. Attribution `© OpenStreetMap contributors, © CARTO` visible on map. Raster requires key since 2026-09-25; paid commercial tiers start at $500/month above free limit. |
| Esri World Imagery | Esri Web Site and Service Terms | Non-commercial use only unless separately licensed. Third-party imagery restrictions apply. Attribution: `Sources: Esri, DigitalGlobe, GeoEye, i-cubed, USDA FSA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community`. Not recommended as the free/commercial default. |

**Licensing conclusion:** the recommended stack is compatible with the project’s honesty and sustainability constraints. The most urgent licensing/security issue is not a new provider; it is the exposed Mapbox token fallback and the unverified opaque Mapbox style.

---

## 7. Implementation plan

Staged plan only. No provider implementation should begin until this audit is accepted and the token is rotated.

### Phase 0 — Safety and evidence (no provider change)

1. Remove the hardcoded Mapbox token fallback from `components/RadarMap.tsx:126-132`; require `NEXT_PUBLIC_MAPBOX_TOKEN` or show explicit `DATA UNAVAILABLE`.
2. Rotate/revoke the exposed Mapbox token and review usage history.
3. Decide whether the legacy root `index.html` and unused `SettingsWorkspace`/`SynchronizedQuadView`/`LayerManagerPanel` should be quarantined or removed; they contain stale provider names and unverified UI claims.
4. Add map-specific tests for projection state, basemap resolution, and camera-sync registration.

**Acceptance:** no token in tracked source; all basemap choices resolve through one tested registry; no dead component advertises unavailable products.

### Phase 1 — Stabilize current MapLibre globe/flat

1. Declare projection in the style on `style.load` before first paint instead of after `mapReady` (`components/RadarMap.tsx:430-438`).
2. Stop swallowing projection failures: record `map.getProjection()` and surface `DATA UNAVAILABLE` or an explicit projection-failure state if requested globe is not active.
3. Avoid full map recreation for basemap switches; use one style source registry and `map.setStyle()` where possible, re-adding operational layers deterministically.
4. Add globe atmosphere/sky styling for the globe style.
5. Replace `jumpTo` sync with a guarded sync/ease approach that does not cancel active `flyTo` animations (`lib/map-sync.ts:28-54`).
6. Resolve the two projection-persistence paths so the unified preference is authoritative.

**Acceptance:** globe and flat toggle reliably in single, quad, and expert panes; no first-paint flip; UI projection matches `map.getProjection()`; basemap switch preserves camera and overlays.

### Phase 2 — Separate satellite meanings

1. Introduce distinct source/layer IDs for ground satellite basemap and live GOES weather satellite; stop reusing `mv-radar-source` for both.
2. Rename UI labels: “Satellite Basemap (ground imagery)” vs “Weather Satellite (GOES live)”.
3. Replace z0-only availability probe with a probe matching the selected sector/zoom, with explicit `DATA UNAVAILABLE` when unavailable.
4. Keep advanced RGB/GeoColor products unavailable until an end-to-end verified feed exists.

**Acceptance:** radar and GOES can be reasoned about independently; no false `DATA UNAVAILABLE` from a z0-only probe; no product claim beyond the verified matrix.

### Phase 3 — Verified dark basemap and 3D buildings

1. Add a vector source with OSM building height/min-height from the chosen provider.
2. Add a `fill-extrusion` layer below labels; do not apply it to raster tiles.
3. Provide at least one explicit dark style with visible OSM attribution.
4. Verify `fill-extrusion` under globe and flat projections; keep radar imagery primary and avoid covering it.
5. Update capability entries only after end-to-end verification.

**Acceptance:** dark and 3D-building modes render with correct attribution; radar remains readable; capability matrix reflects real status.

### Phase 4 — Satellite basemap evaluation

1. Prototype open Sentinel-2 COG/mosaic rendering in a separate branch.
2. Compare direct COG protocol vs pre-tiled PMTiles for CORS, latency, and cost.
3. Keep clear temporal labels: a quarterly cloudless mosaic is not current weather.
4. Do not replace IEM GOES live weather mode.

**Acceptance:** licensing, attribution, freshness, and cost are documented before any provider switch.

### Phase 5 — Final validation

- Browser checks for: Globe, Flat, Dark, Satellite basemap, Weather Satellite, 3D buildings, quad view, expert view.
- Capture real before/after screenshots; never synthesize them.
- Run `npm run -s build` and `npm run -s test:verify`.
- Update `lib/capabilities/platform-capabilities.ts` and `lib/data-sources.ts` only with verified results.

---

## 8. Build and test results

Run after restoring the already-declared missing local dependency with `npm install --no-audit --no-fund`. `package-lock.json` was reverted afterward; no dependency manifest change is part of this audit.

### Build

`npm run -s build` — **PASS**

- Next.js 14.2.15 compiled successfully.
- Type checking and lint validity passed.
- Static pages generated 5/5.
- Route table produced successfully.

### Tests

`npm run -s test:verify` — **PASS**

- Capability matrix: 27 entries, PASS.
- Satellite capability matrix: 31 entries, PASS.
- Observation capabilities: 43 entries, PASS.
- Severe capabilities: 43 entries, PASS.
- Aviation/marine capabilities: 23 entries, PASS.
- Platform capabilities: 72 entries, PASS.
- Sounding capabilities: 251 entries, PASS.
- Radar render config contract: PASS.
- Fake-data guards: 88 files scanned, PASS.
- Archive integrity: 2 datasets validated, PASS.

### Files modified by this audit

- `docs/MAP_PLATFORM_AUDIT.md` — this report only.

No map provider, basemap, projection, layer, or renderer implementation was changed.

---

## 9. Bottom line

The current MapLibre stack can support Globe, Flat, Satellite, Dark, and 3D buildings. The blockers are:

1. late/silent projection setup,
2. raster-only opaque Mapbox basemap,
3. shared provider/layer identity,
4. map teardown on basemap change,
5. camera-sync/animation conflict,
6. missing building vector source,
7. weak verification and an exposed token.

Fix those before migrating providers. The sustainable target is MapLibre + open OSM vector tiles + open Copernicus imagery, with IEM GOES retained as a separate live weather-satellite product.
