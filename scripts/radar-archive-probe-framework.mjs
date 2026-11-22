#!/usr/bin/env node
/**
 * Generalized radar archive probe framework (Phase 2 / Task 4).
 *
 * Purpose: verify archive timestamps, frame integrity, and playback integrity
 * before any radar product is enabled as WORKING.
 *
 * Usage:
 *   node scripts/radar-archive-probe-framework.mjs --config path/to/config.json
 *   node scripts/radar-archive-probe-framework.mjs --config config.json --out report.json
 *
 * Config schema: see docs/stabilization/archive-framework-design.md
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_TEMPLATE =
  'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::{{site}}-{{product}}-{{stamp}}/{{z}}/{{x}}/{{y}}.png';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/radar-archive-probe-framework.mjs --config <file.json> [--out <report.json>]

Config JSON fields:
  generatedBy            string (optional)
  tileTemplate           string with {{site}},{{product}},{{stamp}},{{z}},{{x}},{{y}}
  z,x,y                  tile coords (default 7,33,50)
  timeoutMs              fetch timeout (default 8000)
  offsetsMin             number[] minutes ago (default [15,30,60,120,180,360,720,1440,2880])
  classification         { realArchiveMinRate?:0.7, partialArchiveMinHits?:1 }
  playbackIntegrity      boolean (default true)
  products               [{ id, key, kind?, sites:[] }]
`;
}

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toNumArray(v, fallback) {
  if (!Array.isArray(v)) return fallback;
  const nums = v.map(Number).filter((n) => Number.isFinite(n));
  return nums.length ? nums : fallback;
}

function stamp(minsAgo, alignMinutes = 5) {
  const d = new Date(Date.now() - minsAgo * 60_000);
  const aligned = Math.floor(d.getUTCMinutes() / alignMinutes) * alignMinutes;
  d.setUTCMinutes(aligned, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => encodeURIComponent(String(vars[k] ?? '')));
}

async function probe(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const contentType = r.headers.get('content-type') || '';
    if (!r.ok) {
      clearTimeout(t);
      return { ok: false, status: r.status, bytes: 0, contentType, magic: '' };
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    const magic = buf.length >= 4 ? Array.from(buf.slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('') : '';
    const isPng = magic === '89504e47';
    clearTimeout(t);
    return {
      ok: r.status === 200 && isPng,
      status: r.status,
      bytes: buf.length,
      contentType,
      magic,
    };
  } catch (e) {
    clearTimeout(t);
    return {
      ok: false,
      status: 'ERR',
      bytes: 0,
      contentType: '',
      magic: '',
      err: String(e?.message || e).slice(0, 120),
    };
  }
}

function classify(summary, cfg) {
  const rate = summary.total ? summary.ok / summary.total : 0;
  const minRate = Number.isFinite(Number(cfg.realArchiveMinRate)) ? Number(cfg.realArchiveMinRate) : 0.7;
  const minHits = Number.isFinite(Number(cfg.partialArchiveMinHits)) ? Number(cfg.partialArchiveMinHits) : 1;
  if (rate >= minRate) return 'REAL_ARCHIVE';
  if (summary.ok >= minHits) return 'PARTIAL_ARCHIVE';
  return 'LIVE_ONLY';
}

function playbackIntegrity(samples) {
  const okSamples = samples.filter((s) => s.ok);
  const stamps = okSamples.map((s) => s.stamp);
  const uniqueStamps = Array.from(new Set(stamps));
  // Samples are probed in configured offset order per site. For playback integrity we
  // require that successful stamps are unique within a site-offset probe set and that
  // timestamps parse/align. We do not claim semantic correctness beyond observed integrity.
  const issues = [];
  if (okSamples.length > 1 && uniqueStamps.length !== stamps.length) {
    issues.push('duplicate_timestamps_in_ok_samples');
  }
  for (const s of okSamples) {
    if (!/^\d{12}$/.test(String(s.stamp))) issues.push(`invalid_stamp:${s.stamp}`);
  }
  // Ordering check: offsets ascending means expected chronological order descending (newer first)? 
  // We record offsets as provided; integrity check ensures no impossible duplicate stamp+offset contradictions.
  const seen = new Set();
  for (const s of samples) {
    const k = `${s.site}|${s.offsetMin}|${s.stamp}`;
    if (seen.has(k)) issues.push(`duplicate_sample_key:${k}`);
    seen.add(k);
  }
  return {
    checked: true,
    ok: issues.length === 0,
    okSamples: okSamples.length,
    uniqueTimestamps: uniqueStamps.length,
    issues,
  };
}

async function loadConfig(configPath) {
  const raw = await fs.readFile(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('Config must be a JSON object');
  if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
    throw new Error('Config.products must be a non-empty array');
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write(usage());
    return;
  }
  if (!args.config) {
    process.stderr.write('Missing --config\n\n' + usage());
    process.exit(1);
  }

  const configPath = path.resolve(process.cwd(), String(args.config));
  const config = await loadConfig(configPath);

  const tileTemplate = String(config.tileTemplate || DEFAULT_TEMPLATE);
  const z = toInt(config.z, 7);
  const x = toInt(config.x, 33);
  const y = toInt(config.y, 50);
  const timeoutMs = toInt(config.timeoutMs, 8000);
  const offsetsMin = toNumArray(config.offsetsMin, [15, 30, 60, 120, 180, 360, 720, 1440, 2880]);
  const classificationCfg = config.classification && typeof config.classification === 'object' ? config.classification : {};
  const doPlaybackIntegrity = config.playbackIntegrity !== false;

  const report = {
    generatedAt: new Date().toISOString(),
    generatedBy: config.generatedBy || null,
    config: {
      path: configPath,
      tileTemplate,
      z,
      x,
      y,
      timeoutMs,
      offsetsMin,
      classification: {
        realArchiveMinRate: Number.isFinite(Number(classificationCfg.realArchiveMinRate)) ? Number(classificationCfg.realArchiveMinRate) : 0.7,
        partialArchiveMinHits: Number.isFinite(Number(classificationCfg.partialArchiveMinHits)) ? Number(classificationCfg.partialArchiveMinHits) : 1,
      },
      playbackIntegrity: doPlaybackIntegrity,
    },
    products: {},
    summary: { products: 0, realArchive: 0, partialArchive: 0, liveOnly: 0 },
  };

  for (const product of config.products) {
    const key = String(product.key || product.id || '').trim();
    if (!key) throw new Error('Each product must have key or id');
    const id = String(product.id || key);
    const kind = String(product.kind || 'UNKNOWN');
    const sites = Array.isArray(product.sites) ? product.sites.map(String).filter(Boolean) : [];
    if (!sites.length) throw new Error(`Product ${key} must have non-empty sites[]`);
    const productTemplate = String(product.tileTemplate || tileTemplate);
    const pz = toInt(product.z, z);
    const px = toInt(product.x, x);
    const py = toInt(product.y, y);
    const poffsets = toNumArray(product.offsetsMin, offsetsMin);

    const res = {
      id,
      key,
      kind,
      tileTemplate: productTemplate,
      z: pz,
      x: px,
      y: py,
      offsetsMin: poffsets,
      samples: [],
      summary: { total: 0, ok: 0, fail: 0, okRate: 0, firstOkOffsetMin: null, lastOkOffsetMin: null },
      classification: 'LIVE_ONLY',
      playbackIntegrity: null,
    };

    for (const site of sites) {
      for (const off of poffsets) {
        const st = stamp(off, toInt(product.alignMinutes, toInt(config.alignMinutes, 5)));
        const url = fillTemplate(productTemplate, { site, product: key, stamp: st, z: pz, x: px, y: py });
        const r = await probe(url, timeoutMs);
        const sample = { site, offsetMin: off, stamp: st, url, ...r };
        res.samples.push(sample);
        res.summary.total++;
        if (r.ok) {
          res.summary.ok++;
          if (res.summary.firstOkOffsetMin === null) res.summary.firstOkOffsetMin = off;
          res.summary.lastOkOffsetMin = off;
        } else {
          res.summary.fail++;
        }
        process.stderr.write('.');
      }
    }

    res.summary.okRate = res.summary.total ? res.summary.ok / res.summary.total : 0;
    res.classification = classify(res.summary, classificationCfg);
    if (doPlaybackIntegrity) {
      res.playbackIntegrity = playbackIntegrity(res.samples);
    }
    report.products[key] = res;
    report.summary.products++;
    if (res.classification === 'REAL_ARCHIVE') report.summary.realArchive++;
    else if (res.classification === 'PARTIAL_ARCHIVE') report.summary.partialArchive++;
    else report.summary.liveOnly++;

    process.stderr.write(`\n${key} ${res.summary.ok}/${res.summary.total} rate=${res.summary.okRate.toFixed(3)} ${res.classification}\n`);
  }

  // Exit 2 if any REAL_ARCHIVE product fails integrity checks (future-facing gate per design).
  let integrityFailure = false;
  for (const p of Object.values(report.products)) {
    if (p.classification === 'REAL_ARCHIVE' && p.playbackIntegrity && p.playbackIntegrity.ok === false) {
      integrityFailure = true;
    }
  }

  const json = JSON.stringify(report, null, 2);
  if (args.out) {
    const outPath = path.resolve(process.cwd(), String(args.out));
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, json + '\n', 'utf8');
    process.stderr.write(`Wrote report: ${outPath}\n`);
  }
  process.stdout.write(json + '\n');
  if (integrityFailure) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
