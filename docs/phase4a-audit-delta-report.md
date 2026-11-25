# Phase 4A — Trust Restoration: Audit Delta Report

Date: 2026-11-24  
Baseline commit: `d050a22a8ea09694b7982376b521f11e5628c4e1`  
Scope: remediate the P0 findings in the authoritative master audit only.

## Scope statement

This is a delta report against the earlier master audit, not a new audit and not a release certification. No new meteorological system, product, or model was added. Work stayed inside existing radar, satellite, alert, capability, and map capabilities.

The original master audit conclusions remain authoritative. This report records what changed, why, and what evidence was captured.

## Evidence conventions

Screenshots were captured by Playwright using system Chrome in headless mode at 1600×1000 after the fixes were running locally. UI state was read back from the DOM by the capture script at the same time as each image was saved. This report cites those readbacks and the retained PNGs as evidence; it does not claim that every image was manually visually inspected.

For each finding, the "before" evidence is the authoritative master audit conclusion against baseline commit `d050a22a8ea09694b7982376b521f11e5628c4e1`; the "after" evidence is the changed source, passing guard output, DOM readback, and screenshot listed in that section. Command results and browser readbacks are summarized in `docs/phase4a-verification-log.md`. `npm run test:verify` is a static contract suite, not end-to-end live-data verification.

---

## 1. Alert correctness

### Root causes fixed

- Audio policy was split between `lib/alerts/settings.ts`, a second side effect in `app/page.tsx`, and the fast-alert hook. The page-side effect bypassed the canonical `soundProfile` and custom-sound dispatcher.
- `useFastAlerts()` had no access to canonical alert settings or to whether an alert surface was visible, so it could play a tone while no banner was available.
- Audio arming state was not persisted in the canonical settings path.
- After persistence was added, a restored "armed" state could be reported before the browser had a fresh gesture to unlock Web Audio, so the first background alert could still be blocked.
- Alert selection did not clear `locationContext`, so a stale map-location context could remain active while a specific alert was displayed.
- The warning toggle gated all warning/watch map layers because `showWatches` was unused; turning warnings off also hid watches.

### Files modified

- `lib/alerts/audio.ts`
- `lib/alerts/use-fast-alerts.ts`
- `app/page.tsx`
- `components/RadarMap.tsx`
- `scripts/test-alert-integrity.mjs` (new)
- `package.json`

### What changed

- Added one `playAlertAudio()` dispatcher that checks sound profile, custom sounds, category, banner visibility, and browser support before producing sound.
- `silent` is now a real no-op for built-in tones and custom sounds.
- `useFastAlerts({ settings, bannerVisible })` now reads the canonical settings schema through refs and persists audio arming.
- A restored arming state is re-unlocked by the next pointer or keyboard gesture before any background alert can play; explicit `Enable Tones` still unlocks in the same gesture.
- Removed the duplicate page-level custom-sound effect and its imports/ref.
- All alert-selection paths now clear `locationContext`; map context clicks clear `selectedAlertId`.
- Warning and watch toggles are independent. Other alert categories remain visible regardless of either toggle.

### Screenshot evidence

- `docs/phase4a-screenshots/01-baseline-radar.png` — radar workstation after the alert/map integration fixes.
- `docs/phase4a-screenshots/05-independent-warning-watch-toggles.png` — captured after the script set warnings off and watches on; DOM readback was `false true`.
- `docs/phase4a-screenshots/06-alert-audio-settings.png` — captured with the settings panel open; DOM readback confirmed `Alert Settings`.

### Tests

- `node scripts/test-alert-integrity.mjs` — PASS.
- `npm run test:verify` — includes the alert integrity guard — PASS.

---

## 2. Capability matrix consistency

### Root causes fixed

- Several capability catalogs still reflected stale Phase 3A assumptions after the authoritative radar matrix was updated:
  - MESH, hail detection, QPE, and rotation tracks were described as unavailable.
  - `cross_sections` was `PARTIAL` because a labeled synthetic demo existed, although the real data product is unavailable.
  - QPE was conflated with an unverified combined radar+QPE workflow rather than the working QPE tile itself.
  - `an_cross_sections` cited another catalog's stale wording instead of the radar matrix.
- No guard existed to catch future contradictions.

### Files modified

