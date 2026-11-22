# Sprint 2 - Radar Product Discovery Report

Date: 2026-11-22  
Method: Sampled HTTP probes against IEM RIDGE and IEM MRMS TMS endpoints. OK = 200 + PNG magic.

## Summary

| Product | Official/Expected Name | Candidate Source Probed | Endpoint Result | Archive | Playback | Classification |
|---|---|---|---|---|---|---|
| CC (Correlation Coefficient) | NEXRAD Dual-Pol CC (N0C) | IEM ridge N0C | 503 on LZK/LWX/TLX/MHX | Unknown | None verified | **SOURCE UNKNOWN / NOT AVAILABLE on probed IEM ridge path** |
| CC (MRMS proxy candidate) | MRMS RhoHV | IEM MRMS TMS `mrms::RhoHV` | 200 PNG | Unknown | Unknown | **SOURCE EXISTS BUT INTEGRATION MISSING** (semantics not verified as CC) |
| ZDR | NEXRAD Dual-Pol ZDR (N0X) | IEM ridge N0X | 503 sampled | Unknown | None verified | **NOT AVAILABLE on probed IEM ridge path** |
| KDP | NEXRAD Dual-Pol KDP (N0K) | IEM ridge N0K | 503 sampled | Unknown | None verified | **NOT AVAILABLE on probed IEM ridge path** |
| SW (Spectrum Width) | NEXRAD SW (N0W) | IEM ridge N0W | 503 sampled | Unknown | None verified | **NOT AVAILABLE on probed IEM ridge path** |
| HHC (Hydrometeor Classification) | NEXRAD HHC (DHC/HHC/N0H variants) | IEM ridge DHC/HHC/N0H | 503 sampled | Unknown | None verified | **NOT AVAILABLE on probed IEM ridge path** |
| QPE | NEXRAD/MRMS precip products (DPR/ONE/OHA etc.) | IEM ridge DPR/ONE/OHA | 503 sampled | Unknown | None verified | **NOT AVAILABLE on probed IEM ridge path** |
| NROT / Normalized Rotation | MRMS NROT / Level III derived | No verified tile endpoint in pipeline | Not probed as working source | Unknown | None | **SOURCE UNKNOWN / NOT AVAILABLE (verified)** |
| AzShear / Rotation Tracks | MRMS AzShear 0-2km | IEM MRMS `AzShear_0-2km`, `AzShear_0-2km_30min` | 503 sampled | Unknown | None verified | **NOT AVAILABLE on probed IEM MRMS path** |
| MESH | MRMS MESH / MESH_Max60min | IEM MRMS `MESH`, `MESH_Max60min` | 200 PNG | Unknown | Unknown | **SOURCE EXISTS BUT INTEGRATION MISSING** (end-to-end semantics/legend/archive unverified) |
| Echo Tops | NEXRAD Echo Tops (NET/EET) | IEM ridge NET/EET | NET 200 PNG; EET 503 | Unknown | Unknown | **SOURCE EXISTS BUT INTEGRATION MISSING** (NET candidate; semantics/units/archive unverified) |
| VIL | NEXRAD VIL (DVL/NVL) | IEM ridge DVL/NVL | 503 sampled | Unknown | None verified | **NOT AVAILABLE on probed IEM ridge path** |

## Evidence Notes

- IEM ridge dual-pol/spectrum/HHC/QPE/VIL candidates returned 503 on sampled sites (LZK/LWX/TLX/MHX) at sample time. This is evidence of non-availability on that path, but not absolute proof for all times/sites.
- MRMS tiles that returned 200 (MESH, MESH_Max60min, RhoHV, PrecipClass, SeamlessHSR) prove endpoint responsiveness only. Before enabling: verify product semantics, units, legend mapping, update cadence, archive/timestamp behavior, attribution, and end-to-end rendering.
- NROT previously mapped to N0U velocity in old code - intentionally disabled as data lie. No verified distinct NROT source found.

## Policy

No product moves to WORKING/PARTIAL without end-to-end verification through capability matrix and UI gating. Source existence != integration readiness.
