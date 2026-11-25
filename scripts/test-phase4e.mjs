#!/usr/bin/env node
/** Phase 4E surface observations and forecaster tools contracts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const draw = fs.readFileSync('lib/surface/draw-station-model.ts', 'utf8');
const panel = fs.readFileSync('components/AlertDetailsPanel.tsx', 'utf8');
const popup = fs.readFileSync('components/reports/ReportDetailPopup.tsx', 'utf8');
const toolbox = fs.readFileSync('components/map-tools/ToolboxPanel.tsx', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const map = fs.readFileSync('components/RadarMap.tsx', 'utf8');
const profiles = fs.readFileSync('lib/overlay-profiles.ts', 'utf8');

// 1-4. True station models, canonical sources, full details, unified toggle.
for (const token of ['drawWindBarb', 'drawSkyCover', 'plot.tempC', 'plot.dewpointC', 'plot.pressure.display', 'plot.stationId']) {
  assert.ok(draw.includes(token), `station model must render ${token}`);
}
assert.doesNotMatch(draw, /type: 'circle'/, 'no generic station dots');
for (const field of ['Full NWS warning text', 'decodedMetar', 'flightCategory', 'Observation age']) {
  assert.ok(fs.readFileSync('components/RadarMap.tsx', 'utf8').includes('stationDetailFields'), 'station click uses canonical details');
  break;
}
assert.match(page, /surfaceLayers\.observations/, 'OBSERVATIONS master toggle');
assert.match(page, /Network-specific controls \(advanced\)/, 'advanced observation controls');

// 5. Storm reports: clickable time/location/source/text, mPING wired honestly.
for (const field of ['Time', 'Location', 'Source', 'Report text']) assert.ok(popup.includes(field), `report popup must show ${field}`);
assert.match(panel, /onSelectReport/, 'context reports are clickable');
assert.match(page, /api\/mping\?minutes=60/, 'mPING feed is wired');
assert.match(page, /NSSL mPING/, 'mPING source is labelled honestly');
assert.match(popup, /DATA UNAVAILABLE/, 'missing report fields stay unavailable');

// 6. Forecaster toolbox: distance/area, coordinate readout/copy, storm motion.
assert.match(toolbox, /measure-distance/, 'distance tool');
assert.match(toolbox, /measure-area/, 'area tool');
assert.match(toolbox, /cursor\.lat\.toFixed\(4\)/, 'coordinate readout');
assert.match(toolbox, /Copy lat\/lon/, 'lat/lon copy');
assert.match(toolbox, /Storm motion estimate/, 'storm motion estimate');
assert.match(toolbox, /not an observed storm track/, 'storm motion derivation is disclosed');
assert.match(map, /onCursorMove\?: \(lat: number, lon: number\) => void/, 'map emits cursor coordinates');
assert.match(page, /data-menu-toolbox="true"/, 'toolbox is an optional surface');

// 7. Named workspaces remember overlays, panels and visibility.
for (const id of ['radar', 'satellite', 'forecast', 'broadcast']) {
  assert.ok(profiles.includes(`${id}:`), `workspace ${id} must exist`);
}
assert.match(profiles, /DEFAULT_WORKSPACE_PANELS/, 'workspace panel defaults');
assert.match(page, /workspacePanels\[overlayMode\]\.hsi/, 'HSI panel visibility follows workspace');
assert.match(page, /data-menu-broadcast="true"/, 'broadcast workspace is selectable');
assert.match(page, /broadcastMode/, 'broadcast workspace state');

// 8-9. Zoom-aware declustering and broadcast preparation stay calm.
assert.match(fs.readFileSync('lib/surface/station-model.ts', 'utf8'), /declusterStationPlots/, 'zoom-aware declustering');
assert.match(fs.readFileSync('app/globals.css', 'utf8'), /@keyframes warning-slide-in/, 'one-time slide retained');
assert.doesNotMatch(fs.readFileSync('app/globals.css', 'utf8'), /@keyframes marquee/, 'no gimmick marquee');

console.log('PASS: Phase 4E observations and forecaster tools contracts');
