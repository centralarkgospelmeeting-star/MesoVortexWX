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

const radarMap = fs.readFileSync('components/RadarMap.tsx', 'utf8');
assert.match(radarMap, /getRadarRasterRenderConfig\(\{ mode, product \}\)/, 'RadarMap must use render config');
assert.match(radarMap, /tileSize:\s*renderConfig\.tileSize/, 'RadarMap must use configured tile size');
assert.match(radarMap, /'raster-resampling':\s*renderConfig\.rasterResampling/, 'RadarMap must use configured resampling');

console.log('PASS: radar render config contract');
