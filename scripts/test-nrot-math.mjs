import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/radar/nrot.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
vm.runInNewContext(compiled, sandbox);
const calculateNrot = sandbox.exports.calculateNrot || sandbox.module.exports.calculateNrot;
if (typeof calculateNrot !== 'function') throw new Error('calculateNrot export not found');

const radials = [];
for (let azimuth = 0; azimuth < 360; azimuth += 1) {
  const radians = azimuth * Math.PI / 180;
  const firstGate = 1;
  const gateSize = 0.25;
  const moment_data = Array.from({ length: 280 }, (_, gate) => {
    const rangeKm = firstGate + gate * gateSize;
    const eastKm = rangeKm * Math.sin(radians);
    const distanceFromEast = Math.min(azimuth, 360 - azimuth);
    const localizedVortexWindow = Math.exp(-Math.pow(distanceFromEast / 6, 2));
    return 6 * eastKm * localizedVortexWindow;
  });
  radials.push({
    azimuth,
    elevation_angle: 0.5,
    radial: { nyquist_velocity: 2500 },
    velocity: { first_gate: firstGate, gate_size: gateSize, moment_data },
  });
}
const cyclonic = calculateNrot(radials, 34.836, -92.262);
if (!cyclonic.available || cyclonic.maxCyclonic == null) throw new Error('Synthetic cyclonic shear was not detected');
if (Math.abs(cyclonic.maxCyclonic - 1) > 0.12) throw new Error('Expected normalized shear near +1; got ' + cyclonic.maxCyclonic);
if (cyclonic.quality.velocityDealiased !== false || cyclonic.quality.aliasSensitive !== true) throw new Error('Velocity aliasing limitation was not reported');

const antiRadials = radials.map(radial => ({
  ...radial,
  velocity: { ...radial.velocity, moment_data: radial.velocity.moment_data.map(value => -value) },
}));
const anticyclonic = calculateNrot(antiRadials, 34.836, -92.262);
if (anticyclonic.maxAnticyclonic == null || Math.abs(anticyclonic.maxAnticyclonic + 1) > 0.12) {
  throw new Error('Expected normalized anticyclonic shear near -1; got ' + anticyclonic.maxAnticyclonic);
}
if (cyclonic.gatesExcludedNearRadar === 0) throw new Error('Near-radar exclusion was not exercised');
console.log(JSON.stringify({
  cyclonicMax: cyclonic.maxCyclonic,
  anticyclonicMin: anticyclonic.maxAnticyclonic,
  analyzed: cyclonic.gatesAnalyzed,
  nearRadarExcluded: cyclonic.gatesExcludedNearRadar,
}));
console.log('NROT synthetic math tests PASS');
