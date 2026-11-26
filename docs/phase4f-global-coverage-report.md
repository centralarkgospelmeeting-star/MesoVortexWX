# Phase 4F — Global Coverage Report

| Region | Satellite | Usable products | Notes |
|---|---|---|---|
| North America / CONUS | GOES-East | Visible, IR, WV, ABI channels, moving mesoscale | IEM TMS; full disk and CONUS probed. |
| North Pacific / Alaska / West CONUS | GOES-West | Visible, IR, WV, ABI channels, moving mesoscale | Full disk and Alaska bounds cross the antimeridian; bounded by real capabilities. |
| Europe / Africa / Middle East | Meteosat | Visible, IR, WV | EUMETSAT MSG full Earth disk WMS; no mesoscale sector claimed. |
| Japan / Western Pacific / Philippines / Taiwan / South China Sea / Australia | Himawari | Visible (legacy full-disk only) | IR/WV/GeoColor remain `DATA UNAVAILABLE` until a proven public feed is verified. |

Global monitoring is honest: the workstation can show GOES and Meteosat imagery
plus NHC/JTWC tropical information. Himawari coverage is listed but its
limited product set is disclosed rather than filled with synthetic imagery.

No region is hidden by the observation or satellite code; WMS bounds come from
published capabilities, and MapLibre overzooms instead of asking for invented detail.
