# Phase 4E — Observation System Report

## One combined layer
A single **OBSERVATIONS** toggle (default on) plots all supported networks in one
canonical station feed. Advanced per-network controls remain in the Surface panel
and Settings; they are never required for the default workflow.

## Source priority
`SURFACE_SOURCE_PRIORITY` resolves duplicate station IDs by real source priority
(METAR > SPECI > ASOS > AWOS > Mesonet > PWS > buoy/marine), then freshness, then
station ID. The lower-priority duplicate is not plotted twice.

## Global rendering
The request bbox follows camera zoom (whole world at overview zoom). Screen-space
declustering shows one density badge per cell when zoomed out and full station
models when zoomed in; no region is filtered and no reading is invented.

## Honest availability
Vendor PWS networks, realtime COOP, GeoColor and GLM remain `DATA UNAVAILABLE`
with recorded probe evidence. Missing fields render as `DATA UNAVAILABLE`.
