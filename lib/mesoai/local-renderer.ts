/**
 * MesoAI deterministic local renderer.
 *
 * Maps structured observations and Layer 2 detections to plain language. It
 * never adds a detection, never upgrades confidence into an operational claim,
 * and never emits gated severe signatures. No network access is used here.
 */

import { getCatalogProduct } from '../radar/product-catalog';
import type { AnalysisMode, AnalysisRequest, AnalysisResult, Detection } from './types';
import { stableHash, truncate, unique } from './util';

/** Claims that require an independently verified gate-level detector. */
export const GATED_CLAIM_PATTERN =
  /\bTVS\b|tornado debris|debris signature|tornado on the ground|confirmed tornado|mesocyclone object|projected (?:storm )?path/i;

const STANDARD_CAVEAT =
  'MesoAI explains verified data. It is not an official rating, probability, warning, or replacement for meteorologists.';

/** Phrases that are only permitted when a matching detection exists. */
const CLAIM_GATES: Array<{ pattern: RegExp; required: string[]; anyOf?: boolean }> = [
  { pattern: /rotation|velocity couplet|gate[- ]to[- ]gate shear|\bnrot\b/i, required: ['det-couplet', 'det-nrot', 'det-shear'], anyOf: true },
  { pattern: /correlation coefficient|\brhohv\b|\bCC\b/i, required: ['det-rhohv'] },
  { pattern: /reflectivity|\bdbz\b|large hail/i, required: ['det-reflectivity', 'det-echo-coverage'], anyOf: true },
  { pattern: /lightning|flash density/i, required: ['det-lightning'] },
  { pattern: /spc categor|outlook categor/i, required: ['det-outlook'] },
  { pattern: /mesoscale discussion/i, required: ['det-mcd'] },
  { pattern: /flash flood warning/i, required: ['det-flash-flood'] },
];

/**
 * Rejects text that adds an unsupported feature, a gated severe claim, or an
 * operational claim. Used by both the local renderer (self-check) and the
 * optional model adapter (untrusted output check).
 */
export function validateAnalysisText(
  text: string,
  detections: Detection[],
  mode: AnalysisMode = 'storm'
): boolean {
  if (!text.trim()) return false;
  if (GATED_CLAIM_PATTERN.test(text)) return false;
  if (/MesoAI (?:issued|issues|upgraded|upgrades|confirmed|confirms)/i.test(text)) return false;

  const ids = new Set(detections.map((detection) => detection.id));
  const mentioned = Array.from(text.matchAll(/\bdet-[a-z0-9-]+/gi)).map((match) => match[0]);
  if (mentioned.some((id) => !ids.has(id))) return false;

  // Detection-specific claim gates apply only to storm analysis. Product,
  // warning, and model explanations intentionally describe catalog or official
  // product wording rather than a detection claim.
  if (mode !== 'storm') return true;

  for (const gate of CLAIM_GATES) {
    if (!gate.pattern.test(text)) continue;
    const hasRequired = gate.anyOf
      ? gate.required.some((id) => ids.has(id))
      : gate.required.every((id) => ids.has(id));
    if (!hasRequired) return false;
  }
  return true;
}

