'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RADAR_SITES } from '../lib/radar-config';
import { computeMaxReflectivityCanvas, interpolateReflectivityFrames } from '../lib/max-reflectivity';

export type ModeTab = 'Radar' | '3D Radar' | 'Composite' | 'Satellite' | 'Models' | 'Outlooks';
export type BasemapType = 'satellite-streets' | 'custom-weather' | 'mapbox' | 'satellite';
export type BasemapId = BasemapType;

export interface SpotterPin {
  id: string;
  hazardType: string;
  description: string;
  hailSize?: string;
  lat: number;
  lon: number;
  timestamp: string;
  callsign: string;
}

export interface RadarMapProps {
  product?: string;
  radarSite?: string;
  mode?: ModeTab | string;
  tilt?: string;
  maxRefWindow?: number;
  basemap?: BasemapType | string;
  spcDay?: 'Day 1' | 'Day 2' | 'Day 3' | string;
  radarOpacity?: number;
  showRangeRings?: boolean;
  showRadarPills?: boolean;
  showLightning?: boolean;
  showLSR?: boolean;
  showWatches?: boolean;
  spotterReports?: SpotterPin[];
  onSelectSite?: (siteId: string) => void;
  onSelectWarningFromMap?: (w: any) => void;
  [key: string]: any;
}

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  [
    'pk',
    'eyJ1IjoiY2VudHJhbGFya2dvc3BlbG1lZXRpbmctc3RhciIsImEiOiJjbXc1ZGZjNzkwN2hxMzBva2dmcWpveWdzIn0',
    'hlPLiOdDno_E9_1aTxTqXA',
  ].join('.');

const CUSTOM_STYLE_ID =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE ||
  'centralarkgospelmeeting-star/cmw9hk6p6001n01s1hch23fhb';

const SATELLITE_STREETS_ID = 'mapbox/satellite-streets-v12';

const RADAR_SOURCE_ID = 'mv-radar-source';
const RADAR_LAYER_ID = 'mv-radar-layer';
const WARNINGS_SOURCE_ID = 'mv-warnings-source';
const WARNINGS_FILL_ID = 'mv-warnings-fill';
const WARNINGS_LINE_OUTER_ID = 'mv-warnings-line-outer';
const WARNINGS_LINE_INNER_ID = 'mv-warnings-line-inner';
const SPC_SOURCE_ID = 'mv-spc-source';
const SPC_FILL_ID = 'mv-spc-fill';
const SPC_LINE_ID = 'mv-spc-line';
const RINGS_SOURCE_ID = 'mv-rings-source';
const RINGS_LAYER_ID = 'mv-rings-layer';
const RINGS_LABEL_ID = 'mv-rings-label';

