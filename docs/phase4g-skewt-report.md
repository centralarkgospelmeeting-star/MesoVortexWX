# Phase 4G — Skew-T Report

`components/sounding/AtmosphericAnalysisPanel.tsx` renders a dark-theme Skew-T /
log-P canvas from real sounding levels: temperature (red), dew point (green),
pressure grid (200–1000 mb), and a real parcel-path calculation based on
measured temperature/dew point and height. It is resizable and exports a composed
PNG containing both the Skew-T and hodograph.

Missing level data is not plotted, and all derived parameters that require
missing inputs read `DATA UNAVAILABLE`. No default LCL/LFC/EL or CAPE is shown.

The panel is intentionally compact and dockable within the Forecaster Workspace;
it is not a splash screen or modal interruption.
