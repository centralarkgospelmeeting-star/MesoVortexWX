# Phase 4D — Observation System Report

## Unified toggle
One **OBSERVATIONS** toggle (default on) plots every supported observation network
in one canonical feed: METAR, SPECI, ASOS/AWOS, IEM Mesonet, atmowx PWS, NDBC
buoys and marine stations. Advanced network-specific controls remain in the
Surface panel and Settings.

## Duplicate handling
`SURFACE_SOURCE_PRIORITY` resolves duplicate station IDs by source priority
(METAR > SPECI > ASOS > AWOS > Mesonet > PWS > buoy/marine) with freshness and
station-ID tie-breaks. The highest-priority real report is plotted; duplicates
are not drawn twice.

## Global display
The request bbox follows the camera: whole world at overview zoom, zoom-scaled
region when zoomed in. Screen-space declustering draws one compact density badge
per cell when zoomed out and full workstation station models at high zoom.
No region is filtered out and no value is invented.

## Honest status
Weather Underground, Tempest, Davis, realtime COOP, and vendor-only PWS feeds
remain `DATA UNAVAILABLE` until verified. Missing fields render as
`DATA UNAVAILABLE`; humidity is explicitly labelled derived.
