# Dual-Pol / Spectrum / HHC Source Probe

Generated: 2026-11-23T20:03:53.796Z

> Verification-only evidence. This probe does **not** enable any product. Capability matrix remains authoritative.

## False-positive guard

- Invalid layer `hrrr::DOES_NOT_EXIST-0`: status 200, x-iem-error=InvalidTMSRequest, bytes=20229, png=true
- Known-good `nexrad-n0q-900913`: status 200, x-iem-error=none, bytes=511, png=true
- **IEM can return 200 PNG with X-IEM-Error for invalid layers; status==200 alone is insufficient.**

## IEM radar.py advertised products

- LZK: 200 - N0B, N0S
- TLX: 200 - N0B, N0S
- DMX: 200 - N0B, N0S
- LOT: 200 - N0S, N0B
- MHX: 200 - N0S, N0B

## IEM RIDGE tile probe (single-site, z/x/y=6/15/25, stamp=0)

| Product | Code | Site | Status | Content-Type | X-IEM-Error | Bytes | PNG |
|---|---|---:|---:|---|---|---:|:---:|
| Correlation Coefficient | N0C | LZK | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Correlation Coefficient | N0C | TLX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Correlation Coefficient | N0C | DMX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Correlation Coefficient | N0C | LOT | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Correlation Coefficient | N0C | MHX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Differential Reflectivity | N0X | LZK | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Differential Reflectivity | N0X | TLX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Differential Reflectivity | N0X | DMX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Differential Reflectivity | N0X | LOT | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Differential Reflectivity | N0X | MHX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Specific Differential Phase | N0K | LZK | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Specific Differential Phase | N0K | TLX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Specific Differential Phase | N0K | DMX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Specific Differential Phase | N0K | LOT | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Specific Differential Phase | N0K | MHX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Spectrum Width | NSW | LZK | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Spectrum Width | NSW | TLX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Spectrum Width | NSW | DMX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Spectrum Width | NSW | LOT | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Spectrum Width | NSW | MHX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Spectrum Width | NSP | LZK | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Spectrum Width | NSP | TLX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Spectrum Width | NSP | DMX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Spectrum Width | NSP | LOT | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Spectrum Width | NSP | MHX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Hydrometeor Classification | N0H | LZK | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Hydrometeor Classification | N0H | TLX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Hydrometeor Classification | N0H | DMX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Hydrometeor Classification | N0H | LOT | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Hydrometeor Classification | N0H | MHX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Hydrometeor Classification | HHC | LZK | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Hydrometeor Classification | HHC | TLX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Hydrometeor Classification | HHC | DMX | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Hydrometeor Classification | HHC | LOT | 503 | text/plain; charset=UTF-8 |  | 983 | no |
| Hydrometeor Classification | HHC | MHX | 503 | text/plain; charset=UTF-8 |  | 983 | no |

## MRMS NCEP GRIB2 directory probe

| Path | Status | Has latest.grib2.gz | Sample files |
|---|---:|:---:|---|
| 2D/MergedRhoHV/ | 200 | yes | MRMS_MergedRhoHV.latest.grib2.gz, MRMS_MergedRhoHV.latest.grib2.gz, MRMS_MergedRhoHV_00.50_20261122-200039.grib2.gz |
| 2D/MergedZdr/ | 200 | yes | MRMS_MergedZdr.latest.grib2.gz, MRMS_MergedZdr.latest.grib2.gz, MRMS_MergedZdr_00.50_20261122-200040.grib2.gz |
| 2D/MergedKdp/ | 403 | no |  |
| 2D/MergedHHC/ | 403 | no |  |
| 3DRhoHV/ | 200 | no |  |
| 3DZdr/ | 200 | no |  |

## Assessment

- **IEM RIDGE dual-pol/SW/HHC tiles**: currently not usable as verified live sources in this probe (503/invalid). Do not enable.
- **IEM radar.py metadata**: currently advertises only N0B/N0S on sampled sites; dual-pol codes not advertised.
- **MRMS NCEP GRIB2**: MergedRhoHV and MergedZdr directories are live; KDP/HHC 2D paths probed returned 403/absent. GRIB2 availability is not tile/API/UI end-to-end integration.
- **Next honest path**: build verified MRMS/Level III ingest+decode+tile+legend+archive pipeline; only then update capability matrix after end-to-end verification.
