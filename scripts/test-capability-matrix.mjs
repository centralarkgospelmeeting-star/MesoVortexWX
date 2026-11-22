#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('lib/radar/capability-matrix.ts');
const src = fs.readFileSync(file, 'utf8');

// Extract the RADAR_CAPABILITY_MATRIX array block roughly
const m = src.match(/export const RADAR_CAPABILITY_MATRIX[\s\S]*?\] as const;/);
if (!m) { console.error('FAIL: matrix not found'); process.exit(1); }
const block = m[0];

// Split by product entries starting with id:
const entries = block.split(/\n  \{\n    id: '/).slice(1);
if (entries.length === 0) { console.error('FAIL: no entries'); process.exit(1); }

const required = ['availability', 'verification', 'playbackSupport', 'archiveSupport'];
const allowedAvailability = new Set(['WORKING','PARTIAL','UNAVAILABLE','RESTRICTED']);
const allowedVerification = new Set(['VERIFIED','PARTIALLY_VERIFIED','UNVERIFIED','TESTED_LIVE','TESTED_ARCHIVE']);
const allowedPlayback = new Set(['REAL_ARCHIVE','PARTIAL_ARCHIVE','LIVE_ONLY','NONE','UNKNOWN']);
const allowedArchive = new Set(['FULL','PARTIAL','PARTIAL_ARCHIVE','NONE','UNKNOWN']);

let fail = 0;
for (const e of entries) {
  const id = e.split("'")[0];
  for (const r of required) {
    if (!new RegExp(`\\b${r}\\b`).test(e)) { console.error(`FAIL ${id}: missing ${r}`); fail++; }
  }
  if (!/level:\s*'([^']+)'/.test(e)) { console.error(`FAIL ${id}: missing verification.level`); fail++; }
  const av = e.match(/availability:\s*'([^']+)'/);
  const vl = e.match(/level:\s*'([^']+)'/);
  const pb = e.match(/playbackSupport:\s*'([^']+)'/);
  const ar = e.match(/archiveSupport:\s*'([^']+)'/);
  if (av && !allowedAvailability.has(av[1])) { console.error(`FAIL ${id}: bad availability ${av[1]}`); fail++; }
  if (vl && !allowedVerification.has(vl[1])) { console.error(`FAIL ${id}: bad verificationLevel ${vl[1]}`); fail++; }
  if (pb && !allowedPlayback.has(pb[1])) { console.error(`FAIL ${id}: bad playbackSupport ${pb[1]}`); fail++; }
  if (ar && !allowedArchive.has(ar[1])) { console.error(`FAIL ${id}: bad archiveSupport ${ar[1]}`); fail++; }
  if (!/lastCheckedAt/.test(e)) { console.error(`FAIL ${id}: missing verification.lastCheckedAt`); fail++; }
  if (!/evidence:\s*\[/.test(e)) { console.error(`FAIL ${id}: missing verification.evidence`); fail++; }
}
console.log(`Checked ${entries.length} capability entries`);
if (fail) { console.error(`FAILED: ${fail} issues`); process.exit(1); }
console.log('PASS');
