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
    name: 'Volume-Minimum Correlation Coefficient (Derived)',
    shortLabel: 'mCC',
    source: { type: 'DERIVED', provider: 'NOAA NEXRAD Level II volume scan', endpointTemplate: '/api/radar/level2-tile?site={{SITE}}&product=min_cc&z={z}&x={x}&y={y}', productCode: 'minimum valid RHOHV sampled across available elevation cuts', notes: 'App-derived live map: samples each scan elevation at the map location with a 4/3-earth beam-range correction. This is not a separate official Level III product.' },
    availability: 'PARTIAL',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'LIVE_ONLY',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false, reason: 'Derived from real CC gates in the current live volume; the app does not claim equivalence to a vendor Level III product.' },
    verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Uses real Level II RHOHV gates across the live scan elevation cuts.', 'Volume minimum is an app-derived map; archive playback and exact official Level III equivalence are not claimed.'] },
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
    source: { type: 'NOAA_NEXRAD_LEVEL2', provider: 'NOAA NEXRAD Level II spectrum-width moment', endpointTemplate: '/api/radar/level2-tile?site={{SITE}}&product=sw&tilt={{TILT}}&z={z}&x={x}&y={y}', productCode: 'SW', notes: 'Per-radar spectrum-width moment decoded from the latest Level II volume. Live only; no archive loop.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: ['0.5', '0.9', '1.3', '1.8'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA Level II volume for KLZK returned a PNG tile for the 0.5° spectrum-width moment through /api/radar/level2-tile.', 'Live only; archive playback is not claimed.'] },
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
    source: { type: 'NOAA_AWS_MRMS', provider: 'NOAA MRMS MultiSensor QPE 1-hour Pass 1', endpointTemplate: '/api/radar/mrms-tile?product=qpe&z={z}&x={x}&y={y}', productCode: 'MultiSensor_QPE_01H_Pass1', notes: 'National 1-hour accumulation estimate; grid is not a single-site radar product.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA MRMS MultiSensor_QPE_01H_Pass1 decoded and returned an image/png tile; the route enforces a three-hour staleness limit.', 'This is the one-hour Pass 1 national accumulation, not a per-site radar image.'] },
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
    source: { type: 'NOAA_AWS_MRMS', provider: 'NOAA MRMS merged low-level azimuthal shear', endpointTemplate: '/api/radar/mrms-tile?product=azshear&z={z}&x={x}&y={y}', productCode: 'MergedAzShear_0-2kmAGL', notes: 'National 0–2 km AGL merged azimuthal shear field. This is not per-site N0S storm-relative velocity.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA MRMS MergedAzShear_0-2kmAGL decoded and returned an image/png tile.', 'This is the national 0–2 km AGL AzShear grid; no N0S fallback is used.'] },
  },
  {
    id: 'mesh',
    name: 'MESH',
    shortLabel: 'MESH',
    source: { type: 'NOAA_AWS_MRMS', provider: 'NOAA MRMS Maximum Expected Size of Hail', endpointTemplate: '/api/radar/mrms-tile?product=mesh&z={z}&x={x}&y={y}', productCode: 'MESH', notes: 'National MRMS MESH estimate; the tile is the current 2D grid, not a time-maximum swath.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA MRMS MESH decoded and returned an image/png tile; NSSL defines this grid in millimeters.', 'The route selects current MESH, not a time-maximum hail swath.'] },
  },
  {
    id: 'tops',
    name: 'Echo Tops',
    shortLabel: 'ET',
    source: { type: 'NOAA_AWS_MRMS', provider: 'NOAA MRMS 18-dBZ echo-top grid', endpointTemplate: '/api/radar/mrms-tile?product=tops&z={z}&x={x}&y={y}', productCode: 'EchoTop_18', notes: '18 dBZ echo-top height in km MSL; national MRMS grid, not per-site enhanced echo tops.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA MRMS EchoTop_18 decoded and returned an image/png tile.', 'NSSL defines this field as 18 dBZ echo-top height in km MSL.'] },
  },
  {
    id: 'vil',
    name: 'Vertically Integrated Liquid',
    shortLabel: 'VIL',
    source: { type: 'NOAA_AWS_MRMS', provider: 'NOAA MRMS Vertically Integrated Liquid', endpointTemplate: '/api/radar/mrms-tile?product=vil&z={z}&x={x}&y={y}', productCode: 'VIL', notes: 'National MRMS vertically integrated liquid grid (kg/m²); not a per-site NEXRAD Level III field.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA MRMS VIL decoded and returned an image/png tile; the route uses the exact current VIL grid.'] },
  },
  {
    id: 'vil_density',
    name: 'VIL Density',
    shortLabel: 'VILD',
    source: { type: 'NOAA_AWS_MRMS', provider: 'NOAA MRMS VIL Density', endpointTemplate: '/api/radar/mrms-tile?product=vil_density&z={z}&x={x}&y={y}', productCode: 'VIL_Density', notes: 'National VIL density grid in g/m³; NOAA defines it as VIL divided by 18-dBZ echo-top height.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA MRMS VIL_Density decoded and returned an image/png tile.', 'NSSL defines VIL_Density in g/m³ from VIL divided by the 18 dBZ echo-top height.'] },
  },
  {
    id: 'hail_detection',
    name: 'Hail Severity Index (SHI)',
    shortLabel: 'HAIL',
    source: { type: 'NOAA_AWS_MRMS', provider: 'NOAA MRMS Severe Hail Index', endpointTemplate: '/api/radar/mrms-tile?product=hail_detection&z={z}&x={x}&y={y}', productCode: 'SHI', notes: 'Displays MRMS SHI, a hail-severity index. It is not a probability product or a tracked hail swath.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA MRMS SHI decoded and returned an image/png tile.', 'UI identifies SHI as a severity index, not as hail probability or a tracked swath.'] },
  },
  {
    id: 'rotation_tracks',
    name: 'Rotation Tracks',
    shortLabel: 'ROTTRK',
    source: { type: 'NOAA_AWS_MRMS', provider: 'NOAA MRMS 30-minute rotation track', endpointTemplate: '/api/radar/mrms-tile?product=rotation_tracks&z={z}&x={x}&y={y}', productCode: 'RotationTrack30min', notes: 'National MRMS 30-minute rotation-track field; this is a time-window product, with no app playback loop.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA MRMS RotationTrack30min decoded and returned an image/png tile.', 'No archive playback is claimed; product represents the rolling 30-minute period.'] },
  },
  {
    id: 'cross_section',
    name: 'Reflectivity Cross Sections',
    shortLabel: 'XSEC',
    source: { type: 'NOAA_NEXRAD_LEVEL2', provider: 'NOAA NEXRAD Level II on AWS', notes: 'Live single-radar transect extraction from measured reflectivity gates across decoded elevation sweeps. The viewer plots gate samples at approximate 4/3-earth beam heights; it is not a Cartesian volume reconstruction.' },
    availability: 'PARTIAL',
    archiveSupport: 'NONE',
    superResolutionSupport: 'UNKNOWN',
    playbackSupport: 'LIVE_ONLY',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false, reason: 'Measured Level II reflectivity gates are plotted at approximate beam heights. Terrain-corrected AGL, gridded interpolation, archive playback, and end-to-end live validation are not yet verified.' },
    verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: '2026-11-24', evidence: ['POST /api/radar/cross-section reads the existing NOAA Level II volume decoder and returns per-sweep measured reflectivity samples.', 'Map supports two-point transect selection and the XSEC viewer consumes the live API response.', 'Live operational scan and build/test validation still pending; capability must remain PARTIAL.'] },
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
    source: { type: 'NOAA_AWS_MRMS', provider: 'NOAA MRMS PrecipRate', endpointTemplate: '/api/radar/mrms-tile?product=precip_rate&z={z}&x={x}&y={y}', productCode: 'PrecipRate', notes: 'National MRMS radar precipitation rate in mm/hr; separate from accumulated QPE.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Live NOAA MRMS PrecipRate decoded and returned an image/png tile; product units are mm/hr.'] },
  },
  {
    id: 'rain_mix_snow',
    name: 'Surface Precipitation Type',
    shortLabel: 'RMS',
    source: { type: 'NOAA_AWS_MRMS', provider: 'NOAA MRMS PrecipFlag', endpointTemplate: '/api/radar/mrms-tile?product=rain_mix_snow&z={z}&x={x}&y={y}', productCode: 'PrecipFlag', notes: 'Surface precipitation type: warm/cold stratiform rain, snow, convective rain, hail-mixed rain, and tropical rain classes. It is categorical, not an intensity field.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['NOAA NSSL PrecipFlag flag table defines values 0, 1, 3, 6, 7, 10, 91, and 96; app maps the precipitation categories to distinct colors.', 'The acronym RMS is retained in the UI, but the product is precipitation type rather than intensity.'] },
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
    source: { type: 'NOAA_NEXRAD_LEVEL2', provider: 'NOAA NEXRAD Level II on AWS', notes: 'Current live volume scan is decoded into measured elevation sweeps and moment availability; archive volume playback and 3D rendering are not provided.' },
    availability: 'PARTIAL',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'LIVE_ONLY',
    networks: ['NEXRAD'],
    tiltSupport: [],
    dataHonesty: { realData: true, substitute: false, synthetic: false, reason: 'Live Level II scan inventory is real; archive, 3D rendering, and every moment/elevation combination are not claimed.' },
    verification: { level: 'PARTIALLY_VERIFIED', lastCheckedAt: CHECKED_AT, evidence: ['Live NOAA Level II scan decoder exposes elevation sweeps and per-sweep moments; inventory and live sweep navigation supported'] },
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
    source: { type: 'NOAA_NEXRAD_LEVEL2', provider: 'NOAA NEXRAD Level II velocity moment (derived)', endpointTemplate: '/api/radar/level2-tile?site={{SITE}}&product=gate_to_gate_shear&tilt={{TILT}}&z={z}&x={x}&y={y}', productCode: 'absolute difference between adjacent range gates, converted to knots', notes: 'Per-radial adjacent-range-gate velocity difference from real Level II velocity. This is a simple gate-pair shear display, not a storm-relative or multi-gate mesocyclone algorithm.' },
    availability: 'WORKING',
    archiveSupport: 'UNKNOWN',
    superResolutionSupport: 'N/A',
    playbackSupport: 'NONE',
    networks: ['NEXRAD'],
    tiltSupport: ['0.5', '0.9', '1.3', '1.8'],
    dataHonesty: { realData: true, substitute: false, synthetic: false },
    verification: { level: 'TESTED_LIVE', lastCheckedAt: '2026-11-24', evidence: ['Algorithm samples adjacent range gates in the real NOAA Level II velocity moment, reports absolute difference in knots, and returns transparent pixels below 10 kt.', 'This intentionally does not claim normalized rotation or mesocyclone detection.'] },
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
