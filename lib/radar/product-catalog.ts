import { getRadarCapability, type RadarProductCapability } from './capability-matrix';

/**
 * Phase 4B product organization.
 *
 * The catalog is grouped by data domain before it is grouped by meteorological
 * family. Radar Products come from an individual radar site; Composite
 * Products come from a national mosaic or multi-radar/large-scale processing
 * system. Every entry resolves availability from the authoritative capability
 * matrix, so reorganizing the catalog cannot silently enable a product.
 */
export type ProductDomain = 'RADAR' | 'COMPOSITE';

export type RadarCategory =
  | 'Reflectivity'
  | 'Velocity'
  | 'Polarimetric Products'
  | 'Classification Products'
  | 'Severe Analysis'
  | 'Tilt Products'
  | 'Unverified / Not Claimed';

export type CompositeCategory =
  | 'National Mosaic'
  | 'Rotation Products'
  | 'Hail Products'
  | 'Echo Tops'
  | 'VIL Products'
  | 'QPE Products';

export type ProductCategory = RadarCategory | CompositeCategory;

export type CatalogProduct = {
  key: string;
  capId: string;
  short: string;
  label: string;
  domain: ProductDomain;
  category: ProductCategory;
};

export const PRODUCT_DOMAINS: ReadonlyArray<{
  id: ProductDomain;
  label: string;
  description: string;
}> = [
  {
    id: 'RADAR',
    label: 'Radar Products',
    description: 'Generated from an individual radar site. Tilt and site selection apply where verified.',
  },
  {
    id: 'COMPOSITE',
    label: 'Composite Products',
    description: 'Created from multiple radars or national processing systems. No per-site tilt semantics.',
  },
];

export const RADAR_CATEGORIES: readonly RadarCategory[] = [
  'Reflectivity',
  'Velocity',
  'Polarimetric Products',
  'Classification Products',
  'Severe Analysis',
  'Tilt Products',
  'Unverified / Not Claimed',
];

export const COMPOSITE_CATEGORIES: readonly CompositeCategory[] = [
  'National Mosaic',
  'Rotation Products',
  'Hail Products',
  'Echo Tops',
  'VIL Products',
  'QPE Products',
];

