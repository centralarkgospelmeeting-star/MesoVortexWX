# MesoAI Architecture Specification

Date: 2026-11-24  
Project: MesoAI for MesoVortexWX  
Status: design specification; not a release certification.

## Purpose and boundaries

MesoAI is a built-in weather analysis system for MesoVortexWX. Its job is to turn already-verified weather data and deterministic detections into plain-language explanations. It is not a general-purpose chatbot, not an operational warning service, and not a replacement for meteorologists.

The system must remain:

- free and open source;
- community driven;
- available on web, desktop, and mobile;
- vendor independent;
- honest about source, verification, and uncertainty.

The AI must not self-modify in production. It may save analyses, outcomes, and feedback for later human-reviewed improvement of algorithms, prompts, and training data.

## Confirmed implementation decisions

- Plain-language output uses a deterministic local template engine first.
- An optional Qwen-compatible endpoint may be enabled through environment variables. If it is not configured, the system fails closed to local templates. No API key is committed.
- Tornadic Vortex Signature (TVS) and debris-signature indicators are hidden until a verified gate-level algorithm exists. Provisional rotation, velocity-couplet, gate-to-gate shear, and correlation-coefficient caveats may be shown with explicit uncertainty.
- No unverified product, model, or provider is enabled merely to feed MesoAI.

## Layer 1 — Weather Data Engine

This layer gathers and normalizes data from existing authoritative paths. It does not replace providers or invent sources.

| Domain | Existing source path used by MesoAI | Normalized role |
|---|---|---|
| NEXRAD Level II | `app/api/radar/volume`, `/api/radar/cross-section`, `/api/radar/storm-analysis`, Level II header/probe routes | Single-radar measured gates, elevation sweeps, derived scan statistics |
| NEXRAD Level III | `app/api/nexrad/frames`, IEM RIDGE raster path | Single-site raster products and scan metadata |
| MRMS | `/api/radar/mrms-tile` and severe-capability entries | National mosaics, rotation tracks, hail products, QPE |
| SPC Mesoanalysis | SPC outlook/MCD routes | Environmental and categorical risk context |
| NWS Alerts | `/api/alerts`, `/api/warnings`, `/api/watches` | Active warnings and watches |
| HRRR / RAP / GFS / NAM | Existing model catalog and field endpoints | Guidance comparison only; not observations |
| Satellite | Existing GOES/ABI selection endpoints | Cloud/topology and temperature-scale context |
| Lightning | `/api/lightning/glm` | Flash density and trend input |
| Local observations | METAR, buoy, marine, LSR/spotter routes | Surface verification context |

Normalization rules:

1. Preserve source type, provider, product code, verification level, and timestamp.
2. Label single-radar, national composite, MRMS, QPE, hydrology, satellite, model, and observation domains explicitly.
3. Fail closed when a source is unavailable; never substitute synthetic data for a missing observation.
4. Keep all data in a structured `WeatherObservation` shape; the language layer never receives raw imagery as its authoritative input.

## Layer 2 — Meteorological Detection Engine

This layer makes deterministic scientific decisions. It is the only layer allowed to claim that a feature was detected.

### Implemented or available from the current app

- Rotation and velocity-couplet screening from single-radar Level II scan analysis (`/api/radar/storm-analysis`).
- Gate-to-gate / adjacent-radial shear proxies with documented thresholds and quality flags.
- Correlation-coefficient and dual-pol summaries where measured moments exist.
- Reflectivity statistics and hail-size indicators from measured gates and MRMS hail products.
- Echo-top and reflectivity-trend inputs where their capability entries are verified.
- QPE and flash-flood context from national QPE/MRMS products; soil saturation and flash-flood guidance remain conditional on verified source availability.
- Lightning density and trend from GLM.
- Active warning/watch association from NWS alerts.
- Storm growth and strengthening from verified reflectivity/echo-top/lightning trends.

### Gated / not shown

- TVS detection: hidden until a verified gate-level algorithm exists.
- Debris signature detection: hidden until a verified CC/velocity algorithm exists.
- Mesocyclone object tracking: not claimed from the MRMS rolling rotation raster.
- Projected storm paths: not claimed.
- Archive playback for live-only products: not claimed.

Every detector emits:

```ts
type Detection = {
  id: string;
  kind: string;
  domain: 'RADAR' | 'COMPOSITE' | 'MRMS' | 'QPE' | 'SATELLITE' | 'MODEL' | 'OBSERVATION' | 'ALERT';
  sourceRef: string;
  observedAt: string;
  confidence: 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';
  evidence: string[];
  values: Record<string, number | string | boolean | null>;
  caveats: string[];
  operationalClaim: false;
};
```

## Layer 3 — MesoAI Analysis Engine

The analysis engine receives structured weather information, not raw imagery.

Example input:

```json
{
  "rotationDetected": true,
  "gateToGateShear": 82,
  "ccMinimum": 0.74,
  "mesh": 2.1,
  "stormMotion": "NE 42 mph"
}
```

