export type SatelliteBird = 'goes-east' | 'goes-west' | 'himawari';
export type SatelliteSector = 'conus' | 'fulldisk' | 'mesoscale-1' | 'mesoscale-2' | 'puertorico' | 'alaska';

export type SatelliteProductId =
  | 'geocolor'
  | 'visible'
  | 'ir'
  | 'wv-upper'
  | 'wv-mid'
  | 'wv-lower'
  | 'airmass'
  | 'sandwich'
  | 'day-cloud-phase'
  | 'fire-temperature'
  | 'dust'
  | 'ch01'
  | 'ch02'
  | 'ch03'
  | 'ch04'
  | 'ch05'
  | 'ch06'
  | 'ch07'
  | 'ch08'
  | 'ch09'
  | 'ch10'
  | 'ch11'
  | 'ch12'
  | 'ch13'
  | 'ch14'
  | 'ch15'
  | 'ch16';

export interface SatelliteProductDef {
  id: SatelliteProductId;
  label: string;
  shortLabel: string;
  group: 'Featured' | 'RGB' | 'Visible/IR' | 'Water Vapor' | 'Channels';
  description: string;
  /** IEM GOES channel number for real tile products, if applicable. */
  channel?: string;
  /** True when a real, verified XYZ tile endpoint is available. */
  available: boolean;
  unavailableReason?: string;
}

export interface SatelliteSelection {
  bird: SatelliteBird;
  sector: SatelliteSector;
  productId: SatelliteProductId;
}

export const SATELLITE_BIRDS: Array<{ id: SatelliteBird; label: string }> = [
  { id: 'goes-east', label: 'GOES-East' },
  { id: 'goes-west', label: 'GOES-West' },
  { id: 'himawari', label: 'Himawari' },
];

export const SATELLITE_SECTORS: Array<{ id: SatelliteSector; label: string; birds: SatelliteBird[] }> = [
  { id: 'conus', label: 'CONUS', birds: ['goes-east', 'goes-west'] },
  { id: 'fulldisk', label: 'Full Disk', birds: ['goes-east', 'goes-west', 'himawari'] },
  { id: 'mesoscale-1', label: 'Meso Sector 1', birds: ['goes-east', 'goes-west'] },
  { id: 'mesoscale-2', label: 'Meso Sector 2', birds: ['goes-east', 'goes-west'] },
  { id: 'puertorico', label: 'Puerto Rico', birds: ['goes-east'] },
  { id: 'alaska', label: 'Alaska', birds: ['goes-west'] },
];

const IEM_UNAVAILABLE = 'No verified real XYZ tile source in current IEM/GOES feed';

