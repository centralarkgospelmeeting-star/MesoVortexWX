# Sprint 4 - NET Archive Report

Date: 2026-11-22

## Task 2 - Archive Support

| Test | Result | Evidence |
|---|---|---|
| Single-site ridge NET timestamped archive | 503 / no data on sampled timestamps | `ridge::SITE-NET-<stamp>` for LZK/TLX/FWS/LWX/OKX at -15/-30/-60/-120m returned 503, 0B |
| Single-site ridge NET live | 200 PNG 334B on sampled sites | `NET-0` returned 334B (empty sample) |
| Composite TMS rolling offsets | Partial/rolling evidence | `nexrad-net-m05m..m50m` 200 PNG with varying sizes; `m55m` 404 |
| Deep archive verified | No | No verified deep timestamped archive for single-site ridge NET; composite offsets only suggest short rolling window |

## Classification

**LIVE ONLY / UNVERIFIED ARCHIVE** for end-to-end product enablement. 

Rationale: timestamped single-site ridge NET archive returned 503 in samples; composite rolling offsets exist but do not establish verified, honest, deep archive/playback semantics for the enabled radar product contract.
