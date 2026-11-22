# Sprint 2 - Archive Integrity Report

Date: 2026-11-22  
Method: Sampled timestamped IEM RIDGE tile probes (-15m/-30m/-60m, 5-min UTC aligned). OK = 200 + PNG magic. Spotty results treated as PARTIAL/UNKNOWN, not FULL.

| Product | Capability ID | Archive Claim (Matrix) | Observed Evidence | Playback Classification | Notes |
|---|---|---|---|---|---|
| Reflectivity N0B | ref | PARTIAL | Mixed OK/503 across sampled sites/timestamps | **REAL_ARCHIVE (PARTIAL)** | Some real archived frames observed; not consistent in all samples |
| Reflectivity N0Q | ref (candidate) | N/A (not enabled) | 503 in all sampled timestamps | **UNKNOWN / NO EVIDENCE** | Do not migrate |
| Velocity N0U | vel | UNKNOWN (updated) | 503 in sampled -15/-30/-60m on LZK/LWX/TLX | **LIVE_ONLY** | Endpoint enforces LIVE_ONLY; no fake frames |
| SRV N0S | srvel | PARTIAL | Mixed OK/503; -60m OK on sampled sites | **REAL_ARCHIVE (PARTIAL)** | Endpoint allows archive; honesty note remains |
| TDWR TZL/TV0 | ref/vel (TDWR) | NONE/UNKNOWN | Not probed for archive in this pass | **LIVE_ONLY** | Endpoint enforces LIVE_ONLY until verified |
| CC/ZDR/KDP/SW/HHC/QPE/NROT/AzShear/MESH/TOPS/VIL | various | NONE/UNKNOWN | No verified end-to-end source | **NONE** | Unavailable; no playback |

## Data Honesty Rules Enforced

- `REAL_ARCHIVE` only when real timestamped frames are generated from verified archive path.
- `LIVE_ONLY` returns single real LIVE frame; no synthetic historical frames.
- `NONE/UNKNOWN` returns unavailable or live-only as appropriate; never fake playback.
