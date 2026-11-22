#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
let fail = 0;
function flag(ok, msg) { if (!ok) { fail++; console.error(`FAIL: ${msg}`); } }

function readJson(rel) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, rel), 'utf8')); }

// 1) Validate dataset shape/invariants if present
const datasetPaths = ['archive-confidence-dataset.json', 'docs/stabilization/archive-confidence-dataset.json'].filter((p) => fs.existsSync(path.resolve(ROOT, p)));
flag(datasetPaths.length > 0, 'no archive-confidence-dataset.json found');
for (const rel of datasetPaths) {
  const ds = readJson(rel);
  flag(Array.isArray(ds.runs) && ds.runs.length > 0, `${rel}: runs must be non-empty array`);
  flag(ds.aggregate && ds.aggregate.byProduct && typeof ds.aggregate.byProduct === 'object', `${rel}: missing aggregate.byProduct`);
  for (const run of ds.runs || []) {
    flag(Array.isArray(run.config?.offsetsMin) && run.config.offsetsMin.length > 0, `${rel}: run missing offsetsMin`);
    for (const [key, p] of Object.entries(run.products || {})) {
      flag(p.summary && typeof p.summary.total === 'number', `${rel}:${key} missing summary.total`);
      flag(p.summary.total === p.summary.ok + p.summary.fail, `${rel}:${key} total != ok+fail`);
      flag(['REAL_ARCHIVE', 'PARTIAL_ARCHIVE', 'LIVE_ONLY'].includes(p.classification), `${rel}:${key} bad classification ${p.classification}`);
      flag(Array.isArray(p.samples), `${rel}:${key} samples must be array`);
      for (const s of p.samples) {
        flag(typeof s.url === 'string' && s.url.length > 0, `${rel}:${key} sample missing url`);
        flag(typeof s.stamp === 'string', `${rel}:${key} sample missing stamp`);
        flag(typeof s.offsetMin === 'number', `${rel}:${key} sample missing offsetMin`);
      }
      if (p.playbackIntegrity) {
        flag(typeof p.playbackIntegrity.ok === 'boolean', `${rel}:${key} playbackIntegrity.ok missing`);
        flag(Array.isArray(p.playbackIntegrity.issues), `${rel}:${key} playbackIntegrity.issues missing`);
      }
    }
  }
  for (const [key, a] of Object.entries(ds.aggregate?.byProduct || {})) {
    flag(a.total === a.ok + a.fail, `${rel}:aggregate:${key} total != ok+fail`);
    flag(a.okRate >= 0 && a.okRate <= 1, `${rel}:aggregate:${key} okRate out of range`);
    flag(['REAL_ARCHIVE', 'PARTIAL_ARCHIVE', 'LIVE_ONLY'].includes(a.finalClassification), `${rel}:aggregate:${key} bad finalClassification`);
  }
}

// 2) Behavioral smoke test: run framework against local server with known responses
const PNG = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,10,73,68,65,84,120,156,99,0,1,0,0,5,0,1,13,10,45,180,0,0,0,0,73,69,78,68,174,66,96,130]);
const server = http.createServer((req, res) => {
  if (req.url.includes('-OK-')) {
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(PNG);
  } else {
    res.writeHead(503, { 'content-type': 'text/plain' });
    res.end('unavailable');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const tmpCfg = path.resolve(ROOT, '.tmp-archive-test-config.json');
const tmpOut = path.resolve(ROOT, '.tmp-archive-test-out.json');
fs.writeFileSync(tmpCfg, JSON.stringify({
  generatedBy: 'archive-integrity-test',
  tileTemplate: `http://127.0.0.1:${port}/ridge::{{site}}-{{product}}-{{stamp}}/{{z}}/{{x}}/{{y}}.png`,
  z: 7, x: 33, y: 50, timeoutMs: 3000,
  offsetsMin: [15, 30, 60, 120],
  classification: { realArchiveMinRate: 0.7, partialArchiveMinHits: 1 },
  products: [
    { id: 'ok', key: 'OK', sites: ['S1'] },
    { id: 'bad', key: 'BAD', sites: ['S1'] },
  ]
}));

const report = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/radar-archive-probe-framework.mjs', '--config', tmpCfg, '--out', tmpOut], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', (d) => out += d.toString());
  child.stderr.on('data', (d) => err += d.toString());
  child.on('error', reject);
  child.on('close', (code) => resolve({ code, out, err }));
});

try { fs.unlinkSync(tmpCfg); } catch {}
server.close();

flag(report.code === 0, `framework smoke test exited ${report.code}: ${report.err.slice(-200)}`);
if (fs.existsSync(tmpOut)) {
  const r = readJson(tmpOut.replace(ROOT + path.sep, ''));
  flag(r.products?.OK?.classification === 'REAL_ARCHIVE', `expected OK REAL_ARCHIVE got ${r.products?.OK?.classification}`);
  flag(r.products?.BAD?.classification === 'LIVE_ONLY', `expected BAD LIVE_ONLY got ${r.products?.BAD?.classification}`);
  flag(r.products?.OK?.playbackIntegrity?.ok === true, 'OK playbackIntegrity should be ok');
  try { fs.unlinkSync(tmpOut); } catch {}
} else {
  flag(false, 'framework smoke test did not write output file');
}

if (fail) { console.error(`FAILED: ${fail} archive integrity issues`); process.exit(1); }
console.log(`PASS: archive integrity (${datasetPaths.length} dataset(s) validated, framework smoke test ok)`);