export const SATELLITE_PRODUCTS: SatelliteProductDef[] = [
  { id: 'geocolor', label: 'GeoColor', shortLabel: 'GeoColor', group: 'Featured', description: 'True color day / multispectral IR night', available: false, unavailableReason: 'No verified real public XYZ tile endpoint; NOAA STAR provides static imagery only' },
  { id: 'visible', label: 'Visible (Ch 02 Red)', shortLabel: 'Visible', group: 'Visible/IR', description: 'Daytime cloud imagery', channel: '02', available: true },
  { id: 'ir', label: 'Clean Longwave IR (Ch 13)', shortLabel: 'Infrared', group: 'Visible/IR', description: 'Day and night cloud-top temperatures', channel: '13', available: true },
  { id: 'wv-upper', label: 'Upper-Level Water Vapor (Ch 08)', shortLabel: 'WV Upper', group: 'Water Vapor', description: 'Upper-level moisture / jet stream', channel: '08', available: true },
  { id: 'wv-mid', label: 'Mid-Level Water Vapor (Ch 09)', shortLabel: 'WV Mid', group: 'Water Vapor', description: 'Mid-level moisture / dry slots', channel: '09', available: true },
  { id: 'wv-lower', label: 'Lower-Level Water Vapor (Ch 10)', shortLabel: 'WV Lower', group: 'Water Vapor', description: 'Lower-level moisture', channel: '10', available: true },
  { id: 'airmass', label: 'AirMass RGB', shortLabel: 'AirMass', group: 'RGB', description: 'RGB based on IR & water vapor', available: false, unavailableReason: 'No verified real public XYZ tile endpoint; NOAA STAR provides static imagery only' },
  { id: 'sandwich', label: 'Sandwich RGB', shortLabel: 'Sandwich', group: 'RGB', description: 'IR band 13 + visible band 3 blend', available: false, unavailableReason: 'No verified real public XYZ tile endpoint; NOAA STAR provides static imagery only' },
  { id: 'day-cloud-phase', label: 'Day Cloud Phase RGB', shortLabel: 'Cloud Phase', group: 'RGB', description: 'Daytime cloud phase distinction', available: false, unavailableReason: 'No verified real public XYZ tile endpoint; NOAA STAR provides static imagery only' },
  { id: 'fire-temperature', label: 'Fire Temperature RGB', shortLabel: 'Fire Temp', group: 'RGB', description: 'Fire/hotspot identification', available: false, unavailableReason: 'No verified real public XYZ tile endpoint; NOAA STAR provides static imagery only' },
  { id: 'dust', label: 'Dust RGB', shortLabel: 'Dust', group: 'RGB', description: 'Dust detection RGB', available: false, unavailableReason: 'No verified real public XYZ tile endpoint; NOAA STAR provides static imagery only' },
  { id: 'ch01', label: 'Ch 01 - Blue Visible (0.47µm)', shortLabel: 'Ch01', group: 'Channels', description: 'Visible blue', channel: '01', available: true },
  { id: 'ch02', label: 'Ch 02 - Red Visible (0.64µm)', shortLabel: 'Ch02', group: 'Channels', description: 'Visible red', channel: '02', available: true },
  { id: 'ch03', label: 'Ch 03 - Veggie (0.86µm)', shortLabel: 'Ch03', group: 'Channels', description: 'Near-IR vegetation', channel: '03', available: true },
  { id: 'ch04', label: 'Ch 04 - Cirrus (1.37µm)', shortLabel: 'Ch04', group: 'Channels', description: 'Near-IR cirrus', channel: '04', available: true },
  { id: 'ch05', label: 'Ch 05 - Snow/Ice (1.6µm)', shortLabel: 'Ch05', group: 'Channels', description: 'Near-IR snow/ice', channel: '05', available: true },
  { id: 'ch06', label: 'Ch 06 - Cloud Particle (2.2µm)', shortLabel: 'Ch06', group: 'Channels', description: 'Near-IR cloud particle', channel: '06', available: true },
  { id: 'ch07', label: 'Ch 07 - Shortwave IR (3.9µm)', shortLabel: 'Ch07', group: 'Channels', description: 'Shortwave IR', channel: '07', available: true },
  { id: 'ch08', label: 'Ch 08 - Upper Water Vapor (6.2µm)', shortLabel: 'Ch08', group: 'Channels', description: 'Upper-level water vapor', channel: '08', available: true },
  { id: 'ch09', label: 'Ch 09 - Mid Water Vapor (6.9µm)', shortLabel: 'Ch09', group: 'Channels', description: 'Mid-level water vapor', channel: '09', available: true },
  { id: 'ch10', label: 'Ch 10 - Lower Water Vapor (7.3µm)', shortLabel: 'Ch10', group: 'Channels', description: 'Lower-level water vapor', channel: '10', available: true },
  { id: 'ch11', label: 'Ch 11 - Cloud-Top Phase (8.4µm)', shortLabel: 'Ch11', group: 'Channels', description: 'Cloud-top phase IR', channel: '11', available: true },
  { id: 'ch12', label: 'Ch 12 - Ozone (9.6µm)', shortLabel: 'Ch12', group: 'Channels', description: 'Ozone IR', channel: '12', available: true },
  { id: 'ch13', label: 'Ch 13 - Clean Longwave IR (10.3µm)', shortLabel: 'Ch13', group: 'Channels', description: 'Clean longwave IR', channel: '13', available: true },
  { id: 'ch14', label: 'Ch 14 - Longwave IR (11.2µm)', shortLabel: 'Ch14', group: 'Channels', description: 'Longwave IR', channel: '14', available: true },
  { id: 'ch15', label: 'Ch 15 - Dirty Longwave IR (12.3µm)', shortLabel: 'Ch15', group: 'Channels', description: 'Dirty longwave IR', channel: '15', available: true },
  { id: 'ch16', label: 'Ch 16 - CO2 Longwave IR (13.3µm)', shortLabel: 'Ch16', group: 'Channels', description: 'CO2 longwave IR', channel: '16', available: true },
];

export const DEFAULT_SATELLITE_SELECTION: SatelliteSelection = {
  bird: 'goes-east',
  sector: 'conus',
  productId: 'visible',
};

export function getSatelliteProductDef(id: SatelliteProductId | string | undefined): SatelliteProductDef {
  return SATELLITE_PRODUCTS.find((p) => p.id === id) || SATELLITE_PRODUCTS.find((p) => p.id === 'visible')!;
}

export function getSectorsForBird(bird: SatelliteBird): Array<{ id: SatelliteSector; label: string }> {
  return SATELLITE_SECTORS.filter((s) => s.birds.includes(bird)).map(({ id, label }) => ({ id, label }));
}

export function isSectorSupported(bird: SatelliteBird, sector: SatelliteSector): boolean {
  return SATELLITE_SECTORS.some((s) => s.id === sector && s.birds.includes(bird));
}

