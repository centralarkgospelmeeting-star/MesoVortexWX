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

const scoreLib = fs.readFileSync('lib/hazard-severity.ts', 'utf8');
for (const label of ['Low', 'Elevated', 'Significant', 'Major', 'Extreme']) {
  assert.ok(scoreLib.includes(`label: '${label}'`), `HSI must define band: ${label}`);
}
assert.match(scoreLib, /calculateHsi/, 'HSI must be calculated by a deterministic function');
assert.match(scoreLib, /DATA INCOMPLETE/, 'unavailable components must reduce confidence honestly');
assert.match(scoreLib, /HSI_SCALES/, 'HSI must support national, regional, state, local, and custom scales');
assert.match(scoreLib, /alertsForHsiScope/, 'HSI must scope alerts to the selected area');
assert.match(scoreLib, /stormAnalysisToRadarInput/, 'HSI must use live Level II analysis input');
assert.match(scoreLib, /lightningToInput/, 'HSI must use GLM lightning input');
assert.match(scoreLib, /spcCategoryAtPoint/, 'HSI must use the SPC categorical outlook at the site point');
assert.doesNotMatch(scoreLib, /Math\.random|fetch\(/, 'HSI must not invent values or fetch data itself');
assert.doesNotMatch(scoreLib, /tornado detected|debris signature detected/i, 'HSI must not claim unverified severe signatures');

const panel = fs.readFileSync('components/hsi/HsiPanel.tsx', 'utf8');
assert.match(panel, /data-hsi-panel="true"/, 'panel must expose an observable DOM surface');
assert.match(panel, /Hazard Severity Index \(HSI\)/, 'panel must use the HSI name');
assert.match(panel, /onClose/, 'panel must support closing');
assert.match(panel, /Refresh/, 'panel must support refresh');
assert.match(panel, /alertsForHsiScope/, 'panel must scope alerts to the active area');
assert.match(panel, /DATA INCOMPLETE/, 'panel must disclose incomplete input coverage');
assert.match(panel, /Draw operational area/, 'custom HSI must let emergency managers draw an area');
assert.match(panel, /not official/, 'panel must disclose that HSI is not official');
assert.doesNotMatch(panel, /debris|TVS/i, 'panel must not show unverified severe signatures');

// The HSI panel has a right-click action menu; no browser default menu and
// no claim that the menu can change the underlying data.
assert.match(panel, /onContextMenu=\{\(event\) => \{/, 'panel must intercept right-click');
assert.match(panel, /event\.preventDefault\(\);/, 'panel must suppress the browser default context menu');
assert.match(panel, /data-hsi-context-menu="true"/, 'panel must expose an observable context menu');
for (const action of ['Refresh HSI', 'Copy summary', 'Hide HSI']) {
  assert.ok(panel.includes(action), `context menu must expose: ${action}`);
}
assert.match(panel, /role="menu"/, 'context menu must expose menu semantics');
assert.doesNotMatch(panel, /navigator\.clipboard\.writeText\([^)]*detected/i, 'copy action must not claim detections');

const page = fs.readFileSync('app/page.tsx', 'utf8');
assert.match(page, /HsiPanel/, 'page must mount the HSI panel');
assert.match(page, /data-menu-hsi-toggle="true"/, 'hamburger menu must expose a show/hide control');
assert.match(page, /setHsiOpen\(\(v\) => !v\)/, 'hamburger control must toggle HSI visibility');
assert.match(page, /onClose=\{\(\) => setHsiOpen\(false\)\}/, 'panel close must hide the panel');
assert.match(page, /HSI_STORAGE_KEY/, 'HSI visibility must persist across reloads');
assert.match(page, /siteLat=\{currentSite\.lat\}/, 'panel must receive real site coordinates');

const radarMap = fs.readFileSync('components/RadarMap.tsx', 'utf8');
assert.doesNotMatch(radarMap, /data-rotation-status="mrms"/, 'standalone map product card must be removed');

console.log('PASS: MesoAI M1 spec, score, and banner integration contract');
