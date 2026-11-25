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

// Legacy index.html must not present canned scores, AI replies, or live status.
if (exists('index.html')) {
  const src = read('index.html');
  const forbidden = [
    { re: /Severe\s+Risk\s+Score|Composite\s+Risk\s+Score/i, label: 'a fabricated severe risk score label' },
    { re: /\b84\s*\/\s*100\b|\b84\s+out\s+of\s+100\b/i, label: 'a hard-coded 84/100 score' },
    { re: /\[AI\]|<b>AI:<\/b>|Analyzing thermodynamic profiles|Strong azimuthal shear detected|Severe Hail Index \(SHI\) indicates/i, label: 'a canned AI reply' },
    { re: /Monitoring real-time NEXRAD|NEXRAD WSR-88D Live|FETCHING LIVE NWS ALERTS|●\s*Connected/i, label: 'a fake live-status claim' },
    { re: /aiChatHistory|riskScore|riskBar|submitSpotterReport/i, label: 'legacy fake-demo UI hooks' },
  ];
  for (const { re, label } of forbidden) flag(!re.test(src), `index.html contains ${label}`);
  flag(/STATIC ARCHIVE/i.test(src) && /NOT FOR OPERATIONAL USE/i.test(src),
    'index.html must be clearly labeled STATIC ARCHIVE / NOT FOR OPERATIONAL USE');
}

// AI copilot prompts must not supply invented meteorological defaults.
const copilotFiles = walk(path.resolve(ROOT, 'app/api/copilot'), ['.ts', '.tsx', '.js', '.mjs']);
for (const f of copilotFiles) {
  const rel = path.relative(ROOT, f);
  const src = read(rel);
  for (const [value, label] of [
    [/\b2400\b/, 'SBCAPE 2400'],
    [/\b220\b/, 'SRH 220'],
    [/\b48\b/, 'bulk shear 48'],
    [/\b2\.4\b/, 'STP 2.4'],
  ]) {
    flag(!value.test(src), `${rel} contains removed invented value ${label}`);
  }
  src.split(/\n/).forEach((line, i) => {
    const at = `${rel}:${i + 1}`;
    if (/(\|\||\?\?)\s*\d+(?:\.\d+)?\b/.test(line)) {
      flag(false, `${at} uses a numeric fallback default in an AI prompt`);
    }
    if (/\b(SBCAPE|SRH(?:01)?|shear06|bulk shear|STP)\b/i.test(line) && /\b\d{2,}\b/.test(line)) {
      flag(false, `${at} hard-codes a meteorological index value in an AI prompt`);
    }
  });
  flag(/do not (?:infer|estimate|assume|fabricate)|never invent/i.test(src),
    `${rel} must instruct the model not to fabricate missing values`);
}

// Radar frame times must come from provider scan metadata, not the server clock.
// Legitimate uses of new Date() for fetchedAt/cache headers are not flagged.
const clockArithmetic = /new\s+Date\s*\(\s*(?:(?:Date\.now|[A-Za-z_$][\w$]*\.getTime)\s*\(\s*\))?\s*[-+]\s*[^)]*\*/;
const frameClockTime = /\b(?:time|timestamp|scanTime|validTime)\s*:\s*[A-Za-z_$][\w$]*\s*\.\s*toISOString\s*\(\s*\)/;
const frameClockVariable = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:frame|scan|valid|stamp|time)[A-Za-z_$\w]*\s*=\s*new\s+Date\s*\(/i;
for (const f of apiFiles) {
  const rel = path.relative(ROOT, f);
  const src = read(rel);
  const frameContext = /\bframes?\b/i.test(src);
  src.split(/\n/).forEach((line, i) => {
    const at = `${rel}:${i + 1}`;
    if (clockArithmetic.test(line)) flag(false, `${at} synthesizes a timestamp from the server clock`);
    if (frameClockTime.test(line) && frameContext) {
      flag(false, `${at} assigns a clock-derived value to radar frame time metadata`);
    }
    if (frameClockVariable.test(line) && frameContext) {
      flag(false, `${at} initializes frame/scan time metadata from the server clock`);
    }
  });
  if (/app[/\\]api[/\\]radar[/\\]route\.ts$/.test(rel)) {
    flag(/status:\s*410/.test(src), 'app/api/radar/route.ts must be deprecated with 410 Gone');
    flag(!/\bframes\s*[:=]\s*\[/.test(src), 'app/api/radar/route.ts must not construct radar frames');
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
console.log(`PASS: fake-data guards (${scanFiles.length} API/lib files; index.html, app/api/copilot/**, and radar frame time checks scanned)`);
