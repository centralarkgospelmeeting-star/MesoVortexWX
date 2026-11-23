/**
 * Radar raster render configuration.
 *
 * Inspired by Supercell-Wx's separation of product/view state from rendering:
 * rendering decisions are centralized and explicit. This module is intentionally
 * conservative: it does not enable unverified products or fabricate data.
 */

export type RadarRasterResampling = 'nearest' | 'linear';

export interface RadarRasterRenderConfig {
  tileSize: number;
  /** Optional MapLibre raster source maxzoom. Undefined preserves overzoom behavior. */
  maxzoom?: number;
  rasterResampling: RadarRasterResampling;
  rasterFadeDuration: number;
}

export const DEFAULT_RADAR_RASTER_TILE_SIZE = 256;
export const DEFAULT_RADAR_RASTER_FADE_DURATION = 0;

const DEFAULT_RADAR_RASTER_RENDER_CONFIG: RadarRasterRenderConfig = {
  tileSize: DEFAULT_RADAR_RASTER_TILE_SIZE,
  rasterResampling: 'nearest',
  rasterFadeDuration: DEFAULT_RADAR_RASTER_FADE_DURATION,
};

const SATELLITE_RASTER_RENDER_CONFIG: RadarRasterRenderConfig = {
  tileSize: DEFAULT_RADAR_RASTER_TILE_SIZE,
  rasterResampling: 'linear',
  rasterFadeDuration: DEFAULT_RADAR_RASTER_FADE_DURATION,
};

/**
 * Product-aware raster render settings for current tile-based radar/satellite sources.
 *
 * Data honesty: this only controls display of already-selected sources; it never
 * upgrades capability availability, archive/playback support, or product verification.
 */
export function getRadarRasterRenderConfig(params: {
  mode?: string | null;
  product?: string | null;
}): RadarRasterRenderConfig {
  if (params.mode === 'Satellite') {
    return { ...SATELLITE_RASTER_RENDER_CONFIG };
  }

  const product = (params.product || '').toLowerCase();
  // Current verified/partial radar products are rasterized gate/value tiles where
  // nearest-neighbor preserves crisp edges at overzoom. Keep conservative defaults.
  if (product === 'ref' || product === 'vel' || product === 'srvel' || product === 'max_ref' || product === 'ref_x' || product === 'hhc') {
    // HHC is categorical raster from verified NCEP opengeo BDHC WMS.
    return { ...DEFAULT_RADAR_RASTER_RENDER_CONFIG };
  }

  return { ...DEFAULT_RADAR_RASTER_RENDER_CONFIG };
}