function detectionSentence(detection: Detection): string {
  const values = detection.values;
  const num = (key: string) => {
    const value = values[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  switch (detection.kind) {
    case 'strong-reflectivity-core': {
      const dbz = num('maxDbz');
      return `Sampled reflectivity reached ${dbz === null ? 'an unverified value' : `${dbz.toFixed(0)} dBZ`}.`;
    }
    case 'strong-echo-coverage': {
      const gates = num('gates50');
      return `${gates === null ? 'Sampled' : `${Math.round(gates).toLocaleString()} sampled`} gates were at or above 50 dBZ.`;
    }
    case 'velocity-couplet-screening': {
      const delta = num('coupletDeltaKt');
      return `Velocity-couplet screening found a peak difference of ${delta === null ? 'an unverified value' : `${delta.toFixed(0)} kt`} between adjacent samples.`;
    }
    case 'gate-to-gate-shear': {
      const shear = num('shearS1');
      return `Adjacent-radial shear was estimated at ${shear === null ? 'an unverified value' : `${shear.toFixed(4)} s⁻¹`}.`;
    }
    case 'normalized-rotation-proxy': {
      const nrot = num('nrot');
      return `NROT-style normalized rotation measured ${nrot === null ? 'an unverified value' : `${nrot >= 0 ? '+' : ''}${nrot.toFixed(2)}`}.`;
    }
    case 'lower-correlation-coefficient': {
      const rhohv = num('minRhohv');
      return `Minimum correlation coefficient was ${rhohv === null ? 'an unverified value' : rhohv.toFixed(2)}.`;
    }
    case 'lightning-density': {
      const count = num('flashCount');
      const minutes = num('minutes') ?? 5;
      const rate = num('flashesPerMinute');
      const cells = num('occupiedCells01Deg');
      const base = `${count === null ? 'A measured' : `${Math.round(count)}`} flash${count === 1 ? '' : 'es'} were measured in ${minutes.toFixed(0)} minutes.`;
      const detail = rate === null && cells === null
        ? ''
        : ` Derived from those points: ${rate === null ? 'an unavailable rate' : `${rate.toFixed(2)} flashes/min`}${cells === null ? '' : ` across ${Math.round(cells)} occupied 0.1-degree cells`}; this is not the official FED grid.`;
      return base + detail;
    }
    case 'spc-categorical-guidance':
      return `The Day ${values.day || '1'} SPC category at the site is ${String(values.category || 'unknown')}.`;
    case 'active-mesoscale-discussion': {
      const count = num('discussionCount');
      return `${count === null ? 'An' : `${Math.round(count)}`} active SPC mesoscale discussion${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} available for mesoscale context.`;
    }
    case 'active-official-warning':
      return `An active NWS warning is in effect near the site: ${String(values.events || 'unspecified event')}.`;
    case 'flash-flood-warning-context':
      return 'An active NWS flash flood warning is in effect near the site.';
    default:
      return `${detection.kind.replace(/-/g, ' ')} was recorded from ${detection.sourceRef}.`;
  }
}

function indicatorLabel(detection: Detection): string {
  const label = detection.kind.replace(/-/g, ' ');
  const evidence = detection.evidence[0] || detection.sourceRef;
  return `${label}: ${evidence} (${detection.confidence.toLowerCase()} confidence)`;
}

function commonCaveats(request: AnalysisRequest, detections: Detection[]): string[] {
  return unique([
    ...request.observations.flatMap((observation) => observation.caveats),
    ...detections.flatMap((detection) => detection.caveats),
    STANDARD_CAVEAT,
  ]);
}

function sourceList(request: AnalysisRequest, detections: Detection[]): string[] {
  return unique([
    ...request.observations.map((observation) =>
      `${observation.source}${observation.productCode ? ` (${observation.productCode})` : ''}`
    ),
    ...detections.map((detection) => detection.sourceRef),
  ]);
}

function stormAnalysis(request: AnalysisRequest, detections: Detection[]): Pick<AnalysisResult, 'headline' | 'explanation' | 'indicators'> {
  const has = (id: string) => detections.some((detection) => detection.id === id);
  let headline = 'No notable verified signals in the supplied data';
  if (has('det-warning')) headline = 'Active official warning near the site';
  else if (has('det-couplet') || has('det-nrot') || has('det-shear')) headline = 'Rotation / couplet screening concern';
  else if (has('det-reflectivity') || has('det-echo-coverage')) headline = 'Strong reflectivity sampled';
  else if (has('det-lightning')) headline = 'Lightning concentration observed';
  else if (has('det-outlook')) headline = 'Elevated categorical guidance';

  const rotationCaveat = (has('det-couplet') || has('det-nrot') || has('det-shear'))
    ? ' Rotation and shear values above are screening proxies, not an operational tornado or mesocyclone claim.'
    : '';
  const explanation = detections.length
    ? `${detections.slice(0, 8).map(detectionSentence).join(' ')}${rotationCaveat}`
    : 'Verified inputs did not cross the configured screening thresholds. No additional feature is inferred when a source is unavailable.';

  return { headline, explanation, indicators: detections.map(indicatorLabel) };
}

function productAnalysis(request: AnalysisRequest): Pick<AnalysisResult, 'headline' | 'explanation' | 'indicators'> {
  const product = request.product;
  if (!product) {
    return {
      headline: 'No product selected',
      explanation: 'Select a verified radar or composite product to see what it measures and where its data comes from.',
      indicators: [],
    };
  }
  const view = getCatalogProduct(product.key);
  const cap = view?.cap;
  if (!product.available) {
    return {
      headline: `${product.label} is unavailable`,
      explanation: product.reason || 'DATA UNAVAILABLE — no verified source is configured for this product.',
      indicators: [`Domain: ${product.domain}`, 'Verification: unavailable'],
    };
  }
  const details = [
    `${product.label} belongs to the ${product.domain} domain.`,
    cap ? `${cap.name} uses ${cap.source.provider}${cap.source.productCode ? ` (${cap.source.productCode})` : ''}.` : `${product.key} is listed in the verified product catalog.`,
    cap?.source.notes ? truncate(cap.source.notes, 360) : '',
    cap?.tiltSupport?.length ? `Tilt support: ${cap.tiltSupport.map((tilt) => `${tilt}°`).join(', ')}.` : '',
    cap ? `Catalog status: ${cap.availability}; verification ${cap.verification.level}.` : '',
  ].filter(Boolean);
  return {
    headline: `${product.label} — ${product.domain} product`,
    explanation: details.join(' '),
    indicators: unique([
      `Domain: ${product.domain}`,
      cap ? `Provider: ${cap.source.provider}` : null,
      cap?.source.productCode ? `Product code: ${cap.source.productCode}` : null,
      cap ? `Verification: ${cap.verification.level}` : null,
      product.warning || null,
    ]),
  };
}

function warningAnalysis(request: AnalysisRequest): Pick<AnalysisResult, 'headline' | 'explanation' | 'indicators'> {
  const warning = request.warning;
  if (!warning) {
    return {
      headline: 'No warning selected',
      explanation: 'Select an active NWS alert to see its official wording and threats. MesoAI never issues or upgrades a warning.',
      indicators: [],
    };
  }
  const threats = [
    /tornado/i.test(warning.event) ? 'tornado' : null,
    /hail/i.test(warning.event) ? 'hail' : null,
    /wind/i.test(warning.event) ? 'wind' : null,
    /flood/i.test(warning.event) ? 'flooding' : null,
    /winter|snow|ice/i.test(warning.event) ? 'winter precipitation' : null,
  ].filter(Boolean);
  const explanation = [
    `The NWS ${warning.category || 'product'} "${warning.event}" for ${warning.areaDesc || 'the selected area'} states: ${truncate(warning.headline || warning.event, 320)}.`,
    warning.description ? truncate(warning.description, 420) : '',
    threats.length ? `The official product names these threats: ${threats.join(', ')}.` : '',
    warning.instruction ? `Recommended awareness actions from the product: ${truncate(warning.instruction, 320)}` : 'Follow the instructions in the latest official NWS product.',
    'This restates an official NWS product. MesoAI did not issue or upgrade it, and warnings can change.',
  ].filter(Boolean).join(' ');
  return {
    headline: `${warning.event} · ${warning.category || 'official product'}`,
    explanation,
    indicators: unique([
      `Category: ${warning.category || 'unknown'}`,
      `Severity: ${warning.severity || 'unknown'}`,
      `Area: ${truncate(warning.areaDesc || 'not supplied', 160)}`,
      warning.sent ? `Issued: ${warning.sent}` : null,
    ]),
  };
}

function modelAnalysis(request: AnalysisRequest): Pick<AnalysisResult, 'headline' | 'explanation' | 'indicators'> {
  const models = request.models ?? [];
  if (models.length === 0) {
    return {
      headline: 'No verified model fields supplied',
      explanation: 'Model comparison requires verified field data. No numeric forecast values are invented when a field endpoint is unavailable.',
      indicators: [],
    };
  }
  const ready = models.flatMap((model) => model.fields.filter((field) => field.status === 'READY_NOW'));
  const explanation = [
    `Compared ${models.length} configured guidance models.`,
    `${ready.length} field${ready.length === 1 ? '' : 's'} are marked READY_NOW; the remaining fields are unavailable in the verified catalog.`,
    'No numeric forecast values were supplied by verified field endpoints, so this comparison describes source availability and verification only.',
    'Model guidance is not observation. Differences between models describe uncertainty, not consensus truth.',
  ].join(' ');
  return {
    headline: 'Model guidance availability comparison',
    explanation,
    indicators: models.map((model) => {
      const available = model.fields.filter((field) => field.status === 'READY_NOW').length;
      return `${model.label}: ${available}/${model.fields.length} verified fields`;
    }),
  };
}

/** Builds a deterministic analysis result from structured input only. */
export function renderLocalAnalysis(request: AnalysisRequest, detections: Detection[]): AnalysisResult {
  const base: AnalysisResult = {
    id: stableHash({
      renderer: 'local',
      mode: request.mode,
      site: request.site,
      generatedAt: request.generatedAt,
      observations: request.observations,
      detections,
      product: request.product,
      warning: request.warning,
      models: request.models,
    }),
    mode: request.mode,
    headline: '',
    explanation: '',
    indicators: [],
    caveats: commonCaveats(request, detections),
    detections,
    renderer: 'local',
    sources: sourceList(request, detections),
    generatedAt: request.generatedAt,
  };

  const rendered = request.mode === 'storm'
    ? stormAnalysis(request, detections)
    : request.mode === 'product'
      ? productAnalysis(request)
      : request.mode === 'warning'
        ? warningAnalysis(request)
        : modelAnalysis(request);

  const combined = `${rendered.headline} ${rendered.explanation}`;
  if (!validateAnalysisText(combined, detections, request.mode)) {
    return {
      ...base,
      headline: 'Analysis withheld — unsupported claim rejected',
      explanation: 'The generated explanation contained an unsupported claim, so MesoAI returned only the structured detections and source caveats.',
      indicators: detections.length ? detections.map(indicatorLabel) : [],
    };
  }

  return { ...base, ...rendered };
}
