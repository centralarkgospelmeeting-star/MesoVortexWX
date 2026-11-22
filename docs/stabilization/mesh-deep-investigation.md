# Phase 3 - MESH Deep Investigation Report

Date: 2026-11-22  
Target: MESH (MRMS Maximum Estimated Size of Hail). **Investigation only - no enablement.**

## Executive Finding

MESH remains **UNAVAILABLE / NOT VERIFIED** for MesoVortexWX WORKING enablement. Live IEM MRMS MESH tile endpoints respond, but timestamp/archive integrity probes are **not trustworthy**: fabricated and time-varied requests returned identical bytes/SHA1 to current in sampled tests. This means we cannot prove archive timestamps are honored or that frames are distinct/honest.

## Evidence (real probes, 2026-11-22)

### 1) Are different timestamps honored?

| Request | Result | SHA1 (12) | Bytes |
|---|---:|---|---:|
| `mrms::MESH/7/33/50.png` (current) | 200 | `24d21fdbabfe` | 20229 |
| `mrms-t::MESH/7/33/50.png` | 200 | `24d21fdbabfe` | 20229 |
| `mrms::MESH/202601010000/7/33/50.png` (fabricated old) | 200 | `24d21fdbabfe` | 20229 |
| `mrms::MESH/<ts-0m>/7/33/50.png` | 200 | `24d21fdbabfe` | 20229 |
| `mrms::MESH/<ts-10m>/7/33/50.png` | 200 | `24d21fdbabfe` | 20229 |
| `mrms::MESH/<ts-30m>/7/33/50.png` | 200 | `24d21fdbabfe` | 20229 |
| `mrms::MESH/<ts-60m>/7/33/50.png` | 200 | `24d21fdbabfe` | 20229 |
| `mrms::MESH/<ts-120m>/7/33/50.png` | 200 | `24d21fdbabfe` | 20229 |

**Finding:** Identical content hash across current, fabricated, and multiple timestamps. This is strong evidence that timestamp/path components are ignored, defaulted, or cached to the same tile for this endpoint/tile. Timestamp integrity is **not verified**.

### 2) Different imagery?

- **No** in sampled probes. Same bytes/SHA1 for all tested MESH paths/timestamps.
- This does not prove the service never changes; it proves our sampled timestamp variations did not produce distinct imagery, including a fabricated historical timestamp.

### 3) Caching behavior / source integrity

- Identical 20229-byte PNG hash across varied requests suggests aggressive caching, default-tile fallback, or path-parameter ignoring. Without response metadata proving timestamp provenance, integrity is untrusted.
- `mrms-t::MESH` (time-style path) also identical - no evidence of honored time semantics.
- MESH_Max60min probes: current, fabricated, and ts60 all returned same hash `24d21fdbabfe` / 20229 bytes.

### 4) Are archive claims real?

- **Not verified / not trustworthy from tested IEM MRMS tile path.** A real archive must return distinct frames for distinct valid timestamps (where data exists) and reject/fail clearly for invalid/fabricated timestamps. Observed behavior fails that integrity smell test.
- Authoritative MRMS archive exists elsewhere (NCEP MRMS GRIB2 feeds, Iowa State MRMS archive, NOAA Open Data dissemination) but that is **not the same as verified IEM tile archive semantics in our pipeline**.

## Additional MRMS Context

- MRMS MESH official product: NSSL MRMS GRIB2 table v12.2, Discipline 209 Category 3 Parameter 28, `MESH`, 2-min, units `mm`, missing -1, no coverage -3.
- MESH swath products: MESHMax30/60/120/240/360/1440min exist with defined units/mm.
- AzShear_0-2km sampled on same IEM TMS path returned 503/0; RotationTrack30min returned 200 but same hash as MESH (`24d21fdbabfe`) - further evidence of endpoint ambiguity/default behavior that must be treated cautiously.

## Determination

| Check | Result |
|---|---|
| Timestamps honored | **No evidence / contradicted by identical-hash probes** |
| Different imagery for different timestamps | **No** (sampled) |
| Caching/default behavior | **Suspected; integrity untrusted** |
| Archive claims real (IEM tile path tested) | **Not verified / not trustworthy** |
| Official MESH semantics/units | **Known from MRMS docs (mm), but not end-to-end verified in app pipeline** |

## Required Before Any Enablement

1. Identify authoritative MRMS source with verifiable timestamp provenance (GRIB2/official archive) and a rendering pipeline with provable mapping.
2. Prove timestamped requests produce distinct frames when underlying data differs; fabricated timestamps must not return "current-looking" success.
3. Verify legend/color mapping for MESH mm values.
4. Verify update cadence, missing/no-coverage semantics, and tile bounds.
5. Build archive/playback integrity evidence over multiple days/sites.
6. End-to-end capability-matrix/API/UI/playback verification. Any failure => UNAVAILABLE.