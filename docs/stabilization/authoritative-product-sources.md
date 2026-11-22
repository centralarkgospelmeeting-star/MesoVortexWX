# Phase 3 - Authoritative Product Sources Report

Date: 2026-11-22  
Scope: Unavailable/candidate products only. **Research only - no implementation, no enablement.**  
Sources: NOAA/NCEI, NWS ROC, NWS NOAAPort product lists, NSSL MRMS operational tables/WDTD, IEM docs (implementation context only).

## Task 1 - Authoritative NOAA/NWS Source Audit

| Product | Official Name | Official Units | Official Legend / Semantics | Official Source (authoritative) | Official Archive Source | Notes |
|---|---|---|---|---|---|---|
| **CC** | Digital Correlation Coefficient (Dual-Pol) | Unitless (rhoHV), typically 0.00-1.05 display range | Values near 1 indicate uniform meteorological targets; ~0.85-0.95 mixed/complex; lower values often non-meteorological/clutter/biological; used with Z/ZDR/KDP for classification | NOAA/NCEI NEXRAD Level III; NWS ROC Level III product types; NOAAPort radar products (NXC/NYC/NZC/N0C/NAC/N1C/NBC/N2C/N3C, product 161 DCC) | NCEI NEXRAD Level III archive (AWS/NCEI); NOAA Big Data Program/NCEI Level III | Official NEXRAD Level III dual-pol product. Not the same as MRMS RhoHV. |
| **ZDR** | Digital Differential Reflectivity (Dual-Pol) | dB | Near 0 dB: spherical/small drops; positive: horizontally oriented/large drops; negative: vertically oriented; interpretation requires CC/context | NOAA/NCEI NEXRAD Level III; NWS ROC; NOAAPort (NXX/NYX/NZX/N0X/NAX/N1X/NBX/N2X/N3X, product 159 DZD) | NCEI NEXRAD Level III archive | Official NEXRAD Level III dual-pol product. |
| **KDP** | Digital Specific Differential Phase (Dual-Pol) | deg/km | Higher KDP indicates greater liquid water content/heavy rain; useful in heavy rain/hail mixed areas; calculated where CC quality sufficient | NOAA/NCEI NEXRAD Level III; NWS ROC; NOAAPort (NXK/NYK/NZK/N0K/NAK/N1K/NBK/N2K/N3K, product 163 DKD) | NCEI NEXRAD Level III archive | Official NEXRAD Level III dual-pol product. |
| **SW** | Spectrum Width (Base Spectrum Width / Super-Res Spectrum Width Data Array) | m/s (or knots in some displays; authoritative product data in velocity units, m/s typical) | Measures velocity dispersion within sample volume; higher values can indicate turbulence/shear/variability; sensitive to noise/quality | NOAA/NCEI NEXRAD Level III; NWS ROC; NOAAPort (NSW product 30; super-res spectrum width product 155 data array) | NCEI NEXRAD Level III archive | Naming/code must be canonicalized before enablement (NSW/N0W/155 confusion risk). |
| **HHC** | Hybrid Hydrometeor Classification / Digital Hydrometeor Classification | Categorical classes (unitless category IDs) | HCA classes (typical): biological, ground clutter, ice crystals, dry snow, wet snow, light/moderate rain, heavy rain, big drops, graupel, hail-rain, unknown; exact class mapping per ROC ICD/dual-pol docs | NOAA/NCEI NEXRAD Level III; NWS ROC; NOAAPort (HHC 177; DHC 165 NXH..N3H) | NCEI NEXRAD Level III archive | Two related products (DHC 165, HHC 177). Must not enable without explicit class legend mapping. |
| **QPE** | Quantitative Precipitation Estimate (family, not one product) | in, in/hr, or product-dependent accumulation/rate units | Product-dependent: OHA 169 one-hour accumulation; DAA 170 digital accumulation array; DSP 138 digital storm total; DPR 176 digital instantaneous precipitation rate; DSD 175 storm total difference; OHP/STP legacy variants | NOAA/NCEI NEXRAD Level III; NWS ROC; NOAAPort product family | NCEI NEXRAD Level III archive | **High semantic risk:** "QPE" is ambiguous. Must select one specific product/code and label units exactly. |
| **AzShear** | Azimuthal Shear (MRMS) / Low-Level & Mid-Level Azimuthal Shear | 0.001/s (MRMS GRIB2 table units; values scaled per table notes) | Azimuthal shear of radial velocity; LL AzShear 0-2km AGL, ML AzShear 3-6km AGL; Rotation Tracks are max AzShear over time windows | NOAA/NSSL MRMS; MRMS Operational GRIB2 Tables (v12.2): MergedAzShear0to2kmAGL 209.3.0, MergedAzShear3to6kmAGL 209.3.1; WDTD MRMS Products Guide | NCEP MRMS operational feeds; Iowa State MRMS archive; NOAA Open Data Dissemination/MRMS archives as available | MRMS product, not NEXRAD Level III single-site. Different semantics from NROT/velocity. |
| **MESH** | Maximum Estimated Size of Hail (MRMS) | mm | Estimated maximum hail size derived from Severe Hail Index (SHI) / vertical reflectivity/temperature profile; not direct hail observation; swath products track max over time | NOAA/NSSL MRMS; MRMS GRIB2 Tables v12.2: MESH 209.3.28, MESHMax30min 209.3.29, MESHMax60min 209.3.30 etc.; WDTD MRMS Products Guide | NCEP MRMS operational feeds; Iowa State MRMS archive; MRMS grib2 archives | MRMS product. MESH != MRMS MESH_Max_60min semantics; labeling must be exact. |
| **VIL** | Vertically Integrated Liquid / Digital Vertically Integrated Liquid | kg/m^2 | Estimate of liquid water in a vertical column; used for storm intensity/heavy rain/hail indication; not a direct precipitation measurement | NOAA/NCEI NEXRAD Level III; NWS ROC; NOAAPort (NVL 57, DVL 134) | NCEI NEXRAD Level III archive | DVL (134) is digital/high-res VIL; NVL (57) legacy. Must pick and label specific code. |
| **Echo Tops** | Echo Tops / Enhanced Echo Tops | kft (common operational display) / source units must be verified per ICD | Height of highest echo above threshold (NET 41 commonly 18 dBZ); EET 135 enhanced/higher-resolution processing; used for convective intensity and aviation situational awareness | NOAA/NCEI NEXRAD Level III; NWS ROC; NOAAPort (NET 41, EET 135); IEM ridge docs list NET | NCEI NEXRAD Level III archive; IEM ridge/TMS has NET service but archive semantics unverified for our pipeline | Candidate only in MesoVortexWX. Official product exists; our source/archive/playback semantics not verified. |