Example local output:

> Strong low-level rotation is present within this storm. A weakening correlation coefficient should be monitored. Large hail exceeding two inches appears possible.

### Local renderer

The local renderer is deterministic and testable. It maps `Detection[]` plus context to:

- a short headline;
- a plain-language explanation;
- a list of supporting indicators;
- uncertainty and caveat text.

It never upgrades `LOW`/`MODERATE` confidence to an operational warning, and it never adds a detection that is absent from Layer 2.

### Optional Qwen-compatible renderer

Configuration is environment-only:

- `MESOAI_BASE_URL` — OpenAI-compatible chat endpoint;
- `MESOAI_MODEL` — default `qwen2.5` family model identifier;
- `MESOAI_API_KEY` — optional key, never committed;
- `MESOAI_ENABLED` — explicit opt-in.

Behavior:

1. If not explicitly enabled or misconfigured, use the local renderer.
2. Send only structured detections and source metadata, never raw radar imagery.
3. Force a strict system prompt: explain, do not warn; do not invent detections; cite source labels; preserve caveats.
4. Validate returned text against the input detection IDs. Reject output that adds unsupported claims, then fall back to local text.
5. Cache by a hash of the structured input and model identifier.

Future Qwen family successors can replace `MESOAI_MODEL` without changing the architecture.

## Layer 4 — National Weather Watcher

The Watcher continuously scans active weather across supported regions and emits deduplicated, time-bounded summaries.

Example output:

> Rotation has increased within a storm west of Little Rock over the last fifteen minutes.

Rules:

- Scan only data sources already enabled by capability gating.
- Deduplicate by storm/source/track key; do not treat the MRMS raster as object tracks.
- Rank by severity indicators, confidence, and recency.
- Rate-limit summaries so repeated identical detections do not flood the UI.
- Mark every summary with sources, observation time, and uncertainty.
- No TVS, debris, or projected-path summaries until those detectors are verified.

## User features

### Analyze Storm

Clicking a storm returns:

- hail potential;
- tornado potential expressed as rotation/couplet concern, not an operational tornado claim;
- flood potential;
- rotation trend;
- lightning trend;
- storm evolution;
- MesoAI summary.

### Explain Product

Selecting a product returns what it measures, how it works, how to interpret it, why it matters, and its source domain. This reuses the shared product catalog and capability matrix.

### Explain Warning

Selecting a warning returns why it was issued, main threats, confidence, and recommended awareness actions. It must restate the official NWS product and must not imply MesoAI issued or upgraded the warning.

### Model Analysis

A comparison of HRRR, RAP, GFS, and NAM uses only verified fields. It is labeled as model guidance, not observation, and disagreements are described as uncertainty rather than consensus truth.

## Learning strategy

MesoAI must not self-modify in production.

Stored for later review:

- structured detection input;
- local and optional model output;
- outcome labels supplied by humans or verified later;
- user feedback;
- source/provider and timestamp.

Improvement loop:

1. human review of saved analyses;
2. update deterministic thresholds or prompts in source control;
3. add tests and capability evidence;
4. release through normal review.

No automatic threshold mutation, prompt rewriting, weight update, or model fine-tuning occurs in the running app.

## Relationship to banner simplification

The top banner becomes a compact, spectrum-first control. Product/source prose moves to hover meaning inside the spectrum and to the existing product drawer. MesoAI explanations are opened on demand from the spectrum/storm/warning surfaces rather than occupying permanent banner space.

The Hazard Severity Index (HSI) is a compact, deterministic composite hazard ranking built only from verified Layer 2 inputs. Unavailable components reduce confidence and are reported as `DATA INCOMPLETE`. HSI is not an AI-generated probability, not an official severity rating, and not a warning.

## Verification requirements

Before any MesoAI surface is enabled:

- static contract tests for detection schema and source gating;
- local renderer tests with no network access;
- optional adapter tests with mocked responses;
- rejection tests for unsupported claims;
- `npm run typecheck`, `npm run test:verify`, `npm run build`;
- DOM/browser evidence for user-facing surfaces.

## Roadmap

### Phase M1 — UI and score foundation

- remove standalone product info box;
- compact spectrum-only banner;
- Hazard Severity Index (HSI) panel;
- deterministic HSI inputs and confidence indicators;
- this architecture spec.

### Phase M2 — Detection engine

- normalize detections from existing endpoints;
- implement local renderer;
- add Analyze Storm, Explain Product, Explain Warning, and Model Analysis using structured data.

### Phase M3 — Watcher and optional Qwen adapter

- continuous scan and deduplicated summaries;
- optional Qwen-compatible renderer with strict validation and fallback;
- saved analyses, outcomes, and feedback.

### Phase M4 — Verified severe signatures

- only after independent verification: TVS, debris, mesocyclone object tracking, and trend/archive workflows.
