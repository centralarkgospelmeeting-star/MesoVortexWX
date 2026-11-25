#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const banner = fs.readFileSync('components/ProductInfoBanner.tsx', 'utf8');
const legend = fs.readFileSync('components/UniversalLegend.tsx', 'utf8');

assert.match(banner, /getProductLegendInfo/, 'banner must use the shared legend accessor');
assert.doesNotMatch(banner, /const REF:|const VEL:|const SAT:|const CC:|const ZDR:/, 'banner must not duplicate local scale tables');
assert.doesNotMatch(banner, /scale: REF, legendLabel: 'Scale'/, 'unknown products must not fall back to reflectivity');
assert.match(banner, /NO_VERIFIED_SCALE_LABEL/, 'unknown products must show an explicit neutral scale state');

// Phase M1: the banner is spectrum-only. No prose, provenance, alert marquee,
// or metadata rows are allowed to consume permanent banner space.
assert.match(banner, /data-spectrum-banner="true"/, 'banner must expose its spectrum surface');
assert.match(banner, /data-spectrum-step="true"/, 'each legend bin must be an interactive spectrum step');
assert.match(banner, /data-spectrum-meaning=/, 'spectrum steps must expose product meaning to the DOM');
assert.match(banner, /onMouseEnter=\{\(\) => setHovered\(step\)\}/, 'hover must select the exact legend step');
assert.match(banner, /hovered\.value/, 'hover readout must show the exact value and unit');
assert.match(banner, /hovered\.meaning/, 'hover readout must show the product meaning');
for (const removed of [
  'capabilityProvenance',
  'data-provenance',
  'alertBanner',
  'satelliteDescription',
  'modelStatus',
  "label: 'Source'",
  "label: 'Grid'",
  "label: 'Elevation'",
  "label: 'Verification'",
  "label: 'Support'",
]) {
  assert.ok(!banner.includes(removed), `banner must not render legacy metadata: ${removed}`);
}

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

const page = fs.readFileSync('app/page.tsx', 'utf8');
const bannerMount = page.slice(page.indexOf('<ProductInfoBanner'), page.indexOf('/>', page.indexOf('<ProductInfoBanner')));
assert.match(bannerMount, /tab=\{tab\}/, 'banner must receive the active mode tab');
assert.match(bannerMount, /product=\{bannerProduct\}/, 'banner must receive the selected radar or composite product');
assert.match(bannerMount, /modelFieldId=\{activeModelField\?\.id\}/, 'banner must receive the model field id for spectrum selection');
for (const removed of ['radarSite=', 'tilt=', 'satelliteDescription=', 'modelStatus=', 'alertBanner=']) {
  assert.ok(!bannerMount.includes(removed), `banner mount must stay compact: ${removed}`);
}
assert.match(page, /modeTab === 'Composite'\) setProduct\('comp_ref'\)/, 'entering Composite must start from the documented national mosaic');
assert.match(page, /modeTab === 'Radar'\) setProduct\('ref'\)/, 'entering Radar must start from reflectivity');

const matrix = fs.readFileSync('lib/radar/capability-matrix.ts', 'utf8');
assert.match(matrix, /id: 'composite_n0q'/, 'existing national N0Q composite must have explicit provenance');
assert.match(matrix, /comp_ref: 'composite_n0q'/, 'Composite UI alias must resolve to the documented mosaic');

console.log('PASS: compact spectrum banner and shared legend contract');