- `lib/capabilities/feature-capabilities.ts`
- `lib/capabilities/severe-capabilities.ts`
- `lib/capabilities/platform-capabilities.ts`
- `scripts/test-capability-consistency.mjs` (new)
- `package.json`

### What changed

- Catalog statuses and prose were reconciled with `lib/radar/capability-matrix.ts`, which was not modified.
- The synthetic cross-section demo is still labeled as a demo; it is no longer treated as evidence for a real data capability.
- A static guard checks 509 capability entries across six catalogs for status/prose contradictions on the five previously inconsistent radar IDs.

### Screenshot evidence

- `docs/phase4a-screenshots/04-capability-matrix-product-grid.png` — captured with the product drawer expanded. Availability wording is additionally verified by the capability consistency guard.

### Tests

- `node scripts/test-capability-consistency.mjs` — PASS.
- `npm run test:verify` — PASS.

---

## 3. Product legends

### Root causes fixed

- `ProductInfoBanner.tsx` maintained duplicated local scale tables and ended its Radar/Composite branch with a catch-all `Reflectivity` fallback.
- `UniversalLegend.tsx` mixed exact aliases with broad substring rules and returned `ref` for unknown product IDs.

### Files modified

- `components/ProductInfoBanner.tsx`
- `components/UniversalLegend.tsx`
- `scripts/test-legend-integrity.mjs` (new)
- `package.json`

### What changed

- Added exported, read-only `getProductLegendInfo()` from the existing `UniversalLegend` definitions.
- Reordered alias normalization so specialized products resolve before generic `ref`/`vel` rules.
- Unknown or unverified products now render an explicit neutral state: `No verified scale available`.
- Removed all duplicated banner scale tables and the REF fallback.

### Screenshot evidence

- `docs/phase4a-screenshots/02-product-mesh-legend-metadata.png` — captured after selecting MESH; DOM readback showed `MESH SCALE (IN)`.
- `docs/phase4a-screenshots/03-product-qpe-legend-metadata.png` — captured after selecting QPE; DOM readback showed `QPE ACCUMULATION SCALE (MM)`.
- `docs/phase4a-screenshots/07-satellite-mode-metadata.png` — satellite mode uses its own banner/legend path.

### Tests

- `node scripts/test-legend-integrity.mjs` — PASS.
- `npm run test:verify` — PASS.

---

## 4. Product metadata

### Root causes fixed

- The banner's titles/descriptions were locally hard-coded and did not reliably follow the authoritative radar capability matrix.
- Product provenance and data-honesty notes could be replaced by generic reflectivity wording.

### Files modified

- `components/ProductInfoBanner.tsx`

### Authoritative source consumed, not modified

- `lib/radar/capability-matrix.ts`

### What changed

- Radar/Composite banner metadata now comes from `getRadarCapability()`, including capability-derived descriptions and data-honesty notes.
- UI-only aliases (`comp_ref`, `ref_x`, `norm_vel`) map to matrix IDs without adding new products.
- Satellite, outlook, and model branches use their own explicit metadata paths.

### Screenshot evidence

- `docs/phase4a-screenshots/02-product-mesh-legend-metadata.png` — DOM readback: `National MRMS MESH estimate; the tile is the current 2D grid, not a time-maximum swath.`
- `docs/phase4a-screenshots/03-product-qpe-legend-metadata.png` — DOM readback: `National 1-hour accumulation estimate; grid is not a single-site radar product.`

### Tests

- `node scripts/test-legend-integrity.mjs` — PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS.

---

## 5. Map defects

### Root causes fixed

- Overlay text used `Open Sans Bold` / `Arial Unicode MS Bold`, while the OpenFreeMap style serves Noto Sans glyphs.
- A global `radarSourceHealthyRef` could suppress real tile errors after any older or unrelated raster source loaded.
- `showWatches` was accepted but unused, and `removeWarningLayers()` hid watches when warnings were toggled off.
- Layer ordering used the stale literal `'radar-layer'` instead of the canonical layer constants.
- `setTiles()` reused satellite raster sources, so changed `bounds`/`maxzoom` never took effect.
- A missing satellite probe tile fell back to `0/0/0`, falsely marking moving mesoscale sectors unavailable.
- The fast-scan reveal called `setSweepAngle()` on every animation frame, re-rendering the whole workstation.
- During verification, the first sweep refactor introduced a callback/initialization-order regression (`site`/`startReveal` used before declaration). This was corrected before the screenshots were captured and before the final browser smoke check.

