/**
 * Radar Capability Matrix - SINGLE SOURCE OF TRUTH
 *
 * All radar product availability, source mapping, archive/playback behavior,
 * and UI gating MUST read from this module. No hidden fallback chains.
 * No silent substitutions. No fake playback.
 */

export type RadarCapabilityStatus = 'WORKING' | 'PARTIAL' | 'UNAVAILABLE' | 'RESTRICTED';
export type RadarSourceType = 'IEM_RIDGE' | 'IEM_MRMS_TMS' | 'NOAA_AWS_MRMS' | 'NOAA_NEXRAD_LEVEL2' | 'NONE';
export type ArchiveSupport = 'FULL' | 'PARTIAL' | 'NONE' | 'UNKNOWN';
export type SuperResolutionSupport = 'YES' | 'NO' | 'N/A' | 'UNKNOWN';
export type PlaybackSupport = 'REAL_ARCHIVE' | 'LIVE_ONLY' | 'NONE' | 'UNKNOWN';

export interface RadarProductCapability {
  id: string;
  name: string;
  shortLabel: string;
  source: {
    type: RadarSourceType;
    provider: string;
    endpointTemplate?: string;
    productCode?: string;
    notes: string;
  };
  availability: RadarCapabilityStatus;
  archiveSupport: ArchiveSupport;
  superResolutionSupport: SuperResolutionSupport;
  playbackSupport: PlaybackSupport;
  networks: Array<'NEXRAD' | 'TDWR'>;
  tiltSupport: string[];
  dataHonesty: {
    realData: boolean;
    substitute: boolean;
    synthetic: boolean;
    reason?: string;
  };
  verification: {
    lastCheckedAt: string;
    evidence: string[];
  };
  unavailableReason?: string;
}

const CHECKED_AT = '2026-11-22';

