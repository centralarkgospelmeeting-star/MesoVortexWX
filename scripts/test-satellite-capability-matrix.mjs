#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const file = path.resolve('lib/satellite/capability-matrix.ts');
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/export const SATELLITE_CAPABILITY_MATRIX[\s\S]*?\] as const;/);
if (!m) { console.error('FAIL: satellite matrix not found'); process.exit(1); }
const block = m[0];
const entries = block.split(/\n  \{ id: '/).slice(1);
if (entries.length === 0) { console.error('FAIL: no entries'); process.exit(1); }

let fail = 0;
const allowedAvailability = new Set(['WORKING', 'PARTIAL', 'UNAVAILABLE', 'RESTRICTED']);
const allowedVerification = new Set(['VERIFIED', 'PARTIALLY_VERIFIED', 'UNVERIFIED', 'TESTED_LIVE']);

for (const e of entries) {
  const id = e.split("'")[0];
  const av = e.match(/availability:\s*'([^']+)'/)?.[1];
  const lvl = e.match(/level:\s*'([^']+)'/)?.[1];
  if (!av || !allowedAvailability.has(av)) { console.error(`FAIL ${id}: bad availability`); fail++; }
  if (!lvl || !allowedVerification.has(lvl)) { console.error(`FAIL ${id}: bad verification level`); fail++; }
  if (!/lastCheckedAt:\s*'[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(e) && !/lastCheckedAt:\s*CHECKED_AT/.test(e)) { console.error(`FAIL ${id}: missing lastCheckedAt`); fail++; }
  if (!/evidence:\s*\[[^\]]+\]/.test(e)) { console.error(`FAIL ${id}: missing evidence`); fail++; }
  if (av === 'UNAVAILABLE' && !/unavailableReason:\s*'[^']+'/.test(e)) { console.error(`FAIL ${id}: UNAVAILABLE missing unavailableReason`); fail++; }
  if (av === 'WORKING' && lvl === 'UNVERIFIED') { console.error(`FAIL ${id}: WORKING cannot be UNVERIFIED`); fail++; }
}

const entrySource = (id) => src.split('\n').find((line) => line.includes(`{ id: '${id}'`)) || '';
const mesoEntry = entrySource('sector_mesoscale');
if (!/availability: 'PARTIAL'/.test(mesoEntry)) { console.error('FAIL sector_mesoscale: runtime mesoscale URLs require PARTIAL, not UNAVAILABLE'); fail++; }
if (/unavailableReason:/.test(mesoEntry)) { console.error('FAIL sector_mesoscale: PARTIAL entry must not claim DATA UNAVAILABLE'); fail++; }
if (!/Moving sector footprints/.test(mesoEntry)) { console.error('FAIL sector_mesoscale: must state why fixed bounds/probes are not claimed'); fail++; }
const abiEntry = entrySource('abi_channels');
if (/0\/0\/0/.test(abiEntry)) { console.error('FAIL abi_channels: stale 0/0/0 probe evidence must be removed'); fail++; }
if (!/VERIFIED_SATELLITE_PROBE_TILES/.test(abiEntry)) { console.error('FAIL abi_channels: evidence must cite fixed in-sector probe tiles'); fail++; }

console.log(`Checked ${entries.length} satellite capability entries`);

// Runtime contract guard for lib/satellite.ts. Transpile the dependency-free
// module in memory so the test checks the real exported functions, not a copy.
const satelliteSrc = fs.readFileSync(path.resolve('lib/satellite.ts'), 'utf8');
const compiled = ts.transpileModule(satelliteSrc, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText;
const satellite = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const {
  SATELLITE_BIRDS,
  SATELLITE_SECTORS,
  SATELLITE_PRODUCTS,
  normalizeSatelliteSelection,
  isSectorSupported,
  getSatelliteTileBounds,
  getSatelliteProbeTile,
  getSatelliteTileMaxzoom,
  getSatelliteTileUrl,
} = satellite;

const fixedSectors = ['conus', 'fulldisk', 'puertorico', 'alaska'];
const movingSectors = ['mesoscale-1', 'mesoscale-2'];
const expectedMaxzoom = {
  conus: 8,
  fulldisk: 6,
  puertorico: 8,
  alaska: 7,
  'mesoscale-1': 8,
  'mesoscale-2': 8,
};

for (const sector of fixedSectors) {
  const bounds = getSatelliteTileBounds(sector);
  if (!Array.isArray(bounds) || bounds.length !== 4 || bounds.some((v) => !Number.isFinite(v))) {
    console.error(`FAIL bounds ${sector}: expected four finite numbers`); fail++; continue;
  }
  const [west, south, east, north] = bounds;
  if (!(west < east && south < north)) { console.error(`FAIL bounds ${sector}: not ordered`); fail++; }
  if (!(west >= -180 && east <= 180 && south >= -90 && north <= 90)) {
    console.error(`FAIL bounds ${sector}: outside Mercator lon/lat domain`); fail++;
  }
}
for (const sector of movingSectors) {
  if (getSatelliteTileBounds(sector) !== undefined) {
    console.error(`FAIL bounds ${sector}: moving sector must stay unbounded`); fail++;
  }
}

function tileCenter(z, x, y) {
  const scale = 2 ** z;
  return {
    lng: ((x + 0.5) / scale) * 360 - 180,
    lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / scale))) * 180) / Math.PI,
  };
}

