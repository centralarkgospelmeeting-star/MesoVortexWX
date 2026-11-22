# Sprint 3 - Echo Tops Validation

Date: 2026-11-22

## Question / Evidence

| Check | Result | Evidence |
|---|---|---|
| What exact product is NET? | **Candidate: NEXRAD Echo Tops (NET)** | IEM TMS service list includes `nexrad-net` and `nexrad-net-m05m..m50m`; `nexrad-eet` variants also present. Composite `nexrad-net/7/33/50.png` returned 200 PNG (973 bytes); `nexrad-net-m30m` returned 200 PNG (1011 bytes), different size suggesting time-offset frame. |
| Is it Echo Tops? | **Likely, not fully end-to-end verified** | Naming and IEM service family strongly suggest Echo Tops; units/legend/product semantics not fully verified in rendering pipeline. |
| Are units verified? | **No** | No legend/units verification performed end-to-end. |
| Is archive available? | **Partial evidence** | Time-offset TMS variants exist (`m05m..m50m`) and respond; not verified as real historical archive semantics across full required window/sites. |
| Can playback work? | **Potentially, not verified** | Time-offset variants suggest possible frames; end-to-end playback, timestamp integrity, and UI integration not verified. |
| Single-site ridge NET? | Mixed | `ridge::LZK-NET-0/7/33/50.png` returned 200 PNG but 334 bytes (empty/transparent tile sample); `EET` 503 in same probe. |

## Determination

**Remains UNAVAILABLE** (candidate only). 

Promote to candidate in documentation/matrix evidence, but not enabled in product catalog/UI. Before WORKING: verify exact product semantics, units/legend, timestamp/archive integrity, playback behavior, and end-to-end rendering through capability matrix.
