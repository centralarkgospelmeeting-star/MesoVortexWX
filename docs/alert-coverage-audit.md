# Alert Coverage Audit

## Root cause

Only severe-convective warning types were consistently visible because two code paths filtered the NWS feed to events whose name contained the substring `"Warning"`:

1. `lib/adapters/providers.ts` `NwsAlertsAdapter.fetchActiveWarnings()` filtered `(f.properties?.event || '').includes('Warning')`, dropping every Advisory, Watch, Statement, and Outlook.
2. `/api/warnings` therefore only ever returned Warning-titled products, so any downstream consumer (EmergencyAlertTone, MesoAI) saw a Warning-only subset.

The map itself (`/api/alerts` → `normalizeNwsCollection`) already ingested all events, but `alertsToFeatureCollection` drops alerts without geometry, and several non-severe products (Special Weather Statements, some advisories) frequently have no polygon — so they never rendered as polygons even though they were in the feed.

## What was fixed

- Removed the `.includes('Warning')` filter from `NwsAlertsAdapter.fetchActiveWarnings()`; now only the geometry requirement remains (needed for point-in-polygon and map rendering).
- `/api/warnings` now returns all alert types with geometry, not just Warnings.
- Added color patterns for heat, red flag, dense fog, dust, tropical/hurricane, and coastal/lakeshore flood so those types are visually distinguishable instead of all red.
- Map rendering (`updateWarnings`, `visibleMapAlerts`) already preserved advisories/statements/watches (advisories and statements always render; warnings/watches follow their toggles).

## Audit matrix

| Type | Visible? | Cause before | After fix |
|---|---|---|---|
| Tornado Warning | Yes | — | Yes |
| Severe Thunderstorm Warning | Yes | — | Yes |
| Flash Flood Warning | Yes | — | Yes |
| Special Weather Statement | Sometimes | No geometry in many products | Shown when geometry present; advisory/statement colors |
| Winter Storm Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |
| Winter Weather Advisory | No | `includes('Warning')` filter + often no geometry | Inclusive feed; renders if geometry |
| Blizzard Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |
| Ice Storm Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |
| High Wind Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |
| Wind Advisory | No | `includes('Warning')` filter + often no geometry | Inclusive feed; renders if geometry |
| Freeze Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |
| Frost Advisory | No | `includes('Warning')` filter + often no geometry | Inclusive feed; renders if geometry |
| Dense Fog Advisory | No | `includes('Warning')` filter + often no geometry | Inclusive feed; renders if geometry |
| Dust Storm Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |
| Heat Advisory | No | `includes('Warning')` filter + often no geometry | Inclusive feed; renders if geometry |
| Excessive Heat Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |
| Red Flag Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |
| Coastal Flood Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |
| Lakeshore Flood Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |
| Tropical / Hurricane Warning | Yes (if geometry) | Filtered out of `/api/warnings` only | Inclusive feed |

## Remaining honest limitations

- Alerts without geometry (many advisories and statements) cannot be rendered as polygons; they still appear in the alert list/panel via `/api/alerts`.
- EmergencyAlertTone intentionally triggers audio only for Tornado and Severe Thunderstorm Warnings (siren policy), regardless of the broader feed.
- Filter mode in Alert Settings can still hide categories when set to `warnings`/`watches`/`statements`; default is `all`.


## Zone geometry resolution

Most NWS alerts (especially advisories and statements) ship without a
polygon; only `affectedZones` (zone URLs) are provided. `/api/alerts` now
resolves those zone geometries (NWS `/zones/.../{id}`), caches them in
memory for 10 minutes, and merges them into a single polygon per alert.
This is why advisories/statements now render on the map instead of only
appearing in the list. First cold request takes ~18s while zones are fetched;
subsequent requests are ~1s.
