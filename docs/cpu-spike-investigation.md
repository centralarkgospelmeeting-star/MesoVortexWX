# CPU Spike Investigation and Performance Audit

## Honesty note

This audit is a **code-level investigation**. No production CPU telemetry, Vercel
Fluid/Active logs, or per-minute metrics are available in this environment, so no
numeric CPU timeline or measured percentage savings is claimed. What follows is
**verifiable from the source**: provable CPU consumers, removed ones, and
qualitative rankings. The statement "CPU spiked on Nov 25" is treated as a user
observation to investigate, not as a pre-measured metric.

## Mission answer

Can high CPU cause degraded responsiveness? **Yes, in principle**, and the code
contains concrete patterns that produce exactly that symptom set (delayed clicks,
multiple clicks, menu lag, slow panels, cheap feel) under load:

- A **continuous 25 fps `requestAnimationFrame` loop** mutating MapLibre paint on
  the spotter layer (removed below).
- **Repainting every station on every map `render` event** (tile loads, source
  updates, post-render) (removed below).
- **Duplicate `updateWarnings` calls** re-tiling the warning source on each
  alerts/filter change (removed below).

Whether the Nov 25 spike *was* user-visible in production is a correlation
question that needs the platform CPU logs plus the runtime profiler to answer
definitively. No causal claim is made here without that data.

## CPU timeline

| Phase | State (from code/release history) | CPU relevance |
|---|---|---|
| Baseline | Radar + satellite + alerts + persisted UI | Normal |
| Phase 4C/4D | Surface observation station models + global declustering | Canvas station painting; bounded by zoom-aware clustering |
| Phase 4E/4F | More tools + global satellite/composite + tropical | More independent layers; multi-pane possible |
| Phase 4G | Sounding/analysis canvases | Client-side rendering only on open |
| Phase 4 Alerts | Alert volume, voice, siren, reminders, emergency dash | Speech/audio + a small 1.4 s emergency dash when a real Tornado Emergency exists |
| Nov 25 observation | Spike reported; deployments paused | See Largest consumers; not reproducible without logs |

## What was investigated

1. **FastScan polling** — `startReveal` uses rAF `setPaintProperty` only; no React state per frame; reveal ends after ~6 s. `showFastScan` optional.
2. **Radar frame polling** — `setInterval(load, 120_000)` for frames; playback uses `setTimeout(step, frameMs)` not re-render-on-interval; `playbackIndex` state changes per frame while playing.
3. **Satellite polling** — no separate satellite interval; source `setTiles` on selection; base map `satelliteSourceConfigRef` compares config to avoid rebuilding.
4. **Warning polling** — `use-fast-alerts` `POLL_MS = 30_000`; `updateWarnings` now called once per change (was duplicated).
5. **Observation polling** — surface feed 300 ms debounce + 180 s poll + `Promise.allSettled`; page-level memoized selectors.
6. **Duplicate API calls** — `Promise.all` batches where present; `/api/alerts` zone cache 10 min; reports poll 120 s; JTWC 300 s; context effects `cancelled`.
7. **Expensive React renders** — `useMemo`/`useCallback` on alerts/styled filtered/sorted/feature-collection; `updateRadar` deps minimal.
8. **MapLibre rendering loops** — `scheduleStationPaint` rAF-coalesced; **station repaint on `render` removed**; spotter rAF **removed**; emergency dash 1.4 s bounded.
9. **Multi-pane rendering** — `registerSyncedMap` shares camera; renderPane used for expert/quad; no duplicate global timers per pane beyond pane-level; maps are separate canvases.
10. **Timeline updates** — `setPlaybackIndex` per frame while playing; `timelineLoopAvailable` gating; pause stops timers.
11. **Alert processing** — `sortAlerts` + filter + apply once per `alerts`/`alertSettings`; `isEmergencyEvent` scan `some`.
12. **Volume scan processing** — `VolumeScanInspector` + cross-section on demand; not continuous; `/api/radar/cross-section` samples Level II when invoked.

## Largest CPU consumers (qualitative ranking, not measured)

1. **Continuous per-frame MapLibre painting** (was: spotter rAF ~25fps; removed) — highest idle CPU.
2. **Station re-projection + declustering on every `render`** (was; removed) — map render storm.
3. **Duplicate warning source re-tiling** (was; removed).
4. **Multi-pane synchronized maps** (expert/quad) — multiple WebGL canvases; inherently heavier; pane sync uses shared camera.
5. **Alert voice/siren audio scheduling** — transient; bounded durations; silent mode no-op.
6. **Sounding Skew-T/hodograph canvases** — only when panel open.
7. **Observation network fetches + zone resolution** — network-bound; cached; can spike server CPU on cold `/api/alerts`, not necessarily browser.

## CPU by feature (qualitative)

| Feature | CPU profile |
|---|---|
| Radar rendering | WebGL tiles; `setTiles`, no per-frame React state; FastScan rAF transient |
| Satellite | On-demand tiles; `setTiles`; no own poll |
| Composite | Same raster path; source rebuild on composite source change |
| Station models | Canvas repaint on move/zoom/resize; zoom-aware declustering |
| Alerts | Bounded polling + memoized filtering; single update; emergency dash only on emergency |
| FastScan | Transient rAF reveal; optional |
| Multi-pane | Multiple maps + sync; highest client CPU |
| Soundings | On-demand canvas rendering |
| Tropical | Data fetch + existing map layers |

## Estimated savings

No numeric % is claimed. From code structure, this phase removes **three recurring
costs**: a ~25 fps always-on animation, a render-event repaint storm, and a
duplicate re-tiling call. Savings are **qualitative**: less idle CPU, fewer
GPU/source updates, and smoother clicks/menus under load, especially in quad view.

## Quick-win fixes (implemented now, no new features)

1. Removed the continuous spotter pulse `requestAnimationFrame` loop; kept a static ring.
2. Removed `map.on('render', scheduleStationPaint)`; station repaint only on `move`/`zoom`/`resize` + explicit calls (rAF-coalesced).
3. Combined duplicate `updateWarnings` effects into one `source.setData` path.
4. (Pre-existing) rAF coalescing, memoized selectors, bounded polling, zone cache, no React state per animation frame.

## Long-term fixes

- Publish per-route server CPU + client `longtask`/Web Vitals metrics to correlate spikes with releases.
- Memoize `normalizeStationPlots`/`declusterStationPlots` output keyed by `(features, zoom bucket)`; render stations in a separate worker.
- Render each pane on demand; disable background panes' timers while hidden; cap multi-pane count.
- Persistent `/api/alerts` zone cache (shared across requests/restarts).
- Re-enable emergency dash + spotter pulse only if restored behind a low-power toggle.
- Profile with Chrome Performance on a real Tornado Emergency + quad view load.

## User-facing performance impact

Not measurable here. The provable improvements are fewer recurring paints, fewer
duplicate source updates, and no always-on animation; these should reduce CPU
and improve click/menu responsiveness under load. Verify in production with
`npm run typecheck`, `npm run test:verify`, `npm run build` (all pass) and a
browser Performance trace before asserting user-visible latency changes.
