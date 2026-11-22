#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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

console.log(`Checked ${entries.length} satellite capability entries`);
if (fail) { console.error(`FAILED: ${fail} issues`); process.exit(1); }
console.log('PASS');
