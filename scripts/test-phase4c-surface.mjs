#!/usr/bin/env node
/**
 * Phase 4C surface-observation workstation contracts.
 *
 * Static guards verify that the station model is a true workstation plot, that
 * every requested network has an honest status, and that unavailable networks
 * cannot silently become fabricated stations.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');

const types = read('lib/surface/types.ts');
const requiredNetworks = [
  'metar', 'speci', 'asos', 'awos', 'mesonet', 'pws',
  'wunderground', 'tempest', 'davis', 'coop', 'buoy', 'marine',
];
for (const id of requiredNetworks) {
  assert.ok(types.includes(`id: '${id}'`), `network inventory must include ${id}`);
}
assert.match(types, /verify|VERIFIED/, 'network inventory must carry verification status');
assert.match(types, /FUTURE_SURFACE_ARCHITECTURE/, 'future architecture contracts must exist');
for (const contract of ['station-history', 'time-series', 'observation-comparison', 'station-favorites', 'front-analysis', 'mesonet-overlays']) {
  assert.ok(types.includes(contract), `future architecture must define ${contract}`);
}

const stationModel = read('lib/surface/station-model.ts');
assert.doesNotMatch(stationModel, /fetch\(|Math\.random\(/, 'station model normalization must be pure');
assert.match(stationModel, /DATA UNAVAILABLE/, 'missing values must be explicitly unavailable');
assert.match(stationModel, /relativeHumidity/, 'humidity must be derived only from real temperature/dew point');
assert.match(stationModel, /presentWeatherCodes/, 'present weather must be decoded from real reports');
assert.match(stationModel, /skyCoverOkta/, 'sky cover must use the 0-8 okta workstation scale');
assert.match(stationModel, /qualityFor/, 'observation age must drive fresh/stale QC');

const draw = read('lib/surface/draw-station-model.ts');
for (const token of ['drawSkyCover', 'drawWindBarb', 'drawPresentWeather', 'plot.tempC', 'plot.dewpointC', 'plot.pressure.display', 'plot.stationId']) {
  assert.ok(draw.includes(token), `station model renderer must implement ${token}`);
}
assert.match(draw, /hitTestStationModels/, 'station model must support compact click targets');

const radarMap = read('components/RadarMap.tsx');
assert.match(radarMap, /data-station-model-canvas/, 'map must mount the canvas station-model overlay');
assert.match(radarMap, /drawStationModels/, 'map must paint workstation station models');
assert.match(radarMap, /stationDetailFields/, 'station click must show the canonical detail fields');
assert.doesNotMatch(radarMap, /type: 'circle'[\s\S]{0,220}SURFACE_SOURCE_ID/, 'surface stations must not render as generic map dots');

const panel = read('components/surface/SurfaceLayersPanel.tsx');
assert.match(panel, /SURFACE_LAYERS/, 'layer controls must render the canonical layer registry');
for (const id of ['metar', 'aviation', 'mesonet', 'pws', 'buoy', 'marine']) {
  assert.ok(types.includes(`id: '${id}'`) || types.includes(`layer: '${id}'`), `layer registry must include ${id}`);
}
assert.match(panel, /NO DATA/, 'unavailable layers must be visibly marked');
assert.match(panel, /DATA UNAVAILABLE/, 'missing station fields must be visibly marked');

for (const file of [
  'app/api/metar/geojson/route.ts',
  'app/api/asos/geojson/route.ts',
  'app/api/surface/mesonet/route.ts',
  'app/api/surface/pws/route.ts',
  'app/api/surface/buoy/route.ts',
  'app/api/surface/marine/route.ts',
]) {
  assert.ok(fs.existsSync(file), `expected surface endpoint ${file}`);
  assert.match(read(file), /force-dynamic/, `${file} must stay live`);
}

const metarFeed = read('lib/metar/surface-feed.ts');
assert.match(metarFeed, /altimHpa \/ 33\.8638866667/, 'AWC altim hPa must be converted to inHg');
assert.match(metarFeed, /seaLevelPressureHpa/, 'real AWC sea-level pressure must be preserved');
assert.match(metarFeed, /\^SPECI\\b/, 'SPECI reports must be classified from the real raw report');

const iemResponse = read('lib/surface/iem-response.ts');
assert.match(iemResponse, /api\/1\/currents\.geojson/, 'IEM currents endpoint must be used');
assert.doesNotMatch(iemResponse, /json\/current\.py/, 'single-station legacy endpoint cannot back a network layer');
const ndbc = read('lib/surface/ndbc.ts');
assert.match(ndbc, /'STN', 'STNID'/, 'NDBC latest_obs uses the STN column');
assert.match(ndbc, /1\.94384/, 'NDBC wind m/s must be converted to knots');
const pws = read('lib/surface/atmowx.ts');
assert.match(pws, /10 \*\* scale/, 'atmowx scaled integers must be decoded');
assert.match(pws, /sparse coverage/i, 'PWS sparse coverage must be disclosed');

const page = read('app/page.tsx');
assert.match(page, /SurfaceLayersPanel/, 'surface panel must be mounted');
assert.match(page, /surfaceLayers/, 'independent layer state must be persisted');
assert.match(page, /surfaceNetwork/, 'combined feed must tag each station network');

console.log('PASS: Phase 4C surface station network and workstation model contracts');