### Files modified

- `components/RadarMap.tsx`
- `scripts/test-radar-render-config.mjs`

### Inspected, no change required

- `lib/map/basemap-styles.ts` — Noto Sans glyph declarations were already correct.

### What changed

- Overlay fonts now use `Noto Sans Bold`.
- Tile errors are tracked per raster source; only a loaded tile from the active source clears the banner.
- Warning/watch filtering is category-based and independent; handler rebinding is reset correctly on map rebuild.
- Model layer ordering checks the canonical `RADAR_LAYER_ID` and `SATELLITE_LAYER_ID`.
- Satellite source config changes force a source rebuild so bounds/maxzoom apply.
- Mesoscale sectors with no stable probe tile skip probing rather than probing a blank world tile.
- Sweep updates now mutate the MapLibre GeoJSON source imperatively; no React state is set in the rAF loop.

### Screenshot evidence

- `docs/phase4a-screenshots/01-baseline-radar.png`
- `docs/phase4a-screenshots/05-independent-warning-watch-toggles.png`
- `docs/phase4a-screenshots/07-satellite-mode-metadata.png`

### Tests

- `node scripts/test-radar-render-config.mjs` — PASS.
- `npm run test:verify` — PASS.
- Fresh headless Chrome load after the fix — no JavaScript page errors.

---

## 6. Satellite defects

### Root causes fixed

- Bounds were inferred from sector names rather than live IEM footprint metadata. CONUS, full disk, Puerto Rico, and Alaska were clipped or overextended.
- Probe tiles were chosen from arbitrary bounds centers at z2/z3/z4 and could be transparent or off-sector.
- Maxzoom was overclaimed from the generic TileCache z0–z23 advertisement; resampled tiles implied fake detail.
- Four GOES-East Puerto Rico channel layers did not exist (`ch11`, `ch12`, `ch14`, `ch16`) but were presented as valid.
- IEM's global WebMercator `BoundingBox` was not treated as distinct from real sector coverage.
- The satellite capability matrix still marked mesoscale sectors unavailable while runtime URL generation already emitted IEM mesoscale layer names; ABI evidence still cited the removed `0/0/0` probe.
- A specific satellite unavailable reason was discarded in favor of a generic error banner, and source comments claimed live checks that the static guard does not perform.

### Files modified

- `lib/satellite.ts`
- `lib/satellite/capability-matrix.ts`
- `scripts/test-satellite-capability-matrix.mjs`
- `components/RadarMap.tsx` (probe-null, source-rebuild, and unavailable-reason integration)

### What changed

- Bounds replaced with buffered values from live IEM WMS `LatLonBoundingBox` metadata. Full disk and Alaska use global longitude bands because their footprints cross the antimeridian.
- Mesoscale bounds remain undefined because live GOES-East/West meso sectors move.
- Fixed probe tiles are now verified per bird/sector; mesoscale probes return `null` and are skipped by `RadarMap`.
- Maxzoom ceilings reduced to verified detail levels: full disk 6, Alaska 7, CONUS/Puerto Rico/mesoscale 8.
- Unavailable Puerto Rico layers now return `url: null` with an explicit reason, and `RadarMap` now displays that reason instead of a generic banner.
- The mesoscale capability entry is now `PARTIAL` / `PARTIALLY_VERIFIED`: IEM layer names are wired, while the moving footprint means no fixed bounds or content probe is claimed. ABI evidence now cites the fixed in-sector probe set.
- Source comments distinguish live fixed-sector probes from static mesoscale URL-contract checks; Himawari remains limited to the verified legacy `goes_himawari_ch02` layer.

### Screenshot evidence

- `docs/phase4a-screenshots/07-satellite-mode-metadata.png` — captured after switching to Satellite; DOM readback showed `Visible (Ch 02 Red)` / `Daytime cloud imagery`.

### Tests

- `node scripts/test-satellite-capability-matrix.mjs` — PASS (31 capability entries, 11 probe/URL combinations).
- `npm run test:verify` — PASS.

---

## 7. Data honesty findings

### Root causes fixed

