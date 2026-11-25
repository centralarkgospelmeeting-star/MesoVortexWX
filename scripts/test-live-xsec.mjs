const base = process.env.XSEC_BASE_URL || 'http://127.0.0.1:3000';
const deadline = Date.now() + 60_000;
let ready = false;

while (Date.now() < deadline) {
  try {
    const response = await fetch(base, { signal: AbortSignal.timeout(3000) });
    if (response.status < 500) { ready = true; break; }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1500));
}
if (!ready) throw new Error('Next.js production server did not become ready within 60 seconds.');

const response = await fetch(`${base}/api/radar/cross-section`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  signal: AbortSignal.timeout(90_000),
  body: JSON.stringify({
    site: 'KLZK',
    start: { lon: -92.262, lat: 34.79 },
    end: { lon: -92.262, lat: 34.88 },
    columns: 120,
  }),
});

const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  throw new Error(`Live XSEC endpoint returned HTTP ${response.status}: ${payload.error || 'unknown error'}`);
}
if (payload.liveOnly !== true || payload.site !== 'KLZK' || !payload.scanTime || !Array.isArray(payload.sweeps) || payload.sweeps.length === 0) {
  throw new Error('Live XSEC response is missing its live-source, scan-time, site, or sweep metadata.');
}
if (payload.transectSampling !== 'GREAT_CIRCLE_EQUAL_DISTANCE'
  || payload.heightReference !== 'ABOVE_RADAR_LEVEL'
  || payload.beamModel !== '4/3_EARTH_EFFECTIVE_RADIUS') {
  throw new Error('Live XSEC response is missing its explicit transect geometry or beam-height reference metadata.');
}
let heightSamples = 0;
for (const sweep of payload.sweeps) {
  if (!Array.isArray(sweep.beamHeightFtAboveRadar) || sweep.beamHeightFtAboveRadar.length !== payload.columns) {
    throw new Error('A live XSEC sweep has an invalid above-radar beam-height array.');
  }
  heightSamples += sweep.beamHeightFtAboveRadar.filter((value) => typeof value === 'number' && Number.isFinite(value)).length;
}
if (heightSamples === 0) throw new Error('The live XSEC volume returned no finite beam-height samples.');
const measuredGates = payload.sweeps.reduce((total, sweep) =>
  total + (Array.isArray(sweep.reflectivityDbz)
    ? sweep.reflectivityDbz.filter((value) => typeof value === 'number' && Number.isFinite(value)).length
    : 0), 0);
if (measuredGates === 0) {
  throw new Error('The live volume returned no numeric reflectivity gates along the test transect.');
}
console.log(JSON.stringify({
  result: 'PASS',
  site: payload.site,
  scanTime: payload.scanTime,
  sweeps: payload.sweeps.length,
  columns: payload.columns,
  measuredGates,
  heightSamples,
  transectSampling: payload.transectSampling,
  heightReference: payload.heightReference,
  beamModel: payload.beamModel,
  source: payload.source,
}, null, 2));