export function normalizeSatelliteSelection(sel: Partial<SatelliteSelection> | null | undefined): SatelliteSelection {
  const bird = SATELLITE_BIRDS.some((b) => b.id === sel?.bird) ? (sel!.bird as SatelliteBird) : DEFAULT_SATELLITE_SELECTION.bird;
  const sector = isSectorSupported(bird, sel?.sector as SatelliteSector) ? (sel!.sector as SatelliteSector) : (getSectorsForBird(bird)[0]?.id || 'conus');
  const productId = SATELLITE_PRODUCTS.some((p) => p.id === sel?.productId) ? (sel!.productId as SatelliteProductId) : DEFAULT_SATELLITE_SELECTION.productId;
  return { bird, sector, productId };
}

/**
 * Approximate geographic coverage used to stop MapLibre requesting GOES tiles
 * outside the selected sector. These are deliberately broad: hiding valid
 * imagery is worse than requesting a few transparent edge tiles.
 * Mesoscale sectors move, so they intentionally have no fixed bounds.
 */
export function getSatelliteTileBounds(sector: SatelliteSector): [number, number, number, number] | undefined {
  switch (sector) {
    case 'conus':
      return [-130, 20, -60, 55];
    case 'fulldisk':
      return [-170, -80, 10, 80];
    case 'puertorico':
      return [-90, 5, -50, 35];
    case 'alaska':
      return [-180, 45, -110, 75];
    case 'mesoscale-1':
    case 'mesoscale-2':
    default:
      return undefined;
  }
}

/** A representative in-sector tile for availability probing, or null for moving mesoscale sectors. */
export function getSatelliteProbeTile(sel: SatelliteSelection): string | null {
  const selection = normalizeSatelliteSelection(sel);
  const bounds = getSatelliteTileBounds(selection.sector);
  if (!bounds) return null;

  const z = selection.sector === 'fulldisk' ? 2 : selection.sector === 'alaska' ? 3 : 4;
  const lng = (bounds[0] + bounds[2]) / 2;
  const lat = (bounds[1] + bounds[3]) / 2;
  const scale = 2 ** z;
  const x = Math.max(0, Math.min(scale - 1, Math.floor(((lng + 180) / 360) * scale)));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.max(
    0,
    Math.min(
      scale - 1,
      Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale)
    )
  );
  return `${z}/${x}/${y}`;
}

/** Native-detail ceiling. Beyond this MapLibre overzooms existing tiles instead of asking IEM for upscaled tiles. */
export function getSatelliteTileMaxzoom(sector: SatelliteSector): number {
  switch (sector) {
    case 'mesoscale-1':
    case 'mesoscale-2':
      return 11;
    case 'fulldisk':
    case 'alaska':
      return 9;
    case 'conus':
    case 'puertorico':
    default:
      return 10;
  }
}

export function getSatelliteTileUrl(sel: SatelliteSelection): { url: string | null; unavailableReason?: string } {
  const selection = normalizeSatelliteSelection(sel);
  const product = getSatelliteProductDef(selection.productId);

  if (!product.available || !product.channel) {
    return { url: null, unavailableReason: product.unavailableReason || IEM_UNAVAILABLE };
  }

  // Himawari: only legacy IEM name verified for ch02; other Himawari channels/sectors not verified as XYZ tiles.
  if (selection.bird === 'himawari') {
    if (selection.productId === 'visible' || selection.productId === 'ch02') {
      return { url: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes_himawari_ch02/{z}/{x}/{y}.png' };
    }
    return { url: null, unavailableReason: 'Himawari tile source not verified for this product/sector in IEM TMS' };
  }

  if (!isSectorSupported(selection.bird, selection.sector)) {
    return { url: null, unavailableReason: 'Sector not available for selected satellite' };
  }

  const bird = selection.bird === 'goes-east' ? 'east' : 'west';
  const sector = selection.sector;
  const channel = product.channel;
  return {
    url: `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes_${bird}_${sector}_ch${channel}/{z}/{x}/{y}.png`,
  };
}

export function getSatelliteLabel(sel: SatelliteSelection): string {
  const s = normalizeSatelliteSelection(sel);
  const bird = SATELLITE_BIRDS.find((b) => b.id === s.bird)?.label || s.bird;
  const sector = SATELLITE_SECTORS.find((x) => x.id === s.sector)?.label || s.sector;
  const product = getSatelliteProductDef(s.productId);
  return `${bird} ${sector} ${product.shortLabel}`;
}

// Back-compat exports for existing imports
export type SatelliteProduct = 'visible' | 'infrared' | 'waterVapor';
export const DEFAULT_SATELLITE_PRODUCT: SatelliteProduct = 'visible';
export function getSatelliteProductDefLegacy(id: SatelliteProduct | string | undefined): SatelliteProductDef {
  if (id === 'infrared') return getSatelliteProductDef('ir');
  if (id === 'waterVapor') return getSatelliteProductDef('wv-upper');
  return getSatelliteProductDef('visible');
}
