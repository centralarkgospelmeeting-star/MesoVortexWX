#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const spec = fs.readFileSync('docs/mesoai-architecture-spec.md', 'utf8');
assert.match(spec, /Weather Data Engine/, 'spec must define the weather data engine layer');
assert.match(spec, /Meteorological Detection Engine/, 'spec must define the deterministic detection layer');
assert.match(spec, /MesoAI Analysis Engine/, 'spec must define the analysis layer');
assert.match(spec, /National Weather Watcher/, 'spec must define the watcher layer');
assert.match(spec, /must not self-modify in production/, 'spec must prohibit production self-modification');
assert.match(spec, /MESOAI_ENABLED/, 'spec must require explicit model opt-in');
assert.match(spec, /local renderer/, 'spec must make local analysis the default');
assert.match(spec, /TVS.*hidden|hidden until a verified gate-level algorithm exists/, 'spec must hide unverified severe signatures');
assert.match(spec, /structured/, 'spec must require structured weather input, not raw imagery');

const scoreLib = fs.readFileSync('lib/weather-intensity.ts', 'utf8');
for (const label of ['Minimal impact', 'General precipitation', 'Strong thunderstorms', 'Severe concerns', 'High-impact weather']) {
  assert.ok(scoreLib.includes(label), `score must define band: ${label}`);
}
assert.match(scoreLib, /calculateWeatherIntensity/, 'score must be calculated by a deterministic function');
assert.match(scoreLib, /stormAnalysisToRadarInput/, 'score must use live Level II analysis input');
assert.match(scoreLib, /lightningToInput/, 'score must use GLM lightning input');
assert.match(scoreLib, /alertsNearSite/, 'score must scope alerts to the selected radar site');
assert.match(scoreLib, /spcCategoryAtPoint/, 'score must use the SPC categorical outlook at the site point');
assert.doesNotMatch(scoreLib, /Math\.random|fetch\(/, 'score must not invent values or fetch data itself');
assert.doesNotMatch(scoreLib, /tornado detected|debris signature detected/i, 'score must not claim unverified severe signatures');

const panel = fs.readFileSync('components/WeatherIntensityScorePanel.tsx', 'utf8');
assert.match(panel, /data-weather-intensity-panel="true"/, 'panel must expose an observable DOM surface');
assert.match(panel, /onClose/, 'panel must support closing');
assert.match(panel, /Refresh/, 'panel must support refresh');
assert.match(panel, /alertsNearSite/, 'panel must scope alerts to the active site');
assert.match(panel, /not official/, 'panel must disclose that the score is not official');
assert.doesNotMatch(panel, /debris|TVS/i, 'panel must not show unverified severe signatures');

// The score panel has a right-click action menu; no browser default menu and
// no claim that the menu can change the underlying data.
assert.match(panel, /onContextMenu=\{\(event\) => \{/, 'panel must intercept right-click');
assert.match(panel, /event\.preventDefault\(\);/, 'panel must suppress the browser default context menu');
assert.match(panel, /data-wis-context-menu="true"/, 'panel must expose an observable context menu');
for (const action of ['Refresh score', 'Copy summary', 'Hide score']) {
  assert.ok(panel.includes(action), `context menu must expose: ${action}`);
}
assert.match(panel, /role="menu"/, 'context menu must expose menu semantics');
assert.doesNotMatch(panel, /navigator\.clipboard\.writeText\([^)]*detected/i, 'copy action must not claim detections');

const page = fs.readFileSync('app/page.tsx', 'utf8');
assert.match(page, /WeatherIntensityScorePanel/, 'page must mount the score panel');
assert.match(page, /data-menu-wis-toggle="true"/, 'hamburger menu must expose a show/hide control');
assert.match(page, /setWisOpen\(\(v\) => !v\)/, 'hamburger control must toggle score visibility');
assert.match(page, /onClose=\{\(\) => setWisOpen\(false\)\}/, 'panel close must hide the panel');
assert.match(page, /WIS_STORAGE_KEY/, 'score visibility must persist across reloads');
assert.match(page, /siteLat=\{currentSite\.lat\}/, 'panel must receive real site coordinates');

const radarMap = fs.readFileSync('components/RadarMap.tsx', 'utf8');
assert.doesNotMatch(radarMap, /data-rotation-status="mrms"/, 'standalone map product card must be removed');

console.log('PASS: MesoAI M1 spec, score, and banner integration contract');
