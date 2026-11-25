# Live NEXRAD Level II reflectivity cross sections

The route `POST /api/radar/cross-section` extracts reflectivity gates along a user-supplied geographic transect from the latest available NOAA NEXRAD Level II volume for one radar.

## Request

```json
{
  "site": "KLZK",
  "start": { "lon": -92.27, "lat": 35.07 },
  "end": { "lon": -91.90, "lat": 35.15 },
  "columns": 120
}
```

- `site`: NEXRAD radar ID or ICAO-style ID.
- `start`, `end`: longitude/latitude endpoints (WGS84).
- `columns`: optional sample count, clamped to 24–180.

## Response and scientific limits

The response includes the live volume timestamp and one row per available elevation sweep. Each row contains the measured elevation angle, reflectivity in dBZ for each transect sample, and the approximate beam height above radar level. The beam geometry uses a standard 4/3-earth effective-radius approximation. Samples with no matching radial/gate remain `null`; the route does not fill gaps or synthesize echoes.

This is a live single-radar cross section, not a Cartesian gridded volume, not a composite, and not an archive product. It is limited to the current volume scan and approximately 460 km radar range. Beam heights are geometric estimates, not terrain-corrected AGL heights. The nearest radial is accepted only within 1.1 degrees of the transect bearing. The API currently provides the data extraction layer; the old modal/UI remains explicitly labeled synthetic until it is replaced and end-to-end verified.

## Failure behavior

Invalid coordinates/site or transects outside the supported length/range are rejected. If a volume or intersecting reflectivity gates are unavailable, the API returns an explicit error rather than placeholder values.

## Example

```bash
curl -X POST http://localhost:3000/api/radar/cross-section \
  -H "Content-Type: application/json" \
  -d '{"site":"KLZK","start":{"lon":-92.27,"lat":35.07},"end":{"lon":-91.90,"lat":35.15}}'
```
