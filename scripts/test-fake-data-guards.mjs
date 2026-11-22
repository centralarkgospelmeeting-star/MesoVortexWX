#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
let fail = 0;
const findings = [];

function read(rel) {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf8');
}
function exists(rel) { return fs.existsSync(path.resolve(ROOT, rel)); }
function walk(dir, exts, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', '.next', '.git', 'dist', 'out', 'build'].includes(ent.name)) continue;
      walk(p, exts, out);
    } else if (exts.some((e) => ent.name.endsWith(e))) out.push(p);
  }
  return out;
}
function flag(ok, msg) {
  if (!ok) { fail++; findings.push(`FAIL: ${msg}`); }
}

const apiFiles = walk(path.resolve(ROOT, 'app/api'), ['.ts', '.tsx', '.js', '.mjs']);
const libFiles = walk(path.resolve(ROOT, 'lib'), ['.ts', '.tsx', '.js', '.mjs']);
const scanFiles = [...apiFiles, ...libFiles];

for (const f of scanFiles) {
  const rel = path.relative(ROOT, f);
  const src = read(rel);
  // Regression: fabricated observation fallback
  if (/fallbackObservation/i.test(src)) flag(false, `${rel} contains forbidden fallbackObservation`);
  // Regression: Math.random used to fabricate weather/radar values in server/lib code
  if (/Math\.random\(/.test(src) && /app\/api\//.test(rel)) {
    flag(false, `${rel} uses Math.random() in API route (potential fabricated data)`);
  }
  // Obvious fake-data markers in API responses
  if (/app\/api\//.test(rel)) {
    const bad = src.match(/\b(fakeData|mockData|dummyData|sampleWeather|placeholderWeather)\b/);
    if (bad) flag(false, `${rel} contains suspicious fake-data identifier ${bad[0]}`);
  }
}

// Specific guard: weather-gateway must not synthesize observation
if (exists('lib/adapters/weather-gateway.ts')) {
  const src = read('lib/adapters/weather-gateway.ts');
  const lines = src.split(/\n/).map((l, i) => ({ l, i: i + 1 }))
    .filter(({ l }) => /createFallbackObservation|synthetic observation/i.test(l))
    .filter(({ l }) => !/never fabricate|do not fabricate|no fabricated|not fabricate/i.test(l));
  flag(lines.length === 0, `lib/adapters/weather-gateway.ts appears to contain synthetic observation logic: ${lines.map(x=>x.i).join(',')}`);
}

// Capability matrix: no WORKING product with synthetic/substitute flags
if (exists('lib/radar/capability-matrix.ts')) {
  const src = read('lib/radar/capability-matrix.ts');
  const blocks = src.split(/\n  \{\n    id: '/).slice(1);
  for (const b of blocks) {
    const id = b.split("'")[0];
    const av = b.match(/availability:\s*'([^']+)'/)?.[1];
    if (av === 'WORKING') {
      flag(!/synthetic:\s*true/.test(b), `capability ${id} is WORKING but synthetic:true`);
      flag(!/substitute:\s*true/.test(b), `capability ${id} is WORKING but substitute:true`);
      flag(/realData:\s*true/.test(b), `capability ${id} is WORKING but realData is not true`);
    }
  }
}

// Archive framework script must exist
flag(exists('scripts/radar-archive-probe-framework.mjs'), 'missing scripts/radar-archive-probe-framework.mjs');

for (const f of findings) console.error(f);
if (fail) { console.error(`FAILED: ${fail} fake-data guard issues`); process.exit(1); }
console.log(`PASS: fake-data guards (${scanFiles.length} files scanned)`);
