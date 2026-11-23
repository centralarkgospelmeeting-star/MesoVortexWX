#!/usr/bin/env node
import fs from 'node:fs';
const src = fs.readFileSync('lib/capabilities/platform-capabilities.ts', 'utf8');
const m = src.match(/export const PLATFORM_CAPABILITIES[\s\S]*?\] as const;/);
if (!m) { console.error('FAIL: matrix not found'); process.exit(1); }
const entries = m[0].split(/\n  \{ id: '/).slice(1);
let fail = 0;
const allowed = new Set(['WORKING', 'PARTIAL', 'UNAVAILABLE']);
for (const e of entries) {
  const id = e.split("'")[0];
  const st = e.match(/status:\s*'([^']+)'/)?.[1];
  if (!st || !allowed.has(st)) { console.error(`FAIL ${id}: bad status`); fail++; }
  if (st === 'UNAVAILABLE' && !/reason:\s*'[^']+'/.test(e)) { console.error(`FAIL ${id}: UNAVAILABLE missing reason`); fail++; }
  if (!/evidence:\s*\[[^\]]+\]/.test(e)) { console.error(`FAIL ${id}: missing evidence`); fail++; }
}
console.log(`Checked ${entries.length} platform capability entries`);
if (fail) { console.error(`FAILED: ${fail}`); process.exit(1); }
console.log('PASS');
