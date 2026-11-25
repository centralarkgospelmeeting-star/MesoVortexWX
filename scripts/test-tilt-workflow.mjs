#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('app/page.tsx', 'utf8');
const inspector = fs.readFileSync('components/radar/VolumeScanInspector.tsx', 'utf8');
const card = fs.readFileSync('components/WeatherWiseRadarCard.tsx', 'utf8');
const frames = fs.readFileSync('app/api/nexrad/frames/route.ts', 'utf8');

// Tilt preference must survive reloads and be sanitized on load.
assert.match(page, /tilt: string;/, 'user preferences must include tilt');
assert.match(page, /tilt: '0\.5'/, 'default tilt must be a renderable code');
assert.match(page, /tilt: typeof p\.tilt === 'string'/, 'persisted tilt must be validated');
assert.match(page, /useState\(initialPrefs\.tilt\)/, 'tilt state must initialize from preferences');
assert.match(page, /favoriteProducts, product, tilt, radarSite/, 'tilt must be persisted in the preference effect');

// Product changes must not leave a tilt the frames route rejects.
assert.match(page, /const selectRadarProduct/, 'page must centralize product selection');
assert.match(page, /getRadarCapability\(id\)/, 'product selection must read the capability matrix');
assert.match(page, /cap\.tiltSupport\.includes\(tilt\)/, 'current tilt must be checked against capability support');
assert.match(page, /setTilt\(cap\.tiltSupport\[0\]\)/, 'unsupported tilt must be replaced with a supported code');

// Measured Level II elevations must be mapped to fixed renderable codes.
assert.match(inspector, /export function mapMeasuredElevationToTilt/, 'inspector must expose an explicit tilt mapper');
assert.match(inspector, /getRadarCapability\(product\)\?\.tiltSupport/, 'mapper must use authoritative tilt support');
assert.match(inspector, /bestDelta <= 0\.2/, 'mapper must reject distant sweeps instead of relabeling them');
assert.doesNotMatch(inspector, /elevationDegrees!\.toFixed\(2\)/, 'raw measured elevation must not be sent to the frames API');
assert.match(inspector, /data-mapped-tilt=\{mappedTilt \|\| ''\}/, 'mapped tilt must be observable in the DOM');
assert.match(inspector, /<section data-volume-inspector="open"/, 'inspector must expose an observable open state');
assert.match(inspector, /onClose/, 'inspector must have an explicit close affordance');

// Selecting a moment must keep the volume inspector open.
const momentHandler = page.match(/onSelectMoment=\{\(nextProduct, nextTilt\) => \{[\s\S]*?\}\}/)?.[0] || '';
assert.ok(momentHandler, 'page must pass a moment-selection handler to the inspector');
assert.match(momentHandler, /setProduct\(nextProduct as RadarProduct\)/);
assert.match(momentHandler, /setTilt\(nextTilt\)/);
assert.doesNotMatch(momentHandler, /setVolumeInspectorOpen\(false\)/, 'moment selection must not close the inspector');

// Tilt controls are capability-derived, never a hardcoded tilt list.
assert.match(card, /getRadarCapability\(product\)\?\.tiltSupport/, 'card tilt options must come from capability matrix');
assert.doesNotMatch(card, /const TILTS\s*=/, 'card must not use a hardcoded tilt list');
assert.match(card, /TDWR FIXED/, 'TDWR must be labeled as fixed elevation');

// Playback metadata must be honored, not discarded.
assert.match(page, /setPlaybackMeta\(\{/, 'master timeline must retain frames API metadata');
assert.match(page, /timelineLoopAvailable = Boolean\(playbackMeta\?\.loopAvailable\) && playbackFrames\.length > 1/, 'loop availability must come from API metadata');
assert.match(page, /loopAvailable=\{timelineLoopAvailable\}/, 'card must receive authoritative loop availability');
assert.match(page, /frameMetadata=\{playbackMeta \?\? undefined\}/, 'card must receive frame provenance metadata');
assert.match(card, /loopAvailable = false/, 'card must fail closed when loop availability is unknown');
assert.match(card, /disabled=\{!loopAvailable\}/, 'play controls must be disabled without a verified loop');
assert.match(card, /data-frame-metadata=\{frameMetadata \? JSON\.stringify\(frameMetadata\) : undefined\}/, 'metadata must be observable in the DOM');
assert.match(card, /data-frame-metadata-scope="master-timeline"/, 'frame metadata must be labeled as master-timeline provenance');
assert.match(card, /'MASTER TIMELINE PROVENANCE'/, 'frame tooltip must identify master-timeline provenance');

// Frames API exposes the metadata the UI now displays.
for (const field of ['playbackSupport', 'archiveSupport', 'verificationLevel', 'provider', 'station', 'network', 'tilt', 'scanTimeAvailable', 'loopAvailable: false']) {
  assert.match(frames, new RegExp(field.replace(':', '\\:')), `frames route must return ${field}`);
}
assert.match(frames, /if \(!cap\.tiltSupport\.includes\(tilt\)\)/, 'frames route must reject unsupported tilts');

console.log('PASS: tilt workflow contract');
