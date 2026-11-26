# Phase 4F — Playback Report

## Sector switching
Full Disk, CONUS, Puerto Rico, Alaska, and moving GOES mesoscale sectors are
selected from the Satellite panel. Sector changes rebuild the raster source with
the published bounds and native-detail ceiling, so MapLibre overzooms instead of
requesting upscaled tiles.

## Timeline / animation
The workstation exposes the live product timeline for radar frames. Satellite
archive playback remains `UNAVAILABLE`: IEM TMS serves current imagery, not a
verified per-scan archive, so a synthetic animation would be dishonest. The
satellite panel shows current selection and source status; refresh re-reads the
latest available imagery.

## Overlays (new)
Radar/Composite workflows can overlay the selected satellite raster with an
operator-set opacity (10–90%). Warnings, storm reports, observations, and GLM
remain independent layers; no layer is silently forced on by a profile.

## Map preservation
The map container uses a dark-navy fallback background so unavailable raster
regions do not show as black holes. Globe mode, labels, and basemap selection
were left unchanged; no new modal or splash was added.
