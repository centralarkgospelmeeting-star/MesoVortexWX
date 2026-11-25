# Phase 4E — Station Plot Report

## Workstation station model
`lib/surface/draw-station-model.ts` renders true meteorological station models on a
canvas overlay: temperature (upper-left), dew point (lower-left), pressure
(upper-right), sky cover (center), wind barb (direction/speed/gust), station ID
(lower-center), and present-weather glyphs. No generic map dots are used.

## Click detail
Clicking a station opens a sectioned popup with full raw METAR/SPECI, decoded
METAR, station ID, airport/site name, temperature, dew point, humidity (derived
label), wind, pressure, visibility, ceiling, cloud layers, weather conditions,
observation age, source, and the VFR/MVFR/IFR/LIFR flight category when both
ceiling and visibility are actually reported. Missing fields read
`DATA UNAVAILABLE`; no value is inferred.

## Sources
METAR, SPECI, ASOS/AWOS, IEM Mesonet, NDBC buoys and marine observations are
wired. The `SurfaceNetworkId` union is already expandable for Tempest, Davis,
Weather Underground and COOP; those remain `UNAVAILABLE` until a verified feed
exists.

## Verification
Phase 4C/4E static guards assert the renderer tokens, canonical detail fields,
and absence of generic station circles. Full gate passed.