export const RADAR_CAPABILITY_MATRIX: readonly RadarProductCapability[] = [
  {
    id: 'ref',
    name: 'Reflectivity',
    shortLabel: 'BR',
    source: {
      type: 'IEM_RIDGE',
      provider: 'Iowa Environmental Mesonet (IEM) / NOAA NEXRAD',
      endpointTemplate: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::{{SECTOR}}-{{CODE}}-{{STAMP}}/{z}/{x}/{y}.png',
      productCode: 'N0B/N1B/N2B/N3B (NEXRAD), TZL (TDWR)',
      notes: 'Current production path uses N0B-family digital reflectivity. N0Q live sampled 200 on IEM; N1Q-N3Q/archive not verified. Do not silently switch to N0Q.',
    },
    availability: 'PARTIAL',
    archiveSupport: 'PARTIAL',
    superResolutionSupport: 'UNKNOWN',
    playbackSupport: 'REAL_ARCHIVE',
    networks: ['NEXRAD', 'TDWR'],
    tiltSupport: ['0.5', '0.9', '1.3', '1.8'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: {
      lastCheckedAt: CHECKED_AT,
      evidence: ['app/api/nexrad/frames/route.ts', 'IEM sampled N0B 200 KLZK', 'IEM sampled N0Q 200 KLZK/FWS', 'N1Q-N3Q sampled 503 KLZK'],
    },
  },
  {
    id: 'vel',
    name: 'Base Velocity',
    shortLabel: 'BV',
    source: {
      type: 'IEM_RIDGE',
      provider: 'IEM / NOAA NEXRAD',
      endpointTemplate: 'ridge::{{SECTOR}}-{{CODE}}-{{STAMP}}',
      productCode: 'N0U/N1U/N2U/N3U (NEXRAD), TV0 (TDWR)',
      notes: 'Base velocity. TDWR uses TV0.',
    },
    availability: 'PARTIAL',
    archiveSupport: 'PARTIAL',
    superResolutionSupport: 'N/A',
    playbackSupport: 'REAL_ARCHIVE',
    networks: ['NEXRAD', 'TDWR'],
    tiltSupport: ['0.5', '0.9', '1.3', '1.8'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames mapping', 'IEM sampled N0U 200 KLZK'] },
  },
  {
    id: 'srvel',
    name: 'Storm Relative Velocity',
    shortLabel: 'SRV',
    source: {
      type: 'IEM_RIDGE',
      provider: 'IEM / NOAA NEXRAD',
      endpointTemplate: 'ridge::{{SECTOR}}-N0S-{{STAMP}}',
      productCode: 'N0S',
      notes: 'NEXRAD SRV. Not verified as TDWR SRV; TDWR base velocity is TV0.',
    },
    availability: 'PARTIAL',
    archiveSupport: 'PARTIAL',
    superResolutionSupport: 'N/A',
    playbackSupport: 'REAL_ARCHIVE',
    networks: ['NEXRAD'],
    tiltSupport: ['0.5'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames mapping', 'IEM sampled N0S 200 KLZK'] },
  },
  {
    id: 'cc',
    name: 'Correlation Coefficient',
    shortLabel: 'CC',
    source: { type: 'NONE', provider: 'Unverified', notes: 'No verified end-to-end source in current pipeline. Prior alternate mappings used MRMS PrecipClass substitute - disallowed.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source; substitutes disabled.' },
    unavailableReason: 'DATA UNAVAILABLE - No verified CC source in current pipeline. Silent substitution disabled.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames returns 404', 'IEM sampled N0C 503 KLZK'] },
  },
  {
    id: 'min_cc',
    name: 'Min Correlation Coefficient',
    shortLabel: 'mCC',
    source: { type: 'NONE', provider: 'Unverified', notes: 'No verified end-to-end source.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source.' },
    unavailableReason: 'DATA UNAVAILABLE - No verified Min CC source in current pipeline.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames explicit unavailable list'] },
  },
  {
    id: 'zdr',
    name: 'Differential Reflectivity',
    shortLabel: 'ZDR',
    source: { type: 'NONE', provider: 'Unverified', notes: 'No verified end-to-end source. Prior alternates used MRMS RALA substitute - disallowed.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source; substitutes disabled.' },
    unavailableReason: 'DATA UNAVAILABLE - No verified ZDR source in current pipeline. Silent substitution disabled.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames returns 404', 'IEM sampled N0X 503 KLZK'] },
  },
  {
    id: 'kdp',
    name: 'Specific Differential Phase',
    shortLabel: 'KDP',
    source: { type: 'NONE', provider: 'Unverified', notes: 'No verified end-to-end source. Prior alternates used MRMS QPE substitute - disallowed.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source; substitutes disabled.' },
    unavailableReason: 'DATA UNAVAILABLE - No verified KDP source in current pipeline. Silent substitution disabled.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames returns 404', 'IEM sampled N0K 503 KLZK'] },
  },
  {
    id: 'sw',
    name: 'Spectrum Width',
    shortLabel: 'SW',
    source: { type: 'NONE', provider: 'Unverified', notes: 'No verified end-to-end source in current pipeline.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source.' },
    unavailableReason: 'DATA UNAVAILABLE - No verified Spectrum Width source in current pipeline.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames returns 404', 'IEM sampled N0W 503 KLZK'] },
  },
  {
    id: 'hhc',
    name: 'Hydrometeor Classification',
    shortLabel: 'HHC',
    source: { type: 'NONE', provider: 'Unverified', notes: 'No verified end-to-end source in current pipeline.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source.' },
    unavailableReason: 'DATA UNAVAILABLE - No verified HHC source in current pipeline.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames returns 404', 'IEM sampled DHC 503 KLZK'] },
  },
  {
    id: 'qpe',
    name: 'Precipitation / QPE',
    shortLabel: 'QPE',
    source: { type: 'NONE', provider: 'Unverified', notes: 'QPE product semantics vary; no verified end-to-end tile/archive path.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source.' },
    unavailableReason: 'DATA UNAVAILABLE - No verified QPE source in current pipeline.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames rejects DPR/N0H/DAA/DTA/N1P/OHA'] },
  },
  {
    id: 'nrot',
    name: 'Normalized Rotation (NROT)',
    shortLabel: 'NROT',
    source: { type: 'NONE', provider: 'Unverified', notes: 'Prior implementation duplicated velocity (N0U) - data lie. Disabled until verified distinct source exists.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified distinct source; prior mapping was unsafe.' },
    unavailableReason: 'DATA UNAVAILABLE - No verified NROT source. Prior velocity-duplicate mapping disabled.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['prior audit: norm_vel mapped to N0U', 'nexrad/frames returns 404'] },
  },
  {
    id: 'azshear',
    name: 'AzShear / Rotation Tracks',
    shortLabel: 'AZ',
    source: { type: 'NONE', provider: 'Unverified', notes: 'MRMS AzShear candidates exist but not verified end-to-end; N0S fallback is disallowed.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source; SRV fallback disabled.' },
    unavailableReason: 'DATA UNAVAILABLE - AzShear not verified end-to-end. N0S/SRV fallback disabled.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['radar/tile had MRMS::AzShear_0-2km then N0S fallback', 'no verified frames mapping'] },
  },
  {
    id: 'mesh',
    name: 'MESH',
    shortLabel: 'MESH',
    source: { type: 'NONE', provider: 'Unverified', notes: 'MRMS MESH candidate exists but not verified end-to-end in current pipeline.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source.' },
    unavailableReason: 'DATA UNAVAILABLE - MESH not verified end-to-end in current pipeline.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['alternate paths map MRMS::MESH_Max60min; main frames no support'] },
  },
  {
    id: 'tops',
    name: 'Echo Tops',
    shortLabel: 'ET',
    source: { type: 'NONE', provider: 'Unverified', notes: 'IEM NET/EET semantics and availability inconsistent across code paths. Sampled NET 200, EET 503 (KLZK tile).' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'Product code semantics not verified/canonicalized.' },
    unavailableReason: 'DATA UNAVAILABLE - Echo Tops product code/semantics not verified across sources.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['NET 200 sampled KLZK', 'EET 503 sampled KLZK', 'conflicting mappings in codebase'] },
  },
  {
    id: 'vil',
    name: 'Vertically Integrated Liquid',
    shortLabel: 'VIL',
    source: { type: 'NONE', provider: 'Unverified', notes: 'IEM DVL/N0Z/NVL mappings conflict across code paths. Sampled DVL 503 (KLZK tile).' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'Product code semantics not verified/canonicalized.' },
    unavailableReason: 'DATA UNAVAILABLE - VIL product code/semantics not verified across sources.',
    verification: { lastCheckedAt: CHECKED_AT, evidence: ['DVL 503 sampled KLZK', 'conflicting mappings in codebase'] },
  },
] as const;

