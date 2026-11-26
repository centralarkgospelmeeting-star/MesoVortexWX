# Phase 4G — Hodograph Report

The hodograph canvas plots the real wind path from sounding levels (u/v from
reported direction and speed) with radius rings. Layer diagnostics use real
0–1 km and 0–3 km winds for storm-relative helicity, and 0–6 km winds for bulk
shear and a Bunkers-style right-mover approximation.

All values are `null` when a required wind level is missing; the UI prints
`DATA UNAVAILABLE`. Corfidi vectors, effective inflow layer, interactive
inspection, and left-moving motions remain `UNAVAILABLE` in the capability matrix.

The Skew-T and hodograph are available side-by-side in the same resizable panel.
