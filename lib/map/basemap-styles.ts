import type { StyleSpecification } from 'maplibre-gl';

/**
 * Keyless base-map styles for MesoVortexWX.
 *
 * Both styles use the OpenFreeMap vector planet (OpenMapTiles schema) for roads,
 * labels, boundaries and building height. The satellite style places public Esri
 * World Imagery underneath a deliberately small transparent vector overlay so
 * imagery remains primary and weather radar stays readable.
 */

export type BasemapProjection = 'mercator' | 'globe';

export const BASEMAP_VECTOR_SOURCE_ID = 'mv-basemap-vector';
export const BASEMAP_IMAGERY_SOURCE_ID = 'mv-basemap-imagery';
export const BASEMAP_SOURCE_IDS = [BASEMAP_VECTOR_SOURCE_ID, BASEMAP_IMAGERY_SOURCE_ID];

const OFM_TILEJSON = 'https://tiles.openfreemap.org/planet';
const OFM_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const OFM_SPRITE = 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm';
const ESRI_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAPTILER_IMAGERY = MAPTILER_KEY
  ? `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`
  : null;

const OFM_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
const ESRI_ATTRIBUTION =
  'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community';
const IMAGERY_TILES = MAPTILER_IMAGERY ? [MAPTILER_IMAGERY] : [ESRI_IMAGERY];
const IMAGERY_ATTRIBUTION = MAPTILER_IMAGERY ? '© MapTiler' : ESRI_ATTRIBUTION;

const GLOBE_SKY = {
  'sky-color': '#0A1B2E',
  'sky-horizon-blend': 0.5,
  'horizon-color': '#27445F',
  'horizon-fog-blend': 0.55,
  'fog-color': '#0B1626',
  'fog-ground-blend': 0.55,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 0.9, 12, 0],
};

const labelSize = (min: number, mid: number, max: number) =>
  ['interpolate', ['linear'], ['zoom'], 4, min, 9, mid, 14, max] as any;

const lineWidth = (small: number, large: number) =>
  ['interpolate', ['linear'], ['zoom'], 5, small, 14, large] as any;

const nameField = ['coalesce', ['get', 'name:en'], ['get', 'name']] as any;

function commonSources(withImagery: boolean) {
  return {
    ...(withImagery
      ? {
          [BASEMAP_IMAGERY_SOURCE_ID]: {
            type: 'raster' as const,
            tiles: IMAGERY_TILES,
            tileSize: 256,
            maxzoom: 19,
            attribution: IMAGERY_ATTRIBUTION,
          },
        }
      : {}),
    [BASEMAP_VECTOR_SOURCE_ID]: {
      type: 'vector' as const,
      url: OFM_TILEJSON,
      attribution: OFM_ATTRIBUTION,
    },
  };
}

function buildingLayer(style: 'dark' | 'hybrid') {
  const dark = style === 'dark';
  return {
    id: 'mv-buildings-3d',
    type: 'fill-extrusion',
    source: BASEMAP_VECTOR_SOURCE_ID,
    'source-layer': 'building',
    minzoom: 14,
    filter: ['all', ['!', ['has', 'hide_3d']], ['has', 'render_height']],
    paint: {
      'fill-extrusion-color': dark ? '#263B52' : '#D6E4F0',
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 0],
      'fill-extrusion-opacity': dark ? 0.9 : 0.5,
      'fill-extrusion-vertical-gradient': true,
    },
  };
}

