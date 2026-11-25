#!/usr/bin/env node
/** Governance for expanded composite radar and satellite sources: verified only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const composites = fs.readFileSync('lib/radar/composite-sources.ts', 'utf8');
const block = (id) => {
  const start = composites.indexOf(`id: '${id}'`);
  if (start < 0) return '';
  const rest = composites.slice(start);
  const end = rest.indexOf('\n  },');
  return end < 0 ? rest : rest.slice(0, end);
};

const canada = block('canada_composite');
assert.match(canada, /status: 'VERIFIED'/, 'ECCC radar composite must be VERIFIED after live GetMap probe');
assert.match(canada, /geo\.weather\.gc\.ca\/geomet/, 'Canada composite must use the ECCC GeoMet WMS endpoint');
assert.match(canada, /RADAR_1KM_RRAI/, 'Canada composite must use the verified radar layer');
assert.match(canada, /\{bbox-epsg-3857\}/, 'WMS tile URL must use the MapLibre bbox token');
assert.match(canada, /EPSG:3857/, 'WMS tile URL must request Web Mercator');

const recent = block('iem_n0q_recent');
assert.match(recent, /status: 'VERIFIED'/, 'additional US N0Q 5-minute composite must be VERIFIED');
assert.match(recent, /nexrad-n0q-m05m/, 'must use the live-probed IEM layer');

const mrms = block('mrms_cref');
assert.match(mrms, /status: 'UNAVAILABLE'/, 'MRMS reflectivity tile must stay UNAVAILABLE until verified');
assert.match(mrms, /HTTP 404/, 'MRMS guard must record the failed IEM probe');
assert.match(mrms, /GRIB2/, 'MRMS guard must record that S3 is GRIB2, not XYZ tiles');

const europe = block('europe_composite');
assert.match(europe, /status: 'UNAVAILABLE'/, 'Europe radar composite must stay UNAVAILABLE');
assert.doesNotMatch(europe, /view\.eumetsat\.int/, 'EUMETSAT satellite WMS must not be labelled a radar composite');

const matrix = fs.readFileSync('lib/satellite/capability-matrix.ts', 'utf8');
const entry = (id) => matrix.split('\n').find((line) => line.includes(`{ id: '${id}'`)) || '';
assert.match(entry('meteosat'), /availability: 'PARTIAL'/, 'Meteosat must be PARTIAL, not fully working');
assert.match(entry('meteosat'), /TESTED_LIVE/, 'Meteosat must cite live WMS probes');
assert.doesNotMatch(entry('meteosat'), /unavailableReason:/, 'verified Meteosat entry must not claim DATA UNAVAILABLE');
assert.match(entry('sector_meteosat_fes'), /TESTED_LIVE/, 'Meteosat sector must cite live GetMap evidence');
assert.match(entry('glm_lightning'), /UNAVAILABLE/, 'GLM must stay UNAVAILABLE without the verified runtime');
assert.match(entry('glm_lightning'), /glm-venv/, 'GLM reason must name the missing runtime');
assert.match(entry('geocolor'), /UNAVAILABLE/, 'GeoColor must stay UNAVAILABLE without verified XYZ tiles');

// Real runtime URL mapping for Meteosat products.
const compiled = ts.transpileModule(fs.readFileSync('lib/satellite.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sat = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
assert.ok(sat.SATELLITE_BIRDS.some((b) => b.id === 'meteosat'), 'Meteosat bird must be selectable');
const expected = { visible: 'msg_fes:vis006', ir: 'msg_fes:ir108', 'wv-upper': 'msg_fes:wv062' };
for (const [productId, layer] of Object.entries(expected)) {
  const result = sat.getSatelliteTileUrl({ bird: 'meteosat', sector: 'meteosat-fes', productId });
  assert.ok(result.url?.includes(encodeURIComponent(layer)), `Meteosat ${productId} must use ${layer}`);
  assert.ok(result.url?.includes('{bbox-epsg-3857}'), `${productId} must be a WMS GetMap URL`);
}
for (const productId of ['ch01', 'ch13', 'airmass', 'geocolor']) {
  const result = sat.getSatelliteTileUrl({ bird: 'meteosat', sector: 'meteosat-fes', productId });
  assert.equal(result.url, null, `Meteosat ${productId} must not emit an unverified URL`);
}

console.log('PASS: expanded composite/satellite source governance (verified only)');
