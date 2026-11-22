# Phase 2 - Product Feasibility Matrix

Date: 2026-11-22
Scope: Unavailable radar products only. Research/planning only - **NO implementation, NO enablement**.
Method: Authoritative NWS/NOAA/IEM/MRMS documentation review + prior Sprint 2-4 probe evidence.

## Authoritative Product Research (Task 1)

| Product | Official NOAA/NWS Name | Official Code(s) | Official Units | Official Legend / Notes | Official Source / Authority | Sprint Evidence |
|---|---|---|---|---|---|---|
| CC | Correlation Coefficient (Dual-Pol) | 161; N0C/N1C/N2C/N3C (and tilts NX/NY/NZ/NA/NB) | Unitless (rhoHV), 0-1 | 0.95-1.0 uniform met; 0.85-0.95 complex/varied; <0.9 often non-met/clutter/biological | NOAA/NCEI NEXRAD products; NWS RPCCDS/NOAAPort product lists; WDTD dual-pol training | IEM ridge N0C 503 on sampled sites (Sprint 2); MRMS RhoHV tile 200 exists but semantics/integration unverified |
| ZDR | Differential Reflectivity (Dual-Pol) | 159; N0X/N1X/N2X/N3X | dB | Near 0 spherical/small; positive horizontal-oblate (large drops); negative vertical-oriented; used with Z/CC/KDP | NOAA/NCEI; NWS RPCCDS/NOAAPort; WDTD dual-pol training | IEM ridge N0X 503 sampled (Sprint 2) |
| KDP | Specific Differential Phase (Dual-Pol) | 163; N0K/N1K/N2K/N3K | deg/km | Higher KDP indicates heavy rain/large liquid drops; computed where CC adequate | NOAA/NCEI; NWS RPCCDS/NOAAPort; WDTD dual-pol training | IEM ridge N0K 503 sampled (Sprint 2) |
| SW | Spectrum Width | 30 NSW (base spectrum width); 155 super-res spectrum width data array | m/s (velocity dispersion) | Higher values indicate turbulence/shear/variability within sample volume | NWS Level III product lists; ROC ICD; IEM ridge lists NSW/N0S related products | IEM ridge N0W 503 sampled (Sprint 2); code/product naming needs canonicalization (N0W vs NSW) |
| HHC | Hydrometeor Classification / Hybrid Hydrometeor Classification | 165 DHC (N0H/N1H/N2H/N3H digital HCA); 177 HHC (hybrid) | Categorical classes | Classes include biological, ground clutter, ice crystals, dry snow, wet snow, rain, heavy rain, big drops, graupel, hail (per HCA/HHC) | NOAA/NCEI; NWS RPCCDS/NOAAPort; WDTD dual-pol; NWS training | IEM ridge DHC/HHC/N0H 503 sampled (Sprint 2) |
| QPE | Precipitation / Quantitative Precipitation Estimate (family) | Multiple: 169 OHA, 170 DAA, 172 DTA, 174 DOD, 175 DSD, 176 DPR, 78 OHP, 80 STP, 138 DSP etc. | in/hr or in (product-dependent) | Product-dependent; must not conflate rate vs accumulation vs difference products | NWS RPCCDS/NOAAPort; NOAA NCEI | IEM ridge DPR/ONE/OHA 503 sampled (Sprint 2); semantics vary by product - high risk of wrong labeling |
| NROT | Normalized Rotation (not standard NEXRAD Level III name) | No standard NEXRAD Level III product code named NROT; MRMS has Azimuthal Shear/Rotation Tracks (different products) | s^-1 (AzShear) / unitless-like normalized values in some vendor products | MRMS AzShear: low/mid-level rotation; Rotation Tracks are max AzShear over time | MRMS/NSSL for AzShear/Rotation Tracks; no authoritative NEXRAD NROT Level III code identified | Prior app mapping NROT->N0U was a data lie (disabled). No verified distinct NROT source. |
| AzShear | MRMS Azimuthal Shear / Rotation Tracks | MRMS GRIB2: MergedAzShear0to2kmAGL (209.3.0), MergedAzShear3to6kmAGL (209.3.1), RotationTrack30min/60min etc. | 0.001/s (scaled) | Azimuthal shear of radial velocity; rotation tracks are max over time window; not a NEXRAD Level III site product | NOAA/NSSL MRMS; WDTD MRMS Products Guide | IEM MRMS AzShear_0-2km and 30min returned 503 (Sprint 2). MRMS live source exists generally, but IEM TMS/archive/integration not verified |
| MESH | Maximum Estimated Size of Hail (MRMS) | MRMS GRIB2: MESH (209.3.28), MESHMax30/60/120/240/360/1440min | mm | Estimated max hail size; derived from reflectivity and temperature profile (SHI/MESH); not direct measurement | NOAA/NSSL MRMS; WDTD MRMS Products Guide | IEM MRMS MESH tiles 200 PNG (Sprint 2/3); Sprint 4 timestamp/archive probe ambiguous (same bytes for fabricated paths) - not end-to-end verified |
| VIL | Vertically Integrated Liquid / Digital VIL | 57 NVL (VIL), 134 DVL (Digital VIL) | kg/m^2 | Estimate of liquid water in vertical column; hail/heavy rain indicator; DVL is digital high-res variant | NWS Level III product lists; NOAA/NCEI; ROC ICD | IEM ridge DVL 503, NVL 503 sampled (Sprint 2); conflicting mappings in old code |
| Echo Tops | Echo Tops / Enhanced Echo Tops | 41 NET (Echo Tops), 135 EET (Enhanced Echo Tops) | kft (typically) | Height of 18 dBZ echo top (NET) / enhanced echo tops (EET); pilot/convective intensity use | NWS Level III product lists; IEM ridge docs list NET; NOAA/NCEI | Sprint 4: ridge NET-0 334B empty sample; timestamped ridge NET 503; json/radar did not list NET for LZK; composite nexrad-net rolling m05m-m50m exists but end-to-end not verified |

