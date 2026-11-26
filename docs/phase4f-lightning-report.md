# Phase 4F — Lightning Report

## Audit result
`/api/lightning/glm` is wired to the NOAA GOES-R GLM parser script
(`scripts/glm_fetch.py`) but requires a local Python runtime
(`/tmp/opencode/glm-venv/bin/python`). That runtime is absent in this deployment,
so the endpoint returns `available: false` with a `DATA UNAVAILABLE` reason. No
flash points, density grid, or recent-flash list are fabricated.

## Capability matrix
`glm_lightning` remains `UNAVAILABLE` with `TESTED_LIVE`-style evidence of the
failed runtime probe. EUMETSAT MSG has no GLM equivalent, so no satellite
lightning overlay is claimed for Meteosat or Himawari.

## Supported UI behavior
The Lightning panel states the real source and data-dependent availability;
the map layer only renders when the endpoint reports verified flash features.
"Lightning density" and "recent flashes" are not displayed while unavailable.

## Fix path
A portable GLM runtime (or a verified server-side replacement feed) is required
before this capability can be promoted. No silent fallback is allowed.
