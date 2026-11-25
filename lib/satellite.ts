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
 * Mercator request bounds for the real IEM GOES sectors, derived from live
 * IEM WMS 1.1.1 GetCapabilities LatLonBoundingBox values fetched 2026-11-24/25:
 *   goes_east: conus [-152.11, 14.56, -52.92, 56.78],
 *              fulldisk [-154.32, 0.00, 4.32, 76.82],
 *              puertorico [-77.00, 8.94, -56.46, 26.68]
 *   goes_west: conus [-184.45, 14.56, -89.55, 53.53],
 *              fulldisk [143.68, 0.00, 302.32, 76.82],
 *              alaska [150.47, 41.89, 270.58, 78.99]
 * A small buffer is added, but these are not guesses from sector names. The
 * west full-disk and Alaska footprints cross the antimeridian; one rectangular
 * [west, south, east, north] source bound cannot hold both lobes, so those two
 * deliberately span all longitudes (with honest latitude limits). That can
 * fetch extra transparent tiles, but it does not clip real imagery.
 *
 * Mesoscale sectors are intentionally left unbounded. The same live
 * capabilities show GOES-East meso-1 over [-103.81, 34.03, -84.73, 48.96]
 * while GOES-West meso-1 is over [-176.29, 3.69, -163.12, 13.37]; these boxes
 * follow the storm of the day and move, so a fixed bound would hide imagery.
 */
const FIXED_SATELLITE_TILE_BOUNDS: Partial<Record<SatelliteSector, [number, number, number, number]>> = {
  // Union of east/west CONUS footprints, clamped to the Mercator longitude
  // domain (west CONUS extends 4.45 deg past the antimeridian).
  conus: [-180, 14, -52, 58],
  // Includes the GOES-West eastern lobe (143.68E..180E); latitude 0..76.82
  // from the live WMS, padded rather than inventing southern coverage.
  fulldisk: [-180, -2, 180, 78],
  puertorico: [-79, 7, -54, 29],
  // GOES-West Alaska spans 150.47E through the dateline to 89.39W and to 78.99N.
  alaska: [-180, 40, 180, 80],
};

export function getSatelliteTileBounds(sector: SatelliteSector): [number, number, number, number] | undefined {
  return FIXED_SATELLITE_TILE_BOUNDS[sector];
}

/**
 * Fixed, known-content probe tiles, not bounds-centre guesses. Every coordinate
 * below was fetched live from tile.py on 2026-11-24/25: HTTP 200 image/png,
 * 256x256 RGBA, opaque fraction >=0.85 and non-flat luminance on ch02/ch08/ch13.
 * Verified examples (ch02 / ch08 / ch13 mean luminance):
 *   goes_east_conus_ch02/4/3/6.png        3.4 / 129.2 / 141.1
 *   goes_west_conus_ch02/4/1/6.png       56.2 / 124.9 /  86.4
 *   goes_east_fulldisk_ch02/3/1/2.png     5.2 / 215.5 / 157.2
 *   goes_west_fulldisk_ch02/3/0/2.png    45.1 / 205.8 / 159.2
 *   goes_east_puertorico_ch02/5/10/14.png 3.4 /  84.3 /  34.2 (0.85 opaque)
 *   goes_west_alaska_ch02/4/1/4.png       7.3 / 222.1 / 158.7
 * Low ch02 luminance is nighttime/low sun angle, not an empty tile; those same
 * coordinates carry bright IR/WV imagery. The legacy Himawari ch02 layer
 * returns the same static low-detail red image for every coordinate sampled,
 * so 2/1/1 probes only that the verified legacy endpoint is reachable.
 * Mesoscale returns null: no fixed tile is stable while the sector moves.
 */
const VERIFIED_SATELLITE_PROBE_TILES: Partial<Record<SatelliteBird, Partial<Record<SatelliteSector, string>>>> = {
  'goes-east': { conus: '4/3/6', fulldisk: '3/1/2', puertorico: '5/10/14' },
  'goes-west': { conus: '4/1/6', fulldisk: '3/0/2', alaska: '4/1/4' },
  himawari: { fulldisk: '2/1/1' },
};

/** A representative in-sector tile for availability probing, or null for moving mesoscale sectors. */
export function getSatelliteProbeTile(sel: SatelliteSelection): string | null {
  const selection = normalizeSatelliteSelection(sel);
  return VERIFIED_SATELLITE_PROBE_TILES[selection.bird]?.[selection.sector] ?? null;
}

/**
 * Native-detail ceilings, not TileCache's advertised zoom list. Its metadata
 * reports z0-z23 for every layer, which is generic, not proof of detail.
 * Live IEM source PNGs/world files (data/gis/images/GOES/... fetched 2026-11-24)
 * show ~501 m/pixel for ch02 (CONUS 10000x6000, Puerto Rico 3900x3560,
 * mesoscale 2000x2000, Alaska 7070x2676) and ~2004 m/pixel for ch13
 * (CONUS 2500x1500, mesoscale 500x500); full disk is 1808x904 at 6012 m/pixel
 * for ch02 and 5424x2712 at 2004 m/pixel for ch13. Live tile samples lose
 * high-frequency detail by z8-z9 (IR: >90% identical neighbouring pixels and
 * <1 DN mean edge by z9-z10). The ceilings below stop at or below the finest
 * real pixel size in each sector, so MapLibre overzooms instead of pretending
 * IEM serves detail it does not. No VERIFIED detail is claimed beyond here.
 */
const VERIFIED_SATELLITE_TILE_MAXZOOM: Record<SatelliteSector, number> = {
  fulldisk: 6,
  alaska: 7,
  conus: 8,
  puertorico: 8,
  'mesoscale-1': 8,
  'mesoscale-2': 8,
};

/** Native-detail ceiling. Beyond this MapLibre overzooms existing tiles instead of asking IEM for upscaled tiles. */
export function getSatelliteTileMaxzoom(sector: SatelliteSector): number {
  return VERIFIED_SATELLITE_TILE_MAXZOOM[sector];
}

export function getSatelliteTileUrl(sel: SatelliteSelection): { url: string | null; unavailableReason?: string } {
  const selection = normalizeSatelliteSelection(sel);
  const product = getSatelliteProductDef(selection.productId);

  if (!product.available || !product.channel) {
    return { url: null, unavailableReason: product.unavailableReason || IEM_UNAVAILABLE };
  }

  // Himawari: only the legacy IEM ch02 name was verified. Live tile.py serves a
  // static low-detail image for every coordinate on that layer; no other
  // Himawari channel/sector XYZ layer was verified, so do not fabricate one.
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

  // Live WMS GetCapabilities (2026-11-24/25) and tile.py both reject these
  // GOES-East Puerto Rico channels: the mapfile defines only ch01-10, 13 and 15,
  // and tile.py returns 503 "LayerNotDefined". Do not emit that layer name.
  if (sector === 'puertorico' && ['11', '12', '14', '16'].includes(channel)) {
    return {
      url: null,
      unavailableReason: 'IEM does not publish this channel for GOES-East Puerto Rico',
    };
  }

  // All other bird/sector/channel combinations follow IEM's documented template:
  // goes_<east|west>_<fulldisk|conus|mesoscale-1|mesoscale-2|puertorico|alaska>_ch<01-16>.
  // Fixed sectors were probed live at the in-sector tiles listed above. Moving
  // mesoscale sectors are checked by URL/layer contract only; the static guard
  // enforces the template (see scripts/test-satellite-capability-matrix.mjs).
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
