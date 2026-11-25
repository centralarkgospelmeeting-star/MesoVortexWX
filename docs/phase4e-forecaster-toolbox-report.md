# Phase 4E — Forecaster Toolbox Report

## Optional surface
The toolbox is available from the hamburger menu ("Show Forecaster Toolbox") and
from Settings. It is compact and uses no modal.

## Included tools
- Distance measurement
- Area measurement
- Point / line / polygon / annotation drawing
- Coordinate readout from the live map cursor
- Lat/Lon copy button (copies `lat, lon` to clipboard)
- Storm motion estimate: draw a line between two positions, enter the minutes
  between scans, and read bearing and kt. It is explicitly labelled
  "Derived from operator line and interval; not an observed storm track."

## Named workspaces
Settings now stores Radar Workspace, Satellite Workspace, Forecast Workspace and
Broadcast Workspace. Each remembers overlay choices and which panels (alerts,
HSI, MesoAI, toolbox) are visible. A Broadcast Workspace toggle is available from
the menu as groundwork; no large-text redesign is claimed yet.

## Verification
`test-phase4e.mjs` asserts tool modes, cursor/copy, storm-motion disclosure,
workspace definitions, and menu access. Full gate passed.