function placeLabels(style: 'dark' | 'hybrid') {
  const dark = style === 'dark';
  const textColor = dark ? '#A9BED1' : '#FFFFFF';
  const haloColor = dark ? '#050B14' : 'rgba(0,0,0,0.85)';
  const haloWidth = dark ? 1 : 1.2;
  const groups: Array<{ id: string; classes: string[]; min: number; mid: number; max: number; weight?: 'bold' | 'regular' }> = [
    { id: 'country', classes: ['country'], min: 10, mid: 11, max: 12, weight: 'bold' },
    { id: 'state', classes: ['state'], min: 9, mid: 10, max: 11 },
    { id: 'city', classes: ['city', 'town'], min: 10, mid: 11, max: 12, weight: 'bold' },
    { id: 'small-place', classes: ['village', 'suburb', 'other'], min: 9, mid: 10, max: 11 },
  ];

  return groups.map((group) => ({
    id: `mv-place-label-${group.id}`,
    type: 'symbol',
    source: BASEMAP_VECTOR_SOURCE_ID,
    'source-layer': 'place',
    minzoom: group.id === 'country' ? 2 : group.id === 'state' ? 3 : 5,
    filter: ['in', ['get', 'class'], ['literal', group.classes]],
    layout: {
      'text-field': nameField,
      'text-font': [group.weight === 'bold' ? 'Noto Sans Bold' : 'Noto Sans Regular'],
      'text-size': labelSize(group.min, group.mid, group.max),
      'text-anchor': 'center',
      'text-allow-overlap': group.id === 'country' || group.id === 'state',
      'text-optional': true,
    },
    paint: {
      'text-color': textColor,
      'text-halo-color': haloColor,
      'text-halo-width': haloWidth,
      'text-halo-blur': 0.5,
    },
  }));
}

function roadLayers(style: 'dark' | 'hybrid') {
  const dark = style === 'dark';
  const groups = [
    { id: 'major', classes: ['motorway', 'trunk', 'primary'], width: [0.8, 3.2] },
    { id: 'secondary', classes: ['secondary', 'tertiary'], width: [0.5, 2.2] },
    { id: 'minor', classes: ['minor', 'service'], width: [0.3, 1.2] },
  ];

  const casing = groups.map((group) => ({
    id: `mv-road-${group.id}-casing`,
    type: 'line',
    source: BASEMAP_VECTOR_SOURCE_ID,
    'source-layer': 'transportation',
    minzoom: group.id === 'minor' ? 10 : 6,
    filter: ['all', ['in', ['get', 'class'], ['literal', group.classes]], ['!', ['has', 'brunnel']]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': dark ? '#050B14' : 'rgba(0,0,0,0.65)',
      'line-width': lineWidth(group.width[0] + 1.4, group.width[1] + 2.6),
      'line-opacity': dark ? 0.9 : 0.8,
    },
  }));

  const core = groups.map((group) => ({
    id: `mv-road-${group.id}`,
    type: 'line',
    source: BASEMAP_VECTOR_SOURCE_ID,
    'source-layer': 'transportation',
    minzoom: group.id === 'minor' ? 10 : 6,
    filter: ['all', ['in', ['get', 'class'], ['literal', group.classes]], ['!', ['has', 'brunnel']]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': dark
        ? group.id === 'major'
          ? '#334C66'
          : '#23384D'
        : group.id === 'major'
          ? '#FFE1A8'
          : '#F2F6FA',
      'line-width': lineWidth(group.width[0], group.width[1]),
      'line-opacity': dark ? 0.95 : 0.9,
    },
  }));

  return [...casing, ...core];
}

function boundaryLayer(style: 'dark' | 'hybrid') {
  const dark = style === 'dark';
  return {
    id: 'mv-boundaries',
    type: 'line',
    source: BASEMAP_VECTOR_SOURCE_ID,
    'source-layer': 'boundary',
    minzoom: 2,
    filter: ['in', ['get', 'admin_level'], ['literal', [2, 4]]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': dark ? '#263A52' : 'rgba(255,255,255,0.6)',
      'line-width': lineWidth(0.5, 1.4),
      'line-dasharray': [2, 2],
      'line-opacity': dark ? 0.9 : 0.8,
    },
  };
}

function roadNameLabels(style: 'dark' | 'hybrid') {
  const dark = style === 'dark';
  return {
    id: 'mv-road-names',
    type: 'symbol',
    source: BASEMAP_VECTOR_SOURCE_ID,
    'source-layer': 'transportation_name',
    minzoom: 11,
    layout: {
      'symbol-placement': 'line',
      'text-field': nameField,
      'text-font': ['Noto Sans Regular'],
      'text-size': labelSize(9, 10, 11),
      'text-rotation-alignment': 'map',
    },
    paint: {
      'text-color': dark ? '#7E96AC' : '#F4F8FC',
      'text-halo-color': dark ? '#050B14' : 'rgba(0,0,0,0.85)',
      'text-halo-width': 1,
    },
  };
}