export function getRadarCapability(id: string): RadarProductCapability | undefined {
  return RADAR_CAPABILITY_MATRIX.find((p) => p.id === id);
}

export function isRadarProductAvailable(id: string): boolean {
  const cap = getRadarCapability(id);
  return cap?.availability === 'WORKING' || cap?.availability === 'PARTIAL';
}

export function radarAvailabilityReason(id: string): string {
  const cap = getRadarCapability(id);
  if (!cap) return 'DATA UNAVAILABLE - Unknown radar product.';
  if (cap.availability === 'UNAVAILABLE' || cap.availability === 'RESTRICTED') {
    return cap.unavailableReason || 'DATA UNAVAILABLE - No verified source.';
  }
  if (cap.playbackSupport === 'LIVE_ONLY') return 'LIVE ONLY - Archive playback not verified.';
  return '';
}

export function radarProductUiState(id: string): { enabled: boolean; warning?: string; reason?: string } {
  const cap = getRadarCapability(id);
  if (!cap) return { enabled: false, reason: 'DATA UNAVAILABLE - Unknown radar product.' };
  if (cap.availability === 'UNAVAILABLE' || cap.availability === 'RESTRICTED') {
    return { enabled: false, reason: cap.unavailableReason || 'DATA UNAVAILABLE' };
  }
  if (cap.availability === 'PARTIAL') {
    return { enabled: true, warning: cap.dataHonesty.reason || 'PARTIAL - Limited verification or archive support.' };
  }
  return { enabled: true };
}
