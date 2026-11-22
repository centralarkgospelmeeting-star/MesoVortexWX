# Phase 3B - NET Authoritative Verification

Date: 2026-11-22  
Scope: NET (Echo Tops) only. **No enablement. No capability matrix status change.**

## Mission

Determine whether NET can EVER become `VERIFIED` for MesoVortexWX WORKING enablement.

## Final Verdict

**UNVERIFIABLE**

*No middle state selected per task. Verdict meaning: NET cannot be verified to the MesoVortexWX WORKING standard with currently evaluated sources/evidence. The authoritative NOAA/NWS NET product exists, but the evaluated IEM integration paths fail required archive/timestamp/playback integrity gates, and no verified end-to-end path (source → archive → timestamp → playback → legend/units → API/UI) has been established.*

## Task 1 - Authoritative NOAA/NWS Documentation

| Item | Finding | Source |
|---|---|---|
| Official name | Echo Tops | NOAA/NCEI NEXRAD product description; NWS ROC/NOAAPort product listings |
| Product code | NET / 41 (Echo Tops); EET / 135 (Enhanced Echo Tops) | NCEI NEXRAD Products page; NOAAPort/RPCCDS product tables; Supercell Wx Level 3 table |
| Official description | "This product generates a color coded image that shows the height of an echo top. Scientists use this product to quickly estimate the most intense convection and higher echo tops, as an aid to identify storm structure features, and for pilot briefing purposes. The EET version of the product provided a higher spatial resolution, and enhanced processing, including identification of weather that is higher than the radar can scan." | NOAA/NCEI: https://www.ncei.noaa.gov/products/radar/next-generation-weather-radar |
| Official units | **kft (kilofeet)** in common operational display; authoritative ICD defines exact units/encoding. NCEI page describes height of echo top but does not spell out kft in the excerpt; operational usage and product legends are kft. | NCEI description (height); ROC ICD for RPG Class 1 User (definitive, not machine-extracted here); WSR-88D/FM H 11 Part C |
| Official legend | Color-coded echo top heights by class; exact color bins/thresholds defined by product spec/ICD. Not verified as an in-app mapping in this phase. | ROC ICD/FM H 11 Part C (authoritative); NCEI general description |
| Official source | NOAA/NWS WSR-88D NEXRAD Level III Radar Product Generator (RPG) product, distributed via RPCCDS/NOAAPort; archived at NCEI. | NCEI; ROC Level III data types: https://www.roc.noaa.gov/level-three-data-types.php |
| Official archive source | NCEI NEXRAD Level III archive; NOAA Open Data Dissemination (NODD) cloud access; AWS Open Data NEXRAD Level III (where available). | NCEI NEXRAD page; NOAA NODD |

## Task 2 - Official Units

- **Verdict:** Officially height of echo top; operationally displayed in **kft**. EET is enhanced echo tops (higher spatial resolution/processing). 
- **Verification status:** Partially verified from authoritative descriptions; exact ICD unit encoding not extracted in-session. Sufficient to know intended unit is height (kft), insufficient for final in-app legend mapping without ICD-confirmed bins.

## Task 3 - Official Legend

- **Verdict:** Authoritative legend exists in NWS/ROC ICD and operational product specs; **not verified** for MesoVortexWX mapping. No in-app NET legend currently verified.

## Task 4 - Official Archive Source

- **Verdict:** Official archives exist (NCEI Level III, NODD/cloud). However, MesoVortexWX has **not verified** an end-to-end integration path from these authoritative archives to app tiles/API/UI/playback with timestamp integrity.

## Task 5 - IEM NET Nature (Single-site / Composite / Deprecated / Rolling)

Live probes (2026-11-22):

