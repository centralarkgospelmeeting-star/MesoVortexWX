# Expanded Composite Radar and Satellite Source Inventory

Live probes on 2026-11-25. Only sources that returned real, in-domain content are marked verified. Everything else stays `UNAVAILABLE` with the failed evidence recorded.

## Composite radar

| Requested source | Decision | Evidence |
|---|---|---|
| MRMS composite reflectivity | **UNAVAILABLE** | IEM `tile.py/1.0.0/mrms/` and `mrms-t/` are listed but sampled tiles return HTTP 404. `mrms.nssl.noaa.gov/geoserver/wms` returns HTTP 410. NOAA `noaa-mrms-pds` S3 publishes GRIB2, not XYZ tiles. The verified `/api/radar/mrms-tile` products are hazard fields (azshear, MESH, tops), not reflectivity. |
| Additional US composites | **VERIFIED (one added)** | IEM `nexrad-n0q-m05m/4/3/6.png` returned a real 256×256 PNG with 129 distinct reported reflectivity colours. Added as `iem_n0q_recent`. Existing `iem_n0q` / `iem_n0r` remain verified. |
| Canada composite | **VERIFIED (wired)** | ECCC GeoMet `RADAR_1KM_RRAI` GetCapabilities 200; GetMap with `CRS=EPSG:3857` and a real BBOX returned a 256×256 PNG with 64 distinct colours. Added as a MapLibre WMS raster source using `{bbox-epsg-3857}`. No Canadian warnings/forecast zones claimed. |
| Europe-wide radar composite | **UNAVAILABLE** | `opendata.dwd.de/weather/radar/composite/` was unreachable from this environment. EUMETSAT WMS is verified **satellite** imagery, not radar, so it is deliberately not labelled a radar composite. OPERA/EUMETNET access was not verified. |

## Satellite

| Requested capability | Decision | Evidence |
|---|---|---|
| GOES-East / GOES-West | **PARTIAL (existing)** | IEM TMS channels/sectors remain the verified source; mesoscale sectors stay unbounded because their footprints move. |
| Himawari | **PARTIAL (existing, limited)** | Only the legacy IEM `goes_himawari_ch02` layer is verified; other products/sectors stay UNAVAILABLE. |
| Meteosat | **PARTIAL (newly wired)** | EUMETSAT `view.eumetsat.int/geoserver/wms` GetCapabilities 200; live GetMap 200 PNG for `msg_fes:vis006`, `msg_fes:ir108`, `msg_fes:wv062` in EPSG:3857. Exposed as the `meteosat-fes` full Earth disk with those three products only. No ABI channel aliasing. |
| GeoColor | **UNAVAILABLE** | No IEM `geocolor` XYZ layer found; NOAA STAR publishes static imagery, not a verified tile pipeline. |
| IR / Water Vapor | **PARTIAL (existing + Meteosat)** | GOES Ch08/09/10/13 via IEM; Meteosat IR10.8 and WV6.2 via EUMETSAT WMS. |
| Mesoscale sectors | **PARTIAL (existing)** | IEM GOES meso-1/meso-2 layers are wired; moving footprints have no fixed probe tile. Meteosat SEVIRI has no mesoscale product here. |
| GLM | **UNAVAILABLE** | `/api/lightning/glm` exists but the local GLM parser runtime (`/tmp/opencode/glm-venv/bin/python`) is absent, so the endpoint honestly returns `DATA UNAVAILABLE`. No flash product is fabricated. |

## Governance

- `scripts/test-expanded-sources.mjs` asserts verified statuses, exact endpoints/layers, and that unverified sources emit no URL.
- `scripts/test-satellite-capability-matrix.mjs` asserts every emitted satellite URL maps to a verified IEM layer or a verified EUMETSAT WMS layer.
- `scripts/test-radar-render-config.mjs` asserts composite source changes rebuild the raster source (a real bug found during browser verification).
