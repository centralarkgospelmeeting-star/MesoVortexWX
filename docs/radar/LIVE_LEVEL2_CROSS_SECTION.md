# Live NEXRAD Level II reflectivity cross sections

The **XSEC** control selects a geographic transect on the radar map. Click Point A and Point B; the application requests a live reflectivity cross section from the latest available NOAA NEXRAD Level II volume for the selected radar. Press Escape or toggle XSEC again to cancel selection.

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
- `start`, `end`: WGS84 longitude/latitude endpoints.
- `columns`: optional sample count, clamped to 24–180.

## Data and geometry

The API decodes the current NOAA Level II volume and samples measured reflectivity gates along the transect for each available elevation sweep. Transect columns are now spaced at equal great-circle distance intervals, rather than equal increments in latitude and longitude. For each column, the nearest available radial is accepted only when its azimuth is within 1.1° of the point bearing from the radar.

Beam height is calculated with the standard 4/3-earth effective-radius model and is reported as **feet above radar level**. It is not AGL: no terrain elevation model or radar antenna elevation correction is applied. The returned field is named `beamHeightFtAboveRadar` to make that reference explicit. The response also identifies `heightReference: ABOVE_RADAR_LEVEL`, `transectSampling: GREAT_CIRCLE_EQUAL_DISTANCE`, and `beamModel: 4/3_EARTH_EFFECTIVE_RADIUS`. Missing radial/gate samples remain `null`; the API does not fill gaps or synthesize echoes.

## Verified scope and limitations

- Live single-radar reflectivity transect from NOAA NEXRAD Level II.
- Current volume only; archive playback is not implemented.
- One measured gate sample per sweep and transect column; no Cartesian 3-D interpolation or multi-radar composite.
- No terrain-corrected AGL heights, storm-severity diagnosis, hail-size estimate, or updraft diagnosis.
- The live CI smoke test has successfully retrieved KLZK data and verified nonempty measured reflectivity gates. This validates the API/data path, not every radar site, every transect geometry, or a full meteorological interpretation.

The viewer plots measured gates in a scaled distance-versus-height coordinate system, with labeled distance and above-radar-height axes, hover details, and a dBZ color legend. It does not connect or interpolate missing samples. The automated live test checks the same response contract at KLZK (Little Rock) and KTLX (Oklahoma City), including per-sweep height and reflectivity array dimensions.

## Failure behavior

Invalid coordinates/site and transects outside the supported length/range are rejected. If a current volume or intersecting reflectivity gates are unavailable, the API returns an explicit error rather than placeholder values.

## Example

```bash
curl -X POST http://localhost:3000/api/radar/cross-section \
  -H "Content-Type: application/json" \
  -d '{"site":"KLZK","start":{"lon":-92.27,"lat":35.07},"end":{"lon":-91.90,"lat":35.15}}'
```
