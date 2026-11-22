export type SatelliteProduct = 'visible' | 'infrared' | 'waterVapor';

export interface SatelliteProductDef {
  id: SatelliteProduct;
  label: string;
  shortLabel: string;
  description: string;
  /** Real IEM GOES-East tile endpoint template. */
  tileUrl: string;
}

export const SATELLITE_PRODUCTS: SatelliteProductDef[] = [
  {
    id: 'visible',
    label: 'GOES-East Visible',
    shortLabel: 'Visible',
    description: 'Daytime cloud imagery',
    tileUrl:
      'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-vis-1km-900913/{z}/{x}/{y}.png',
  },
  {
    id: 'infrared',
    label: 'GOES-East Infrared',
    shortLabel: 'Infrared',
    description: 'Day and night cloud-top temperatures',
    tileUrl:
      'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-ir-4km-900913/{z}/{x}/{y}.png',
  },
  {
    id: 'waterVapor',
    label: 'GOES-East Water Vapor',
    shortLabel: 'Water Vapor',
    description: 'Jet stream, dry slots, mid/upper-level moisture',
    tileUrl:
      'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-wv-4km-900913/{z}/{x}/{y}.png',
  },
];

export const DEFAULT_SATELLITE_PRODUCT: SatelliteProduct = 'visible';

export function getSatelliteProductDef(
  id: SatelliteProduct | string | undefined
): SatelliteProductDef {
  return (
    SATELLITE_PRODUCTS.find((p) => p.id === id) || SATELLITE_PRODUCTS[0]
  );
}