for (const sector of Object.keys(expectedMaxzoom)) {
  const z = getSatelliteTileMaxzoom(sector);
  if (z !== expectedMaxzoom[sector]) {
    console.error(`FAIL maxzoom ${sector}: expected ${expectedMaxzoom[sector]}, got ${z}`); fail++;
  } else if (!Number.isInteger(z) || z < 4 || z > 9) {
    console.error(`FAIL maxzoom ${sector}: outside verified 4..9 range`); fail++;
  }
}

const verifiedIemLayers = new Set(['goes_himawari_ch02']);
const iemChannels = Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0'));
// Live IEM WMS capabilities 2026-11-24/25: GOES-East PR defines only ch01-10,13,15.
const missingPuertoRicoChannels = new Set(['11', '12', '14', '16']);
for (const bird of SATELLITE_BIRDS.map((b) => b.id)) {
  if (bird === 'himawari') continue;
  const prefix = bird === 'goes-east' ? 'east' : 'west';
  for (const { id: sector } of SATELLITE_SECTORS) {
    if (!isSectorSupported(bird, sector)) continue;
    for (const ch of iemChannels) {
      if (sector === 'puertorico' && missingPuertoRicoChannels.has(ch)) continue;
      verifiedIemLayers.add(`goes_${prefix}_${sector}_ch${ch}`);
    }
  }
}

let checkedCombos = 0;
for (const bird of SATELLITE_BIRDS.map((b) => b.id)) {
  for (const { id: sector } of SATELLITE_SECTORS) {
    if (!isSectorSupported(bird, sector)) continue;
    checkedCombos++;
    const selection = normalizeSatelliteSelection({ bird, sector, productId: 'visible' });
    const probe = getSatelliteProbeTile(selection);
    const bounds = getSatelliteTileBounds(sector);

    if (movingSectors.includes(sector)) {
      if (probe !== null) { console.error(`FAIL probe ${bird}/${sector}: moving sector must have null probe`); fail++; }
    } else {
      const parsed = typeof probe === 'string' && probe.match(/^(\d+)\/(\d+)\/(\d+)$/);
      if (!parsed) {
        console.error(`FAIL probe ${bird}/${sector}: expected z/x/y string, got ${probe}`); fail++;
      } else {
        const z = Number(parsed[1]); const x = Number(parsed[2]); const y = Number(parsed[3]);
        const grid = 2 ** z;
        if (!(Number.isInteger(z) && z >= 2 && z <= getSatelliteTileMaxzoom(sector) && x >= 0 && x < grid && y >= 0 && y < grid)) {
          console.error(`FAIL probe ${bird}/${sector}: ${probe} outside z0..${getSatelliteTileMaxzoom(sector)} tile grid`); fail++;
        }
        if (bounds) {
          const { lng, lat } = tileCenter(z, x, y);
          if (!(lng >= bounds[0] && lng <= bounds[2] && lat >= bounds[1] && lat <= bounds[3])) {
            console.error(`FAIL probe ${bird}/${sector}: ${probe} centre (${lng.toFixed(2)},${lat.toFixed(2)}) outside bounds`); fail++;
          }
        }
      }
    }

    for (const product of SATELLITE_PRODUCTS) {
      const result = getSatelliteTileUrl({ bird, sector, productId: product.id });
      if (!product.available) {
        if (result.url !== null) { console.error(`FAIL url ${bird}/${sector}/${product.id}: unavailable product emitted a URL`); fail++; }
        continue;
      }
      const isHimawariCh02 = bird === 'himawari' && (product.id === 'visible' || product.id === 'ch02');
      const isMissingChannel = bird === 'goes-east' && sector === 'puertorico' && missingPuertoRicoChannels.has(product.channel);
      if (bird === 'himawari' && !isHimawariCh02) {
        if (result.url !== null) { console.error(`FAIL url himawari/${product.id}: only legacy ch02 is verified`); fail++; }
        continue;
      }
      if (isMissingChannel) {
        if (result.url !== null) { console.error(`FAIL url ${bird}/${sector}/${product.id}: unpublished IEM layer emitted`); fail++; }
        continue;
      }
      const layerMatch = result.url?.match(/^https:\/\/mesonet\.agron\.iastate\.edu\/cache\/tile\.py\/1\.0\.0\/([^/]+)\/\{z\}\/\{x\}\/\{y\}\.png$/);
      if (!layerMatch || !verifiedIemLayers.has(layerMatch[1])) {
        console.error(`FAIL url ${bird}/${sector}/${product.id}: unverified layer ${result.url}`); fail++;
      }
    }
  }
}

console.log(`Checked ${checkedCombos} bird/sector probe and URL combinations`);
if (fail) { console.error(`FAILED: ${fail} issues`); process.exit(1); }
console.log('PASS');
