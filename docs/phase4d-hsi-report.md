# Phase 4D — Hazard Severity Index Report

## Replacement
`Weather Intensity Score` was replaced everywhere (code, UI, docs, tests) by
**Hazard Severity Index (HSI)**. The legacy module/panel were removed; MesoAI
uses the canonical `lib/hazard-severity.ts`.

## Scales
National (United States HSI), Regional (Central Plains HSI), State (Arkansas HSI),
Local (Pulaski County HSI), and Custom (emergency-manager drawn operational area).
Scale selection changes the area label and alert scope; no geographic region is
hidden from the underlying feed.

## Display and honesty
- HSI 0–100 with **Low 0–19 / Elevated 20–39 / Significant 40–59 / Major 60–79 / Extreme 80–100**.
- Confidence is computed from available inputs; missing components reduce it and
  the panel shows `DATA INCOMPLETE` rather than a confident-looking band.
- All listed future inputs (CAPE, shear, SRH, probabilities, flood/winter/tropical
  impacts, population exposure) are typed as optional and stay `null` until a
  verified adapter exists. No value is fabricated.
- Custom HSI requires a drawn polygon; without one the panel shows `DATA INCOMPLETE`.

## Visual system
Dark navy surface, light blue accents, gray hierarchy, warning colors for the
bands, and a subdued archived-radar backdrop explicitly labelled "not live data
or an HSI input". This is a distinct MesoVortexWX visual language, not a copied
product card.

## Future-ready
Emergency Management Mode and Custom Area HSI are prepared through the custom
polygon scope and profile architecture; they are not claimed as implemented modes.
