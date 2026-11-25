# Phase 4D — Performance Report

## Investigated
- **Multi-click interactions**: overlay profile choices are single-click checkboxes
  in Settings and persist immediately; composite source selection now correctly
  rebuilds the raster source in one action (previously the source never swapped).
- **Delayed responses**: surface feed fetches are debounced 300ms on camera change,
  polled every 180s, and run with `Promise.allSettled` so one failing network cannot
  block the rest. NWS zone geometry/name lookups are cached 10 minutes.
- **Sluggish panels**: panel drag/resize uses pointer events with local refs; React
  state updates only on movement, not per animation frame. Selectors are memoized.
- **Menu latency**: menus are plain conditional trees; no modal/splash path was
  introduced. The composite popover closes immediately on outside click/Escape.

## Measured observations
- Global METAR bbox request returned 378 real features in ~3.8s cold.
- `/api/alerts` cold zone resolution ~18s; cached requests ~1s (previous measurement).
- GLM endpoint remains `DATA UNAVAILABLE` locally because its parser runtime is
  absent; no fallback work is invented.

## Remaining work
Further reduction of cold zone-resolution latency (persistent zone cache) and a
portable GLM runtime are follow-ups; neither is claimed as complete.