export const PRODUCT_CATALOG: readonly CatalogProduct[] = [
  // Radar Products — single-site sources only.
  { key: 'ref', capId: 'ref', short: 'REF', label: 'Base Reflectivity (N0B family)', domain: 'RADAR', category: 'Reflectivity' },
  { key: 'max_ref', capId: 'max_ref', short: 'MAX', label: 'Maximum Reflectivity', domain: 'RADAR', category: 'Reflectivity' },
  { key: 'vel', capId: 'vel', short: 'VEL', label: 'Base Velocity', domain: 'RADAR', category: 'Velocity' },
  { key: 'srvel', capId: 'srvel', short: 'SRV', label: 'Storm-Relative Velocity', domain: 'RADAR', category: 'Velocity' },
  { key: 'cc', capId: 'cc', short: 'CC', label: 'Correlation Coefficient', domain: 'RADAR', category: 'Polarimetric Products' },
  { key: 'min_cc', capId: 'min_cc', short: 'MCC', label: 'Minimum Correlation Coefficient', domain: 'RADAR', category: 'Polarimetric Products' },
  { key: 'zdr', capId: 'zdr', short: 'ZDR', label: 'Differential Reflectivity', domain: 'RADAR', category: 'Polarimetric Products' },
  { key: 'kdp', capId: 'kdp', short: 'KDP', label: 'Specific Differential Phase', domain: 'RADAR', category: 'Polarimetric Products' },
  { key: 'sw', capId: 'sw', short: 'SW', label: 'Spectrum Width', domain: 'RADAR', category: 'Polarimetric Products' },
  { key: 'hhc', capId: 'hhc', short: 'HHC', label: 'Hydrometeor Classification', domain: 'RADAR', category: 'Classification Products' },
  { key: 'gate_to_gate_shear', capId: 'gate_to_gate_shear', short: 'GATE', label: 'Gate-to-Gate Velocity Shear', domain: 'RADAR', category: 'Severe Analysis' },
  { key: 'norm_vel', capId: 'nrot', short: 'NROT', label: 'Normalized Rotation', domain: 'RADAR', category: 'Severe Analysis' },
  { key: 'volume_scan', capId: 'volume_scan', short: 'VOL', label: 'Volume Scan / Elevation Selection', domain: 'RADAR', category: 'Tilt Products' },
  { key: 'tilt_selection', capId: 'tilt_selection', short: 'TILT', label: 'Individual Tilt Selection', domain: 'RADAR', category: 'Tilt Products' },
  { key: 'cross_section', capId: 'cross_section', short: 'XSEC', label: 'Reflectivity Cross Sections', domain: 'RADAR', category: 'Unverified / Not Claimed' },
  { key: 'storm_analysis', capId: 'storm_analysis', short: 'ANLZ', label: 'Radar-Derived Storm Analysis', domain: 'RADAR', category: 'Unverified / Not Claimed' },
  { key: 'super_res_ref', capId: 'super_res_ref', short: 'SR-R', label: 'Super-Resolution Reflectivity', domain: 'RADAR', category: 'Unverified / Not Claimed' },
  { key: 'super_res_vel', capId: 'super_res_vel', short: 'SR-V', label: 'Super-Resolution Velocity', domain: 'RADAR', category: 'Unverified / Not Claimed' },

  // Composite Products — national mosaic / MRMS / multi-radar sources only.
  { key: 'comp_ref', capId: 'composite_n0q', short: 'N0Q', label: 'Composite Reflectivity (National N0Q)', domain: 'COMPOSITE', category: 'National Mosaic' },
  { key: 'azshear', capId: 'azshear', short: 'AZ', label: 'Azimuthal Shear (0–2 km)', domain: 'COMPOSITE', category: 'Rotation Products' },
  { key: 'rotation_tracks', capId: 'rotation_tracks', short: 'TRK', label: 'Rotation Tracks (30-min)', domain: 'COMPOSITE', category: 'Rotation Products' },
  { key: 'mesh', capId: 'mesh', short: 'MESH', label: 'MESH', domain: 'COMPOSITE', category: 'Hail Products' },
  { key: 'hail_detection', capId: 'hail_detection', short: 'HAIL', label: 'Hail Severity Index (SHI)', domain: 'COMPOSITE', category: 'Hail Products' },
  { key: 'tops', capId: 'tops', short: 'ET', label: 'Echo Tops (18 dBZ)', domain: 'COMPOSITE', category: 'Echo Tops' },
  { key: 'vil', capId: 'vil', short: 'VIL', label: 'Vertically Integrated Liquid', domain: 'COMPOSITE', category: 'VIL Products' },
  { key: 'vil_density', capId: 'vil_density', short: 'VILD', label: 'VIL Density', domain: 'COMPOSITE', category: 'VIL Products' },
  { key: 'qpe', capId: 'qpe', short: 'QPE', label: 'One-Hour MultiSensor QPE', domain: 'COMPOSITE', category: 'QPE Products' },
  { key: 'precip_rate', capId: 'precip_rate', short: 'RATE', label: 'Precipitation Rate', domain: 'COMPOSITE', category: 'QPE Products' },
  { key: 'rain_mix_snow', capId: 'rain_mix_snow', short: 'RMS', label: 'Surface Precipitation Type', domain: 'COMPOSITE', category: 'QPE Products' },
];

export type CatalogProductView = CatalogProduct & {
  available: boolean;
  reason?: string;
  warning?: string;
  cap: RadarProductCapability | undefined;
};

export function getCatalogProductViews(): CatalogProductView[] {
  return PRODUCT_CATALOG.map((p) => {
    const cap = getRadarCapability(p.capId);
    const available = cap?.availability === 'WORKING' || cap?.availability === 'PARTIAL';
    return {
      ...p,
      cap,
      available,
      reason: !available ? (cap?.unavailableReason || cap?.dataHonesty.reason || 'DATA UNAVAILABLE - No verified source.') : undefined,
      warning: cap?.availability === 'PARTIAL' ? (cap.dataHonesty.reason || 'PARTIAL - Limited verification.') : undefined,
    };
  });
}

export function getCatalogProduct(key: string): CatalogProductView | undefined {
  return getCatalogProductViews().find((p) => p.key === key);
}

export function categoriesForDomain(domain: ProductDomain): readonly ProductCategory[] {
  return domain === 'RADAR' ? RADAR_CATEGORIES : COMPOSITE_CATEGORIES;
}
