#!/usr/bin/env node
/**
 * Hazard Severity Index (HSI) pure contracts: bands, confidence,
 * DATA INCOMPLETE behavior, scale labels, and custom-area scoping.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('lib/hazard-severity.ts', 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const {
  HSI_BANDS, HSI_SCALES, calculateHsi, hsiBandForScore, hsiAreaLabel, alertsForHsiScope,
} = mod;

assert.deepEqual(HSI_BANDS.map((b) => [b.min, b.max, b.label]), [
  [0, 19, 'Low'], [20, 39, 'Elevated'], [40, 59, 'Significant'], [60, 79, 'Major'], [80, 100, 'Extreme'],
], 'HSI must use the requested 0–100 category scale');
assert.equal(hsiBandForScore(0)?.label, 'Low');
assert.equal(hsiBandForScore(39)?.label, 'Elevated');
assert.equal(hsiBandForScore(80)?.label, 'Extreme');

const empty = calculateHsi({ areaLabel: 'United States HSI' });
assert.equal(empty.score, null, 'no verified inputs must not produce a fabricated score');
assert.equal(empty.bandLabel, 'DATA INCOMPLETE');
assert.equal(empty.dataIncomplete, true);
assert.ok(empty.unavailable.includes('CAPE') && empty.unavailable.includes('Tornado probability'));

const withAlerts = calculateHsi({
  areaLabel: 'Arkansas HSI',
  alerts: [{ event: 'Tornado Warning', category: 'warning', areaDesc: 'Pulaski County' }],
  outlook: { available: true, category: 'HIGH', day: '1' },
});
assert.ok(withAlerts.score !== null && withAlerts.score > 0, 'real alerts must contribute to HSI');
assert.equal(withAlerts.dataIncomplete, true, 'missing components must mark DATA INCOMPLETE');
assert.ok(withAlerts.confidence > 0 && withAlerts.confidence < 1, 'confidence must be reduced by missing inputs');
assert.ok(withAlerts.summary.includes('DATA INCOMPLETE'));

const full = calculateHsi({
  areaLabel: 'Local HSI',
  alerts: [{ event: 'Severe Thunderstorm Warning', category: 'warning', areaDesc: 'Pulaski, AR' }],
  mcds: [{ id: 'MCD 1' }],
  radar: { available: true, maxReflectivityDbz: 55 },
  lightning: { available: true, flashCount: 25, minutes: 5 },
  outlook: { available: true, category: 'SLGT', day: '1' },
  cape: 2500, shear: 40, srh: 150, tornadoProbability: 5, hailProbability: 10,
  windProbability: 15, flashFloodRisk: 'marginal', winterImpact: 'none',
  tropicalImpact: 'none', populationExposure: 100000,
});
assert.equal(full.dataIncomplete, false, 'complete inputs must not be marked incomplete');
assert.equal(full.confidence, 1);
assert.ok(full.score !== null && full.score >= 0 && full.score <= 100);

assert.equal(hsiAreaLabel({ scale: 'national' }), 'United States HSI');
assert.equal(hsiAreaLabel({ scale: 'state', text: 'Arkansas' }), 'Arkansas state HSI');
assert.equal(hsiAreaLabel({ scale: 'custom', text: 'Hospital District' }), 'Hospital District custom HSI');
assert.deepEqual(HSI_SCALES.map((s) => s.id), ['national', 'regional', 'state', 'local', 'custom']);

const alerts = [
  { event: 'Tornado Warning', category: 'warning', areaDesc: 'Pulaski County', geometry: { type: 'Polygon', coordinates: [[[-92.4, 34.7], [-92.3, 34.7], [-92.3, 34.8], [-92.4, 34.8], [-92.4, 34.7]]] } },
  { event: 'Flood Warning', category: 'warning', areaDesc: 'Dallas County', geometry: { type: 'Polygon', coordinates: [[[-96.9, 32.7], [-96.8, 32.7], [-96.8, 32.8], [-96.9, 32.8], [-96.9, 32.7]]] } },
];
assert.equal(alertsForHsiScope(alerts, { scale: 'national' }).length, 2);
const square = [[-92.5, 34.6], [-92.2, 34.6], [-92.2, 34.9], [-92.5, 34.9], [-92.5, 34.6]];
const scoped = alertsForHsiScope(alerts, { scale: 'custom', polygon: square });
assert.equal(scoped.length, 1, 'custom operational area must filter alerts geographically');
assert.equal(scoped[0].areaDesc, 'Pulaski County');

console.log('PASS: Hazard Severity Index bands, confidence, data honesty, and scale scoping');
