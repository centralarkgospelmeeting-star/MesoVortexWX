import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/radar/velocity-dealias.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
vm.runInNewContext(compiled, sandbox);
const dealiasVelocity = sandbox.exports.dealiasVelocity || sandbox.module.exports.dealiasVelocity;
if (typeof dealiasVelocity !== 'function') throw new Error('dealiasVelocity export not found');

const nyquist = 10;
const radials = [];
for (let azimuth = 0; azimuth < 360; azimuth += 1) {
  const trueVelocity = 28 * Math.sin(azimuth * Math.PI / 180);
  const foldedVelocity = ((trueVelocity + nyquist) % (2 * nyquist) + 2 * nyquist) % (2 * nyquist) - nyquist;
  radials.push({
    azimuth,
    radial: { nyquist_velocity: nyquist },
    velocity: {
      first_gate: 10,
      gate_size: 0.25,
      moment_data: Array(100).fill(foldedVelocity),
    },
  });
}
const original = radials.map(r => [...r.velocity.moment_data]);
const result = dealiasVelocity(radials);
if (!result.diagnostics.available) throw new Error('Dealiasing unexpectedly unavailable');
if (result.diagnostics.quality !== 'usable') throw new Error('Complete Nyquist metadata should be usable');
let sumSquared = 0;
let samples = 0;
for (let ri = 0; ri < result.radials.length; ri++) {
  const expected = 28 * Math.sin(ri * Math.PI / 180);
  for (const value of result.radials[ri].velocity.moment_data) {
    if (value == null) continue;
    sumSquared += Math.pow(value - expected, 2);
    samples++;
  }
}
const rmse = Math.sqrt(sumSquared / samples);
if (rmse > 1.5) throw new Error('Folded synthetic wind field RMSE too high: ' + rmse);
if (result.diagnostics.gatesCorrected < 1000) throw new Error('Expected many corrected gates; got ' + result.diagnostics.gatesCorrected);
if (JSON.stringify(radials.map(r => r.velocity.moment_data)) !== JSON.stringify(original)) {
  throw new Error('Raw Level-II input arrays were mutated');
}
const missingNyquist = radials.map(r => ({ ...r, radial: { nyquist_velocity: 0 } }));
const unavailable = dealiasVelocity(missingNyquist);
if (unavailable.diagnostics.available || unavailable.diagnostics.quality !== 'unavailable') {
  throw new Error('Missing Nyquist metadata must fail closed');
}
console.log(JSON.stringify({
  rmseMps: Number(rmse.toFixed(3)),
  correctedGates: result.diagnostics.gatesCorrected,
  suspectedGates: result.diagnostics.gatesSuspected,
  unresolvedGates: result.diagnostics.gatesUnresolved,
  correctionRate: result.diagnostics.correctionRate,
}));
console.log('Velocity dealiasing synthetic tests PASS (folded radial wind field, raw-data immutability, and missing-Nyquist fail-closed checks)');


const partialNyquist = radials.map((radial, index) => index === 180
  ? { ...radial, radial: { nyquist_velocity: 0 } }
  : radial);
const partialResult = dealiasVelocity(partialNyquist);
if (!partialResult.diagnostics.available || partialResult.diagnostics.quality !== 'partial'
  || partialResult.diagnostics.nyquistMissingRadials !== 1) {
  throw new Error('Partial Nyquist coverage must remain explicitly marked partial');
}
const sparseAzimuth = [0, 1, 10, 11].map(azimuth => ({
  azimuth,
  radial: { nyquist_velocity: nyquist },
  velocity: { first_gate: 10, gate_size: 0.25, moment_data: Array(20).fill(4) },
}));
const sparseResult = dealiasVelocity(sparseAzimuth);
if (!sparseResult.diagnostics.available || sparseResult.diagnostics.gatesUnresolved === 0) {
  throw new Error('Large azimuth gaps must be reported as unresolved rather than silently bridged');
}
const nullPreservation = radials.map((radial, index) => ({
  ...radial,
  velocity: { ...radial.velocity, moment_data: radial.velocity.moment_data.map((value, gate) =>
    gate === 17 && index % 7 === 0 ? null : value) },
}));
const nullResult = dealiasVelocity(nullPreservation);
if (nullResult.radials.some((radial, index) =>
  radial.velocity.moment_data.some((value, gate) =>
    value == null && nullPreservation[index].velocity.moment_data[gate] != null))) {
  throw new Error('Missing-data gates must not be filled by the dealiasing pass');
}
