# Phase 4E — Storm Report Workflow Report

## Sources
- **Local Storm Reports (NWS/IEM)** via `/api/spotter?mode=reports`.
- **Spotter Network reports** when the operator connects an account.
- **NSSL mPING** via `/api/mping?minutes=60`. Live probe during this phase found
  the upstream endpoint unavailable (401/404), so the app shows no reports rather
  than inventing them; the feed is wired for when the source is reachable.

## Clicking a report
Reports in the warning context panel are buttons. Clicking one opens a compact,
readable detail dialog with:

- **time** (source timestamp or `DATA UNAVAILABLE`)
- **location** (real reported coordinates/distance, not a guessed place)
- **source** (NWS LSR, Spotter Network, or NSSL mPING)
- **report text** ( verbatim upstream notes/report )

The dialog is manually dismissible and adds no animation.

## Verification
`test-phase4e.mjs` asserts the popup fields, page wiring, mPING labelling, and
`DATA UNAVAILABLE` handling. Full gate passed.
