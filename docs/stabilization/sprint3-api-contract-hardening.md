# Sprint 3 - API Contract Hardening

Date: 2026-11-22

## Scope

Radar endpoints standardized to include contract fields in JSON responses:

- `data`
- `available`
- `playbackSupport`
- `archiveSupport`
- `verificationLevel`
- `reason`

## Endpoints Updated

| Endpoint | Success JSON | Error JSON | Notes |
|---|---|---|---|
| `/api/nexrad/frames` | Yes | Yes | `data=frames`, capability-driven playback/archive/verification |
| `/api/radar` | Yes | Yes | `data=frames`, capability-driven contract fields |
| `/api/radar/tile` | N/A (image body on success) | Yes | JSON errors/unavailable now include contract fields; image success unchanged |
| `/api/radar/tiles` | Yes | Yes | RainViewer composite; contract fields added |
| `/api/radar/stations` | Yes | N/A | Registry endpoint; contract fields added (`data=stations`) |

## Behavior Notes

- No fake data added. Unavailable/error states remain explicit.
- Existing fields preserved for compatibility.
- `PARTIAL_ARCHIVE` playback support added to type system and honored by archive-frame generation.
