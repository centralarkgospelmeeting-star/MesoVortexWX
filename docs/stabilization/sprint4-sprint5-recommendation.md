# Sprint 4 - Sprint 5 Recommendation

Date: 2026-11-22

## Outcome

NET was investigated as priority target. It **was not enabled** because it failed WORKING verification: units/legend not verified, single-site ridge NET archive timestamps returned 503 in samples, json/radar did not list NET for sampled site, and end-to-end playback/integration not verified. MESH also remains UNAVAILABLE due unverified semantics and untrustworthy timestamp/archive probe behavior.

## Recommendation: Stabilization / Evidence-Gated Enablement (not feature expansion)

### Sprint 5A - NET End-to-End Verification (if pursued)
1. Obtain authoritative NET semantics/units/legend (NWS product spec) and map legend in-app.
2. Verify correct source path: single-site ridge NET vs composite nexrad-net; do not mix semantics.
3. Build archive probe for NET across many sites/days; confirm timestamped frames are real and distinct.
4. Implement NET only through capability matrix + standardized API contract + UI gating after all checks pass.
5. Add visual/legend QA before marking WORKING.

### Sprint 5B - MESH Verification (separate, later)
1. Identify authoritative MRMS MESH tile source with verifiable timestamps/metadata.
2. Confirm response differentiation for timestamps (reject default-tile false positives).
3. Verify units (mm), legend, update cadence, archive, playback.
4. Only then end-to-end enable.

### Do Not Do
- No MRMS expansion, no model expansion, no globe, no 3D radar, no new UI systems.
- No partial enablement. WORKING or UNAVAILABLE only.
