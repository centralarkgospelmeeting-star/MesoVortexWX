#!/usr/bin/env node
/**
 * Static consistency guard for capability wording.
 *
 * The radar capability matrix is authoritative. Catalog entries in
 * lib/capabilities/*.ts must not describe a tracked radar product as
 * UNAVAILABLE when the matrix says it is live, or as available when the
 * matrix says it is unavailable.
 */
import fs from 'node:fs';
import path from 'node:path';

const MATRIX_PATH = path.resolve('lib/radar/capability-matrix.ts');
const CAPABILITIES_DIR = path.resolve('lib/capabilities');

const TRACKED_IDS = ['cross_section', 'qpe', 'mesh', 'hail_detection', 'rotation_tracks'];

// Match the product in an entry id/name. Patterns are intentionally specific:
// e.g. "hail reports" or "rotation analysis" are different capabilities.
const SCOPE_PATTERNS = {
  cross_section: /cross[ _-]?sections?|xsec/i,
  qpe: /qpe|\bmrms\s+precipitation\s+estimates?\b/i,
  mesh: /\bmesh\b/i,
  hail_detection: /hail[ _-]?detection/i,
  rotation_tracks: /rotation[ _-]?tracks?/i,
};

// Sounding capabilities use ...U(...) / ...P(...) helpers instead of status:.
const HELPER_STATUS = { U: 'UNAVAILABLE', P: 'PARTIAL', W: 'WORKING' };

// Only these entries describe the radar cross-section product. Forecast,
// atmospheric and sounding cross sections are different capabilities and must
// remain independently UNAVAILABLE when they are not implemented.
const RADAR_CROSS_SECTION_IDS = new Set(['cross_sections', 'an_cross_sections']);

let failures = 0;
function fail(file, id, message) {
  console.error(`FAIL ${file} (${id}): ${message}`);
  failures++;
}

const matrixSource = fs.readFileSync(MATRIX_PATH, 'utf8');
const matrixBlock = matrixSource.match(/export const RADAR_CAPABILITY_MATRIX[\s\S]*?\] as const;/)?.[0];
if (!matrixBlock) {
  console.error('FAIL: RADAR_CAPABILITY_MATRIX not found');
  process.exit(1);
}

const authoritative = new Map();
for (const match of matrixBlock.matchAll(/id:\s*'([^']+)'[\s\S]*?availability:\s*'([^']+)'/g)) {
  authoritative.set(match[1], match[2]);
}
for (const id of TRACKED_IDS) {
  if (!authoritative.has(id)) {
    console.error(`FAIL: radar matrix has no availability for tracked product ${id}`);
    failures++;
  }
}

const files = fs.readdirSync(CAPABILITIES_DIR).filter((name) => name.endsWith('.ts')).sort();
let checkedEntries = 0;

for (const file of files) {
  const source = fs.readFileSync(path.join(CAPABILITIES_DIR, file), 'utf8');
  const block = source.match(/export const [A-Z_]+_CAPABILITIES[\s\S]*?\] as const;/)?.[0];
  if (!block) continue;

  const starts = [...block.matchAll(/\{\s*id:\s*'/g)].map((match) => match.index);
  for (let i = 0; i < starts.length; i++) {
    const chunk = block.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : block.length);
    const id = chunk.match(/\{\s*id:\s*'([^']+)'/)?.[1];
    const name = chunk.match(/name:\s*'([^']+)'/)?.[1] ?? '';
    const status = chunk.match(/status:\s*'([^']+)'/)?.[1]
      ?? HELPER_STATUS[chunk.match(/\.\.\.\s*([UPW])\s*\(/)?.[1]];
    if (!id || !status) continue;
    checkedEntries++;

    const label = `${id} ${name}`;
    for (const productId of TRACKED_IDS) {
      if (!SCOPE_PATTERNS[productId].test(label)) continue;
      if (productId === 'cross_section' && !RADAR_CROSS_SECTION_IDS.has(id)) continue;
      const expected = authoritative.get(productId);
      if (!expected) continue;
      if (expected === 'UNAVAILABLE' && (status === 'WORKING' || status === 'PARTIAL')) {
        fail(file, id, `${productId} is UNAVAILABLE in radar matrix but capability status is ${status}`);
      }
      if (expected !== 'UNAVAILABLE' && status === 'UNAVAILABLE') {
        fail(file, id, `${productId} is ${expected} in radar matrix but capability status is UNAVAILABLE`);
      }
    }

    // Also catch stale prose such as "MESH UNAVAILABLE" or "QPE capability
    // UNAVAILABLE" even when the entry status itself is only PARTIAL.
    // References to the matrix ("per capability-matrix ... UNAVAILABLE")
    // are authoritative statements, not claims, so they are skipped.
    const strings = [...chunk.matchAll(/'([^']*)'/g)].map((match) => match[1]);
    for (const text of strings) {
      if (/capability[- ]?matrix|\bmatrix\b/i.test(text)) continue;
      for (const productId of TRACKED_IDS) {
        if (productId === 'cross_section' || authoritative.get(productId) === 'UNAVAILABLE') continue;
        const token = `(?:${SCOPE_PATTERNS[productId].source})`;
        const staleClaim = new RegExp(
          `(?:${token}.{0,40}\\bUNAVAILABLE\\b|\\bUNAVAILABLE\\b.{0,40}${token})`,
          'i',
        );
        if (staleClaim.test(text)) {
          fail(file, id, `text claims ${productId} UNAVAILABLE while radar matrix says ${authoritative.get(productId)}: "${text}"`);
        }
      }
    }
  }
}

if (files.length === 0 || checkedEntries === 0) {
  console.error('FAIL: no capability entries checked');
  process.exit(1);
}

const summary = TRACKED_IDS.map((id) => `${id}=${authoritative.get(id) ?? 'MISSING'}`).join(', ');
console.log(`Authoritative radar availability: ${summary}`);
console.log(`Checked ${checkedEntries} capability entries across ${files.length} files.`);
if (failures) {
  console.error(`FAILED: ${failures} capability consistency issue(s)`);
  process.exit(1);
}
console.log('PASS: capability wording matches radar matrix');
