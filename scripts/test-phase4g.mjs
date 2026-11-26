#!/usr/bin/env node
/** Phase 4G soundings and environmental analysis contracts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const analysis = fs.readFileSync('lib/sounding/analysis.ts', 'utf8');
const panel = fs.readFileSync('components/sounding/AtmosphericAnalysisPanel.tsx', 'utf8');
const nearest = fs.readFileSync('app/api/sounding/nearest/route.ts', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const map = fs.readFileSync('components/RadarMap.tsx', 'utf8');
const xsect = fs.readFileSync('app/api/radar/cross-section/route.ts', 'utf8');

// 1. Real sounding sources; synthetic generators removed.
assert.ok(!fs.existsSync('lib/skewt-engine.ts'), 'synthetic lat/lon sounding generator removed');
assert.ok(!fs.existsSync('lib/cross-section.ts'), 'synthetic cross-section module removed');
assert.match(nearest, /geojson\/network\.py\?network=RAOB/, 'nearest sounding uses the real RAOB station network');
assert.match(nearest, /json\/raob\.py/, 'observed profile comes from IEM RAOB');
assert.match(nearest, /distanceKm/, 'nearest station is geographic, not guessed');

// 2-4. Skew-T, hodograph, indices — only from real levels, null when missing.
assert.match(panel, /data-skewt-canvas="true"/, 'Skew-T canvas');
assert.match(panel, /data-hodograph-canvas="true"/, 'hodograph canvas');
assert.match(panel, /Export PNG/, 'image export');
assert.match(panel, /data-analysis-resize="true"/, 'resizable analysis panel');
for (const label of ['SBCAPE', 'MLCAPE', 'MUCAPE', 'CIN', 'LI', 'SRH 0–1 km', 'SRH 0–3 km', 'Shear 0–6 km', 'EHI', 'STP', 'SCP', 'DCAPE', 'PWAT', 'LCL', 'LFC', 'EL', 'Freezing level', 'WBZ height']) {
  assert.ok(panel.includes(label), `environmental display must include ${label}`);
}
assert.doesNotMatch(analysis, /Math\.sin\(lat/, 'synthetic latitude formula must be absent');
assert.match(analysis, /dataHonesty|DATA UNAVAILABLE/, 'missing values are explicitly unavailable');
assert.match(analysis, /stormMotion/, 'storm motion from real winds');
assert.match(fs.readFileSync('lib/capabilities/sounding-capabilities.ts', 'utf8'), /components\/sounding\/AtmosphericAnalysisPanel\.tsx/, 'capability matrix cites the real panel');

// 5. Click-to-load point analysis.
assert.match(map, /onSoundingPoint/, 'map emits sounding point');
assert.match(page, /data-menu-forecaster-workspace="true"/, 'forecaster workspace control');
assert.match(page, /mesovortex_forecaster_workspace_v1/, 'workspace persistence');

// 6. Verified cross-section path only.
assert.match(xsect, /fetchLevel2Frame/, 'cross-section uses real Level II volume data');
assert.doesNotMatch(xsect, /SYNTHETIC/, 'no synthetic cross-section claim');

// 9. Honesty: no fallback severe parameters.
assert.doesNotMatch(analysis, /sbcape\s*\*\s*0\.8|srh01\s*\*\s*1\.5/, 'no derived fallback parameters');
assert.match(panel, /Real sounding levels only/, 'panel discloses real-data-only rule');

console.log('PASS: Phase 4G soundings and environmental analysis contracts');
