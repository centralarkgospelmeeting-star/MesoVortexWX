#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const radarMap = fs.readFileSync('components/RadarMap.tsx', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const card = fs.readFileSync('components/WeatherWiseRadarCard.tsx', 'utf8');
const matrix = fs.readFileSync('lib/radar/capability-matrix.ts', 'utf8');
const route = fs.readFileSync('app/api/radar/mrms-tile/route.ts', 'utf8');

// The toggle must reach the map, not just sit in persisted preferences.
assert.match(radarMap, /showStormTracks\?: boolean/, 'RadarMap must accept the rotation overlay toggle');
assert.match(radarMap, /rotationOverlayEnabled/, 'RadarMap must derive a real overlay-enabled state');
assert.match(radarMap, /updateRotationTracks/, 'RadarMap must apply the rotation overlay to the map');
assert.match(radarMap, /ROTATION_SOURCE_ID/, 'rotation overlay must own a dedicated raster source');
assert.match(radarMap, /ROTATION_LAYER_ID/, 'rotation overlay must own a dedicated raster layer');
assert.match(radarMap, /\/api\/radar\/mrms-tile\?product=rotation_tracks/, 'overlay must use the verified MRMS route');
assert.match(radarMap, /data-rotation-status="mrms"/, 'overlay must expose an observable DOM status surface');
assert.match(radarMap, /No mesocyclone IDs or projected track objects are claimed/, 'overlay must disclaim invented track objects');
assert.doesNotMatch(radarMap, /scit-engine|demoTrack|hardcodedTrack/, 'overlay must not use demo track objects');

assert.match(page, /showStormTracks,\n    showHurricanes,/, 'pane props must include the rotation toggle');
assert.match(page, /showStormTracks=\{showStormTracks\}/, 'controls must receive the rotation toggle');
assert.match(page, /onToggleStormTracks=\{\(\) => setShowStormTracks\(\(v\) => !v\)\}/, 'controls must toggle persisted rotation preference');

assert.match(card, /MRMS Rotation Tracks \(30-min overlay\)/, 'card must label the overlay honestly');
assert.match(card, /onToggleStormTracks/, 'card must wire the overlay checkbox');

assert.match(matrix, /productCode: 'RotationTrack30min'/, 'capability matrix must identify the real MRMS grid');
assert.match(matrix, /no app playback loop/, 'rotation tracks must not claim playback');
assert.match(route, /RotationTrack30min/, 'MRMS route must serve the rotation grid');
assert.match(route, /15 \* 60_000/, 'rotation grid must be staleness-gated');

console.log('PASS: rotation track workflow contract');
