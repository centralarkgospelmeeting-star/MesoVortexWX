#!/usr/bin/env node
/**
 * Global observation display: pure dynamic-declustering contracts.
 * Loads the real TypeScript module (transpiled) so the tested logic is the
 * same code the map canvas uses.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('lib/surface/station-model.ts', 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const { declusterStationPlots, stationCellDegrees, DECLUSTER_OFF_ZOOM } = mod;

function station(id, network, lat, lon, tempC, ageMinutes) {
  return {
    id: `${network}:${id}`, stationId: id, name: null, network, layer: 'metar',
    stationType: null, lat, lon, elevationM: null, observedAt: null, observedAtMs: null,
    ageMinutes, quality: 'fresh', tempC, dewpointC: null,
    humidityPct: { value: null, source: 'unavailable' }, windDirDeg: null,
    windSpeedKt: null, windGustKt: null, visibilitySm: null,
    pressure: { kind: 'unavailable', value: null, display: null }, pressureTendency: null,
    waveHeightM: null, wavePeriodS: null, waterTempC: null, skyCoverOkta: null,
    ceilingFt: null, cloudLayers: [], flightCategory: null, decodedMetar: null,
    presentWeather: [], weatherConditions: null, rawOb: null, reportType: null,
    sourceLabel: 'synthetic test input', sourceUrl: null, attribution: null, raw: {},
  };
}

// Cell size shrinks as we zoom in; at high zoom every station is individual.
const cell3 = stationCellDegrees(3);
const cell7 = stationCellDegrees(7);
assert.ok(cell3 !== null && cell7 !== null && cell3 > cell7, 'cell size must shrink when zooming in');
assert.equal(stationCellDegrees(DECLUSTER_OFF_ZOOM), null, 'declustering must be off at high zoom');

// Zoomed out: one representative per cell with an honest count, and no
// geographic hiding (a station in Australia survives alongside London ones).
const worldwide = [];
for (let i = 0; i < 200; i += 1) worldwide.push(station(`LHR${i}`, 'metar', 51.5 + i / 10000, -0.12 + i / 10000, 7, i));
worldwide.push(station('YSSY', 'metar', -33.94, 151.18, 21, 4));
const clustered = declusterStationPlots(worldwide, 3);
assert.equal(clustered.length, 2, 'worldwide field must collapse to two screen-space cells');
assert.ok(clustered.some((p) => p.clusterCount === 200), 'representative must report the real station count');
assert.ok(clustered.some((p) => p.lon > 100 && p.clusterCount === 1), 'no region may be hidden by declustering');

// Source priority selects the representative; reported values are untouched.
const mixed = [
  station('BUOY1', 'buoy', 40, -95, -99, 2),
  station('KMET', 'metar', 40.01, -95.01, 5, 9),
];
const rep = declusterStationPlots(mixed, 7);
assert.equal(rep.length, 1, 'nearby stations must share a cell');
assert.equal(rep[0].stationId, 'KMET', 'higher-priority METAR must represent the cell');
assert.equal(rep[0].tempC, 5, 'representative must keep its real reported temperature');
assert.equal(rep[0].clusterCount, 2, 'density count must reflect both real stations');

// Zoomed in: individual workstation station models with no clustering.
const individual = declusterStationPlots(mixed, 10);
assert.equal(individual.length, 2, 'zoomed-in view must show individual stations');
assert.ok(individual.every((p) => p.clusterCount === 1), 'no cluster markers at high zoom');

// Deterministic output (stable representatives and ordering).
const a = declusterStationPlots(worldwide, 3).map((p) => `${p.stationId}:${p.clusterCount}`).join('|');
const b = declusterStationPlots(worldwide, 3).map((p) => `${p.stationId}:${p.clusterCount}`).join('|');
assert.equal(a, b, 'declustering must be deterministic');

console.log('PASS: global observation declustering (density, priority, zoom, no region hiding)');
