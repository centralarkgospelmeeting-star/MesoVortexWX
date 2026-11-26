# Phase 4G — Sounding Report

## Real sources
- **Observed**: IEM RAOB (`json/raob.py`) at real stations. New
  `/api/sounding/nearest?lat&lon` reads the published RAOB network
  (`geojson/network.py?network=RAOB`), finds the nearest real station by great-circle
  distance, and loads the most recent 00/12 UTC profile with date, station name,
  elevation, and distance. No station or profile is invented.
- **Forecast / RAP / HRRR**: `app/api/sounding/route.ts` requires
  `WEATHERPOWER_API_KEY`. Without the key it returns `DATA UNAVAILABLE`. Per-model
  sounding selection remains `UNAVAILABLE` in the capability matrix.

## Click-to-load
The compact toolbox includes a **Sounding** tool. Clicking the map activates the
nearest real observed profile in the Atmospheric Analysis panel. No synthetic
profile is generated from coordinates.

## Removed
`lib/skewt-engine.ts` (`generateThermodynamicSounding`) and the unused
`SkewTSoundingModal` were removed: they fabricated CAPE/SRH/levels from lat/lon
and applied missing-value defaults.

## Verification
`test-phase4g.mjs` asserts real network/profile endpoints and removal of the
synthetic generator. Full gate passed.