| Probe | Result | Interpretation |
|---|---:|---|
| `ridge::LZK-NET-0/7/33/50.png` (and TLX/FWS/LWX/OKX/MHX/DGX) | 200, 334B, SHA1 `dd6cb45962bc` (identical) | Single-site named endpoint responds; sampled tile tiny/identical across sites - likely empty/transparent or not product-meaningful at sampled location/time |
| `ridge::SITE-NET-{timestamp}` for 15m..1440m, 7 sites | **503 / 0B all timestamped samples** | No verified single-site timestamped archive on ridge path |
| `nexrad-net` composite current | 200, 1860B, `6d71e8cc0d63` | National composite endpoint responds |
| `nexrad-eet` composite current | 200, 1860B, `6d71e8cc0d63` (identical to net) | NET/EET composite aliasing/identical content observed |
| `nexrad-net-m05m/m10m/m15m/m30m` | 200, different byte sizes/hashes | Rolling recent frames exist (short window) |
| `nexrad-net-m60m` | 404 | Beyond ~30m (sampled) unavailable |
| `nexrad-net-900913` variants | identical to nexrad-net | Projection alias |
| `json/radar.py?operation=products&radar=LZK/TLX/FWS` | `N0B,N0S` only | NET not advertised by IEM product discovery |

**Determination:**
- **Deprecated?** No evidence NET is deprecated as NOAA product. IEM still serves named endpoints.
- **Single-site?** Endpoint naming is single-site (`ridge::SITE-NET-...`), but archive/timestamp behavior not verified; current tile suspiciously identical/small across sites.
- **Composite?** Yes, IEM serves national composite `nexrad-net`/`nexrad-eet` with short rolling `mXXm` offsets.
- **Rolling composite only?** Composite appears rolling/short-window. Single-site timestamped archive is not verified (503). Best characterization: **composite rolling available; single-site timestamped archive unverified/unavailable on tested path**.

## Task 6 - IEM Documentation vs Live Behavior

| IEM Documentation/Expectation | Live Behavior (2026-11-22) | Match? |
|---|---|---|
| IEM OGC lists `CONUS NEXRAD Net Echo Tops (net)` WMS | `nexrad-net` TMS returns 200 | Partial |
| Ridge product list includes `NET - Net Echo Tops` | `ridge::SITE-NET-0` returns 200 | Partial |
| `ridge::...-{timestamp}` archive pattern documented generally | NET timestamped ridge requests returned 503 across 7 sites/8 offsets | **No** |
| json/radar products discovery | NET not listed for sampled sites | **No** |
| EET distinct from NET | `nexrad-eet` identical SHA1/bytes to `nexrad-net` at sampled offsets | **No / ambiguous** |

## Task 7 - Timestamp Integrity

- **Single-site ridge NET:** **FAIL.** All timestamped requests 503; no distinct archived frames observed.
- **Composite rolling net:** **PARTIAL/UNVERIFIED.** `m05m..m30m` return different byte sizes/hashes from current, suggesting different frames; `m60m` 404. But this is a rolling offset scheme, not explicit UTC timestamped archive; integrity/provenance/legend/units/frame completeness not verified for playback contract.
- **Fabrication/default risk:** NET/EET identity and small identical single-site current tile raise caution. No fabricated-timestamp acceptance test passed for single-site archive because all timestamped requests failed.

## Task 8 - Playback Integrity

- **FAIL for verified WORKING playback.** No verified timestamped single-site archive sequence. Composite rolling frames exist but were not validated as complete, ordered, timestamp-honest, unit-correct playback suitable for capability-matrix `REAL_ARCHIVE`/verified playback. No end-to-end playback wiring exists.

## Task 9 - Final Verdict

## **UNVERIFIABLE**

**Rationale (no middle state):** NET is an authoritative NOAA/NWS NEXRAD Level III product (41, Echo Tops; 135 EET) with official documentation and official archives. However, for MesoVortexWX WORKING enablement, the currently evaluated integration candidates fail required gates: single-site ridge timestamped archive returns 503; json/radar does not advertise NET; single-site current tile is suspiciously small/identical across sites; composite NET/EET are identical in sampled probes; composite has short rolling offsets but no verified timestamped archive/playback/legend/units/end-to-end integrity. Therefore NET cannot be marked VERIFIED/WORKING on current evidence. It remains **UNAVAILABLE** until a verified end-to-end source/archive/playback path is proven.

## Constraints Observed

- No capability matrix status changed.
- No NET enablement.
- No fake data/fallbacks added.