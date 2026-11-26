# Phase 4G — Cross-Section Report

## Audit
- **Synthetic (removed)**: `lib/cross-section.ts` derived a "cross section" from
  sampled raster tiles and labelled itself `dataHonesty: 'SYNTHETIC'`. It was
  unused and has been deleted so it cannot be presented as real data.
- **Real (retained)**: `app/api/radar/cross-section/route.ts` samples genuine
  NEXRAD Level II sweeps via `fetchLevel2Frame`, applies 4/3-earth beam geometry,
  and returns gates actually intersected by the transect. The existing
  `CrossSectionModal` states when no valid gates are present and displays no
  synthetic echoes.

## Usable status
The real cross-section is usable only where Level II volume data is available for
the selected radar; otherwise it reports unavailable. No synthetic echo, hail
size, or storm-top claim is produced.

## Verification
`test-phase4g.mjs` asserts the synthetic module is gone and the live route uses
`fetchLevel2Frame`. Full gate passed.
