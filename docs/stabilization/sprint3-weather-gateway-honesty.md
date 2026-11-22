# Sprint 3 - Weather Gateway Honesty Audit

Date: 2026-11-22
Scope: `lib/adapters/weather-gateway.ts`, `app/api/weather/hyperlocal/route.ts`, `components/HyperlocalDashboardModal.tsx`

## Findings

| Question | Answer | Evidence |
|---|---|---|
| Is fabricated data returned? | **Yes (before fix)** | `fallbackObservation` fabricated tempF=72, feelsLikeF=72, dewPointF=55, wetBulbF=62, humidityPct=50, pressureInHg=29.92, pressureMb=1013, wind 5/10kt@180, visibility 10mi, condition "Fair", provider OPEN_METEO. Minutely precip fabricated as four zero-probability/zero-amount bins. |
| Can users see it? | **Yes** | `/api/weather/hyperlocal` returned the telemetry to `HyperlocalDashboardModal`, which rendered observation values directly. |
| Can it be mistaken for real observations? | **Yes** | Values looked plausible and were not labeled unavailable/fabricated. |

## Remediation

- Removed `fallbackObservation` and fabricated minutely zeros from `lib/adapters/weather-gateway.ts`.
- Gateway now returns `{ available: false, reason: 'DATA UNAVAILABLE - ...', observation: null, minutely: [], minutelyAvailable: false }` when no real sources respond or core real fields are insufficient.
- Merge uses real NWS/Open-Meteo fields only; no synthetic baseline.
- `/api/weather/hyperlocal` returns explicit availability/reason and backward-compatible flat fields only when `available === true` with real observation.
- `HyperlocalDashboardModal` now renders an explicit DATA UNAVAILABLE state when telemetry is unavailable.

## Data-Honesty Status

**PASS after remediation** - no silent fallback/fabricated observation in this path.
