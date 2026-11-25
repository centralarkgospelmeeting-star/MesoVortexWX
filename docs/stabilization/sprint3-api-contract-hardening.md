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
| `/api/radar` | Retired | `410 Gone` | Legacy frame route removed in Phase 4A; use `/api/nexrad/frames` |
| `/api/radar/tile` | N/A (image body on success) | Yes | JSON errors/unavailable now include contract fields; image success unchanged |
| `/api/radar/tiles` | Yes | Yes | RainViewer composite; contract fields added |
| `/api/radar/stations` | Yes | N/A | Registry endpoint; contract fields added (`data=stations`) |

## Behavior Notes

- No fake data added. Unavailable/error states remain explicit.
- Phase 4A: `/api/radar` no longer synthesizes frame times from the server clock; it returns `410 Gone` and points callers to `/api/nexrad/frames`.
- Existing fields preserved for compatibility.
- `PARTIAL_ARCHIVE` playback support added to type system and honored by archive-frame generation.
