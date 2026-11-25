#!/usr/bin/env node
/**
 * MesoAI M2/M3 contract tests.
 *
 * Loads the pure TypeScript modules through a throwaway CommonJS compile so the
 * deterministic engine is exercised with no network access. Fixture values are
 * test-only structured observations, never application data.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---------- static source contracts ----------
const types = fs.readFileSync('lib/mesoai/types.ts', 'utf8');
assert.match(types, /operationalClaim: false/, 'detections must be structurally non-operational');
assert.match(types, /WeatherObservation/, 'data engine must emit structured observations');
for (const kind of ['RADAR', 'COMPOSITE', 'MRMS', 'QPE', 'SATELLITE', 'MODEL', 'OBSERVATION', 'ALERT']) {
  assert.ok(types.includes(`'${kind}'`), `domain must exist: ${kind}`);
}

const detector = fs.readFileSync('lib/mesoai/detection-engine.ts', 'utf8');
assert.match(detector, /operationalClaim: false/, 'every emission must be non-operational');
assert.doesNotMatch(detector, /fetch\(/, 'detector must not fetch data');
for (const banned of ['tvs', 'debris signature', 'tornado on the ground', 'mesocyclone object', 'projected path']) {
  const mentions = detector.split('\n').filter((line) => line.toLowerCase().includes(banned));
  for (const line of mentions) {
    // The only permitted mentions are explicit negations in caveats or the
    // final belt-and-braces gate that filters such text out of detections.
    assert.ok(
      /\bno\b|\bnot\b|\bnever\b|\bclaim\b|return !\//i.test(line),
      `detector must only negate or gate "${banned}", never claim it: ${line.trim()}`
    );
  }
}

const renderer = fs.readFileSync('lib/mesoai/local-renderer.ts', 'utf8');
assert.match(renderer, /GATED_CLAIM_PATTERN/, 'renderer must reject gated claims');
assert.match(renderer, /validateAnalysisText/, 'renderer must validate output');
assert.doesNotMatch(renderer, /fetch\(/, 'local renderer must be network-free');
for (const feature of ['stormAnalysis', 'productAnalysis', 'warningAnalysis', 'modelAnalysis']) {
  assert.match(renderer, new RegExp(`function ${feature}`), `renderer must implement ${feature}`);
}

const qwen = fs.readFileSync('lib/mesoai/qwen-adapter.ts', 'utf8');
assert.match(qwen, /MESOAI_ENABLED/, 'model renderer must require explicit opt-in');
assert.match(qwen, /MESOAI_BASE_URL/, 'model renderer must require a configured endpoint');
assert.match(qwen, /MESOAI_API_KEY/, 'model renderer must read the key from environment only');
assert.match(qwen, /validateAnalysisText/, 'model output must be validated');
assert.match(qwen, /catch/, 'model failure must fall back');
assert.doesNotMatch(qwen, /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i, 'no key may be committed');

const store = fs.readFileSync('lib/mesoai/feedback-store.ts', 'utf8');
assert.match(store, /appendFile/, 'learning store must be append-only');
assert.doesNotMatch(store, /writeFile|unlink|rm\(/, 'learning store must never rewrite source or stored history');
for (const line of store.split('\n').filter((text) => /prompt|threshold|weight/i.test(text))) {
  assert.ok(/\bnever\b|\bnot\b|\bno production\b/i.test(line), `learning store may only negate mutation: ${line.trim()}`);
}

const watcher = fs.readFileSync('lib/mesoai/watcher.ts', 'utf8');
assert.match(watcher, /windowMs/, 'watcher must rate-limit summaries');
assert.match(watcher, /sourceRef/, 'watcher must deduplicate by source');
assert.doesNotMatch(watcher, /fetch\(/, 'watcher builder must be network-free');

const page = fs.readFileSync('app/page.tsx', 'utf8');
assert.match(page, /data-menu-mesoai="true"/, 'menu must expose the MesoAI toggle');
assert.match(page, /<MesoAIPanel/, 'page must mount the MesoAI panel');
assert.match(page, /mesoaiWarning/, 'warning explanation must receive a real selected alert');

// ---------- runtime contracts ----------
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesoai-engine-'));
const tsc = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const files = [
  'lib/mesoai/types.ts',
  'lib/mesoai/util.ts',
  'lib/mesoai/data-engine.ts',
  'lib/mesoai/detection-engine.ts',
  'lib/mesoai/local-renderer.ts',
  'lib/mesoai/watcher.ts',
  'lib/mesoai/qwen-adapter.ts',
];
execFileSync(tsc, [
  ...files,
  '--outDir', outDir,
  '--module', 'commonjs',
  '--target', 'es2020',
  '--esModuleInterop',
  '--skipLibCheck',
  '--moduleResolution', 'node',
], { cwd: process.cwd(), stdio: 'pipe' });

const detect = require(path.join(outDir, 'mesoai', 'detection-engine.js'));
const render = require(path.join(outDir, 'mesoai', 'local-renderer.js'));
const watch = require(path.join(outDir, 'mesoai', 'watcher.js'));
const data = require(path.join(outDir, 'mesoai', 'data-engine.js'));
const qwenAdapter = require(path.join(outDir, 'mesoai', 'qwen-adapter.js'));

const site = { id: 'KLZK', name: 'Little Rock, AR', lat: 34.84, lon: -92.23 };
const radarObservation = {
  id: 'obs-radar-level2',
  domain: 'RADAR',
  source: 'NEXRAD Level II',
  productCode: 'storm-analysis',
  verification: 'VERIFIED',
  observedAt: '2026-11-24T12:00:00.000Z',
  values: {
    maxDbz: 65,
    gates50: 240,
    coupletDeltaKt: 60,
    shearS1: 0.012,
    nrot: 2.4,
    minRhohv: 0.72,
  },
  caveats: ['Screening sample'],
};
const lightningObservation = {
  id: 'obs-lightning-glm',
  domain: 'OBSERVATION',
  source: 'GOES-R GLM',
  verification: 'VERIFIED',
  observedAt: '2026-11-24T12:00:00.000Z',
  values: { flashCount: 30, minutes: 5 },
  caveats: [],
};
const alertObservation = {
  id: 'obs-nws-alerts',
  domain: 'ALERT',
  source: 'NWS alerts',
  verification: 'VERIFIED',
  observedAt: '2026-11-24T11:58:00.000Z',
  values: { count: 1, events: 'Tornado Warning', hasWarning: true, hasFlashFlood: false },
  caveats: ['Official NWS product'],
};

assert.deepEqual(detect.runDetections([]), [], 'no observations produce no detections');
const detections = detect.runDetections([radarObservation, lightningObservation, alertObservation]);
const ids = detections.map((item) => item.id);
for (const id of ['det-reflectivity', 'det-echo-coverage', 'det-couplet', 'det-shear', 'det-nrot', 'det-rhohv', 'det-lightning', 'det-warning']) {
  assert.ok(ids.includes(id), `detector must emit ${id}`);
}
assert.ok(detections.every((item) => item.operationalClaim === false), 'no detection may be operational');
assert.ok(detections.every((item) => item.caveats.length > 0), 'every detection must carry caveats');
assert.ok(detections.every((item) => item.evidence.length > 0), 'every detection must carry evidence');
assert.ok(!detections.some((item) => /tvs|debris|mesocyclone object|projected path/i.test(`${item.kind} ${item.evidence.join(' ')}`)), 'gated signatures must be absent');

const storm = render.renderLocalAnalysis({
  mode: 'storm',
  site,
  generatedAt: '2026-11-24T12:01:00.000Z',
  observations: [radarObservation, lightningObservation],
}, detections.filter((item) => item.id !== 'det-warning'));
assert.equal(storm.renderer, 'local');
assert.match(storm.explanation, /screening proxies/i, 'rotation language must stay caveated');
assert.doesNotMatch(`${storm.headline} ${storm.explanation}`, render.GATED_CLAIM_PATTERN, 'storm output must avoid gated claims');
assert.equal(storm.detections.length, 7);

assert.equal(render.validateAnalysisText('Debris signature detected at the site.', detections), false);
assert.equal(render.validateAnalysisText('TVS confirmed by MesoAI.', detections), false);
assert.equal(render.validateAnalysisText('MesoAI issued a tornado warning.', detections), false);
assert.equal(render.validateAnalysisText('Rotation is present.', []), false);
assert.equal(render.validateAnalysisText('Sampled reflectivity reached 65 dBZ.', detections.filter((item) => item.id === 'det-reflectivity')), true);
assert.equal(render.validateAnalysisText('A non-radar product description.', detections, 'product'), true);

const productResult = render.renderLocalAnalysis({
  mode: 'product',
  site,
  generatedAt: '2026-11-24T12:01:00.000Z',
  observations: [],
  product: { key: 'ref', label: 'Reflectivity', domain: 'RADAR', available: true },
}, []);
assert.match(productResult.headline, /RADAR/, 'product explanation must state the source domain');
assert.match(productResult.explanation, /NEXRAD|provider|Reflectivity/i, 'product explanation must reuse catalog facts');

const unavailable = render.renderLocalAnalysis({
  mode: 'product',
  site,
  generatedAt: '2026-11-24T12:01:00.000Z',
  observations: [],
  product: { key: 'nrot', label: 'NROT', domain: 'RADAR', available: false, reason: 'DATA UNAVAILABLE — no verified source.' },
}, []);
assert.match(unavailable.explanation, /DATA UNAVAILABLE/, 'unavailable products must fail closed');

const warningResult = render.renderLocalAnalysis({
  mode: 'warning',
  site,
  generatedAt: '2026-11-24T12:01:00.000Z',
  observations: [],
  warning: {
    event: 'Tornado Warning',
    headline: 'Tornado Warning issued by NWS Little Rock',
    description: 'A tornado was reported nearby.',
    instruction: 'Take shelter in an interior room.',
    areaDesc: 'Pulaski County, AR',
    category: 'warning',
    severity: 'Extreme',
    sent: '2026-11-24T11:58:00.000Z',
  },
}, []);
assert.match(warningResult.explanation, /did not issue or upgrade it/i, 'warning output must disclaim issuance');
assert.match(warningResult.explanation, /Tornado Warning/, 'warning output must restate the official product');

const modelResult = render.renderLocalAnalysis({
  mode: 'model',
  site,
  generatedAt: '2026-11-24T12:01:00.000Z',
  observations: [],
  models: ['hrrr', 'rap', 'gfs', 'nam3km'].map((id) => ({
    id,
    label: id.toUpperCase(),
    provider: 'verified catalog',
    status: 'READY_NOW',
    fields: [{ id: 'ref', label: 'Reflectivity', value: 'AVAILABLE', status: 'READY_NOW' }],
  })),
}, []);
for (const id of ['HRRR', 'RAP', 'GFS', 'NAM3KM']) {
  assert.ok(modelResult.indicators.some((item) => item.includes(id)), `model comparison must include ${id}`);
}
assert.match(modelResult.explanation, /not observation/i, 'model output must be labeled guidance');

const first = watch.buildWatcherSummaries(detections, { now: Date.parse('2026-11-24T12:05:00.000Z'), limit: 20 });
assert.ok(first.summaries.length > 0, 'watcher must emit summaries from detections');
const second = watch.buildWatcherSummaries(detections, {
  now: Date.parse('2026-11-24T12:06:00.000Z'),
  state: first.state,
  limit: 20,
});
assert.equal(second.summaries.length, 0, 'watcher must suppress identical recent summaries');
assert.ok(first.summaries.every((item) => item.sources.length > 0 && item.caveats.length > 0), 'watcher summaries must cite sources and uncertainty');

assert.deepEqual(data.buildObservations({ site }), [], 'empty data engine input must produce no observations');
const normalized = data.buildObservations({
  site,
  stormAnalysis: {
    scanTime: '2026-11-24T12:00:00.000Z',
    sweeps: [{ reflectivity: { max: 52, gatesAtLeast50DbZ: 120 } }],
    rotationCouplets: [{ deltaVelocityKt: 44, azimuthalShearS1: 0.008 }],
  },
  alerts: [{ event: 'Severe Thunderstorm Warning', category: 'warning', areaDesc: 'Pulaski County, AR', wfo: 'LZK' }],
  productKey: 'ref',
});
assert.ok(normalized.some((item) => item.id === 'obs-radar-level2'), 'data engine must normalize Level II');
assert.ok(normalized.some((item) => item.id === 'obs-nws-alerts'), 'data engine must normalize alerts');
assert.ok(normalized.every((item) => item.verification !== 'UNAVAILABLE'), 'unavailable sources must not become observations');

delete process.env.MESOAI_ENABLED;
assert.equal(qwenAdapter.qwenConfig(), null, 'model renderer must fail closed when disabled');
const fallback = await qwenAdapter.renderAnalysis({
  mode: 'storm',
  site,
  generatedAt: '2026-11-24T12:01:00.000Z',
  observations: [radarObservation],
}, detections.slice(0, 2));
assert.equal(fallback.renderer, 'local', 'disabled model renderer must return local analysis');

fs.rmSync(outDir, { recursive: true, force: true });
console.log('PASS: MesoAI detection, renderer, watcher, and fail-closed contracts');
