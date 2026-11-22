# Sprint 4 - NET (Echo Tops) Verification Report

Date: 2026-11-22
Target: NET (Echo Tops) - priority enablement candidate. No feature expansion.

## Task 1 - Product Semantics

| Question | Finding | Evidence | Status |
|---|---|---|---|
| Exact product meaning | NET is labeled "Net Echo Tops" by IEM ridge service documentation. Common NWS meaning: Echo Tops (ET) / NET product; exact Level III semantics/units require authoritative confirmation. | IEM GIS ridge page lists `NET - Net Echo Tops` as processed product: https://mesonet.agron.iastate.edu/GIS/ridge.phtml | **PARTIALLY VERIFIED** |
| Units | Not verified end-to-end. NWS Echo Tops commonly kft, but no legend/units extracted from served tile/metadata in this pass. | No legend endpoint/metadata verified; tile-only probes. | **UNVERIFIED** |
| Legend | Not verified. No integrated legend/color mapping verified against authoritative NET legend. | No legend asset/metadata verified. | **UNVERIFIED** |
| Source authority | IEM ridge/composite TMS provides tiles; upstream authority is NOAA/NWS NEXRAD Level III. Direct NOAA semantics not fully validated in-pipeline. | IEM ridge page; NWS product PDF not machine-fetched in-session. | **PARTIALLY VERIFIED** |

## Source Probes

| Probe | Result |
|---|---|
| `ridge::LZK-NET-0/7/33/50.png` | 200 PNG, 334B (empty/transparent sample) |
| `ridge::FWS-NET-0/7/33/50.png` | 200 PNG, 334B |
| `json/radar.py?operation=products&radar=LZK&start=...` | Returned N0B,N0S only; NET not listed |
| `nexrad-net/7/33/50.png` (composite TMS) | 200 PNG, 913B |
| `nexrad-eet/7/33/50.png` (composite TMS) | 200 PNG, 913B |
| `nexrad-net-m05m..m50m` | 200 PNG varying sizes; `m55m` 404 |

## Determination (Task 1)

**NOT VERIFIED for WORKING enablement.** Product name is plausible, but units/legend/authoritative semantics are not fully verified end-to-end.
