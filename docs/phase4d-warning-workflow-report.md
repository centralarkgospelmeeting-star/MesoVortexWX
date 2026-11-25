# Phase 4D — Warning Workflow Report

## Workflow
1. Click inside a warning polygon → compact location summary.
2. Choose a warning → full detail panel.
3. Detail panel is a movable workstation window, not a fixed card.

## Panel behavior (new)
- **Draggable** by its header (pointer events, clamped to viewport).
- **Resizable** from the bottom-right grip (minimum 250×220).
- **Collapse/expand** from the header chevron.
- **Pin/unpin** from the header; a pinned panel is not dismissed by map clicks.
- Position/size persist in `sessionStorage` (`mesovortex_alert_panel_session_v1`) for the session.

## Complete warning product
The detail view shows: event type, WFO, VTEC, severity, urgency, certainty, issue time,
expiration time, remaining time, affected area, **Places Affected**, storm motion,
hazard, impacts, instructions, and the **full NWS warning text**. Population,
schools, hospitals and analyzed storm track remain `DATA UNAVAILABLE` — the sources
do not provide them, so nothing is invented.

## Places Affected (real intersections)
`/api/alerts` resolves each alert's `affectedZones` URLs through the NWS zone API
(cached 10 minutes), reads `properties.name` from those zones, de-duplicates the
names, and attaches them as `properties.places`. The canonical `WeatherAlert`
carries `places: string[]`; the panel labels them as NWS zones. City names are
never guessed from polygon coordinates.

## Verification
`test-alert-integrity.mjs` and `test-phase4d.mjs` assert panel controls, content
fields, zone-name resolution, and pin behavior. Full gate passed.
