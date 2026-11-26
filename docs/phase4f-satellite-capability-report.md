# Phase 4F — Satellite Capability Report

Capability matrix remains authoritative. Live probes 2026-11-25.

| Item | Status | Evidence / limitation |
|---|---|---|
| GOES-East | PARTIAL | IEM TMS channels/sectors (fixed sectors probed live); mesoscale footprints move, no fixed probe. |
| GOES-West | PARTIAL | Same IEM TMS coverage; Alaska full-disk lobes cross the antimeridian. |
| GeoColor | UNAVAILABLE | No verified public XYZ tile endpoint; NOAA STAR static imagery is not a tile feed; IEM layer list has no geocolor layer. |
| IR (Ch13 / SEVIRI IR10.8) | PARTIAL | GOES Ch13 via IEM; Meteosat `msg_fes:ir108` GetMap 200 PNG. |
| Water Vapor (Ch08/09/10 / WV6.2) | PARTIAL | GOES WV channels via IEM; Meteosat `msg_fes:wv062` GetMap 200 PNG. |
| GLM | UNAVAILABLE | Route exists, but the parser runtime (`/tmp/opencode/glm-venv/bin/python`) is absent; endpoint honestly returns `DATA UNAVAILABLE`. |
| Himawari | PARTIAL (visible only) | Legacy IEM `goes_himawari_ch02` layer is reachable but serves a static low-detail image. Probes for a real public IR/WV/GeoColor tile feed failed (404/401/unreachable). No invented channels. |
| Meteosat | PARTIAL / TESTED_LIVE | EUMETSAT `view.eumetsat.int/geoserver/wms` GetCapabilities 200; live GetMap 200 PNG for VIS006, IR10.8, WV6.2 in EPSG:3857. |
| Meteosat RGB products | UNAVAILABLE | SEVIRI raw layers exist, but no verified RGB composite tile endpoint; cloud-top/fire layers are not presented as RGB. |

The selector groups satellites by North America (GOES-East/West), Europe/Africa
(Meteosat), and Asia/Pacific (Himawari). Only products with a verified URL are
selectable; unavailable products are labelled `DATA UNAVAILABLE`.