- `GET /api/radar` synthesized archive frame timestamps from the server clock (`new Date()` minus fixed offsets) and presented them as radar metadata.
- The MCD copilot prompt injected invented sounding values (`SBCAPE 2400`, `SRH01 220`, shear `48`, STP `2.4`) and fabricated official/probability framing.
- Root `index.html` contained a stale interactive demo with a hard-coded severe risk score, canned AI replies, and fake live NEXRAD status.
- Stale comments/docs still pointed callers to the deprecated radar frame route.

### Files modified

- `app/api/radar/route.ts`
- `app/api/copilot/mcd/route.ts`
- `index.html`
- `app/api/radar/tiles/route.ts`
- `docs/stabilization/sprint3-api-contract-hardening.md`
- `scripts/test-fake-data-guards.mjs`

### What changed

- `/api/radar` now fails closed with `410 Gone`, no frames/timestamps, and a pointer to `/api/nexrad/frames`.
- The MCD copilot prompt marks missing meteorological inputs `UNAVAILABLE (no verified value supplied)` and explicitly forbids inferring or inventing values.
- `index.html` is now a minimal static archive shell labeled `STATIC ARCHIVE — NOT FOR OPERATIONAL USE`.
- Guards reject fabricated scores, canned AI text, fake live status, numeric prompt defaults, server-clock frame synthesis, and frame-returning `/api/radar` responses.

### Screenshot evidence

- `docs/phase4a-screenshots/08-static-archive-data-honesty.png` — captured from the legacy `index.html`; DOM readback included `STATIC ARCHIVE — NOT FOR OPERATIONAL USE`.

### Tests

- `node scripts/test-fake-data-guards.mjs` — PASS (90 API/lib files scanned).
- `npm run test:verify` — PASS.

---

## Verification evidence

All commands were run from the repository root with Node v20.20.2. Raw/readback summaries are in `docs/phase4a-verification-log.md`.

| Check | Command | Result |
|---|---|---|
| Type safety | `npm run typecheck` | PASS |
| Static verification suite | `npm run test:verify` | PASS — all 13 guards |
| Production build | `npm run build` | PASS — compiled successfully, 5/5 static pages generated |
| Browser smoke check | Fresh headless Chrome context after final fixes, build, and dev-server restart | Hydrated app loaded; no JavaScript page errors, console errors, or failing responses |

`npm run test:verify` includes:

- capability matrix
- satellite capability matrix and probe/URL contracts
- observation capabilities
- severe capabilities
- aviation/marine capabilities
- platform capabilities
- sounding capabilities
- radar render/map-integrity contract
- fake-data guards
- archive integrity
- capability consistency
- alert integrity
- legend integrity

## Screenshot inventory

All PNGs were captured by the Playwright script described in `docs/phase4a-verification-log.md`. The evidence conventions at the top of this report apply.

| File | Evidence |
|---|---|
| `01-baseline-radar.png` | Radar workstation after map/alert fixes; clean browser load confirmed by DOM readback |
| `02-product-mesh-legend-metadata.png` | MESH banner with product-specific scale and capability-derived metadata |
| `03-product-qpe-legend-metadata.png` | QPE banner with product-specific scale and capability-derived metadata |
| `04-capability-matrix-product-grid.png` | Capability product drawer; wording checked by the consistency guard |
| `05-independent-warning-watch-toggles.png` | Warning/watch toggle state read back as `false true` |
| `06-alert-audio-settings.png` | Settings panel open; DOM readback confirmed `Alert Settings` |
| `07-satellite-mode-metadata.png` | Satellite banner readback: `Visible (Ch 02 Red)` / `Daytime cloud imagery` |
| `08-static-archive-data-honesty.png` | Static archive warning readback from legacy `index.html` |

## Residual limitations / not claimed

- `npm run test:verify` is a static contract suite, not end-to-end live-data verification.
- Audio policy was verified statically and by the settings-panel DOM readback; audible playback was not recorded.
- The earlier master audit was not re-run; this report is a remediation delta only.
- The capability consistency guard covers the five radar IDs that were previously contradictory. Other catalog entries remain self-reported.
- Himawari remains reachability-only via the legacy `goes_himawari_ch02` layer.
- A pre-existing `404` from `/api/spotters/reports` was observed in earlier capture runs; it is outside the P0 scope of this delta and was not present in the final clean-load smoke check.
- No new meteorological system, product, or model was introduced.
