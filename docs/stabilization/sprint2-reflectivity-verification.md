# Sprint 2 - Reflectivity Verification Matrix

Date: 2026-11-22  
Method: HTTP GET probe to IEM RIDGE tile endpoint (`.../ridge::SECTOR-PROD-0/7/33/50.png`), 8s timeout. OK = HTTP 200 + PNG magic `89504e47`. 334-byte PNG usually indicates empty/transparent tile (endpoint responds; may be no echo at sample tile). Larger PNG indicates data pixels. Archive probes used timestamped `-15m/-30m/-60m` rounded to 5-minute UTC stamps.

## Sampled NEXRAD Sites

| Site | Region | N0B | N0Q | N1Q | N2Q | N3Q | N0B Archive (-15/-30/-60m) | N0Q Archive (-15/-30/-60m) | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| KLWX | East | OK/334 | OK/334 | 503 | 503 | 503 | 503/OK/OK | 503/503/503 | Live N0B/N0Q respond; N0B archive spotty |
| KOKX | East | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Live respond; archive not observed in sample |
| KMHX | East | OK/334 | OK/334 | 503 | 503 | 503 | OK/503/503 | 503/503/503 | N0B archive partial |
| KPBZ | East | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/OK | 503/503/503 | N0B archive partial |
| KLZK | Central | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/OK | 503/503/503 | N0B archive partial |
| KTLX | Central | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/OK | 503/503/503 | N0B archive partial |
| KDVN | Central | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Archive not observed in sample |
| KILX | Central | OK/334 | OK/334 | 503 | 503 | 503 | 503/OK/OK | 503/503/503 | N0B archive partial |
| KFWS | Central | OK/334 | OK/334 | 503 | 503 | 503 | OK/503/503 | 503/503/503 | N0B archive partial |
| KAMA | Central | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Archive not observed in sample |
| KRTX | West | OK/334 | OK/334 | 503 | 503 | 503 | 503/OK/503 | 503/503/503 | N0B archive partial |
| KPSR | West | 503 | 503 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Both N0B/N0Q 503 in sample; may be transient/tile/location; inconclusive |
| KSGX | West | 503 | 503 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Both N0B/N0Q 503 in sample; inconclusive |
| KNKX | West | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Live respond; archive not observed |
| PAHG | Alaska | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Live respond; archive not observed |
| PAKC | Alaska | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Live respond; archive not observed |
| TJUA | Puerto Rico | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Live respond; archive not observed |
| PHKI | Hawaii | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Live respond; archive not observed |
| PHMO | Hawaii | OK/334 | OK/334 | 503 | 503 | 503 | 503/503/503 | 503/503/503 | Live respond; archive not observed |

## Findings

1. **N0B availability**: 17/19 sampled sites returned 200 PNG for live N0B. KPSR/KSGX returned 503 in this sample (inconclusive; could be transient or tile-specific).
2. **N0Q availability**: 17/19 sampled sites returned 200 PNG for live N0Q, mirroring N0B in this sample. Same KPSR/KSGX 503 caveat.
3. **N1Q/N2Q/N3Q availability**: 0/19 returned 200; all 503 in sampled tile. **Not usable as verified replacements for N1B/N2B/N3B.**
4. **Archive support**: N0B archive was spotty (some OK, many 503) across sampled timestamps - consistent with PARTIAL/fragile archive behavior. N0Q archive returned 503 in all sampled timestamps/sites. **No evidence to claim N0Q archive support.**
5. **Playback support**: N0B has partial real-archive evidence; N0Q has no archive evidence in this sample. N1Q-N3Q no evidence.

## Recommendation

**No N0Q migration.** Keep N0B/N1B/N2B/N3B. Before any migration: exhaustive nationwide live check, timestamped archive verification over multiple windows, tilt semantics, legend/value consistency, TDWR/non-CONUS behavior, and client compatibility.
