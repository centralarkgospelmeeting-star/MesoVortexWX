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
assert.match(store, /saveOutcome[\s\S]*outcomes\.jsonl/, 'learning store must append outcomes');
assert.match(types, /OutcomeLabel/, 'outcome labels must be a typed contract');
assert.doesNotMatch(store, /writeFile|unlink|rm\(/, 'learning store must never rewrite source or stored history');
for (const line of store.split('\n').filter((text) => /prompt|threshold|weight/i.test(text))) {
  assert.ok(/\bnever\b|\bnot\b|\bno production\b/i.test(line), `learning store may only negate mutation: ${line.trim()}`);
}

const watcher = fs.readFileSync('lib/mesoai/watcher.ts', 'utf8');
assert.match(watcher, /windowMs/, 'watcher must rate-limit summaries');
assert.match(watcher, /sourceRef/, 'watcher must deduplicate by source');
assert.doesNotMatch(watcher, /fetch\(/, 'watcher builder must be network-free');

const dataEngine = fs.readFileSync('lib/mesoai/data-engine.ts', 'utf8');
assert.match(dataEngine, /SATELLITE_CAPABILITY_MATRIX/, 'satellite context must come from the verified capability matrix');
for (const id of ['obs-mrms-aws-listing', 'obs-satellite-capability', 'obs-surface-metar', 'obs-storm-reports', 'obs-spc-mcd']) {
  assert.ok(dataEngine.includes(id), `data engine must normalize ${id}`);
}
assert.doesNotMatch(dataEngine, /fetch\(/, 'data engine must perform no network requests');
assert.match(dataEngine, /deriveGlmMetrics/, 'lightning metrics must come from the real GLM payload');
assert.match(dataEngine, /obs-satellite-selection/, 'selected satellite context must be normalized');
assert.match(dataEngine, /getSatelliteTileUrl/, 'satellite selection must reuse the verified URL builder');
assert.ok(dataEngine.includes('obs-surface-stations'), 'real station features must become a MesoAI observation');

const surfaceFeed = fs.readFileSync('lib/metar/surface-feed.ts', 'utf8');
assert.doesNotMatch(surfaceFeed, /fetch\(|Math\.random\(/, 'surface normalization must be deterministic and network-free');
assert.match(surfaceFeed, /AUTO\|AO\[12\]/, 'ASOS must come from real automated-station remarks');
assert.match(surfaceFeed, /ceilingRaw \* 100/, 'AWC ceil is in hundreds of feet');
assert.match(surfaceFeed, /const latest = new Map/, 'station reports must dedupe to the latest observation');
assert.match(surfaceFeed, /No fabricated|never invents|no invented/i, 'surface feed must disclaim invented readings');
const surfaceResponse = fs.readFileSync('lib/metar/surface-response.ts', 'utf8');
assert.match(surfaceResponse, /forcedSource/, 'ASOS route must force the automated-station subset');
const asosRoute = fs.readFileSync('app/api/asos/geojson/route.ts', 'utf8');
assert.match(asosRoute, /params\.set\('source', 'asos'\)/, 'ASOS endpoint must request the strict subset');
const radarMapSource = fs.readFileSync('components/RadarMap.tsx', 'utf8');
for (const id of ['mv-surface-source', 'mv-surface-point', 'mv-surface-label']) {
  assert.ok(radarMapSource.includes(id), `METAR/ASOS map layer must define ${id}`);
}
const surfacePanel = fs.readFileSync('components/METARPanel.tsx', 'utf8');
assert.match(surfacePanel, /flightCategory/, 'panel must show real flight category');
assert.match(surfacePanel, /ceilingFt/, 'panel must show real ceiling');
assert.match(surfacePanel, /visibilitySm/, 'panel must show real visibility');
const analyzeRoute = fs.readFileSync('app/api/mesoai/analyze/route.ts', 'utf8');
assert.match(analyzeRoute, /surfaceInput\.features\.slice\(0, 150\)/, 'MesoAI must cap supplied station features');

const glmRoute = fs.readFileSync('app/api/lightning/glm/route.ts', 'utf8');
assert.match(glmRoute, /normalizeGlmResponse/, 'GLM route must normalize source fields');
const glmMetricsSource = fs.readFileSync('lib/lightning/glm-metrics.ts', 'utf8');
assert.doesNotMatch(glmMetricsSource, /fetch\(|Math\.random\(/, 'GLM metrics must stay deterministic and network-free');
assert.match(glmMetricsSource, /Flash Extent Density/, 'derived metrics must disclaim FED');

const capabilitySource = fs.readFileSync('lib/capabilities/severe-capabilities.ts', 'utf8');
for (const id of ['cg_strike_count', 'flash_extent_density_grid', 'lightning_tracks']) {
  assert.ok(capabilitySource.includes(`id: '${id}'`), `lightning gap must be explicitly unavailable: ${id}`);
}
for (const stale of ['Blitzortung Live Lightning', 'Lightning Blitzortung Grid']) {
  assert.ok(!fs.readFileSync('components/FloatingProductPanel.tsx', 'utf8').includes(stale) && !fs.readFileSync('components/MainMenuDrawer.tsx', 'utf8').includes(stale), `stale source label must be gone: ${stale}`);
}

const outcomeRoute = fs.readFileSync('app/api/mesoai/outcome/route.ts', 'utf8');
assert.match(outcomeRoute, /OUTCOMES/, 'outcome route must validate labels');
assert.match(outcomeRoute, /saveOutcome/, 'outcome route must append to the learning store');
assert.doesNotMatch(outcomeRoute, /Math\.random\(/, 'outcome IDs must be deterministic');
const panel = fs.readFileSync('components/MesoAIPanel.tsx', 'utf8');
for (const id of ['severe_verified', 'severe_not_verified', 'no_observation', 'unknown']) {
  assert.ok(panel.includes(`'${id}'`), `panel must expose outcome: ${id}`);
}
assert.match(panel, /data-mesoai-outcome=/, 'outcome buttons must be observable');

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
  'lib/metar/surface-feed.ts',
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
const surface = require(path.join(outDir, 'metar', 'surface-feed.js'));

const rawStationReports = [
  { id: 'KAAA', geometry: { coordinates: [-90, 34] }, properties: { obsTime: '2026-11-25T12:00:00Z', temp: 1, ceil: 95, rawOb: 'METAR KAAA 251200Z AUTO 10SM OVC095 01/M02 A3001 AO2' } },
  { id: 'KAAA', geometry: { coordinates: [-90, 34] }, properties: { obsTime: '2026-11-25T13:00:00Z', temp: 3, ceil: 40, rawOb: 'METAR KAAA 251300Z AUTO 10SM OVC040 03/M02 A3001 AO2' } },
  { id: 'KBBB', geometry: { coordinates: [-91, 35] }, properties: { obsTime: '2026-11-25T13:00:00Z', temp: 5, rawOb: 'METAR KBBB 251300Z 10SM SKC 05/M02 A3001' } },
];
const allStations = surface.normalizeCollection(rawStationReports, 'metar');
assert.equal(allStations.length, 2, 'duplicate station reports must collapse to the latest');
const aaa = allStations.find((item) => item.id === 'KAAA');
assert.equal(aaa.properties.tempC, 3, 'latest station report must win');
assert.equal(aaa.properties.ceilingFt, 4000, 'ceil 40 must mean 4000 ft');
assert.equal(aaa.properties.asos, true, 'AO2 remark must classify as ASOS');
const asosOnly = surface.normalizeCollection(rawStationReports, 'asos');
assert.equal(asosOnly.length, 1, 'ASOS must exclude reports without automated markers');
assert.equal(surface.buildUpstreamUrl({}), null, 'missing query must fail closed before fetch');
assert.equal(surface.buildUpstreamUrl({ bbox: '33,-95,36' }), null, 'malformed bbox must fail closed before fetch');

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

const broader = data.buildObservations({
  site,
  mrms: {
    available: true,
    source: 'NOAA MRMS AWS Open Data (S3)',
    prefix: 'CONUS/MergedReflectivityQCComposite_00.50/',
    pipelineStatus: 'SCAFFOLD - real S3 listing only',
    objects: [{ key: 'CONUS/test.grib2', lastModified: '2026-11-24T12:00:00Z' }],
  },
  metar: {
    observations: [{ station: 'KOUN', text: 'Clear skies', temp: '72°F', dewpoint: '55°F', wind: 'Calm' }],
    _meta: { ok: true, fetchedAt: '2026-11-24T12:00:00Z' },
  },
  surfaceStations: {
    features: [
      { id: 'KLIT', properties: { stationId: 'KLIT', flightCategory: 'VFR', tempC: 4, asos: true, rawOb: 'METAR KLIT 251353Z 01005KT 10SM SKC 04/M03 A3027 AO2' } },
      { id: 'KFYV', properties: { stationId: 'KFYV', flightCategory: 'MVFR', tempC: -4, asos: true, rawOb: 'METAR KFYV 251353Z AUTO 10SM OVC015 M04/M06 A3012' } },
      { id: 'KFFF', properties: { stationId: 'KFFF', flightCategory: null, tempC: null, asos: false, rawOb: '' } },
    ],
    _meta: { fetchedAt: '2026-11-24T12:00:00Z' },
  },
  lsr: { features: [{ type: 'Feature' }], _meta: { fetchedAt: '2026-11-24T12:00:00Z' } },
  mcd: {
    features: [{ properties: { name: 'Mesoscale Discussion 1234', issueTime: '2026-11-24T11:55:00Z' } }],
  },
  includeSatelliteContext: true,
});
const broaderIds = broader.map((item) => item.id);
for (const id of ['obs-mrms-aws-listing', 'obs-satellite-capability', 'obs-surface-metar', 'obs-surface-stations', 'obs-storm-reports', 'obs-spc-mcd']) {
  assert.ok(broaderIds.includes(id), `broader data engine must emit ${id}`);
}
const stationObservation = broader.find((item) => item.id === 'obs-surface-stations');
assert.equal(stationObservation.values.stationCount, 3, 'station count must come from real features');
assert.equal(stationObservation.values.asosCount, 2, 'ASOS count must come only from AUTO/AO remarks');
assert.match(stationObservation.caveats.join(' '), /no separate ASOS feed/i, 'ASOS must disclaim a separate feed');
assert.ok(broader.every((item) => item.verification !== 'VERIFIED' || item.domain === 'RADAR'), 'metadata context must stay PARTIAL');
assert.ok(broader.find((item) => item.id === 'obs-mrms-aws-listing').caveats.some((text) => /decode/i.test(text)), 'MRMS context must disclaim missing decode pipeline');
assert.ok(broader.find((item) => item.id === 'obs-satellite-capability').caveats.some((text) => /no pixel value/i.test(text)), 'satellite context must disclaim imagery values');
const broaderDetections = detect.runDetections(broader);
assert.ok(broaderDetections.some((item) => item.id === 'det-mcd'), 'MCD detector must emit a LOW-confidence guidance signal');
assert.ok(broaderDetections.every((item) => item.operationalClaim === false), 'broader detections stay non-operational');
const broaderText = render.renderLocalAnalysis({
  mode: 'storm',
  site,
  generatedAt: '2026-11-24T12:01:00.000Z',
  observations: broader,
}, broaderDetections);
assert.match(broaderText.explanation, /mesoscale discussion/i, 'renderer must explain MCD context');
assert.doesNotMatch(`${broaderText.headline} ${broaderText.explanation}`, render.GATED_CLAIM_PATTERN, 'broader output avoids gated claims');

// ---------- GLM-derived metrics and selected satellite context ----------
const glm = require(path.join(outDir, 'lightning', 'glm-metrics.js'));
const glmPayload = {
  available: true,
  source: 'NOAA GOES-R GLM (GOES-East, noaa-goes19 S3)',
  generatedAt: '2026-11-24T12:00:00Z',
  windowMinutes: 5,
  count: 3,
  features: {
    type: 'FeatureCollection',
    features: [
      { geometry: { coordinates: [-92.25, 34.85] }, properties: { energy_j: 10 } },
      { geometry: { coordinates: [-92.26, 34.86] }, properties: { energy_j: 20 } },
      { geometry: { coordinates: [-93, 35.5] }, properties: { energy_j: null } },
    ],
  },
};
const normalizedGlm = glm.normalizeGlmResponse(glmPayload, 5);
assert.equal(normalizedGlm.minutes, 5, 'windowMinutes must normalize to minutes');
assert.equal(normalizedGlm.flashCount, 3, 'count must normalize to flashCount');
assert.equal(normalizedGlm.metrics.flashesPerMinute, 0.6, 'rate must derive from real flashes only');
assert.equal(normalizedGlm.metrics.occupiedCells01Deg, 2, 'cell occupancy must derive from real coordinates');
assert.ok(normalizedGlm.metrics.extentLatKm > 72 && normalizedGlm.metrics.extentLatKm < 73, 'extent must derive from real coordinates');
assert.equal(normalizedGlm.metrics.meanEnergyJ, 15, 'mean energy must ignore missing values');
assert.equal(normalizedGlm.metrics.maxEnergyJ, 20, 'max energy must come from the source field');
assert.equal(glm.deriveGlmMetrics({ available: false }), null, 'unavailable GLM must produce no metrics');
const passthrough = glm.normalizeGlmResponse({ available: false, reason: 'DATA UNAVAILABLE - no feed' }, 5);
assert.ok(!('metrics' in passthrough) && !('flashCount' in passthrough), 'unavailable GLM must pass through without derived fields');
const glmObservation = data.buildObservations({ site, lightning: normalizedGlm }).find((item) => item.id === 'obs-lightning-glm');
assert.ok(glmObservation, 'real GLM payload must produce a lightning observation');
assert.equal(glmObservation.observedAt, '2026-11-24T12:00:00Z', 'observation time must come from the source');
assert.equal(glmObservation.values.flashesPerMinute, 0.6, 'MesoAI must receive the derived rate');
assert.ok(glmObservation.caveats.some((text) => /Flash Extent Density/.test(text)), 'MesoAI must disclaim the official FED product');
assert.ok(glmObservation.caveats.some((text) => /CG strike count/.test(text)), 'MesoAI must disclaim CG strike counts');

const irSelection = data.buildObservations({ site, satelliteSelection: { bird: 'goes-east', sector: 'conus', productId: 'ir' } })
  .find((item) => item.id === 'obs-satellite-selection');
assert.ok(irSelection, 'selected satellite channel must produce an observation');
assert.equal(irSelection.verification, 'PARTIAL', 'verified IR tile selection stays PARTIAL');
assert.equal(irSelection.values.channel, '13', 'channel must come from the real product definition');
assert.equal(irSelection.values.tileUrlAvailable, true, 'IR tile URL must be verified');
const rgbSelection = data.buildObservations({ site, satelliteSelection: { bird: 'goes-east', sector: 'conus', productId: 'geocolor' } })
  .find((item) => item.id === 'obs-satellite-selection');
assert.equal(rgbSelection.verification, 'UNAVAILABLE', 'GeoColor must fail closed');
assert.equal(rgbSelection.values.tileUrlAvailable, false, 'no RGB tile URL may be claimed');
assert.ok(rgbSelection.caveats.some((text) => /RGB and GeoColor/.test(text)), 'RGB unavailability must be explicit');

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
