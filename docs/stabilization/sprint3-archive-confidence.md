# Sprint 3 - Archive Confidence Testing

Date: 2026-11-22
Method: Automated probe script `scripts/probe-radar-archive.mjs`. Probes IEM RIDGE timestamped tile URLs (`ridge::SECTOR-PROD-STAMP/7/33/50.png`) with 8s timeout. OK = HTTP 200 + PNG magic. 

Coverage per product: 10 sites x 9 timestamp offsets (15,30,60,120,180,360,720,1440,2880 minutes ago), 5-minute UTC-aligned stamps. Total 90 samples/product. Timestamps span ~15m to 2 days back (multiple time windows/days relative to run time).

## Results

| Product | Code | Sites | Samples | OK | Hit Rate | Classification | Evidence |
|---|---|---:|---:|---:|---:|---|---|
| Reflectivity (NEXRAD) | N0B | LWX,LZK,TLX,MHX,FWS,RTX,OKX,DVN,AMA,PBZ | 90 | 14 | 15.6% | **PARTIAL_ARCHIVE** | Real archived tiles observed, but sparse/inconsistent |
| Base Velocity (NEXRAD) | N0U | same 10 NEXRAD | 90 | 0 | 0.0% | **LIVE_ONLY** | No archived tile hits in sampled window |
| Storm Relative Velocity | N0S | same 10 NEXRAD | 90 | 12 | 13.3% | **PARTIAL_ARCHIVE** | Real archived tiles observed, but sparse/inconsistent |
| TDWR Reflectivity | TZL | TDFW,TATL,TORD,TMSP,TPHX,TLAS,TMIA,TDEN,TDTW,TCLT | 90 | 0 | 0.0% | **LIVE_ONLY** | No archived tile hits in sampled window |
| TDWR Velocity | TV0 | same 10 TDWR | 90 | 0 | 0.0% | **LIVE_ONLY** | No archived tile hits in sampled window |

## Capability Matrix Updates

- `ref`: archiveSupport/playbackSupport -> `PARTIAL_ARCHIVE`; evidence updated with probe.
- `vel`: archiveSupport -> `NONE`, playbackSupport -> `LIVE_ONLY`; evidence updated.
- `srvel`: archiveSupport/playbackSupport -> `PARTIAL_ARCHIVE`; evidence updated.
- TDWR archive evidence recorded in `ref`/`vel` notes (TZL/TV0 0/90).

## Caveats

- Single automated run; results can vary by time, site, IEM cache behavior, and tile location. Sparse != absent forever, but insufficient for REAL_ARCHIVE confidence.
- Classification rule used for evidence: >=70% REAL_ARCHIVE, >0% PARTIAL_ARCHIVE, 0% LIVE_ONLY.
- Endpoints generate archive frames only for REAL_ARCHIVE/PARTIAL_ARCHIVE products and never fabricate missing frames.
