# Sprint 3 - MESH Validation

Date: 2026-11-22

## Question / Evidence

| Check | Result | Evidence |
|---|---|---|
| Source responds? | Yes | IEM MRMS TMS `mrms::MESH/7/33/50.png` -> 200 PNG, 20229 bytes, `image/png`. `mrms::MESH_Max60min/7/33/50.png` -> 200 PNG, 20229 bytes. |
| Is product actually MESH? | **Unverified** | Endpoint name suggests MESH, but no legend/metadata/units verified from this path. Same-byte response for MESH and MESH_Max60min at sampled tile is suspicious; insufficient to confirm semantics. |
| Metadata correct? | **Unverified** | No IEM TMS metadata/legend endpoint verified in this pass. |
| Timestamp correct? | **Unverified** | No timestamped MRMS TMS variant identified. `mrms-t` probe 404 on sample; no Last-Modified header observed. |
| Archive available? | **No evidence** | No timestamped/archive URL pattern verified for MRMS MESH on IEM TMS. |
| Playback possible? | **No evidence** | Without verified archive timestamps, playback cannot be honestly implemented. |
| Legend available? | **Unverified** | No verified legend source integrated. |

## Determination

**UNAVAILABLE** (no middle ground). 

Rationale: source candidate exists, but required end-to-end verification (identity, metadata, timestamp, archive, playback, legend) is incomplete. Capability matrix keeps MESH unavailable with reason "source candidate exists but end-to-end verification/integration is incomplete".
