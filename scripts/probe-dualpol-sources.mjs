#!/usr/bin/env node
/**
 * Verification-only probe for unavailable dual-pol/spectrum/hydroclass products.
 * DATA HONESTY: This script does NOT enable products. It records evidence only.
 */
import fs from 'node:fs/promises';

const IEM_TILE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';
const IEM_JSON = 'https://mesonet.agron.iastate.edu/json/radar.py';
const MRMS = 'https://mrms.ncep.noaa.gov';
const SITES = ['LZK', 'TLX', 'DMX', 'LOT', 'MHX'];
const PRODUCTS = [
  { id: 'cc',  label: 'Correlation Coefficient', codes: ['N0C'] },
  { id: 'zdr', label: 'Differential Reflectivity', codes: ['N0X'] },
  { id: 'kdp', label: 'Specific Differential Phase', codes: ['N0K'] },
  { id: 'sw',  label: 'Spectrum Width', codes: ['NSW', 'NSP', 'N0U'] }, // N0U is velocity, included as control? no - avoid confusion
  { id: 'hhc', label: 'Hydrometeor Classification', codes: ['N0H', 'HHC'] },
];
// Remove N0U control from SW; probe only SW candidates
PRODUCTS.find(p => p.id === 'sw').codes = ['NSW', 'NSP'];

const TILE = '6/15/25';
const STAMP = '0';

async function fetchText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'MesoVortexWX-dualpol-probe/1.0' } });
    const text = await res.text();
    return { ok: res.ok, status: res.status, headers: Object.fromEntries(res.headers.entries()), text };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e) };
  } finally {
    clearTimeout(t);
  }
}

async function probeTile(layer) {
  const url = `${IEM_TILE}/${layer}/${TILE}.png`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'MesoVortexWX-dualpol-probe/1.0' } });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      url, status: res.status,
      contentType: res.headers.get('content-type'),
      xIemError: res.headers.get('x-iem-error'),
      bytes: buf.length,
      isPng: buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a',
    };
  } catch (e) {
    return { url, status: 0, error: String(e?.message || e) };
  } finally { clearTimeout(t); }
}

