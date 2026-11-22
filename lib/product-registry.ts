import { RADAR_CAPABILITY_MATRIX, type RadarCapabilityStatus } from './radar/capability-matrix';

export type RadarProductKey =
  | 'ref'
  | 'max_ref'
  | 'vel'
  | 'srvel'
  | 'cc'
  | 'min_cc'
  | 'zdr'
  | 'kdp'
  | 'sw'
  | 'hhc'
  | 'qpe'
  | 'precip_rate'
  | 'nrot'
  | 'azshear'
  | 'mesh'
  | 'tops'
  | 'vil'
  | 'vil_density'
  | 'hail_detection'
  | 'rotation_tracks'
  | 'cross_section'
  | 'gate_filter'
  | 'rain_mix_snow'
  | 'storm_analysis'
  | 'volume_scan'
  | 'tilt_selection';

export type ProductSourceKind = 'nexrad-level3' | 'mrms' | 'derived' | 'unknown' | 'none';

export type RadarProductDef = {
  key: RadarProductKey;
  label: string;
  short: string;
  description: string;
  sourceKind: ProductSourceKind;
  substitute: boolean;
  loopExpected: boolean;
  availability: RadarCapabilityStatus;
  unavailableReason?: string;
  sourceNote?: string;
  attribution?: string;
};

export const PRODUCT_ATTRIBUTION_IEM = 'Iowa Environmental Mesonet (IEM) / NOAA NEXRAD & MRMS tile services';

function cap(id: string) {
  return RADAR_CAPABILITY_MATRIX.find((p) => p.id === id);
}

function toDef(key: RadarProductKey, id: string, description: string, short?: string): RadarProductDef {
  const c = cap(id);
  const sourceKind: ProductSourceKind =
    c?.source.type === 'IEM_RIDGE' ? 'nexrad-level3'
      : c?.source.type === 'IEM_MRMS_TMS' || c?.source.type === 'NOAA_AWS_MRMS' ? 'mrms'
      : c?.source.type === 'DERIVED' ? 'derived'
      : c?.source.type === 'NONE' ? 'none' : 'unknown';
  return {
    key,
    label: c?.name || key,
    short: short || c?.shortLabel || key.toUpperCase(),
    description,
    sourceKind,
    substitute: c?.dataHonesty.substitute ?? false,
    loopExpected: c?.playbackSupport === 'REAL_ARCHIVE' || c?.playbackSupport === 'PARTIAL_ARCHIVE',
    availability: c?.availability || 'UNAVAILABLE',
    unavailableReason: c?.unavailableReason,
    sourceNote: c?.unavailableReason || c?.source.notes,
    attribution: c?.source.provider || PRODUCT_ATTRIBUTION_IEM,
  };
}

export const RADAR_PRODUCTS: readonly RadarProductDef[] = [
  toDef('ref', 'ref', 'Super-resolution base reflectivity'),
  toDef('max_ref', 'max_ref', 'Maximum reflectivity derived from recent real reflectivity frames'),
  toDef('vel', 'vel', 'Super-resolution base velocity'),
  toDef('srvel', 'srvel', 'Storm-relative velocity'),
  toDef('cc', 'cc', 'Correlation coefficient'),
  toDef('min_cc', 'min_cc', 'Minimum correlation coefficient'),
  toDef('zdr', 'zdr', 'Differential reflectivity'),
  toDef('kdp', 'kdp', 'Specific differential phase'),
  toDef('sw', 'sw', 'Spectrum width'),
  toDef('hhc', 'hhc', 'Hydrometeor classification (HCA/HHC)'),
  toDef('qpe', 'qpe', 'Precipitation accumulation/QPE estimate'),
  toDef('precip_rate', 'precip_rate', 'Precipitation rate'),
  toDef('nrot', 'nrot', 'Normalized rotation'),
  toDef('azshear', 'azshear', 'Azimuthal shear'),
  toDef('rotation_tracks', 'rotation_tracks', 'Rotation tracks'),
  toDef('mesh', 'mesh', 'Maximum Estimated Size of Hail'),
  toDef('hail_detection', 'hail_detection', 'Hail detection and hail swaths'),
  toDef('tops', 'tops', 'Echo tops estimate'),
  toDef('vil', 'vil', 'Vertically integrated liquid'),
  toDef('vil_density', 'vil_density', 'VIL density'),
  toDef('cross_section', 'cross_section', 'Reflectivity cross sections'),
  toDef('gate_filter', 'gate_filter', 'Reflectivity gate filtering'),
  toDef('rain_mix_snow', 'rain_mix_snow', 'Rain/mix/snow intensity'),
  toDef('storm_analysis', 'storm_analysis', 'Radar-derived storm analysis'),
  toDef('volume_scan', 'volume_scan', 'Radar volume scans and elevation-angle selection'),
  toDef('tilt_selection', 'tilt_selection', 'Individual radar tilt selection'),
] as const;

export function getProductDef(key: string): RadarProductDef | undefined {
  return RADAR_PRODUCTS.find((p) => p.key === key);
}

export type FrameProvenance = {
  source: string;
  attribution?: string;
  fetchedAt: string;
  productKey: string;
  productLabel?: string;
  productCode?: string;
  sourceKind?: ProductSourceKind;
  substitute: boolean;
  loopAvailable: boolean;
  notes?: string[];
};
