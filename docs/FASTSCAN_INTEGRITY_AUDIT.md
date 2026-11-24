# FastScan Integrity Audit and Correction

Date: 2026-11-24  
Branch: `main`  
Starting HEAD: `45494fa`  
Commit message used for this work: `FastScan integrity audit and correction`

## Scope

Audit whether FastScan showed real incoming radar updates or only a cosmetic spinning beam, and correct the behavior without fabricating data or migrating radar providers. MapLibre GL JS and `lib/radar/capability-matrix.ts` remain the authoritative map/radar foundation.

## Current implementation audit

### Before correction

1. `app/page.tsx` initialized `showSweepAnimation` to `true` and passed it to every `RadarMap` through `paneProps`.
2. `components/RadarMap.tsx` computed:

   ```ts
   const sweepEnabled = radarVisualsEnabled && ((sweepAnimationProp ?? showSweepAnimation) || fastScanEnabled);
   ```

   In Radar modes this made the beam an always-on animation.
3. The FastScan effect polled `/api/nexrad/frames` every 10 seconds, but the API returned a static `latestTileUrl` ending in `-0/` plus a synthetic `LIVE` time generated from `new Date()`. IEM's `-0` tile is a latest pointer and has no `Last-Modified` or `ETag` header, so the URL did not change when a new volume scan arrived.
4. The ingest detector only compared `tileUrl` to `prevTileUrlRef.current`. Because the URL stayed constant between scans, `setScanIngesting(true)` and `onNewScan` were driven by product/site/tilt changes, not by verified incoming scans.
5. There was no old-frame retention or progressive reveal: the sweep was decorative, and the raster source was swapped with normal MapLibre fade behavior.

### Real-data availability probe

IEM publishes a verified volume-scan index at `https://mesonet.agron.iastate.edu/json/radar.py?operation=list`. Live probe for KLZK/N0B returned discrete scan times such as `2026-11-24T23:16Z`. Timestamped IEM RIDGE tiles for those scan tokens returned real PNG imagery with distinct hashes, confirming a legitimate new-scan signal.

## Verdict

**Cosmetic at the reveal layer.** FastScan did perform faster real API polling, but the beam and “scan ingest” state were not connected to incoming radar scan timing. The displayed beam could run continuously and appeared to imply scan progress that the data path could not verify.

## Correction implemented

### 1. Verified scan-time resolution

Added `lib/radar/iem-scan-time.ts`:

- Resolves the latest published IEM volume scan for a radar/product.
- Uses a bounded lookback window and a short request timeout.
- Converts ISO UTC scan time into the `YYYYMMDDHHMM` tile stamp used by IEM.
- Returns `null` when no verified scan is available; no guessed timestamps.

### 2. Honest frames API response

Updated `app/api/nexrad/frames/route.ts`:

- Resolves IEM scan time only for RIDGE sources with a verified scan index.
- Pins `latestTileUrl` to the verified timestamped tile instead of the ambiguous `-0` latest pointer.
- Adds `scanTime`, `scanTimeSource`, `scanTimeAvailable`, and `latestTileStamp`.
- Replaces the synthetic `LIVE` time with `VERIFIED SCAN <time>` or `LIVE ONLY`.
- Sets `Cache-Control: no-store` so each poll sees the current published scan.
- Leaves other sources explicitly `LIVE ONLY`; FastScan reveal is disabled for them.

### 3. Real scan-triggered reveal

Updated `components/RadarMap.tsx`:

- Removed `showSweepAnimation` and `sweepAnimation` props and the always-on interval.
- Beam is active only while `scanIngesting` is true.
- A reveal starts only when all of these are true:
  - the API reports a verified scan time;
  - the scan key changes while product/site/tilt context stays the same;
  - a previous real tile URL exists;
  - FastScan is enabled.
- Product, site, or tilt changes do not masquerade as new scans.
- Enabling FastScan does not replay an already-observed scan.
- `startReveal` keeps the previous radar raster layer visible, fades the new scan raster from 0 to the configured opacity over 6 seconds, and sweeps the beam from 0 to 360 degrees during that interval.
- Old tiles are removed when the sweep completes, and MapLibre's configured raster fade duration is restored.
- When no verified scan time exists, the map shows `FASTSCAN LIVE ONLY · NO VERIFIED SCAN TIME` and no beam.
- When verified scan data is available and idle, the map shows `FASTSCAN READY · VERIFIED <scan time>`.

Updated the toggle label in `components/WeatherWiseRadarCard.tsx` to `Fast Scan (verified scan reveal)`.

Updated `lib/capabilities/feature-capabilities.ts` so FastScan and beam-animation entries describe the verified scan-index behavior while retaining `PARTIAL` for unproven ultra-low-latency and Level II beam timing.

## Files modified

- `lib/radar/iem-scan-time.ts` (new)
- `app/api/nexrad/frames/route.ts`
- `components/RadarMap.tsx`
- `app/page.tsx`
- `components/WeatherWiseRadarCard.tsx`
- `lib/capabilities/feature-capabilities.ts`
- `docs/FASTSCAN_INTEGRITY_AUDIT.md`
- `docs/screenshots/fastscan-disabled-no-beam.png`
- `docs/screenshots/fastscan-ready-verified-scan.png`
- `docs/screenshots/fastscan-reveal-verified-new-scan.png`

## Verification

### Automated

- `npm run typecheck` — PASS
- `npm run build` — PASS
- `npm run test:verify` — PASS (capability matrix, satellite, observation, severe, aviation/marine, platform, sounding, radar render config, fake-data guards, archive integrity)

### Live API

Request:

```text
GET /api/nexrad/frames?site=KLZK&product=ref&tilt=0.5
```

Observed response fields:

```json
{
  "scanTime": "2026-11-24T23:16Z",
  "scanTimeSource": "IEM RIDGE volume scan list (json/radar.py operation=list)",
  "scanTimeAvailable": true,
  "latestTileStamp": "202611242316",
  "label": "VERIFIED SCAN 2026-11-24 23:16 UTC",
  "latestTileUrl": "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::LZK-N0B-202611242316/{z}/{x}/{y}.png"
}
```

### Browser

- FastScan off: no beam and no ingest badge.
- FastScan on with verified scan: `FASTSCAN READY · VERIFIED ...` badge; no beam while idle.
- New verified scan: `SCAN INGEST FRONTIER` banner and one 6-second beam/reveal cycle, then idle state.
- The only browser console error observed was the pre-existing unrelated `GET /api/spotters/reports` 404.

Screenshots are real browser captures; no synthetic or fabricated radar imagery was created.

## Data honesty notes

- No provider migration was performed.
- No archive frames are fabricated; playback remains `LIVE_ONLY` for this route.
- Unavailable scan timing is reported as `LIVE ONLY`, not as a completed scan.
- `lib/radar/capability-matrix.ts` was not changed.
