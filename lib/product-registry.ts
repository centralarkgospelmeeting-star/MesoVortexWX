import { RADAR_CAPABILITY_MATRIX, type RadarCapabilityStatus } from './radar/capability-matrix';

export type RadarProductKey =
  | 'ref'
  | 'max_ref'
  | 'vel'
  | 'srvel'
  | 'cc'
  | 'zdr'
  | 'kdp'
  | 'tops'
  | 'vil'
  | 'mesh'
  | 'azshear';

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
  return {
    key,
    label: c?.name || key,
    short: short || c?.shortLabel || key.toUpperCase(),
    description,
    sourceKind: c?.source.type === 'IEM_RIDGE' ? 'nexrad-level3'
      : c?.source.type === 'IEM_MRMS_TMS' || c?.source.type === 'NOAA_AWS_MRMS' ? 'mrms'
      : c?.source.type === 'NONE' ? 'none' : 'unknown',
    substitute: c?.dataHonesty.substitute ?? false,
    loopExpected: c?.playbackSupport === 'REAL_ARCHIVE',
    availability: c?.availability || 'UNAVAILABLE',
    unavailableReason: c?.unavailableReason,
    sourceNote: c?.unavailableReason || c?.source.notes,
    attribution: c?.source.provider || PRODUCT_ATTRIBUTION_IEM,
  };
}

export const RADAR_PRODUCTS: readonly RadarProductDef[] = [
  toDef('ref', 'ref', 'Base reflectivity', 'REF'),
  { ...toDef('ref', 'ref', 'Per-pixel maximum reflectivity composite over selected scan history', 'MAX'), key: 'max_ref' as any, label: 'Max Reflectivity', sourceKind: 'derived', loopExpected: true, substitute: false, sourceNote: 'Client-composited max dBZ from recent reflectivity scans. Depends on real reflectivity frames; no synthetic data.' },
  toDef('vel', 'vel', 'Base velocity', 'VEL'),
  toDef('srvel', 'srvel', 'Storm-relative motion', 'SRV'),
  toDef('cc', 'cc', 'Correlation coefficient', 'CC'),
  toDef('zdr', 'zdr', 'Differential reflectivity', 'ZDR'),
  toDef('kdp', 'kdp', 'Specific differential phase', 'KDP'),
  toDef('tops', 'tops', 'Echo tops estimate', 'TOPS'),
  toDef('vil', 'vil', 'VIL estimate', 'VIL'),
  toDef('mesh', 'mesh', 'Maximum Estimated Size of Hail', 'MESH'),
  toDef('azshear', 'azshear', 'Low-level azimuthal shear / rotation tracks', 'ROT'),
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
