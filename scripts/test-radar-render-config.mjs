#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('lib/radar/render-config.ts', 'utf8');

// Static contract checks: this module must stay display-only and conservative.
assert.match(src, /getRadarRasterRenderConfig/, 'missing render config export');
assert.match(src, /rasterResampling:\s*'nearest'/, 'radar should default to nearest');
assert.match(src, /rasterResampling:\s*'linear'/, 'satellite should use linear');
assert.match(src, /does not enable unverified products/i, 'must document no unverified enablement');
assert.doesNotMatch(src, /availability:\s*'WORKING'/, 'render config must not alter capability availability');
assert.match(src, /does not claim raw super-resolution Level II/i, 'render config must disclaim super-resolution decoding');
assert.match(src, /no maxzoom cap/i, 'render config must document preserved overzoom');

const radarMap = fs.readFileSync('components/RadarMap.tsx', 'utf8');
assert.match(radarMap, /getRadarRasterRenderConfig\(\{ mode, product \}\)/, 'RadarMap must use render config');
assert.match(radarMap, /tileSize:\s*renderConfig\.tileSize/, 'RadarMap must use configured tile size');
assert.match(radarMap, /'raster-resampling':\s*renderConfig\.rasterResampling/, 'RadarMap must use configured resampling');

// Phase 4A map-integrity contracts. These are static guards for defects that
// passed the original render-config check: font/glyph mismatch, per-source
// tile-error suppression, warning/watch coupling, stale layer ids, satellite
// source-option reuse, and React state updates inside the reveal rAF loop.
const basemapStyles = fs.readFileSync('lib/map/basemap-styles.ts', 'utf8');
assert.match(basemapStyles, /Noto Sans Bold/, 'OpenFreeMap basemap must declare available Noto Sans glyphs');
assert.doesNotMatch(radarMap, /Open Sans Bold|Arial Unicode MS Bold/, 'map overlays must use the glyphs served by the basemap style');
assert.doesNotMatch(radarMap, /radarSourceHealthyRef/, 'tile errors must not be suppressed by a global healthy flag');
assert.match(radarMap, /rasterTileErrorsRef/, 'tile errors must be tracked per raster source');
assert.match(radarMap, /tile\?\.state === 'errored'/, 'sourcedata must recognize errored tiles');
assert.match(radarMap, /showWatchesRef/, 'warning and watch toggles must be independent');
assert.match(radarMap, /category === 'warning'.*showWarningsRef\.current/s, 'warning features must follow showWarnings');
assert.match(radarMap, /category === 'watch'.*showWatchesRef\.current/s, 'watch features must follow showWatches');
assert.doesNotMatch(radarMap, /if \(showWarningsRef\.current\) updateWarnings/, 'watch-only view must not be gated by showWarnings');
assert.doesNotMatch(radarMap, /getLayer\('radar-layer'\)/, 'layer ordering must use the canonical RADAR_LAYER_ID');
assert.match(radarMap, /satelliteSourceConfigRef/, 'satellite bounds/maxzoom changes must rebuild the source');
assert.match(radarMap, /\[mode, product, compositeSource, tilt/, 'composite source selection must rebuild the raster source');
assert.doesNotMatch(radarMap, /getSatelliteProbeTile\(satSel\)\s*\|\|\s*'0\/0\/0'/, 'unstable satellite probes must not fall back to a blank world tile');
assert.doesNotMatch(radarMap, /setSweepAngle/, 'reveal animation must not set React state per frame');
assert.doesNotMatch(radarMap, /map\.setPaintProperty\(SPOTTER_PULSE_LAYER_ID/, 'no per-frame spotter pulse painting');
assert.doesNotMatch(radarMap, /map\.on\('render', scheduleStationPaint\)/, 'no station repaint on every map render');
assert.match(radarMap, /map\.on\('move', scheduleStationPaint\)/, 'camera-only station repaint');

// Phase 4B: active product labels must not claim super-resolution when the
// capability matrix says superResolutionSupport is UNKNOWN and the app renders
// IEM-provided raster tiles.
for (const file of ['components/WeatherWiseRadarCard.tsx', 'components/FloatingProductPanel.tsx', 'components/SynchronizedQuadView.tsx', 'lib/data-sources.ts']) {
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /Super[- ]Res(?:olution)?/i, `${file} must not claim super-resolution`);
}

console.log('PASS: radar render config and map integrity contract');
