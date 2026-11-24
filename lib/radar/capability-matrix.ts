/**
 * Radar Capability Matrix - SINGLE SOURCE OF TRUTH
 *
 * All radar product availability, source mapping, archive/playback behavior,
 * and UI gating MUST read from this module. No hidden fallback chains.
 * No silent substitutions. No fake playback.
 */

export type RadarCapabilityStatus = 'WORKING' | 'PARTIAL' | 'UNAVAILABLE' | 'RESTRICTED';
export type RadarSourceType = 'IEM_RIDGE' | 'IEM_MRMS_TMS' | 'NOAA_AWS_MRMS' | 'NOAA_NEXRAD_LEVEL2' | 'NOAA_NCEP_WMS' | 'DERIVED' | 'NONE';
export type ArchiveSupport = 'FULL' | 'PARTIAL' | 'PARTIAL_ARCHIVE' | 'NONE' | 'UNKNOWN';
export type SuperResolutionSupport = 'YES' | 'NO' | 'N/A' | 'UNKNOWN';
export type PlaybackSupport = 'REAL_ARCHIVE' | 'PARTIAL_ARCHIVE' | 'LIVE_ONLY' | 'NONE' | 'UNKNOWN';
export type VerificationLevel = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'TESTED_LIVE' | 'TESTED_ARCHIVE';

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
    level: VerificationLevel;
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
    archiveSupport: 'PARTIAL_ARCHIVE',
    superResolutionSupport: 'UNKNOWN',
    playbackSupport: 'PARTIAL_ARCHIVE',
    networks: ['NEXRAD', 'TDWR'],
    tiltSupport: ['0.5', '0.9', '1.3', '1.8'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: {
      level: 'PARTIALLY_VERIFIED',
      lastCheckedAt: CHECKED_AT,
      evidence: ['app/api/nexrad/frames/route.ts', 'Sprint 2 sampled 19 NEXRAD sites: N0B/N0Q mostly 200 PNG; N1Q/N2Q/N3Q 503; KPSR/KSGX 503 for N0B/N0Q in sample', 'Sprint 3 archive probe: N0B 14/90 hits (10 sites, 9 offsets 15m-2d) - PARTIAL_ARCHIVE', 'Sprint 3 archive probe: TZL 0/90 hits (10 TDWR sites, 9 offsets) - LIVE_ONLY for TDWR archive', 'TDWR TZL live verified 44/44 200 PNG'],
    },
  },
  {
    id: 'max_ref',
    name: 'Maximum Reflectivity',
    shortLabel: 'MAX',
    source: {
      type: 'DERIVED',
      provider: 'Derived from IEM / NOAA NEXRAD reflectivity',
      notes: 'Client-composited per-pixel maximum dBZ from recent real reflectivity frames. No synthetic data; availability depends on verified reflectivity source frames.',
    },
    availability: 'PARTIAL',
    archiveSupport: 'PARTIAL_ARCHIVE',
    superResolutionSupport: 'UNKNOWN',
    playbackSupport: 'PARTIAL_ARCHIVE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: {
      realData: true,
      substitute: false,
      synthetic: false,
      reason: 'Derived only from real reflectivity frames; no synthetic/fabricated values.',
    },
    verification: {
      level: 'PARTIALLY_VERIFIED',
      lastCheckedAt: CHECKED_AT,
      evidence: ['lib/max-reflectivity.ts computes per-pixel max dBZ from loaded reflectivity frames', 'depends on ref capability/source availability; no independent source/archive endpoint'],
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
      notes: 'Base velocity. TDWR uses TV0. N0U live sampled 200; automated archive probe found 0/90 archive hits across 10 sites x 9 timestamps (15m-2d). TDWR TV0 0/90.',
    },
    availability: 'PARTIAL',
    archiveSupport: 'NONE',
    superResolutionSupport: 'N/A',
    playbackSupport: 'LIVE_ONLY',
    networks: ['NEXRAD', 'TDWR'],
    tiltSupport: ['0.5', '0.9', '1.3', '1.8'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: {
      level: 'PARTIALLY_VERIFIED',
      lastCheckedAt: CHECKED_AT,
      evidence: ['nexrad/frames mapping', 'Sprint 2: N0U live 200 on sampled sites', 'Sprint 3 archive probe: N0U 0/90 hits (10 sites, 9 offsets 15m-2d)', 'Sprint 3 archive probe: TV0 0/90 hits (10 TDWR sites, 9 offsets)', 'TDWR TV0 live verified 44/44 200 PNG'],
    },
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
      notes: 'NEXRAD SRV. Not verified as TDWR SRV; TDWR base velocity is TV0. Automated archive probe found 12/90 hits - sparse partial archive.',
    },
    availability: 'PARTIAL',
    archiveSupport: 'PARTIAL_ARCHIVE',
    superResolutionSupport: 'N/A',
    playbackSupport: 'PARTIAL_ARCHIVE',
    networks: ['NEXRAD'],
    tiltSupport: ['0.5'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: {
      level: 'PARTIALLY_VERIFIED',
      lastCheckedAt: CHECKED_AT,
      evidence: ['nexrad/frames mapping', 'Sprint 2: N0S live 200 on sampled sites', 'Sprint 3 archive probe: N0S 12/90 hits (10 sites, 9 offsets 15m-2d) - PARTIAL_ARCHIVE'],
    },
  },
  {
    id: 'cc',
    name: 'Correlation Coefficient',
    shortLabel: 'CC',
    source: {
      type: 'NOAA_NEXRAD_LEVEL2',
      provider: 'NOAA NEXRAD Level II (single-radar RHO)',
      endpointTemplate: '/api/radar/level2-tile?site={{SITE}}&product=cc&tilt={{TILT}}&z={z}&x={x}&y={y}',
      productCode: 'RHO',
      notes: 'Live per-radar Level II correlation coefficient moment decoded from current volume scans and rendered as XYZ tiles. No merged-radar substitute.',
    },
    availability: 'WORKING',
    archiveSupport: 'NONE',
    superResolutionSupport: 'N/A',
    playbackSupport: 'LIVE_ONLY',
    networks: ['NEXRAD'],
    tiltSupport: ['0.5', '0.9', '1.3', '1.8'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: {
      level: 'TESTED_LIVE',
      lastCheckedAt: '2026-11-24',
      evidence: [
        'Live NOAA Level II volume for KLZK parsed; 720 lowest-elevation radials contained RHO moment data',
        'Single-radar RHO moment rendered in XYZ tile route; no merged-data alias',
        'Live-only route; archive playback remains unavailable',
      ],
    },
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
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames explicit unavailable list', 'Sprint 2: no verified end-to-end source identified'] },
  },
  {
    id: 'zdr',
    name: 'Differential Reflectivity',
    shortLabel: 'ZDR',
    source: {
      type: 'NOAA_NEXRAD_LEVEL2',
      provider: 'NOAA NEXRAD Level II (single-radar ZDR)',
      endpointTemplate: '/api/radar/level2-tile?site={{SITE}}&product=zdr&tilt={{TILT}}&z={z}&x={x}&y={y}',
      productCode: 'ZDR',
      notes: 'Live per-radar Level II differential reflectivity moment decoded from current volume scans and rendered as XYZ tiles. No merged-radar substitute.',
    },
    availability: 'WORKING',
    archiveSupport: 'NONE',
    superResolutionSupport: 'N/A',
    playbackSupport: 'LIVE_ONLY',
    networks: ['NEXRAD'],
    tiltSupport: ['0.5', '0.9', '1.3', '1.8'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: {
      level: 'TESTED_LIVE',
      lastCheckedAt: '2026-11-24',
      evidence: [
        'Live NOAA Level II volume for KLZK parsed; 720 lowest-elevation radials contained ZDR moment data',
        'Single-radar ZDR moment rendered in XYZ tile route; no merged-data alias',
        'Live-only route; archive playback remains unavailable',
      ],
    },
  },
  {
    id: 'kdp',
    name: 'Specific Differential Phase',
    shortLabel: 'KDP',
    source: {
      type: 'NOAA_NEXRAD_LEVEL2',
      provider: 'NOAA NEXRAD Level II PHI (derived KDP)',
      endpointTemplate: '/api/radar/level2-tile?site={{SITE}}&product=kdp&tilt={{TILT}}&z={z}&x={x}&y={y}',
      productCode: 'KDP = one-half range derivative of PHI',
      notes: 'KDP is calculated from real per-radar Level II differential phase by unwrapping phase and applying a centered seven-gate linear fit, masked where RHO is below 0.80. It is not substituted with QPE.',
    },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: ['0.5', '0.9', '1.3', '1.8'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA Level II volume for KLZK parsed; 720 lowest-elevation radials contained differential PHI data', 'KDP derived from real PHI moment using a centered seven-gate linear fit', 'Live-only route; archive playback remains unavailable'] },
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
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames returns 404', 'Sprint 2: IEM ridge N0W 503 on LZK/LWX/TLX/MHX'] },
  },
  {
    id: 'hhc',
    name: 'Hydrometeor Classification',
    shortLabel: 'HHC',
    source: {
      type: 'NOAA_NCEP_WMS',
      provider: 'NOAA NCEP opengeo WMS (RIDGEII BDHC)',
      endpointTemplate: '/api/radar/ncep-wms?product=hhc&site={{SITE}}&bbox={bbox-epsg-3857}&width=256&height=256',
      productCode: 'BDHC',
      notes: 'NCEP opengeo per-radar WMS layer k<SITE>_bdhc (Digital Hydrometeor Classification). Live verified; TIME dimension advertised but archive/playback not yet end-to-end verified in MesoVortexWX.',
    },
    availability: 'PARTIAL',
    archiveSupport: 'PARTIAL_ARCHIVE',
    superResolutionSupport: 'N/A',
    playbackSupport: 'LIVE_ONLY',
    networks: ['NEXRAD'],
    tiltSupport: ['0.5'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: {
      level: 'TESTED_LIVE',
      lastCheckedAt: '2026-11-23',
      evidence: [
        'NCEP opengeo GetCapabilities lists klzk_bdhc with time dimension and default recent timestamp',
        'GetMap returns image/png for klzk/ktlx/kdmx/kfws BDHC layers',
        'IEM RIDGE N0H/HHC 503 on sampled sites; unidata L3 N0H files exist but not yet decoded/rendered in-app',
        'Archive TIME advertised by NCEP but not yet wired into MesoVortexWX playback - LIVE_ONLY until verified',
      ],
    },
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
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['nexrad/frames rejects DPR/N0H/DAA/DTA/N1P/OHA', 'Sprint 2: IEM ridge DPR/ONE/OHA 503 on LZK/LWX/TLX/MHX'] },
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
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['prior audit: norm_vel mapped to N0U', 'nexrad/frames returns 404', 'Sprint 2: no verified distinct NROT source found'] },
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
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['radar/tile had MRMS::AzShear_0-2km then N0S fallback', 'Sprint 2: IEM MRMS AzShear_0-2km 503; AzShear_0-2km_30min 503'] },
  },
  {
    id: 'mesh',
    name: 'MESH',
    shortLabel: 'MESH',
    source: { type: 'IEM_MRMS_TMS', provider: 'IEM MRMS TMS (candidate)', notes: 'MRMS MESH/MESH_Max60min tiles return 200 PNG on IEM TMS probe, but end-to-end semantics, legend, archive, and pipeline integration are NOT verified. Kept UNAVAILABLE until verified.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'Source candidate exists but not verified end-to-end; integration missing.' },
    unavailableReason: 'DATA UNAVAILABLE - MESH source candidate exists but end-to-end verification/integration is incomplete.',
    verification: { level: 'TESTED_LIVE', lastCheckedAt: CHECKED_AT, evidence: ['Sprint 2: IEM MRMS MESH 200 PNG; MESH_Max60min 200 PNG', 'Sprint 3: same tile size (20229B) for MESH and MESH_Max60min; no timestamp/archive variant verified; no legend/units metadata verified', 'Sprint 4: mrms-t::MESH and fabricated timestamp path returned same 20229B/200 as current - timestamp/archive semantics not trustworthy from probes; no legend/units/end-to-end verification', 'Determination: UNAVAILABLE (no middle ground) - not verifiable for WORKING enablement'] },
  },
  {
    id: 'tops',
    name: 'Echo Tops',
    shortLabel: 'ET',
    source: { type: 'IEM_RIDGE', provider: 'IEM RIDGE (candidate)', notes: 'NET returns 200 PNG on sampled IEM ridge tiles; EET returns 503. Semantics/units/legend/archive not verified end-to-end. Kept UNAVAILABLE until verified.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'Source candidate exists but not verified end-to-end; integration missing.' },
    unavailableReason: 'DATA UNAVAILABLE - Echo Tops candidate exists (NET) but semantics/archive/integration not verified.',
    verification: { level: 'TESTED_LIVE', lastCheckedAt: CHECKED_AT, evidence: ['Sprint 2: IEM ridge NET 200 on LZK/LWX/TLX/MHX; EET 503', 'Sprint 3: IEM TMS nexrad-net/nexrad-eet and m05m..m50m variants respond 200; nexrad-net-m30m differs from current - archive-candidate evidence', 'Sprint 4: IEM json/radar products for LZK did not list NET; ridge NET-0 returned 334B on sampled sites; ridge NET timestamped -15m..-120m returned 503 on LZK/TLX/FWS/LWX/OKX', 'Sprint 4: composite nexrad-net has rolling m05m-m50m (m55m 404) but single-site ridge archive/timestamp integrity not verified; units/legend/end-to-end pipeline not verified', 'Determination: UNAVAILABLE - not fully verified for WORKING enablement'] },
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
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Sprint 2: IEM ridge DVL 503; NVL 503 on LZK/LWX/TLX/MHX', 'conflicting mappings in codebase'] },
  },
  {
    id: 'vil_density',
    name: 'VIL Density',
    shortLabel: 'VILD',
    source: { type: 'NONE', provider: 'Unverified', notes: 'No verified VIL Density source, units, legend, or end-to-end pipeline.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source.' },
    unavailableReason: 'DATA UNAVAILABLE - VIL Density is not verified end-to-end.',
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Phase 3A catalog addition: requested product not yet verified'] },
  },
  {
    id: 'hail_detection',
    name: 'Hail Detection and Hail Swaths',
    shortLabel: 'HAIL',
    source: { type: 'NONE', provider: 'Unverified', notes: 'MESH candidate exists but hail detection/swaths are not verified end-to-end; no false enablement.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source.' },
    unavailableReason: 'DATA UNAVAILABLE - Hail detection/swaths not verified end-to-end.',
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['MESH remains UNAVAILABLE; hail swath/detection pipeline not verified'] },
  },
  {
    id: 'rotation_tracks',
    name: 'Rotation Tracks',
    shortLabel: 'ROTTRK',
    source: { type: 'NONE', provider: 'Unverified', notes: 'MRMS rotation track candidates exist but no verified end-to-end source/archive/playback/legend.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source.' },
    unavailableReason: 'DATA UNAVAILABLE - Rotation tracks not verified end-to-end.',
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Phase 3A catalog addition: requested product not yet verified'] },
  },
  {
    id: 'cross_section',
    name: 'Reflectivity Cross Sections',
    shortLabel: 'XSEC',
    source: { type: 'NONE', provider: 'Unverified', notes: 'Cross-section rendering requires verified volume data and dedicated UI/pipeline; not implemented.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'Not implemented/verified.' },
    unavailableReason: 'DATA UNAVAILABLE - Reflectivity cross sections are not implemented/verified.',
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Phase 3A catalog addition: feature requested but no verified implementation'] },
  },
  {
    id: 'gate_filter',
    name: 'Reflectivity Gate Filtering',
    shortLabel: 'GATE',
    source: { type: 'NONE', provider: 'Unverified', notes: 'No verified gate-filtering processing pipeline exposed as a user product.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'Not implemented/verified.' },
    unavailableReason: 'DATA UNAVAILABLE - Reflectivity gate filtering is not implemented/verified.',
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Phase 3A catalog addition: feature requested but no verified implementation'] },
  },
  {
    id: 'precip_rate',
    name: 'Precipitation Rate',
    shortLabel: 'RATE',
    source: { type: 'NONE', provider: 'Unverified', notes: 'Precipitation rate/QPE product semantics vary; no verified end-to-end source.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source.' },
    unavailableReason: 'DATA UNAVAILABLE - Precipitation rate is not verified end-to-end.',
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Related QPE remains UNAVAILABLE; rate semantics not verified'] },
  },
  {
    id: 'rain_mix_snow',
    name: 'Rain/Mix/Snow Intensity',
    shortLabel: 'RMS',
    source: { type: 'NONE', provider: 'Unverified', notes: 'No verified radar-derived precipitation type/intensity product in current pipeline.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source.' },
    unavailableReason: 'DATA UNAVAILABLE - Rain/Mix/Snow intensity is not verified end-to-end.',
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Phase 3A catalog addition: requested product not yet verified'] },
  },
  {
    id: 'storm_analysis',
    name: 'Radar-Derived Storm Analysis',
    shortLabel: 'ANLZ',
    source: { type: 'NONE', provider: 'Unverified', notes: 'No verified storm-analysis product pipeline; would require verified inputs and explicit algorithms.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'Not implemented/verified.' },
    unavailableReason: 'DATA UNAVAILABLE - Radar-derived storm analysis is not implemented/verified.',
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Phase 3A catalog addition: feature requested but no verified implementation'] },
  },
  {
    id: 'volume_scan',
    name: 'Radar Volume Scans and Elevation-Angle Selection',
    shortLabel: 'VOL',
    source: { type: 'NONE', provider: 'Unverified', notes: 'Full volume scan/elevation-angle selection is not fully verified end-to-end; limited tilt selection exists for some products only.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'Not fully implemented/verified.' },
    unavailableReason: 'DATA UNAVAILABLE - Full volume scan/elevation-angle selection is not verified end-to-end.',
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Tilt selection exists for ref/vel/srvel only; full volume scan workflow not verified'] },
  },
  {
    id: 'tilt_selection',
    name: 'Individual Radar Tilt Selection',
    shortLabel: 'TILT',
    source: { type: 'IEM_RIDGE', provider: 'IEM / NOAA NEXRAD (partial)', notes: 'Tilt selection is available for verified/partial reflectivity and velocity products; not all requested tilts/products verified.' },
    availability: 'PARTIAL',
    archiveSupport: 'PARTIAL_ARCHIVE',
    superResolutionSupport: 'UNKNOWN',
    playbackSupport: 'PARTIAL_ARCHIVE',
    networks: ['NEXRAD', 'TDWR'],
    tiltSupport: ['0.5', '0.9', '1.3', '1.8'],
    dataHonesty: { realData: true, substitute: false, synthetic: false, reason: 'Available only for verified/partial supported products and tilts.' },
    verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['ref/vel support tilt selection in capability matrix; srvel 0.5 only; many products unavailable'] },
  },
  {
    id: 'gate_to_gate_shear',
    name: 'Gate-to-Gate Shear',
    shortLabel: 'GATE',
    source: { type: 'NONE', provider: 'Unverified', notes: 'Derived from base radial velocity; no verified gate-to-gate shear source or processing pipeline is connected.' },
    availability: 'UNAVAILABLE',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: false, substitute: false, synthetic: false, reason: 'No verified source or derived processing.' },
    unavailableReason: 'DATA UNAVAILABLE - Gate-to-gate shear is not verified end-to-end.',
    verification: { level: 'UNVERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['GATE means gate-to-gate shear here; existing gate_filter capability is a different feature.'] },
  },
] as const;

const RADAR_PRODUCT_ALIASES: Record<string, string> = {
  ref: 'ref', reflectivity: 'ref', br: 'ref', ref_x: 'ref_x', max_ref: 'max_ref',
  vel: 'vel', velocity: 'vel', bv: 'vel',
  srvel: 'srvel', srv: 'srvel', sr_v: 'srvel', storm_relative_velocity: 'srvel',
  cc: 'cc', correlation: 'cc', correlation_coefficient: 'cc',
  min_cc: 'min_cc', mcc: 'min_cc',
  zdr: 'zdr', differential_reflectivity: 'zdr',
  kdp: 'kdp', specific_differential_phase: 'kdp',
  sw: 'sw', spectrum_width: 'sw', hhc: 'hhc', qpe: 'qpe',
  nrot: 'nrot', az: 'azshear', azshear: 'azshear', mesh: 'mesh',
  trk: 'rotation_tracks', rotation_tracks: 'rotation_tracks',
  et: 'tops', echo_tops: 'tops', enhanced_echo_tops: 'tops',
  vil: 'vil', vild: 'vil_density',
  hail: 'hail_detection', hail_detection: 'hail_detection',
  xsec: 'cross_section', cross_section: 'cross_section',
  gate: 'gate_to_gate_shear', gate_to_gate_shear: 'gate_to_gate_shear', gate_filter: 'gate_filter',
  rate: 'precip_rate', precip_rate: 'precip_rate',
  rms: 'rain_mix_snow', rain_mix_snow: 'rain_mix_snow',
  anlz: 'storm_analysis', storm_analysis: 'storm_analysis',
  vol: 'volume_scan', volume_scan: 'volume_scan',
};

export function canonicalRadarProductId(id: string): string {
  const key = id.trim().toLowerCase();
  return RADAR_PRODUCT_ALIASES[key] ?? key;
}

export function getRadarCapability(id: string): RadarProductCapability | undefined {
  const canonicalId = canonicalRadarProductId(id);
  return RADAR_CAPABILITY_MATRIX.find((p) => p.id === canonicalId);
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
