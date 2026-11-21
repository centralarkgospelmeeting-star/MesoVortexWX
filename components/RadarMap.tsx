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
  crossSectionMode?: boolean;
  frameUrl?: string | null;
  frameTime?: string;
  showRangeRings?: boolean;
  showRadarPills?: boolean;
  showLightning?: boolean;
  showMcd?: boolean;
  showWarnings?: boolean;
  onSelectSite?: (siteId: string) => void;
  onCrossSectionComplete?: (pointA: [number, number], pointB: [number, number]) => void;
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
const MCD_SOURCE_ID = 'mv-mcd-source';
const MCD_FILL_ID = 'mv-mcd-fill';
const MCD_LINE_ID = 'mv-mcd-line';
const LIGHTNING_SOURCE_ID = 'mv-lightning-sync-source';
const LIGHTNING_LAYER_ID = 'mv-lightning-sync-layer';
const RHI_LINE_SOURCE_ID = 'mv-rhi-baseline-source';
const RHI_LINE_LAYER_ID = 'mv-rhi-baseline-layer';

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

export function RadarMap({
  product = 'ref',
  radarSite = 'KLZK',
  mode = 'Radar',
  tilt = '0.5',
  maxRefWindow = 10,
  basemap = 'satellite-streets',
  radarOpacity = 0.88,
  crossSectionMode = false,
  frameUrl = null,
  frameTime,
  showLightning = true,
  showMcd = true,
  showRadarPills = true,
  onSelectSite,
  onCrossSectionComplete,
}: RadarMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const siteMarkersRef = useRef<maplibregl.Marker[]>([]);
  const rhiMarkersRef = useRef<maplibregl.Marker[]>([]);
  const rhiPointsRef = useRef<[number, number][]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);

  const site =
    RADAR_SITES.find((s) => s.id === radarSite || s.radarId === radarSite) ||
    RADAR_SITES[0];

  // 1. Live NWS Warning Polygons (Dual-Stroke Style)
  const updateWarnings = useCallback((map: MapLibreMap) => {
    fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert')
      .then((res) => res.json())
      .then((geojson) => {
        const polygonFeatures = (geojson.features || []).filter((f: any) => {
          const event = f.properties?.event || '';
          return (
            f.geometry &&
            (event.includes('Warning') || event.includes('Tornado') || event.includes('Thunderstorm') || event.includes('Flood'))
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
        }
      })
      .catch((err) => console.warn('[Warnings Notice]:', err));
  }, []);

  // 2. Live SPC Mesoscale Discussions (MCD) Polygons
  const updateMCDLayer = useCallback((map: MapLibreMap) => {
    fetch('/api/spc/mcd')
      .then((res) => res.json())
      .then((geojson) => {
        const source = map.getSource(MCD_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData(geojson);
        } else {
          map.addSource(MCD_SOURCE_ID, { type: 'geojson', data: geojson });

          map.addLayer({
            id: MCD_FILL_ID,
            type: 'fill',
            source: MCD_SOURCE_ID,
            paint: {
              'fill-color': '#f97316',
              'fill-opacity': 0.14,
            },
          });

          map.addLayer({
            id: MCD_LINE_ID,
            type: 'line',
            source: MCD_SOURCE_ID,
            paint: {
              'line-color': '#ea580c',
              'line-width': 2.5,
              'line-dasharray': [4, 2],
            },
          });

          map.on('click', MCD_FILL_ID, (e) => {
            const props = e.features?.[0]?.properties;
            if (!props) return;

            const mcdNum = props.md_number || props.mcd_number || props.id || 'Active';
            const concerning = props.concerning || props.area_desc || 'Thunderstorm Potential';
            const prob = props.watch_prob || props.probability || 'Watch Likely';

            new maplibregl.Popup({ closeButton: true, offset: 12 })
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family:system-ui;padding:6px;max-width:280px;color:#0f172a;">
                  <span style="background:#ea580c;color:#fff;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:900;text-transform:uppercase;">
                    SPC Mesoscale Discussion #${mcdNum}
                  </span>
                  <div style="font-size:12px;font-weight:800;margin-top:6px;color:#1e293b;">
                    Concerning: ${concerning}
                  </div>
                  <div style="font-size:11px;font-weight:bold;color:#dc2626;margin-top:2px;">
                    Probability of Watch: ${prob}
                  </div>
                  <div style="font-size:10px;color:#64748b;margin-top:4px;max-height:140px;overflow-y:auto;line-height:1.3;">
                    ${props.discussion || props.summary || props.text || 'Forecasters are monitoring convective trends.'}
                  </div>
                </div>`
              )
              .addTo(map);
          });
        }
      })
      .catch((err) => console.warn('[MCD Layer Notice]:', err));
  }, []);

  // 3. Synchronized Lightning Layer (US, Canada, Colombia via GOES GLM)
  const updateSynchronizedLightning = useCallback((map: MapLibreMap) => {
    if (!map.getSource(LIGHTNING_SOURCE_ID)) {
      map.addSource(LIGHTNING_SOURCE_ID, {
        type: 'raster',
        tiles: ['https://realearth.ssec.wisc.edu/tiles/GOESEastGLMFEDRadC/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: 'NOAA GOES GLM Lightning',
      });

      const beforeId = map.getLayer(WARNINGS_FILL_ID) ? WARNINGS_FILL_ID : undefined;

      map.addLayer(
        {
          id: LIGHTNING_LAYER_ID,
          type: 'raster',
          source: LIGHTNING_SOURCE_ID,
          paint: {
            'raster-opacity': 0.85,
            'raster-fade-duration': 0,
          },
          layout: {
            visibility: showLightning ? 'visible' : 'none',
          },
        },
        beforeId
      );
    }
  }, [showLightning]);

  // 4. Radar Layer (Supports Playback Frame Sync & Max Reflectivity)
  const updateRadar = useCallback(
    async (map: MapLibreMap) => {
      setTileError(null);
      let tileUrl = frameUrl || '';

      if (!tileUrl) {
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
        } else {
          try {
            const res = await fetch(
              `/api/nexrad/frames?site=${encodeURIComponent(site.radarId)}&product=${encodeURIComponent(product)}&tilt=${encodeURIComponent(tilt)}`,
              { cache: 'no-store' }
            );
            const data = await res.json();
            tileUrl = data.latestTileUrl;
          } catch {
            tileUrl = `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${site.radarId}-N0B-0/{z}/{x}/{y}.png`;
          }
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

      const beforeId = map.getLayer(MCD_FILL_ID)
        ? MCD_FILL_ID
        : map.getLayer(WARNINGS_FILL_ID)
        ? WARNINGS_FILL_ID
        : undefined;

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
    [mode, product, tilt, maxRefWindow, site.radarId, radarOpacity, frameUrl]
  );

  const renderTowerPills = useCallback(
    (map: MapLibreMap) => {
      siteMarkersRef.current.forEach((m) => m.remove());
      siteMarkersRef.current = [];

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

    setTimeout(() => map.resize(), 100);
    setTimeout(() => map.resize(), 300);

    map.on('load', () => {
      setMapReady(true);
      map.resize();
      updateWarnings(map);
      updateMCDLayer(map);
      updateSynchronizedLightning(map);
      updateRadar(map);
      if (showRadarPills) renderTowerPills(map);
    });

    // Cross-Section baseline click handler
    map.on('click', (e) => {
      if (!crossSectionMode) return;

      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      rhiPointsRef.current.push(coords);

      const isPointA = rhiPointsRef.current.length === 1;
      const markerEl = document.createElement('div');
      markerEl.className = `flex h-6 w-6 items-center justify-center rounded-full font-black text-xs text-white shadow-xl ${
        isPointA ? 'bg-cyan-500 border-2 border-white' : 'bg-purple-600 border-2 border-white'
      }`;
      markerEl.innerText = isPointA ? 'A' : 'B';

      const marker = new maplibregl.Marker({ element: markerEl })
        .setLngLat(coords)
        .addTo(map);
      rhiMarkersRef.current.push(marker);

      if (rhiPointsRef.current.length === 2) {
        const [pA, pB] = rhiPointsRef.current;

        const geojson = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [pA, pB],
          },
        };

        if (map.getSource(RHI_LINE_SOURCE_ID)) {
          (map.getSource(RHI_LINE_SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson as any);
        } else {
          map.addSource(RHI_LINE_SOURCE_ID, { type: 'geojson', data: geojson as any });
          map.addLayer({
            id: RHI_LINE_LAYER_ID,
            type: 'line',
            source: RHI_LINE_SOURCE_ID,
            paint: {
              'line-color': '#06b6d4',
              'line-width': 3,
              'line-dasharray': [3, 2],
            },
          });
        }

        if (onCrossSectionComplete) {
          onCrossSectionComplete(pA, pB);
        }

        rhiPointsRef.current = [];
      }
    });

    return () => {
      siteMarkersRef.current.forEach((m) => m.remove());
      siteMarkersRef.current = [];
      rhiMarkersRef.current.forEach((m) => m.remove());
      rhiMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, crossSectionMode]);

  useEffect(() => {
    if (mapRef.current && mapReady) {
      updateRadar(mapRef.current);
    }
  }, [product, tilt, maxRefWindow, radarOpacity, frameUrl, mapReady, updateRadar]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer(LIGHTNING_LAYER_ID)) {
      map.setLayoutProperty(LIGHTNING_LAYER_ID, 'visibility', showLightning ? 'visible' : 'none');
    }
  }, [showLightning, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer(MCD_FILL_ID) && map.getLayer(MCD_LINE_ID)) {
      const vis = showMcd ? 'visible' : 'none';
      map.setLayoutProperty(MCD_FILL_ID, 'visibility', vis);
      map.setLayoutProperty(MCD_LINE_ID, 'visibility', vis);
    }
  }, [showMcd, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (radarSite !== 'US') {
      map.flyTo({ center: [site.lon, site.lat], zoom: 7.5, duration: 1100 });
    }
  }, [site.lon, site.lat, radarSite, mapReady]);

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden', cursor: crossSectionMode ? 'crosshair' : 'default' }}>
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
