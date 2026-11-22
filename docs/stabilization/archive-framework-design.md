# Phase 2 - Archive Probe Framework Design

Date: 2026-11-22

## Goal (Task 4)

Create reusable verification tooling so every future radar product must prove:
- timestamps
- archive integrity
- playback integrity

before enablement. Generalizes `scripts/probe-radar-archive.mjs`.

## Existing Tool

- `scripts/probe-radar-archive.mjs` - hardcoded N0B/N0U/N0S/TZL/TV0 probe; outputs JSON summary with hit rate and classification.

## Generalized Framework

**Script:** `scripts/radar-archive-probe-framework.mjs`

### Inputs
- `--config <path>` JSON config file, or CLI flags.
- Config schema:
```json
{
  "generatedBy": "sprint-name",
  "tileTemplate": "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::{{site}}-{{product}}-{{stamp}}/{{z}}/{{x}}/{{y}}.png",
  "z": 7, "x": 33, "y": 50,
  "timeoutMs": 8000,
  "offsetsMin": [15,30,60,120,180,360,720,1440,2880],
  "classification": { "realArchiveMinRate": 0.7, "partialArchiveMinHits": 1 },
  "products": [
    { "id": "ref", "key": "N0B", "kind": "NEXRAD", "sites": ["LWX","LZK"] }
  ]
}
```

### Probe Checks
- HTTP status, content-type, byte length, PNG magic.
- Timestamp generation (5-min UTC aligned by default).
- Per-sample record: site, offset, stamp, URL, ok, status, bytes.
- Per-product summary: total/ok/fail/hitRate, classification, first/last ok offset.
- Optional playback integrity check: verify sequence ordering and unique timestamps.

### Classification
- `REAL_ARCHIVE`: hitRate >= `realArchiveMinRate` (default 0.7)
- `PARTIAL_ARCHIVE`: hits >= `partialArchiveMinHits` (default 1)
- `LIVE_ONLY`: 0 hits

### Output
- JSON report to stdout; optional `--out <file>`.
- Exit 0 on success; exit 2 if any product marked REAL_ARCHIVE fails integrity checks (future).

## Required Gates Before Product Enablement
1. Source identity/semantics verified (official name/code/units/legend).
2. Live tile/source verified.
3. Archive probe: timestamps real, not default/fabricated; classification evidence recorded.
4. Playback integrity: frame ordering, timestamp uniqueness, no fake frames.
5. Capability matrix updated with verificationLevel/evidence.
6. End-to-end: source -> endpoint -> matrix -> API contract -> UI -> playback.

## Limitations
- Tile probes can be tile-location specific; sample multiple z/x/y when possible.
- 503 may be transient; repeat probes across days.
- A 200 PNG does not prove correct product semantics - metadata/legend verification still required.
