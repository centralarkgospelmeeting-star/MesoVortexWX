# Phase 3 - NET Deep Investigation Report

Date: 2026-11-22  
Target: NET (Echo Tops), NEXRAD Level III product 41. **Investigation only - no enablement.**

## Executive Finding

NET remains **UNAVAILABLE / NOT VERIFIED** for MesoVortexWX WORKING enablement. IEM has NET-named tile endpoints that respond, but the evidence does not establish verified single-site timestamped archive/playback semantics suitable for our capability-matrix WORKING gate. json/radar does not advertise NET for sampled sites; composite NET/EET responses were identical in probe; timestamped single-site ridge NET requests returned 503.

## Evidence (real probes, 2026-11-22)

### 1) Why does IEM NET respond?

- IEM RIDGE/TMS exposes NET-named services. Sampled ridge current tiles returned HTTP 200 PNG (334 bytes, same SHA1 `dd6cb45962bc` across LZK/TLX/FWS/LWX/OKX/MHX for tile 7/33/50). This indicates the endpoint responds, but the sampled tile was tiny/uniform in size (likely empty/transparent for that tile/location/time) - not proof of full product correctness.
- IEM composite endpoints also responded: `nexrad-net`, `nexrad-eet`, `nexrad-net-900913`, `nexrad-eet-900913` all 200 PNG, 1231 bytes, identical SHA1 `0b14130d5284` for same tile in probe window.

**Interpretation:** IEM has NET/EET named services and can serve PNG tiles. Response alone is insufficient for WORKING verification (units, legend, semantics, archive integrity, timestamp truth still required).

### 2) Why does json/radar not list NET?

- `https://mesonet.agron.iastate.edu/json/radar.py?operation=products&radar=LZK|TLX|FWS|OKX` returned only `N0B,N0S` (sampled 2026-11-22).
- This means IEM's json/radar product discovery endpoint does not advertise NET for those sampled sites, even though ridge NET tile endpoints respond.

**Interpretation:** Either NET is not exposed through that discovery API, not available as a discoverable realtime product in that path for those sites, or served through different service semantics. This is a verification gap: our discovery/integration cannot rely on json/radar for NET.

### 3) Is NET deprecated?

- **Not deprecated in authoritative NEXRAD product listings.** NOAA/NCEI and NWS NOAAPort/ROC product materials list Echo Tops (NET/41) and Enhanced Echo Tops (EET/135) as Level III products.
- IEM naming also still includes NET. No authoritative evidence found in this pass that NET/41 is deprecated; EET/135 is an enhanced variant.

**Interpretation:** NET appears current as an official product code/name. "Deprecated" is not supported by evidence gathered.

### 4) Is NET composite-only?

- Evidence is mixed:
  - Single-site ridge path `ridge::SITE-NET-0` returned 200 for sampled sites (334B same hash). This suggests single-site named endpoint exists.
  - Composite TMS `nexrad-net` also exists and returns 200.
  - json/radar did not list NET for sampled single sites.
- The identical NET/EET composite bytes in probe suggest possible aliasing/caching/default behavior at composite layer or same rendered content at sampled tile/time; cannot conclude semantic equivalence.

**Interpretation:** Cannot confidently classify as composite-only. There is evidence of single-site endpoint naming, but discoverability/archive behavior is inconsistent. Enablement would require clear decision: single-site NEXRAD Level III NET vs composite mosaic, with explicit semantics.

### 5) Is NET single-site?

- Ridge naming is single-site (`ridge::LZK-NET-...`). Current `-0` responds 200 on sampled sites.
- However, timestamped single-site requests returned 503 across all sampled sites/offsets, and json/radar omits NET.

**Interpretation:** Single-site endpoint exists in naming, but operational/archive behavior is not verified as a reliable single-site archive source.

### 6) Does archive support actually exist?

- **Single-site ridge NET timestamped archive:** No verified archive in probes. For sites LZK/TLX/FWS/LWX/OKX/MHX and offsets 10/30/60/120/360/720/1440 min, requests returned **503 / 0 bytes**. Only `-0` (current) returned 200 (334B).
- **Composite rolling offsets:** Prior Sprint 4 observed `nexrad-net-m05m..m50m` responding (m55m 404). This suggests short rolling composite window may exist, but not verified as honest single-site archive/playback with timestamp/frame integrity for our capability contract.
- **Archive framework run (Phase 3 run1):** NET classified **LIVE_ONLY** (0/54 ok, okRate 0.000) across 6 sites x 9 offsets.

**Interpretation:** No verified real archive support for NET in the single-site ridge path tested. Composite rolling behavior is, at best, unverified/partial and semantically ambiguous. Not sufficient for WORKING.

## Determination

| Question | Determination | Confidence |
|---|---|---|
| Why IEM NET responds | IEM exposes NET-named ridge/composite tile services; current endpoint responds | High |
| Why json/radar doesn't list NET | json/radar product discovery omits NET for sampled sites; discovery/API path mismatch or unsupported listing | High (observed), cause unknown |
| Deprecated? | No evidence of deprecation; official NET 41 / EET 135 remain listed | Medium-High |
| Composite-only? | No - single-site naming exists; but behavior ambiguous | Medium |
| Single-site? | Endpoint naming single-site; reliable single-site archive not verified | Medium |
| Archive support exists? | **No verified single-site archive**; composite rolling unverified | High |

## Required Before Any Enablement

1. Authoritative units/legend confirmation (NET 41 kft, EET 135 semantics) and in-app legend mapping.
2. Choose and document canonical source (single-site ridge vs composite) - do not mix.
3. Prove timestamped archive returns real distinct frames (multi-day/multi-site), not 503/default/empty.
4. Prove playback ordering/frame integrity/timestamp honesty.
5. End-to-end wiring through capability matrix, standardized API contract, UI gating, legend, and tests.
6. If any gate fails: remain UNAVAILABLE.