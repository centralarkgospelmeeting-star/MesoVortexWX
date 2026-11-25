# Phase 4E — Performance Report

## Zoom-aware station rendering
Large station networks are declustered in screen space: one representative badge
per cell when zoomed out, full individual station models when zoomed in. This is
computed purely from zoom and coordinates, with no network requests.

## Feed responsiveness
- Camera-driven surface refetch is debounced 300ms.
- Network queries use `Promise.allSettled` so one unavailable feed cannot block
  the others.
- NWS zone geometry and names are cached 10 minutes; alert zone resolution is
  the dominant cold-path cost and is intentionally honest about it.

## UI responsiveness
Report detail and toolbox panels are plain conditional surfaces with pointer-driven
interaction; no repeated animations were added. Measurements and drawings remain
local user annotations, so no backend round-trip is required for tools.

## Remaining work
mPING upstream availability and a portable GLM parser runtime remain external
dependencies; neither is faked. Persistent zone caching across restarts and
further cold-start reduction are follow-ups.
