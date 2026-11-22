# Phase 3 - Verification Exit Criteria

Date: 2026-11-22  
Purpose: Define objective evidence required before any unavailable product moves from `UNAVAILABLE` to `VERIFIED`/`WORKING`. **No enablement in Phase 3.**

## Global Gates (apply to every product)

A product may become `WORKING` only when **all** are true:

1. **Authoritative semantics** - Official NOAA/NWS/MRMS name, code, units, legend, and source documented with primary references.
2. **Source verified** - Live endpoint/source returns correct product data; response content verified (not just HTTP 200). No default/fabricated timestamp acceptance.
3. **Archive verified** - Timestamped requests over multiple days/sites/offsets return real, distinct frames where data exists; hit rate/classification meets threshold and is documented.
4. **Playback verified** - Frame ordering, timestamp integrity, no duplicates/fake frames, no silent gaps presented as data.
5. **Capability matrix** - Entry updated with evidence, `verificationLevel`, `lastCheckedAt`, archive/playback support, and honest `unavailableReason` removed only when fully verified.
6. **End-to-end agreement** - Source -> endpoint -> capability matrix -> API response -> UI label/legend -> playback all agree. No hidden fallback/substitution.
7. **Tests pass** - `scripts/test-capability-matrix.mjs` and build pass; any new product-specific tests added.

If any gate fails, product remains **UNAVAILABLE**.

## Product-Specific Exit Criteria

### Echo Tops (NET/EET) -> VERIFIED

| Criterion | Required Evidence | Current Status |
|---|---|---|
| Official semantics | Confirm NET 41 / EET 135 units (kft), legend, 18 dBZ echo top definition from ROC/NCEI/ICD | Partially known; in-app legend not verified |
| Canonical source | Choose single-site ridge or composite; document why; json/radar omission explained/resolved | **Fail** - json/radar omits NET; ridge vs composite ambiguous |
| Live correctness | Current tile responds with real product content (not empty 334B-only evidence); multiple sites/times | **Fail** - 334B same-hash samples observed |
| Archive integrity | Timestamped single-site or chosen source returns distinct real frames; >=70% hit rate over multi-day/multi-site probe | **Fail** - timestamped ridge NET 503 in Phase 3 probes; run1 LIVE_ONLY 0/54 |
| Playback integrity | Ordered frames, unique timestamps, no fabricated frames | **Fail** - not verified |
| Units/legend in UI | Legend matches official units/scale | **Fail** |
| End-to-end wiring | Capability matrix/API/UI/playback agree | **Fail** |

### MESH -> VERIFIED

| Criterion | Required Evidence | Current Status |
|---|---|---|
| Official semantics | MRMS MESH 209.3.28, mm, missing/no-coverage semantics documented | **Pass (docs)** |
| Source verified | Authoritative MRMS source with verifiable timestamp/provenance; not default-tile endpoint | **Fail** - IEM MRMS tile path returned identical hash for fabricated timestamps |
| Timestamp integrity | Different valid timestamps yield different imagery when data differs; fabricated timestamps rejected/not masqueraded | **Fail** - identical SHA1 across current/fabricated/ts variants |
| Archive integrity | Multi-day/multi-site distinct archived frames verified | **Fail** |
| Playback integrity | Ordered, unique, honest frames | **Fail** |
| Legend/units | mm legend mapped correctly; MESH vs MESHMax60min not conflated | **Fail** |
| End-to-end wiring | Full pipeline agreement | **Fail** |

### CC (Correlation Coefficient) -> VERIFIED

| Criterion | Required Evidence | Current Status |
|---|---|---|
| Official semantics | NEXRAD Level III 161 DCC, N0C..N3C, unitless rhoHV 0-1, official legend | **Pass (docs)** |
| Source verified | Verified NEXRAD Level III CC source (not MRMS RhoHV unless explicitly labeled as different product) | **Fail** - N0C ridge 503 in prior probes; MRMS RhoHV not equivalent |
| Archive integrity | Multi-day/multi-site timestamped archive >=70% or documented partial with honest classification | **Fail** |
| Playback integrity | Verified | **Fail** |
| Legend/units | CC legend/colors match official guidance | **Fail** |
| End-to-end wiring | Matrix/API/UI/playback agree | **Fail** |

### ZDR (Differential Reflectivity) -> VERIFIED

| Criterion | Required Evidence | Current Status |
|---|---|---|
| Official semantics | NEXRAD Level III 159 DZD, N0X..N3X, dB, official legend | **Pass (docs)** |
| Source verified | Verified NEXRAD Level III ZDR source | **Fail** - N0X 503 in prior probes |
| Archive integrity | Real timestamped archive verified | **Fail** |
| Playback integrity | Verified | **Fail** |
| Legend/units | dB legend correct | **Fail** |
| End-to-end wiring | Full pipeline agreement | **Fail** |

### KDP (Specific Differential Phase) -> VERIFIED

| Criterion | Required Evidence | Current Status |
|---|---|---|
| Official semantics | NEXRAD Level III 163 DKD, N0K..N3K, deg/km, official legend | **Pass (docs)** |
| Source verified | Verified NEXRAD Level III KDP source | **Fail** - N0K 503 in prior probes |
| Archive integrity | Real timestamped archive verified | **Fail** |
| Playback integrity | Verified | **Fail** |
| Legend/units | deg/km legend correct | **Fail** |
| End-to-end wiring | Full pipeline agreement | **Fail** |

## Minimum Evidence Package for Any Future Enablement PR

- [ ] Authoritative source citations (NOAA/NWS/MRMS primary docs)
- [ ] Probe dataset (multi-day, multi-site, multi-offset) with raw results
- [ ] Archive classification and playback integrity report
- [ ] Legend/unit mapping documentation
- [ ] Capability matrix update with verification evidence
- [ ] API contract/UI screenshots or automated checks
- [ ] `scripts/test-capability-matrix.mjs` pass
- [ ] `next build` pass
- [ ] Explicit statement: no fake data, no silent fallback, no partial enablement