function waterLabels(style: 'dark' | 'hybrid') {
  const dark = style === 'dark';
  return {
    id: 'mv-water-labels',
    type: 'symbol',
    source: BASEMAP_VECTOR_SOURCE_ID,
    'source-layer': 'water_name',
    minzoom: 4,
    layout: {
      'text-field': nameField,
      'text-font': ['Noto Sans Italic'],
      'text-size': labelSize(10, 11, 12),
    },
    paint: {
      'text-color': dark ? '#6FA8C7' : '#D7ECFF',
      'text-halo-color': dark ? '#050B14' : 'rgba(0,0,0,0.8)',
      'text-halo-width': 1,
    },
  };
}

function shell(projection: BasemapProjection) {
  return {
    projection: { type: projection },
    sky: GLOBE_SKY,
    glyphs: OFM_GLYPHS,
    sprite: OFM_SPRITE,
  };
}

export function buildDarkNightStyle(projection: BasemapProjection): StyleSpecification {
  const style = {
    ...shell(projection),
    version: 8,
    name: 'mesovortex-dark-night',
    sources: commonSources(false),
    layers: [
      {
        id: 'mv-background',
        type: 'background',
        paint: { 'background-color': '#050B14' },
      },
      {
        id: 'mv-landcover',
        type: 'fill',
        source: BASEMAP_VECTOR_SOURCE_ID,
        'source-layer': 'landcover',
        paint: { 'fill-color': '#0A1422', 'fill-opacity': 0.8 },
      },
      {
        id: 'mv-landuse',
        type: 'fill',
        source: BASEMAP_VECTOR_SOURCE_ID,
        'source-layer': 'landuse',
        paint: { 'fill-color': '#0B1626', 'fill-opacity': 0.65 },
      },
      {
        id: 'mv-water',
        type: 'fill',
        source: BASEMAP_VECTOR_SOURCE_ID,
        'source-layer': 'water',
        paint: { 'fill-color': '#071B2B', 'fill-opacity': 0.95 },
      },
      ...roadLayers('dark'),
      boundaryLayer('dark'),
      {
        id: 'mv-building-footprints',
        type: 'fill',
        source: BASEMAP_VECTOR_SOURCE_ID,
        'source-layer': 'building',
        minzoom: 13,
        paint: { 'fill-color': '#101E30', 'fill-opacity': 0.85 },
      },
      buildingLayer('dark'),
      waterLabels('dark'),
      roadNameLabels('dark'),
      ...placeLabels('dark'),
    ],
  };

  return style as unknown as StyleSpecification;
}

export function buildSatelliteHybridStyle(projection: BasemapProjection): StyleSpecification {
  const style = {
    ...shell(projection),
    version: 8,
    name: 'mesovortex-satellite-hybrid',
    sources: commonSources(true),
    layers: [
      {
        id: 'mv-imagery',
        type: 'raster',
        source: BASEMAP_IMAGERY_SOURCE_ID,
        paint: { 'raster-opacity': 1, 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
      },
      ...roadLayers('hybrid'),
      boundaryLayer('hybrid'),
      buildingLayer('hybrid'),
      waterLabels('hybrid'),
      roadNameLabels('hybrid'),
      ...placeLabels('hybrid'),
    ],
  };

  return style as unknown as StyleSpecification;
}

export function buildBasemapStyle(basemap: string | undefined, projection: BasemapProjection): StyleSpecification {
  const value = (basemap || '').toLowerCase();
  if (value === 'satellite-streets' || value === 'satellite' || value === 'mapbox') {
    return buildSatelliteHybridStyle(projection);
  }
  return buildDarkNightStyle(projection);
}