## Feasibility Matrix (Task 2)

| Product | Official Source | Verified Source (in our pipeline) | Verified Archive | Verified Playback | Verified Units | Verified Legend | Implementation Effort | Enablement Candidate |
|---|---|---|---|---|---|---|---|---|
| CC | NOAA/NWS Level III (161) | **No** (N0C ridge 503; MRMS RhoHV not semantically equivalent) | No | No | Partially (docs) | Partially (docs) | High | No |
| ZDR | NOAA/NWS Level III (159) | **No** (N0X 503) | No | No | Partially (docs) | Partially (docs) | High | No |
| KDP | NOAA/NWS Level III (163) | **No** (N0K 503) | No | No | Partially (docs) | Partially (docs) | High | No |
| SW | NOAA/NWS Level III (30/155) | **No** (N0W 503; code naming unclear) | No | No | Partially (docs) | Partially (docs) | Medium-High | No |
| HHC | NOAA/NWS Level III (165/177) | **No** (DHC/HHC/N0H 503) | No | No | Partially (docs) | Partially (docs) | High | No |
| QPE | NOAA/NWS Level III family | **No** (DPR/ONE/OHA 503; semantics vary) | No | No | No (product-dependent) | No | High (semantics risk) | No |
| NROT | No standard NEXRAD Level III NROT | **No** | No | No | No | No | Very High / N/A | No - avoid |
| AzShear | NOAA/NSSL MRMS | **No** (IEM MRMS AzShear 503) | No | No | Yes (docs, 0.001/s) | Partially (docs) | High | No |
| MESH | NOAA/NSSL MRMS | **Partial candidate only** (MRMS tile 200 but timestamp/archive semantics untrustworthy in probes) | No verified | No verified | Yes (mm, docs) | Partially (docs) | High | **Investigate only** (not ready) |
| VIL | NOAA/NWS Level III (57/134) | **No** (DVL/NVL 503) | No | No | Yes (kg/m^2 docs) | Partially (docs) | Medium-High | No |
| Echo Tops | NOAA/NWS Level III (41 NET/135 EET) | **Partial candidate only** (name known; ridge live 334B; timestamped 503; composite rolling offsets exist) | No verified | No verified | Likely kft (docs) | Unverified | Medium-High | **Investigate only** (not ready) |

## Ranking (best to worst enablement candidate)

| Rank | Product | Rationale | Blockers |
|---:|---|---|---|
| 1 | Echo Tops (NET/EET) | Official NEXRAD product; IEM has named ridge/composite services; rolling offsets observed | json/radar did not list NET; ridge archive 503; units/legend/end-to-end not verified; single-site vs composite semantics |
| 2 | MESH | MRMS official product, clear units (mm), tiles respond | Timestamp/archive probe ambiguity; no verified legend/metadata; no trustworthy archive/playback path; MRMS integration not in verified pipeline |
| 3 | VIL (DVL/NVL) | Official NEXRAD codes/units clear | Ridge DVL/NVL 503 sampled; no verified source path; mapping conflicts historically |
| 4 | SW | Official product exists | N0W/NSW naming ambiguity; 503 sampled; limited user value vs risk |
| 5 | CC | High value dual-pol product | N0C 503; RhoHV not semantically equivalent substitute; needs verified source+legend |
| 6 | ZDR | High value dual-pol product | N0X 503; no verified source |
| 7 | KDP | High value dual-pol product | N0K 503; no verified source |
| 8 | HHC | Categorical product useful | DHC/HHC/N0H 503; categorical legend/rendering complexity |
| 9 | AzShear | MRMS value high | AzShear endpoints 503 on probed path; MRMS pipeline integration/legend/archive unverified |
| 10 | QPE | High user value but risky | Multiple product semantics (rate/accum/diff); wrong labeling risk; 503 sampled |
| 11 | NROT | Name ambiguous | No standard NEXRAD Level III NROT; prior mapping was data lie; avoid until authoritative distinct source defined |

## Notes

- "Verified Source" means end-to-end verified in MesoVortexWX pipeline (source + timestamp/units/legend/archive/playback as applicable), not merely "endpoint returns PNG".
- No product is ready for WORKING enablement today.
