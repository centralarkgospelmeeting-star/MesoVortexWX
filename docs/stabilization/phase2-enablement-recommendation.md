# Phase 2 - Product Enablement Recommendation

Date: 2026-11-22

## Task 3 - Single Best Candidate Selection

**Recommendation: NO product is ready for enablement now.**  
If forced to pick a *next investigation target* (not enablement), choose **Echo Tops (NET/EET)** over MESH, but only as an evidence-gathering candidate.

## Why No Enablement

The capability matrix requires end-to-end verification before WORKING status. No unavailable product currently satisfies:
- verified source in our pipeline
- verified archive
- verified playback/timestamps/frame integrity
- verified units
- verified legend
- end-to-end API/UI/capability-matrix agreement

## Candidate Comparison

| Candidate | Confidence | Why | Blocking Gaps |
|---|---|---|---|
| Echo Tops (NET/EET) | Low-Medium | Official NEXRAD Level III product (41/135); IEM documents NET; composite nexrad-net rolling offsets observed | json/radar did not list NET for sampled site; ridge timestamped archive 503; single-site vs composite semantics; units/legend/end-to-end not verified |
| MESH (MRMS) | Low | Official MRMS product with clear units (mm); tiles respond 200 | Timestamp/archive probes ambiguous (same bytes for fabricated paths); no verified legend/metadata; no trustworthy archive/playback; MRMS pipeline not verified end-to-end |
| VIL (DVL) | Low | Official NEXRAD product, clear units (kg/m^2) | DVL/NVL 503 sampled; no verified source path |

## Decision

- **Enable now:** none.
- **Next investigation only:** Echo Tops, with strict gate: authoritative units/legend, source semantics (ridge vs composite), multi-day archive probe, timestamp/frame integrity, end-to-end wiring. If any gate fails, remain UNAVAILABLE.
