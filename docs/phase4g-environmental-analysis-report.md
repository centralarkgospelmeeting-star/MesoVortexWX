# Phase 4G — Environmental Analysis Report

`lib/sounding/analysis.ts` computes parameters strictly from real sounding levels:

| Parameter | Status |
|---|---|
| SBCAPE, CIN, LCL, LFC, EL, LI | Computed from real parcel ascent when temperatures/heights exist. |
| SRH 0–1 / 0–3 km, 0–6 km shear, storm motion | Computed from real wind levels. |
| EHI, STP | Derived only when their real inputs exist. |
| MLCAPE, MUCAPE, DCAPE, PWAT, SCP | `DATA UNAVAILABLE` — no source-provided or verified computation in this build. |
| Freezing level / WBZ height | Crossing heights from real temperature/dew point profiles. |

No `0` placeholder, latitude formula, or fallback multiplication is used for a
missing parameter. Broadcast preparation uses larger, cleaner labels in the
panel but adds no new data product.

The Forecaster Workspace menu action docks Radar and Satellite panes alongside
the analysis panel and persists its on/off state locally.
