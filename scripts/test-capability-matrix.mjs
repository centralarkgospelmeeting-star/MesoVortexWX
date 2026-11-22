#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('lib/radar/capability-matrix.ts');
const src = fs.readFileSync(file, 'utf8');

const m = src.match(/export const RADAR_CAPABILITY_MATRIX[\s\S]*?\] as const;/);
if (!m) { console.error('FAIL: matrix not found'); process.exit(1); }
const block = m[0];

const entries = block.split(/\n  \{\n    id: '/).slice(1);
if (entries.length === 0) { console.error('FAIL: no entries'); process.exit(1); }

const required = ['availability', 'verification', 'playbackSupport', 'archiveSupport', 'name', 'shortLabel', 'source', 'dataHonesty'];
const allowedAvailability = new Set(['WORKING', 'PARTIAL', 'UNAVAILABLE', 'RESTRICTED']);
const allowedVerification = new Set(['VERIFIED', 'PARTIALLY_VERIFIED', 'UNVERIFIED', 'TESTED_LIVE', 'TESTED_ARCHIVE']);
const allowedPlayback = new Set(['REAL_ARCHIVE', 'PARTIAL_ARCHIVE', 'LIVE_ONLY', 'NONE', 'UNKNOWN']);
const allowedArchive = new Set(['FULL', 'PARTIAL', 'PARTIAL_ARCHIVE', 'NONE', 'UNKNOWN']);

let fail = 0;
const ids = new Set();

for (const e of entries) {
  const id = e.split("'")[0];
  if (ids.has(id)) { console.error(`FAIL ${id}: duplicate id`); fail++; }
  ids.add(id);

  for (const r of required) {
    if (!new RegExp(`\\b${r}\\b`).test(e)) { console.error(`FAIL ${id}: missing ${r}`); fail++; }
  }

  const av = e.match(/availability:\s*'([^']+)'/)?.[1];
  const vl = e.match(/level:\s*'([^']+)'/)?.[1];
  const pb = e.match(/playbackSupport:\s*'([^']+)'/)?.[1];
  const ar = e.match(/archiveSupport:\s*'([^']+)'/)?.[1];

  if (av && !allowedAvailability.has(av)) { console.error(`FAIL ${id}: bad availability ${av}`); fail++; }
  if (vl && !allowedVerification.has(vl)) { console.error(`FAIL ${id}: bad verificationLevel ${vl}`); fail++; }
  if (pb && !allowedPlayback.has(pb)) { console.error(`FAIL ${id}: bad playbackSupport ${pb}`); fail++; }
  if (ar && !allowedArchive.has(ar)) { console.error(`FAIL ${id}: bad archiveSupport ${ar}`); fail++; }

  if (!/lastCheckedAt/.test(e)) { console.error(`FAIL ${id}: missing verification.lastCheckedAt`); fail++; }
  if (!/lastCheckedAt:\s*'[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(e) && !/lastCheckedAt:\s*CHECKED_AT/.test(e)) {
    console.error(`FAIL ${id}: verification.lastCheckedAt not ISO-like`); fail++;
  }
  if (!/evidence:\s*\[/.test(e)) { console.error(`FAIL ${id}: missing verification.evidence`); fail++; }
  // evidence must not be empty array literal
  if (/evidence:\s*\[\s*\]/.test(e)) { console.error(`FAIL ${id}: empty verification.evidence`); fail++; }

  if (!/source:\s*\{[\s\S]*?provider:\s*'[^']+'/.test(e)) { console.error(`FAIL ${id}: missing source.provider`); fail++; }
  if (!/source:\s*\{[\s\S]*?type:\s*'[^']+'/.test(e)) { console.error(`FAIL ${id}: missing source.type`); fail++; }

  if (av === 'UNAVAILABLE') {
    if (!/unavailableReason:\s*'[^']+'/.test(e)) { console.error(`FAIL ${id}: UNAVAILABLE missing unavailableReason`); fail++; }
  }
  if (av === 'WORKING') {
    if (!/realData:\s*true/.test(e)) { console.error(`FAIL ${id}: WORKING must have realData:true`); fail++; }
    if (/synthetic:\s*true/.test(e)) { console.error(`FAIL ${id}: WORKING cannot be synthetic`); fail++; }
    if (/substitute:\s*true/.test(e)) { console.error(`FAIL ${id}: WORKING cannot be substitute`); fail++; }
  }
  if (av === 'WORKING' && vl === 'UNVERIFIED') {
    console.error(`FAIL ${id}: WORKING cannot be UNVERIFIED`); fail++;
  }
}

console.log(`Checked ${entries.length} capability entries`);
if (fail) { console.error(`FAILED: ${fail} issues`); process.exit(1); }
console.log('PASS');
