# Canada Support Audit

## Summary

Canada support is **partial**. ECCC (Environment and Climate Change Canada / MSC GeoMet) endpoints have been verified at the WMS GetCapabilities and GetMap level, and the ECCC national radar composite is now wired as a verified WMS raster source in the Composite selector. The MSC GeoMet model WMS is partially wired (temperature and wind fields). Canadian warnings and Canadian forecast zones are still not rendered; they remain honestly marked `NOT_IMPLEMENTED` / `planned` / `DATA UNAVAILABLE`.

## 1. What exists

| Component | Status | Evidence |
|---|---|---|
| International radar registry entry (Canada) | verified (metadata) | `lib/international-radar-registry.ts` — `RADAR_1KM_RRAI` GetCapabilities verified; "Tile/WMS adapter integration pending." |
| ECCC GeoMet WMS GetCapabilities | verified | `https://geo.weather.gc.ca/geomet?SERVICE=WMS&REQUEST=GetCapabilities` returns 200 (39MB capabilities). |
| ECCC GetMap tile (RADAR_1KM_RRAI) | verified | GetMap returns 256×256 PNG with `Radar-Rain_14colors` style. |
| MSC GeoMet model WMS (GDPS-GEML) | partial | `lib/model-registry.ts` — temperature and wind fields marked `READY_NOW` with verified WMS layers; other fields `NEEDS_SOURCE`. |
| Composite source registry entry | verified (radar) | `lib/radar/composite-sources.ts` — `canada_composite` marked `VERIFIED` with the ECCC `RADAR_1KM_RRAI` WMS GetMap URL; live tile probe 2026-11-25. |
| Data source registry entry | not implemented | `lib/data-sources.ts` — `canada-eccc` `NOT_IMPLEMENTED`. |

## 2. What is missing

- **Environment Canada radar layer** — now available through the Composite selector (`canada_composite`, ECCC WMS). It is a national composite raster, not a station-level or tilt-aware product.
- **Canadian warnings** — no adapter. NWS `/api/alerts` and `/api/warnings` are US-only. ECCC CAP alerts exist under `https://dd.weather.gc.ca/today/alerts/cap/` as `.cap` XML, organized by forecast office and hour, but no parser/adapter exists.
- **Canadian forecast zones** — no zone geometry or forecast-zone rendering for Canada. ECCC forecast zones are exposed via GeoMet WMS/WFS and the CAP alerts, but not consumed.
- **Canadian composite in the composite selector** — listed but `UNAVAILABLE`.
- **Canadian alerts in the alert panel/sidebar** — none.
- **Canadian radar in the international radar registry** beyond metadata — adapter pending.

## 3. Data sources available

| Source | URL | Format | Access | Notes |
|---|---|---|---|---|
| ECCC GeoMet WMS (radar) | `https://geo.weather.gc.ca/geomet` | WMS 1.3.0 GetMap (PNG) | Open, no key | `RADAR_1KM_RRAI` composite reflectivity, multiple styles. Verified. |
| ECCC GeoMet WMS (models) | same | WMS | Open, no key | GDPS-GEML temperature/wind verified; other fields pending. |
| ECCC CAP alerts | `https://dd.weather.gc.ca/today/alerts/cap/{office}/{hour}/` | CAP 1.2 XML (`.cap`) | Open, no key | Organized by MSC forecast office and hour. Contains polygon geometry. |
| ECCC Open Data (GeoMet OGC API) | `https://api.weather.gc.ca/` | OGC API Features | Open, no key | Hydrometric and other collections; no alerts collection found. |
| ECCC open-data catalogue | `https://eccc-msc.github.io/open-data/` | Documentation | Open | Terms: ECCC Open Government Licence – Canada. |

## 4. Integration difficulty

| Capability | Difficulty | Reason |
|---|---|---|
| ECCC radar WMS layer on the map | Medium | MapLibre supports WMS via `raster` source with a tile URL template. Need a GetMap URL builder (bbox, width, height, CRS, style) and caching. Similar to satellite WMS path already in `RadarMap.tsx`. CRS handling (EPSG:3857 vs 4326) and GetMap vs tile endpoint differences. |
| Canadian alerts (CAP) | High | CAP 1.2 XML parsing; alerts organized by office/hour directories (not a single feed). Need to enumerate offices and latest hour, parse polygons, normalize to the internal `WeatherAlert` model, and resolve geometry (CAP already includes polygons, so no zone resolution needed). Significant new adapter + caching + polling. |
| Canadian forecast zones | Medium–High | Need zone geometry from GeoMet WMS/WFS or CAP area definitions; map to internal zone model; integrate with alert polygons. |
| Composite source entry | Low | Already listed; flip status to VERIFIED once a tile URL is wired. |
| Model fields (GDPS-GEML) | Medium | Additional WMS layer names need verification per field; follow the existing temperature/wind pattern. |

## 5. Canada support roadmap

1. **Phase A — ECCC radar layer (medium)**: Add an ECCC WMS raster source to `RadarMap.tsx` (mirroring the satellite WMS path), with a style selector and provenance/refresh/latency in the banner. Mark `canada_composite` VERIFIED in `composite-sources.ts`.
2. **Phase B — Canadian alerts adapter (high)**: Implement a CAP 1.2 parser that enumerates `dd.weather.gc.ca/today/alerts/cap/` by office and latest hour, normalizes alerts into `WeatherAlert`, and feeds `/api/alerts` and `/api/warnings` (or a new `/api/alerts/canada` route). Add CAP-derived polygons directly (no zone resolution needed).
3. **Phase C — Forecast zones (medium)**: Wire ECCC forecast-zone geometries for zone-based display and alert association.
4. **Phase D — Model fields (medium)**: Verify and wire additional GDPS-GEML WMS layers (CAPE, CIN, precipitation, etc.) following the temperature/wind pattern.
5. **Phase E — UI/registry (low)**: Flip `canada-eccc` in `data-sources.ts` to `PARTIAL`/`IMPLEMENTED` as each capability lands; add Canada to the international radar registry with adapter status.

## 6. Data honesty

- ECCC radar WMS is verified and returns real tiles, but it is **not yet integrated** into the map; no Canadian radar is rendered today.
- ECCC CAP alerts are a real, open, authoritative source, but **no adapter exists**; no Canadian alerts are shown today.
- All Canada entries remain `NOT_IMPLEMENTED` / `planned` / `DATA UNAVAILABLE` until wired and verified end-to-end. No synthetic or estimated Canadian data is produced.