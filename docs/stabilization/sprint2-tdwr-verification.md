# Sprint 2 - TDWR Verification Matrix

Date: 2026-11-22  
Method: HTTP GET probe to IEM RIDGE tile endpoint (`.../ridge::SITE-PROD-0/7/33/50.png`), 8s timeout. OK = 200 + PNG magic.

| TDWR Site | TZL | TV0 | Classification | Notes |
|---|---:|---:|---|---|
| TADW | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TATL | OK | OK | PASS | TZL 200/7661B, TV0 200/454B |
| TBNA | OK | OK | PASS | TZL 200/7958B, TV0 200/6448B |
| TBOS | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TBWI | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TCLT | OK | OK | PASS | TZL 200/372B, TV0 200/334B |
| TCMH | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TCVG | OK | OK | PASS | TZL 200/1682B, TV0 200/334B |
| TDAL | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TDAY | OK | OK | PASS | TZL 200/348B, TV0 200/334B |
| TDCA | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TDEN | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TDFW | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TDTW | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TEWR | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TFLL | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| THOU | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TIAD | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TIAH | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TICH | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TIDS | OK | OK | PASS | TZL 200/466B, TV0 200/334B |
| TJFK | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TLAS | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TLVE | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TMCI | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TMCO | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TMDW | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TMEM | OK | OK | PASS | TZL 200/490B, TV0 200/334B |
| TMIA | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TMKE | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TMSP | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TMSY | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TOKC | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TPBI | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TPHL | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TPHX | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TPIT | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TRDU | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TSDF | OK | OK | PASS | TZL 200/584B, TV0 200/334B |
| TSJU | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TSLC | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TSTL | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TTPA | OK | OK | PASS | TZL 200/334B, TV0 200/334B |
| TTUL | OK | OK | PASS | TZL 200/334B, TV0 200/334B |

## Summary

- Total probed: 44
- PASS (TZL+TV0): 44
- PARTIAL: 0
- FAIL: 0

## Caveats

- Probe confirms endpoint responds with PNG at sampled tile. It does not fully prove rendering in all map states, all zoom levels, or archive behavior.
- 334-byte PNGs may be empty/transparent tiles; endpoint still responded.
- Archive/playback for TDWR TZL/TV0 remains UNVERIFIED in capability matrix (LIVE_ONLY until archive verified).
