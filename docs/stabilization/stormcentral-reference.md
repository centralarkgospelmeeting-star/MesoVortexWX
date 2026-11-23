# StormCentral Reference Notes

Date: 2026-11-22  
Source reviewed: https://github.com/KingCreeper531/StormCentral (MIT, Copyright 2026 KingCreeper531)  
MesoVortexWX license: MIT (compatible). See `THIRD_PARTY_NOTICES.md`.

## Purpose

Use StormCentral as a **reference for guide/glossary/product-explanation patterns**, not a drop-in UI/content port. The reviewed snippet was a Spanish Pro-mode guide/tour/glossary covering products, tools, how-tos, and terminology.

## Data-Honesty / Capability Constraints

- MesoVortexWX must not document or present features as available when they are `UNAVAILABLE`, `PARTIAL` without clear scope, or unverified.
- `lib/radar/capability-matrix.ts` remains the single radar authority; other capability matrices/registries govern satellite, models, sounding, aviation/marine, etc.
- Any user-facing guide content must match verified current behavior. Unknown/unverified = `UNAVAILABLE`/not shown as working.

## What Can Be Reused (pattern level)

| StormCentral pattern | Reuse value | MesoVortexWX adaptation notes |
|---|---|---|
| Guide structure: Start/Products/Tools/How-to/Glossary/Tour | High | Good IA pattern. Only include sections backed by real MesoVortexWX features. |
| Product cards with "How to read it / Look for / How to use it" | High | Useful for radar/satellite/alerts. Must use MesoVortexWX units, sources, and limitations. |
| Glossary with short operational definitions | High | Reuse only terms relevant to implemented features; keep meteorological abbreviations clear. |
| Tour/onboarding flow | Medium | Only if MesoVortexWX has equivalent UI elements; avoid referencing missing controls. |
| Localization object shape | Medium | Can inform i18n structure, but MesoVortexWX currently has no app i18n/guide system. |

## Not Directly Portable (feature mismatch / verification risk)

| StormCentral feature/content | Status in MesoVortexWX (audit context) | Action |
|---|---|---|
| Pro data server-gated products | No equivalent verified Pro-server product gating/UI | Do not copy. |
| WarnGen / spotter-network warning issuance | Not implemented/verified | Do not copy. |
| 3D volume tool | Not implemented/verified; cross-section lib is synthetic | Do not copy. |
| Cross-section tool as real data | `lib/cross-section.ts` synthetic; no verified real cross-section | Do not copy as real. |
| Storm vector / TOA tools | Not verified as implemented | Do not copy unless verified. |
| Meteogram / multi-model compare / ensemble plume | Model registry mostly NEEDS_SOURCE/RESTRICTED; no verified end-to-end equivalent | Do not copy. |
| Level II decoded in-app full volume / PTDS / NROT claims | No verified MesoVortexWX raw Level II decoded moment pipeline; NROT unavailable | Do not copy. |
| Specific MRMS/satellite products claimed | Many unavailable/unverified in MesoVortexWX | Only include products present and verified in capability matrices. |

## Safe Reuse Checklist

1. **License/attribution:** preserve StormCentral MIT notice when copying/adapting content/code.
2. **Feature parity check:** every guide claim maps to a current MesoVortexWX route/component/capability-matrix entry.
3. **Data honesty:** label unavailable/partial features explicitly; no implied capability.
4. **Terminology:** keep units/abbreviations accurate; prefer MesoVortexWX naming.
5. **Verification:** UI review + tests/static checks for broken references to nonexistent features.

## Implemented Now

- Added StormCentral MIT attribution to `THIRD_PARTY_NOTICES.md`.
- Added this reference document. No StormCentral UI/content copied into runtime features.