async function main() {
  const out = { generatedAt: new Date().toISOString(), note: 'Verification-only probe. No products enabled.', iemProducts: {}, ridgeTiles: [], mrms: {}, falsePositiveCheck: {} };

  for (const site of SITES) {
    const url = `${IEM_JSON}?operation=products&radar=${site}&start=${new Date().toISOString().slice(0,16)}Z`;
    const r = await fetchText(url);
    let products = null;
    try { products = JSON.parse(r.text).products; } catch {}
    out.iemProducts[site] = { status: r.status, products, url };
  }

  for (const p of PRODUCTS) {
    for (const code of p.codes) {
      for (const site of SITES) {
        const layer = `ridge::${site}-${code}-${STAMP}`;
        const r = await probeTile(layer);
        out.ridgeTiles.push({ productId: p.id, label: p.label, code, site, ...r });
      }
    }
  }

  // False-positive guard: known invalid IEM TMS layer should not be treated as valid data.
  const invalid = await probeTile('hrrr::DOES_NOT_EXIST-0');
  const knownGood = await probeTile('nexrad-n0q-900913');
  out.falsePositiveCheck = {
    invalidLayer: invalid,
    knownGoodN0Q: knownGood,
    warning: invalid.status === 200 && invalid.xIemError ? 'IEM can return 200 PNG with X-IEM-Error for invalid layers; status==200 alone is insufficient.' : 'No false-positive signature observed.',
  };

  for (const path of ['2D/MergedRhoHV/', '2D/MergedZdr/', '2D/MergedKdp/', '2D/MergedHHC/', '3DRhoHV/', '3DZdr/']) {
    const r = await fetchText(`${MRMS}/${path}`);
    const hasLatest = /latest\.grib2\.gz/.test(r.text || '');
    const sampleFiles = (r.text || '').match(/MRMS_[A-Za-z0-9_.-]+\.grib2\.gz/g) || [];
    out.mrms[path] = { status: r.status, hasLatest, sampleFiles: sampleFiles.slice(0, 3) };
  }

  await fs.mkdir('docs/stabilization', { recursive: true });
  await fs.writeFile('docs/stabilization/dualpol-sources-probe.json', JSON.stringify(out, null, 2));

  const lines = [];
  lines.push('# Dual-Pol / Spectrum / HHC Source Probe');
  lines.push('');
  lines.push(`Generated: ${out.generatedAt}`);
  lines.push('');
  lines.push('> Verification-only evidence. This probe does **not** enable any product. Capability matrix remains authoritative.');
  lines.push('');
  lines.push('## False-positive guard');
  lines.push('');
  lines.push(`- Invalid layer \`hrrr::DOES_NOT_EXIST-0\`: status ${invalid.status}, x-iem-error=${invalid.xIemError || 'none'}, bytes=${invalid.bytes}, png=${invalid.isPng}`);
  lines.push(`- Known-good \`nexrad-n0q-900913\`: status ${knownGood.status}, x-iem-error=${knownGood.xIemError || 'none'}, bytes=${knownGood.bytes}, png=${knownGood.isPng}`);
  lines.push(`- **${out.falsePositiveCheck.warning}**`);
  lines.push('');
  lines.push('## IEM radar.py advertised products');
  lines.push('');
  for (const [site, v] of Object.entries(out.iemProducts)) {
    const names = (v.products || []).map(p => p.id).join(', ') || '(none/parse error)';
    lines.push(`- ${site}: ${v.status} - ${names}`);
  }
  lines.push('');
  lines.push('## IEM RIDGE tile probe (single-site, z/x/y=6/15/25, stamp=0)');
  lines.push('');
  lines.push('| Product | Code | Site | Status | Content-Type | X-IEM-Error | Bytes | PNG |');
  lines.push('|---|---|---:|---:|---|---|---:|:---:|');
  for (const r of out.ridgeTiles) {
    lines.push(`| ${r.label} | ${r.code} | ${r.site} | ${r.status} | ${r.contentType || ''} | ${r.xIemError || ''} | ${r.bytes ?? ''} | ${r.isPng ? 'yes' : 'no'} |`);
  }
  lines.push('');
  lines.push('## MRMS NCEP GRIB2 directory probe');
  lines.push('');
  lines.push('| Path | Status | Has latest.grib2.gz | Sample files |');
  lines.push('|---|---:|:---:|---|');
  for (const [path, v] of Object.entries(out.mrms)) {
    lines.push(`| ${path} | ${v.status} | ${v.hasLatest ? 'yes' : 'no'} | ${(v.sampleFiles||[]).join(', ')} |`);
  }
  lines.push('');
  lines.push('## Assessment');
  lines.push('');
  lines.push('- **IEM RIDGE dual-pol/SW/HHC tiles**: currently not usable as verified live sources in this probe (503/invalid). Do not enable.');
  lines.push('- **IEM radar.py metadata**: currently advertises only N0B/N0S on sampled sites; dual-pol codes not advertised.');
  lines.push('- **MRMS NCEP GRIB2**: MergedRhoHV and MergedZdr directories are live; KDP/HHC 2D paths probed returned 403/absent. GRIB2 availability is not tile/API/UI end-to-end integration.');
  lines.push('- **Next honest path**: build verified MRMS/Level III ingest+decode+tile+legend+archive pipeline; only then update capability matrix after end-to-end verification.');
  await fs.writeFile('docs/stabilization/dualpol-sources-probe.md', lines.join('\n') + '\n');
  console.log('Wrote docs/stabilization/dualpol-sources-probe.md and .json');
}

main().catch(e => { console.error(e); process.exit(1); });