## Sources Consulted (authoritative/primary)

- NOAA/NCEI NEXRAD Products: https://www.ncei.noaa.gov/products/radar/next-generation-weather-radar
- NOAA/NCEI NEXRAD Level III metadata/landing: https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc:C00708
- NWS ROC Level III Data Types: https://www.roc.noaa.gov/level-three-data-types.php
- NWS NOAAPort Radar Products (PDF): https://www.weather.gov/media/tg/noaaport_radar_products.pdf
- NSSL MRMS Operational GRIB2 Tables: https://www.nssl.noaa.gov/projects/mrms/operational/tables.php
- NSSL MRMS support tables (GitHub): https://github.com/NOAA-National-Severe-Storms-Laboratory/mrms-support
- WDTD MRMS Products Guide (Rotation Tracks/AzShear/MESH): https://vlab.noaa.gov/web/wdtd/-/rotation-tracks
- NCEP MRMS data access: https://mrms.ncep.noaa.gov/

## Explicit Non-Findings / Risks

- **NROT**: No standard NEXRAD Level III product named "NROT" identified. MRMS Rotation Tracks / AzShear are different products; do not map NROT to N0U or SRV.
- **QPE**: Ambiguous family name; enabling "QPE" without selecting exact product code/units is a data-honesty risk.
- **SW**: Product code/name mapping (NSW vs N0W vs 155) must be canonicalized against ROC/NOAAPort before implementation.
- **MRMS via IEM tiles**: IEM tile availability is not equivalent to authoritative archive integrity, timestamp semantics, or legend correctness.