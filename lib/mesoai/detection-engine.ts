/**
 * MesoAI Meteorological Detection Engine.
 *
 * Deterministic, source-scoped detectors. This is the only layer allowed to
 * claim a feature was detected, and every emitted detection carries evidence,
 * caveats, and operationalClaim: false. Gated severe signatures are never
 * constructed here.
 */

import type { Detection, DetectionConfidence, WeatherObservation } from './types';
import { finiteNumber } from './util';

const UNKNOWN_TIME = 'UNKNOWN';

function emit(
  observation: WeatherObservation,
  kind: string,
  id: string,
  confidence: DetectionConfidence,
  evidence: string[],
  values: Record<string, number | string | boolean | null>,
  caveats: string[]
): Detection {
  return {
    id,
    kind,
    domain: observation.domain,
    sourceRef: `${observation.source}${observation.productCode ? ` / ${observation.productCode}` : ''}`,
    observedAt: observation.observedAt || UNKNOWN_TIME,
    confidence,
    evidence,
    values,
    caveats,
    operationalClaim: false,
  };
}

function radarDetections(observation: WeatherObservation): Detection[] {
  if (observation.domain !== 'RADAR' || observation.verification === 'UNAVAILABLE') return [];
  const found: Detection[] = [];

  const dbz = finiteNumber(observation.values.maxDbz);
  if (dbz !== null && dbz >= 50) {
    found.push(emit(
      observation,
      'strong-reflectivity-core',
      'det-reflectivity',
      dbz >= 65 ? 'HIGH' : 'MODERATE',
      [`Maximum sampled reflectivity ${dbz.toFixed(0)} dBZ`],
      { maxDbz: dbz },
      ['Reflectivity alone does not confirm severe weather or a warning.']
    ));
  }

  const gates = finiteNumber(observation.values.gates50);
  if (gates !== null && gates >= 100) {
    found.push(emit(
      observation,
      'strong-echo-coverage',
      'det-echo-coverage',
      gates >= 500 ? 'MODERATE' : 'LOW',
      [`${Math.round(gates).toLocaleString()} sampled gates at or above 50 dBZ`],
      { gates50: gates },
      ['Gate counts describe this sample, not a storm object or tracked path.']
    ));
  }

  const couplet = finiteNumber(observation.values.coupletDeltaKt);
  if (couplet !== null && couplet >= 20) {
    found.push(emit(
      observation,
      'velocity-couplet-screening',
      'det-couplet',
      couplet >= 50 ? 'MODERATE' : 'LOW',
      [`Peak velocity difference ${couplet.toFixed(0)} kt across adjacent samples`],
      { coupletDeltaKt: couplet },
      [
        'Screening proxy only; rotation concern, not a tornado claim.',
        'No TVS, debris signature, mesocyclone ID, or projected path is claimed.',
      ]
    ));
  }

  const shear = finiteNumber(observation.values.shearS1);
  if (shear !== null && shear >= 0.002) {
    found.push(emit(
      observation,
      'gate-to-gate-shear',
      'det-shear',
      shear >= 0.01 ? 'MODERATE' : 'LOW',
      [`Adjacent-radial shear estimate ${shear.toFixed(4)} s⁻¹`],
      { shearS1: shear },
      ['Gate-to-gate shear is a local proxy and does not establish a mesocyclone.']
    ));
  }

  const nrot = finiteNumber(observation.values.nrot);
  if (nrot !== null && Math.abs(nrot) >= 0.5) {
    found.push(emit(
      observation,
      'normalized-rotation-proxy',
      'det-nrot',
      Math.abs(nrot) >= 2 ? 'MODERATE' : 'LOW',
      [`NROT-style normalized rotation ${nrot >= 0 ? '+' : ''}${nrot.toFixed(2)}`],
      { nrot },
      ['Research aid; not an operational rotation or tornado product.']
    ));
  }

  const rhohv = finiteNumber(observation.values.minRhohv);
  if (rhohv !== null && rhohv < 0.9) {
    found.push(emit(
      observation,
      'lower-correlation-coefficient',
      'det-rhohv',
      'LOW',
      [`Minimum correlation coefficient ${rhohv.toFixed(2)} in sampled gates`],
      { minRhohv: rhohv },
      [
        'Lower CC can indicate mixed or non-meteorological targets.',
        'No debris-signature or tornado-ground-contact claim is made.',
      ]
    ));
  }

  return found;
}

function lightningDetections(observation: WeatherObservation): Detection[] {
  if (observation.domain !== 'OBSERVATION') return [];
  const count = finiteNumber(observation.values.flashCount);
  if (count === null || count < 5) return [];
  const minutes = finiteNumber(observation.values.minutes) ?? 5;
  return [emit(
    observation,
    'lightning-density',
    'det-lightning',
    count >= 20 ? 'MODERATE' : 'LOW',
    [`${Math.round(count)} flashes in ${minutes.toFixed(0)} minutes`],
    { flashCount: count, minutes },
    ['Flash density supports electrical activity, not a severity confirmation.']
  )];
}

function outlookDetections(observation: WeatherObservation): Detection[] {
  if (observation.domain !== 'MODEL') return [];
  const category = String(observation.values.category || '').toUpperCase();
  if (!['HIGH', 'MDT', 'ENH', 'SLGT', 'MRGL', 'TSTM'].includes(category)) return [];
  return [emit(
    observation,
    'spc-categorical-guidance',
    'det-outlook',
    ['HIGH', 'MDT', 'ENH'].includes(category) ? 'MODERATE' : 'LOW',
    [`Day ${observation.values.day || '1'} SPC category ${category}`],
    { category },
    ['Categorical outlook is guidance at a broad scale, not an observation at the site.']
  )];
}

function alertDetections(observation: WeatherObservation): Detection[] {
  if (observation.domain !== 'ALERT') return [];
  const found: Detection[] = [];
  const events = String(observation.values.events || '');
  const hasWarning = observation.values.hasWarning === true;

  if (hasWarning) {
    found.push(emit(
      observation,
      'active-official-warning',
      'det-warning',
      'HIGH',
      [`Active NWS warning events near the site: ${events}`],
      { events, count: finiteNumber(observation.values.count) },
      ['Official NWS product; MesoAI restates it and does not issue or upgrade warnings.']
    ));
  }
  if (/flash flood/i.test(events)) {
    found.push(emit(
      observation,
      'flash-flood-warning-context',
      'det-flash-flood',
      'MODERATE',
      ['Active NWS flash flood warning near the site'],
      { events },
      ['Soil saturation and QPE contributions remain conditional on verified source availability.']
    ));
  }
  return found;
}

/** Runs every deterministic detector over normalized observations. */
export function runDetections(observations: WeatherObservation[]): Detection[] {
  return observations
    .flatMap((observation) => [
      ...radarDetections(observation),
      ...lightningDetections(observation),
      ...outlookDetections(observation),
      ...alertDetections(observation),
    ])
    .filter((detection) => {
      // Belt-and-braces gate: gated signatures must never enter the analysis.
      return !/(tvs|debris signature|tornado on the ground|mesocyclone object|projected path)/i.test(
        `${detection.kind} ${detection.evidence.join(' ')}`
      );
    });
}
