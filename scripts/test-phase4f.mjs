#!/usr/bin/env node
/** Phase 4F global satellite and tropical expansion contracts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const matrix = fs.readFileSync('lib/satellite/capability-matrix.ts', 'utf8');
const satellite = fs.readFileSync('lib/satellite.ts', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const map = fs.readFileSync('components/RadarMap.tsx', 'utf8');
const jtwc = fs.readFileSync('app/api/tropical/jtwc/route.ts', 'utf8');

const entry = (id) => matrix.split('\n').find((line) => line.includes(`{ id: '${id}'`)) || '';
for (const id of ['goes_east', 'goes_west', 'himawari', 'meteosat', 'geocolor', 'infrared', 'water_vapor', 'glm_lightning']) {
  assert.ok(entry(id), `satellite inventory must include ${id}`);
}
assert.match(entry('geocolor'), /UNAVAILABLE/, 'GeoColor stays UNAVAILABLE without verified XYZ tiles');
assert.match(entry('glm_lightning'), /UNAVAILABLE/, 'GLM stays UNAVAILABLE without verified runtime');
assert.match(entry('infrared'), /PARTIAL/, 'IR is PARTIAL across verified sources');
assert.match(entry('water_vapor'), /PARTIAL/, 'water vapor is PARTIAL across verified sources');
assert.match(entry('meteosat'), /TESTED_LIVE/, 'Meteosat must cite live EUMETSAT probes');
assert.match(entry('himawari'), /legacy IEM Himawari ch02/, 'Himawari must disclose its limited verified path');

// Region-grouped selector; only real products in the selector.
assert.match(satellite, /SATELLITE_BIRD_GROUPS/, 'bird selector groups by region');
for (const region of ['North America', 'Europe / Africa', 'Asia / Pacific']) assert.ok(satellite.includes(region), `selector must include ${region}`);
assert.match(page, /SATELLITE_BIRD_GROUPS\.map/, 'selector must render regional groups');

// Tropical workflow: verified NHC + JTWC, no invented storms.
assert.match(jtwc, /metoc\.navy\.mil\/jtwc\/rss\/jtwc\.rss/, 'JTWC public RSS source');
assert.match(page, /api\/tropical\/jtwc/, 'JTWC products must be fetched');
assert.match(page, /data-menu-tropical="true"/, 'dedicated Tropical Mode control');
assert.match(page, /No placeholder storms/, 'tropical UI must disclaim placeholder storms');
assert.match(fs.readFileSync('app/api/tropical/cyclones/route.ts', 'utf8'), /NHC_CURRENT/, 'NHC tropical source remains authoritative');

// Satellite overlays and adjustable opacity.
assert.match(map, /SATELLITE_OVERLAY_SOURCE_ID/, 'radar+ satellite overlay source');
assert.match(map, /satelliteOverlayOpacity/, 'overlay opacity applied');
assert.match(page, /Satellite over radar\/composite/, 'overlay control in satellite panel');
assert.match(page, /aria-label="Satellite overlay opacity"/, 'opacity slider');

// Data honesty + map workflow preservation.
assert.doesNotMatch(fs.readFileSync('app/globals.css', 'utf8'), /@keyframes marquee/, 'no gimmick marquee');
assert.match(map, /background: '#071426'/, 'map voids use navy fallback instead of black');
assert.match(fs.readFileSync('docs/phase4f-satellite-capability-report.md', 'utf8'), /DATA UNAVAILABLE/, 'report records unavailable products');

console.log('PASS: Phase 4F global satellite and tropical contracts');
