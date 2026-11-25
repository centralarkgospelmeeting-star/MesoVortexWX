# Phase 4A — Verification log

All commands were run from the repository root with Node v20.20.2 on 2026-11-24. Results below are the observed terminal/browser output from the verification run; they are summarized here as evidence for `docs/phase4a-audit-delta-report.md`.

## Static verification

### `npm run typecheck`

Exit code 0. No TypeScript errors after the final `RadarMap` callback-order fix.

### `npm run test:verify`

Exit code 0. All 13 guards passed:

- capability matrix — `Checked 27 capability entries`, `PASS`
- satellite capability matrix — `Checked 31 satellite capability entries`, `Checked 11 bird/sector probe and URL combinations`, `PASS`
- observation capabilities — `Checked 43 observation capability entries`, `PASS`
- severe capabilities — `Checked 43 severe capability entries`, `PASS`
- aviation/marine capabilities — `Checked 23 aviation/marine capability entries`, `PASS`
- platform capabilities — `Checked 72 platform capability entries`, `PASS`
- sounding capabilities — `Checked 251 sounding capability entries`, `PASS`
- radar render config and map integrity — `PASS: radar render config and map integrity contract`
- fake-data guards — `PASS: fake-data guards (90 API/lib files; index.html, app/api/copilot/**, and radar frame time checks scanned)`
- archive integrity — `PASS: archive integrity (2 dataset(s) validated, framework smoke test ok)`
- capability consistency — `Checked 509 capability entries across 6 files`, `PASS: capability wording matches radar matrix`
- alert integrity — `PASS: alert correctness and single-audio-dispatcher contract`
- legend integrity — `PASS: product legend and metadata accessor contract`

`npm run test:verify` is a static contract suite, not an end-to-end live-data verification.

### `npm run build`

Exit code 0. Next.js 14.2.15 reported:

- `✓ Compiled successfully`
- `✓ Linting and checking validity of types`
- `✓ Generating static pages (5/5)`
- Route table generated for `/`, `/_not-found`, and all API routes.

## Browser capture

Screenshots were captured by Playwright using `/usr/bin/google-chrome` in headless mode at viewport 1600×1000, against the local Next.js dev server on port 3200 after the fixes were running. The eight PNGs are in `docs/phase4a-screenshots/`.

DOM readbacks captured at the same time as the screenshots:

- Baseline reflectivity banner: `PRODUCT INFORMATION | Reflectivity | Current production path uses N0B-family digital reflectivity... | REFLECTIVITY SCALE (DBZ)`
- MESH banner: `PRODUCT INFORMATION | MESH | National MRMS MESH estimate; the tile is the current 2D grid, not a time-maximum swath. | MESH SCALE (IN)`
- QPE banner: `PRODUCT INFORMATION | Precipitation / QPE | National 1-hour accumulation estimate; grid is not a single-site radar product. | QPE ACCUMULATION SCALE (MM)`
- Warning/watch toggles before interaction: `true true`; after interaction: `false true`.
- Alert settings: DOM contained `Alert Settings` when the panel was opened.
- Satellite banner: `PRODUCT INFORMATION | Visible (Ch 02 Red) | Daytime cloud imagery | TEMPERATURE / IMAGERY SCALE`
- Static archive text: `STATIC ARCHIVE — NOT FOR OPERATIONAL USE. This legacy file is a non-interactive landing shell only.`

No JavaScript `pageerror` events were observed during the capture session.

## Post-review closure re-verification

After the independent review findings were addressed, the full suite was re-run:

- `npm run typecheck` — exit 0, no errors.
- `node scripts/test-alert-integrity.mjs` — PASS. The guard now also requires gesture re-unlock for stored arming and checks specific alert-selection paths.
- `node scripts/test-satellite-capability-matrix.mjs` — PASS (31 capability entries, 11 probe/URL combinations). The guard now also requires the mesoscale entry to be `PARTIAL`, forbids an `unavailableReason` there, and rejects stale `0/0/0` ABI evidence.
- `npm run test:verify` — exit 0; all 13 guards PASS.
- `npm run build` — exit 0; `✓ Compiled successfully`, `✓ Generating static pages (5/5)`.

## Final clean-load smoke check

After that production build, the dev server was restarted so the browser loaded from a fresh `.next` state. A fresh headless Chrome page loaded `http://localhost:3200/?phase4a=final-smoke` with hydrated JavaScript and produced:

- document title: `MesoVortexWX | Weather Radar`
- reflectivity banner as shown above
- `pageErrors: []`
- `consoleErrors: []`
- `badResponses: []`

Earlier capture runs did observe a pre-existing `404` from `/api/spotters/reports`; it is outside the P0 scope of this delta and was not present in the final clean load.
