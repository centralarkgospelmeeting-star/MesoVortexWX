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

console.log('PASS: product legend and metadata accessor contract');
