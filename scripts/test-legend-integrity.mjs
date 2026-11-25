#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const banner = fs.readFileSync('components/ProductInfoBanner.tsx', 'utf8');
const legend = fs.readFileSync('components/UniversalLegend.tsx', 'utf8');

assert.match(banner, /getProductLegendInfo/, 'banner must use the shared legend accessor');
assert.match(banner, /getRadarCapability/, 'banner must use authoritative radar product metadata');
assert.doesNotMatch(banner, /const REF:|const VEL:|const SAT:|const CC:|const ZDR:/, 'banner must not duplicate local scale tables');
assert.doesNotMatch(banner, /scale: REF, legendLabel: 'Scale'/, 'unknown products must not fall back to reflectivity');
assert.match(banner, /NO_VERIFIED_SCALE_LABEL/, 'unknown products must show an explicit neutral scale state');

assert.match(legend, /export function getProductLegendInfo/, 'shared legend accessor must be exported');
assert.match(legend, /NO_VERIFIED_SCALE_LABEL/, 'legend module must expose the neutral scale label');
assert.doesNotMatch(legend, /\n  return 'ref';/, 'unknown legend types must not silently render REF');

const functionBody = legend.slice(legend.indexOf('function normalizeLegendType'));
const idx = (needle) => functionBody.indexOf(needle);
for (const specialized of ["key.includes('azshear')", "key.includes('rotation_track')", "key.includes('hail')", "key.includes('vild')"]) {
  assert.ok(idx(specialized) >= 0, `missing specialized alias rule: ${specialized}`);
  assert.ok(idx(specialized) < idx("key.includes('vel')"), `${specialized} must run before the broad velocity rule`);
}
assert.ok(idx("key.includes('ref')") < idx("key.includes('vel')"), 'reflectivity rule must not capture velocity aliases first');

// Phase 4B: the eight completion products have a legend step set and a real
// description. HHC deliberately stays neutral because BDHC class colors are
// not independently verified here.
const legendProducts = ['kdp', 'sw', 'tops', 'vil', 'mesh', 'qpe', 'azshear', 'rotation_tracks'];
for (const id of legendProducts) {
  assert.match(legend, new RegExp(`\\n  ${id}: \\[`), `${id} must have verified legend steps`);
  assert.doesNotMatch(legend, new RegExp(`\\n  ${id}: \\{[^}]*description: ''`), `${id} must have a product description`);
}
assert.doesNotMatch(legend, /\n  hhc: \[/, 'HHC must not invent an unverified BDHC scale');
assert.match(legend, /\n  hhc: \{ title: 'Hydrometeor Classification'[^}]*no numeric scale is claimed/, 'HHC must explain its neutral scale');

// Legend bins mirror the actual render palettes rather than older generic bins.
for (const label of ['20–30 m/s', '2–4 km MSL', '15+ km MSL', '0–5 kg/m²', '50–75 kg/m²', '≤ −0.010 s⁻¹']) {
  assert.ok(legend.includes(label), `legend must include renderer bin ${label}`);
}

// Provenance is rendered from the authoritative capability matrix, not copied strings.
assert.match(banner, /function capabilityProvenance/, 'banner must derive provenance from capability data');
assert.match(banner, /data-provenance="radar"/, 'banner must expose radar provenance in the DOM');
for (const label of ['Source', 'Grid', 'Elevation', 'Verification', 'Support']) {
  assert.ok(banner.includes(`label: '${label}'`), `provenance must include ${label}`);
}
const page = fs.readFileSync('app/page.tsx', 'utf8');
assert.match(page, /radarSite=\{currentSite\.id\}/, 'banner must receive the active radar site');
assert.match(page, /tilt=\{tilt\}/, 'banner must receive the active tilt');
assert.match(page, /product=\{bannerProduct\}/, 'banner must receive the selected radar or composite product');
assert.match(page, /modeTab === 'Composite'\) setProduct\('comp_ref'\)/, 'entering Composite must start from the documented national mosaic');
const matrix = fs.readFileSync('lib/radar/capability-matrix.ts', 'utf8');
assert.match(matrix, /id: 'composite_n0q'/, 'existing national N0Q composite must have explicit provenance');
assert.match(matrix, /comp_ref: 'composite_n0q'/, 'Composite UI alias must resolve to the documented mosaic');

console.log('PASS: product legend and metadata accessor contract');