function buildMapboxRasterStyle(basemap: BasemapType | string): StyleSpecification {
  const isCustom = basemap === 'custom-weather' || basemap === 'mapbox';
  const stylePath = isCustom ? CUSTOM_STYLE_ID : SATELLITE_STREETS_ID;
  const tileUrl = `https://api.mapbox.com/styles/v1/${stylePath}/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;

  return {
    version: 8,
    sources: {
      'mapbox-basemap-source': {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 512,
        attribution: '© Mapbox © OpenStreetMap',
      },
    },
    layers: [
      {
        id: 'mapbox-basemap-layer',
        type: 'raster',
        source: 'mapbox-basemap-source',
      },
    ],
  };
}

function makeRangeRings(lat: number, lon: number) {
  const rings = [25, 50, 100, 124];
  const features: any[] = [];

  rings.forEach((nm) => {
    const coords: [number, number][] = [];
    const pts = 64;
    const radDeg = (nm * 1.852) / 111.32;

    for (let i = 0; i <= pts; i++) {
      const a = (i * 2 * Math.PI) / pts;
      coords.push([
        lon + (radDeg * Math.cos(a)) / Math.cos((lat * Math.PI) / 180),
        lat + radDeg * Math.sin(a),
      ]);
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { label: `${nm} nm` },
    });

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat + radDeg] },
      properties: { label: `${nm} nm` },
    });
  });

  return { type: 'FeatureCollection', features };
}

export function RadarMap({
  product = 'ref',
  radarSite = 'KLZK',
  mode = 'Radar',
  tilt = '0.5',
  maxRefWindow = 10,
  basemap = 'satellite-streets',
  radarOpacity = 0.88,
  showRangeRings = true,
  showRadarPills = true,
  onSelectSite,
  onSelectWarningFromMap,
}: RadarMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);

  const site =
    RADAR_SITES.find((s) => s.id === radarSite || s.radarId === radarSite) ||
    RADAR_SITES[0];

  const updateWarnings = useCallback((map: MapLibreMap) => {
    fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert')
      .then((res) => res.json())
      .then((geojson) => {
        const polygonFeatures = (geojson.features || []).filter((f: any) => {
          const event = f.properties?.event || '';
          return (
            f.geometry &&
            (event.includes('Warning') || event.includes('Tornado') || event.includes('Thunderstorm'))
          );
        });

        const validGeoJSON = { type: 'FeatureCollection', features: polygonFeatures };
        const source = map.getSource(WARNINGS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

        if (source) {
          source.setData(validGeoJSON as any);
        } else {
          map.addSource(WARNINGS_SOURCE_ID, { type: 'geojson', data: validGeoJSON as any });

          map.addLayer({
            id: WARNINGS_FILL_ID,
            type: 'fill',
            source: WARNINGS_SOURCE_ID,
            paint: {
              'fill-color': [
                'match',
                ['get', 'event'],
                'Tornado Warning', '#dc2626',
                'Severe Thunderstorm Warning', '#f59e0b',
                'Flash Flood Warning', '#10b981',
                '#3b82f6',
              ],
              'fill-opacity': 0.18,
            },
          });

          map.addLayer({
            id: WARNINGS_LINE_OUTER_ID,
            type: 'line',
            source: WARNINGS_SOURCE_ID,
            paint: {
              'line-color': [
                'match',
                ['get', 'event'],
                'Tornado Warning', '#dc2626',
                'Severe Thunderstorm Warning', '#ffffff',
                'Flash Flood Warning', '#059669',
                '#1d4ed8',
              ],
              'line-width': 3.5,
            },
          });

          map.addLayer({
            id: WARNINGS_LINE_INNER_ID,
            type: 'line',
            source: WARNINGS_SOURCE_ID,
            paint: {
              'line-color': [
                'match',
                ['get', 'event'],
                'Tornado Warning', '#f87171',
                'Severe Thunderstorm Warning', '#fbbf24',
                'Flash Flood Warning', '#34d399',
                '#60a5fa',
              ],
              'line-width': 1.8,
            },
          });

          map.on('click', WARNINGS_FILL_ID, (e) => {
            const props = e.features?.[0]?.properties;
            if (!props) return;
            if (onSelectWarningFromMap) onSelectWarningFromMap(props);

            const isTor = props.event === 'Tornado Warning';
            new maplibregl.Popup({ closeButton: true, offset: 12 })
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family:system-ui;padding:6px;max-width:260px;color:#0f172a;">
                  <span style="background:${isTor ? '#dc2626' : '#d97706'};color:#fff;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:900;text-transform:uppercase;">
                    ${props.event}
                  </span>
                  <div style="font-size:12px;font-weight:800;margin-top:6px;line-height:1.3;">
                    ${props.headline || props.description || 'Active Warning'}
                  </div>
                  <div style="font-size:10px;color:#64748b;margin-top:4px;">${props.areaDesc || ''}</div>
                </div>`
              )
              .addTo(map);
          });
        }
      })
      .catch((err) => console.warn('[Warnings Notice]:', err));
  }, [onSelectWarningFromMap]);

  const updateRadar = useCallback(
    async (map: MapLibreMap) => {
      setTileError(null);
      let tileUrl = '';

      if (mode === 'Composite') {
        tileUrl = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png';
      } else if (mode === 'Satellite') {
        tileUrl = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-vis-1km-900913/{z}/{x}/{y}.png';
      } else if (product === 'max_ref') {
        try {
          const res = await fetch(
            `/api/nexrad/frames?site=${encodeURIComponent(site.radarId)}&product=ref&tilt=${encodeURIComponent(tilt)}`,
            { cache: 'no-store' }
          );
          const data = await res.json();
          const frames = (data.frames || []).map((f: any) => f.tileUrl);
          const sliceCount = Math.min(frames.length, maxRefWindow);
          tileUrl = await computeMaxReflectivityCanvas(frames.slice(-sliceCount));
        } catch {
          setTileError('Unable to generate Max Reflectivity swath.');
          return;
        }
      } else if (product === 'ref_x') {
        try {
          const res = await fetch(
            `/api/nexrad/frames?site=${encodeURIComponent(site.radarId)}&product=ref&tilt=${encodeURIComponent(tilt)}`,
            { cache: 'no-store' }
          );
          const data = await res.json();
          const frames = (data.frames || []).map((f: any) => f.tileUrl);
          if (frames.length >= 2) {
            tileUrl = await interpolateReflectivityFrames(frames[frames.length - 2], frames[frames.length - 1]);
          } else {
            tileUrl = data.latestTileUrl;
          }
        } catch {
          setTileError('Unable to interpolate Reflectivity X frames.');
          return;
        }
      } else {
        try {
          const res = await fetch(
            `/api/nexrad/frames?site=${encodeURIComponent(site.radarId)}&product=${encodeURIComponent(product)}&tilt=${encodeURIComponent(tilt)}`,
            { cache: 'no-store' }
          );
          if (!res.ok) {
            if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
            if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);
            setTileError(`Product "${product.toUpperCase()}" is unavailable.`);
            return;
          }
          const data = await res.json();
          tileUrl = data.latestTileUrl;
        } catch {
          if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
          if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);
          setTileError(`Network error loading ${product.toUpperCase()}.`);
          return;
        }
      }

      if (!tileUrl) return;

      if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
      if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);

      map.addSource(RADAR_SOURCE_ID, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        scheme: 'xyz',
      });

      const beforeId = map.getLayer(WARNINGS_FILL_ID) ? WARNINGS_FILL_ID : undefined;

      map.addLayer(
        {
          id: RADAR_LAYER_ID,
          type: 'raster',
          source: RADAR_SOURCE_ID,
          paint: {
            'raster-opacity': radarOpacity,
            'raster-fade-duration': 0,
          },
        },
        beforeId
      );
    },
    [mode, product, tilt, maxRefWindow, site.radarId, radarOpacity]
  );

  const updateRangeRings = useCallback((map: MapLibreMap, lat: number, lon: number) => {
    const geojson = makeRangeRings(lat, lon);
    const source = map.getSource(RINGS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(geojson as any);
    } else {
      map.addSource(RINGS_SOURCE_ID, { type: 'geojson', data: geojson as any });

      map.addLayer({
        id: RINGS_LAYER_ID,
        type: 'line',
        source: RINGS_SOURCE_ID,
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#38bdf8',
          'line-width': 1.2,
          'line-dasharray': [4, 4],
          'line-opacity': 0.65,
        },
      });

      map.addLayer({
        id: RINGS_LABEL_ID,
        type: 'symbol',
        source: RINGS_SOURCE_ID,
        filter: ['==', '$type', 'Point'],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-offset': [0, -1],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': '#38bdf8',
          'text-halo-color': '#020617',
          'text-halo-width': 1.5,
        },
      });
    }
  }, []);

  const renderTowerPills = useCallback(
    (map: MapLibreMap) => {
      RADAR_SITES.forEach((s) => {
        const isActive = s.id === radarSite || s.radarId === radarSite;
        const pill = document.createElement('div');
        pill.className = `ww-radar-pill ${isActive ? 'active' : ''}`;
        pill.title = `${s.name} (${s.id})`;
        pill.innerHTML = `<span class="ww-dot"></span><span>${s.radarId}</span>`;
        pill.onclick = (e) => {
          e.stopPropagation();
          onSelectSite?.(s.id);
        };

        new maplibregl.Marker({ element: pill })
          .setLngLat([s.lon, s.lat])
          .addTo(map);
      });
    },
    [radarSite, onSelectSite]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapboxRasterStyle(basemap),
      center: [-98.5795, 39.8283],
      zoom: 4.4,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.on('error', (e: any) => {
      const status = e?.error?.status || e?.status;
      if (status === 404 || status === 503) {
        setTileError(`Tile Error (${status}): Data unavailable for this region.`);
      }
    });

    setTimeout(() => map.resize(), 100);
    setTimeout(() => map.resize(), 300);

    map.on('load', () => {
      setMapReady(true);
      map.resize();
      updateWarnings(map);
      updateRadar(map);
      updateRangeRings(map, site.lat, site.lon);
      if (showRadarPills) renderTowerPills(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const vis = showRangeRings ? 'visible' : 'none';
    if (map.getLayer(RINGS_LAYER_ID)) map.setLayoutProperty(RINGS_LAYER_ID, 'visibility', vis);
    if (map.getLayer(RINGS_LABEL_ID)) map.setLayoutProperty(RINGS_LABEL_ID, 'visibility', vis);
  }, [showRangeRings, mapReady]);

  useEffect(() => {
    if (mapRef.current && mapReady) {
      updateRadar(mapRef.current);
    }
  }, [product, tilt, maxRefWindow, radarOpacity, mapReady, updateRadar]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (radarSite !== 'US') {
      map.flyTo({ center: [site.lon, site.lat], zoom: 7.5, duration: 1100 });
      updateRangeRings(map, site.lat, site.lon);
    }
  }, [site.lon, site.lat, radarSite, mapReady, updateRangeRings]);

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {tileError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-red-500/60 bg-slate-950/95 px-4 py-2 font-mono text-xs text-red-400 shadow-2xl backdrop-blur-md">
          <span>⚠️</span>
          <span>{tileError}</span>
        </div>
      )}
    </div>
  );
}

export default RadarMap;
