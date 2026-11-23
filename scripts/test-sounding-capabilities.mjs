#!/usr/bin/env node
import fs from 'node:fs';
const src = fs.readFileSync('lib/capabilities/sounding-capabilities.ts', 'utf8');
const m = src.match(/export const SOUNDING_CAPABILITIES[\s\S]*?\] as const;/);
if (!m) { console.error('FAIL: matrix not found'); process.exit(1); }
const block = m[0];
// split by object entries
const entries = block.split(/\n  \{ id: '/).slice(1);
let fail = 0;
const allowed = new Set(['WORKING', 'PARTIAL', 'UNAVAILABLE']);
for (const e of entries) {
  const id = e.split("'")[0];
  // status can be literal or via spread helper: ...P(...) => PARTIAL, ...U(...) => UNAVAILABLE
  let st = e.match(/status:\s*'([^']+)'/)?.[1];
  if (!st) {
    if (/\.\.\.P\(/.test(e)) st = 'PARTIAL';
    else if (/\.\.\.U\(/.test(e)) st = 'UNAVAILABLE';
  }
  if (!st || !allowed.has(st)) { console.error(`FAIL ${id}: bad status`); fail++; continue; }
  // reason/evidence present either inline or in helper call
  const hasInlineReason = /reason:\s*'[^']+'/.test(e) || /\.\.\.[PU]\(/.test(e);
  const hasInlineEvidence = /evidence:\s*\[[^\]]+\]/.test(e) || /\.\.\.[PU]\(/.test(e);
  if (st === 'UNAVAILABLE' && !hasInlineReason) { console.error(`FAIL ${id}: UNAVAILABLE missing reason`); fail++; }
  if (!hasInlineEvidence) { console.error(`FAIL ${id}: missing evidence`); fail++; }
}
console.log(`Checked ${entries.length} sounding capability entries`);
if (fail) { console.error(`FAILED: ${fail}`); process.exit(1); }
console.log('PASS');
