'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RADAR_SITES } from '../lib/radar-config';
import { computeMaxReflectivityCanvas, interpolateReflectivityFrames } from '../lib/max-reflectivity';
import type { SpotterReport } from './SpotterNetworkPanel';

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
  showRangeRings?: boolean;
  showRadarPills?: boolean;
  spotterData?: SpotterReport[];          // Live spotter pins & reports
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
// IEM raster tile layer for ALL active NWS warnings/watches/advisories
const WARNINGS_TILES_SOURCE_ID = 'mv-warnings-tiles-source';
const WARNINGS_TILES_LAYER_ID = 'mv-warnings-tiles-layer';
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
  showRadarPills = true,
  spotterData = [],
  onSelectSite,
  onCrossSectionComplete,
}: RadarMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const siteMarkersRef = useRef<maplibregl.Marker[]>([]);
  const rhiMarkersRef = useRef<maplibregl.Marker[]>([]);
  const rhiPointsRef = useRef<[number, number][]>([]);
  const spotterMarkersRef = useRef<maplibregl.Marker[]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);

  const site =
    RADAR_SITES.find((s) => s.id === radarSite || s.radarId === radarSite) ||
    RADAR_SITES[0];

  const updateWarnings = useCallback((map: MapLibreMap) => {
    // ── Layer A: IEM raster tile overlay — shows ALL active NWS warnings, watches & advisories instantly ──
    // This renders every warning polygon that NWS issues, regardless of geometry availability in the API
    if (!map.getSource(WARNINGS_TILES_SOURCE_ID)) {
      map.addSource(WARNINGS_TILES_SOURCE_ID, {
        type: 'raster',
        tiles: [
          'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/warnings_active/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© Iowa Environmental Mesonet / NWS',
      });
      map.addLayer({
        id: WARNINGS_TILES_LAYER_ID,
        type: 'raster',
        source: WARNINGS_TILES_SOURCE_ID,
        paint: { 'raster-opacity': 0.75 },
      });
    }

    // ── Layer B: NWS GeoJSON — clickable polygon layer for alerts that include direct geometry ──
    // (Most alerts are zone/county-based with no geometry; Layer A covers those via IEM tiles)
    fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert&limit=500')
      .then((res) => res.json())
      .then((geojson) => {
        // Include ALL features that have polygon geometry (any event type)
        const polygonFeatures = (geojson.features || []).filter((f: any) => f.geometry != null);

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
                'Tornado Watch', '#fbbf24',
                'Severe Thunderstorm Warning', '#f59e0b',
                'Flash Flood Warning', '#10b981',
                'Winter Storm Warning', '#a78bfa',
                'Blizzard Warning', '#7c3aed',
                'High Wind Warning', '#f97316',
                '#3b82f6',
              ],
              'fill-opacity': 0.08,
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
                'Tornado Warning', '#ff0000',
                'Tornado Watch', '#fbbf24',
                'Severe Thunderstorm Warning', '#ff9900',
                'Flash Flood Warning', '#00cc66',
                'Winter Storm Warning', '#9b8fe0',
                '#1d4ed8',
              ],
              'line-width': 3,
            },
          });

          map.addLayer({
            id: WARNINGS_LINE_INNER_ID,
            type: 'line',
            source: WARNINGS_SOURCE_ID,
            paint: {
              'line-color': '#ffffff',
              'line-width': 1,
              'line-opacity': 0.5,
            },
          });
        }
      })
      .catch((err) => console.warn('[Warnings Notice]:', err));
  }, []);

  // ── Spotter Network Markers ──────────────────────────────────────────────
  // Renders live spotter positions & reports as map markers
  const renderSpotterMarkers = useCallback(
    (map: MapLibreMap, data: SpotterReport[]) => {
      // Clear old spotter markers
      spotterMarkersRef.current.forEach((m) => m.remove());
      spotterMarkersRef.current = [];

      data.forEach((s) => {
        if (!s.lat || !s.lon) return;

        const isReport = s.type === 'report' || !!s.hazard;
        const h = (s.hazard || '').toLowerCase();

        // Choose icon and color based on hazard type
        let icon = '📡';
        let color = '#06b6d4'; // cyan for position
        let borderColor = '#0e7490';

        if (isReport) {
          if (h.includes('tornado')) { icon = '🌪'; color = '#dc2626'; borderColor = '#7f1d1d'; }
          else if (h.includes('funnel') || h.includes('wall')) { icon = '🌀'; color = '#ea580c'; borderColor = '#7c2d12'; }
          else if (h.includes('hail')) { icon = '🧊'; color = '#eab308'; borderColor = '#713f12'; }
          else if (h.includes('wind') || h.includes('gust')) { icon = '💨'; color = '#f59e0b'; borderColor = '#78350f'; }
          else if (h.includes('flood') || h.includes('water')) { icon = '🌊'; color = '#10b981'; borderColor = '#064e3b'; }
          else if (h.includes('snow') || h.includes('ice') || h.includes('bliz')) { icon = '❄️'; color = '#38bdf8'; borderColor = '#0c4a6e'; }
          else if (h.includes('fire') || h.includes('smoke')) { icon = '🔥'; color = '#f97316'; borderColor = '#7c2d12'; }
          else { icon = '📋'; color = '#a78bfa'; borderColor = '#4c1d95'; }
        }

        // Build the marker element
        const el = document.createElement('div');
        el.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${isReport ? '28px' : '22px'};
          height: ${isReport ? '28px' : '22px'};
          border-radius: 50%;
          background: ${color};
          border: 2px solid ${borderColor};
          box-shadow: 0 0 ${isReport ? '8px' : '4px'} ${color}99;
          font-size: ${isReport ? '14px' : '11px'};
          cursor: pointer;
          transition: transform 0.1s;
          z-index: ${isReport ? 10 : 5};
        `;
        el.textContent = icon;
        el.title = `${s.name}${s.hazard ? ' — ' + s.hazard : ''}`;

        // Hover effect
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.25)'; });
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

        // Click: show popup
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const popup = new maplibregl.Popup({
            closeButton: true,
            className: 'mv-spotter-popup',
            maxWidth: '260px',
          })
            .setLngLat([s.lon, s.lat])
            .setHTML(`
              <div style="font-family:sans-serif;font-size:11px;color:#e2e8f0;background:#0f172a;padding:10px;border-radius:8px;">
                <div style="font-weight:700;font-size:13px;color:#fff;margin-bottom:4px;">
                  ${icon} ${s.name}${s.verified ? ' <span style="color:#34d399;font-size:10px;">✓ Verified</span>' : ''}
                </div>
                ${s.hazard ? `<div style="color:${color};font-weight:600;margin-bottom:3px;">${s.hazard}</div>` : ''}
                ${s.magnitude ? `<div style="color:#fbbf24;font-weight:700;font-size:12px;">${s.magnitude}</div>` : ''}
                ${s.description ? `<div style="color:#cbd5e1;margin-top:4px;line-height:1.4;">${s.description}</div>` : ''}
                <div style="color:#64748b;margin-top:6px;font-size:10px;">
                  ${s.lat.toFixed(4)}°N ${Math.abs(s.lon).toFixed(4)}°W · ${s.timestamp}
                </div>
              </div>
            `)
            .addTo(map);
          return popup;
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([s.lon, s.lat])
          .addTo(map);

        spotterMarkersRef.current.push(marker);
      });
    },
    []
  );

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

      // Insert radar BELOW the warning overlay layers so warnings appear on top
      const beforeId =
        map.getLayer(WARNINGS_TILES_LAYER_ID)
          ? WARNINGS_TILES_LAYER_ID
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
    [mode, product, tilt, maxRefWindow, site.radarId, radarOpacity]
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

        const marker = new maplibregl.Marker({ element: pill })
          .setLngLat([s.lon, s.lat])
          .addTo(map);

        siteMarkersRef.current.push(marker);
      });
    },
    [radarSite, onSelectSite]
  );

  // Initialize Map
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

    map.on('load', () => {
      setMapReady(true);
      map.resize();
      updateWarnings(map);
      updateRadar(map);
      if (showRadarPills) renderTowerPills(map);
    });

    // Cross-Section baseline click handler
    map.on('click', (e) => {
      if (!crossSectionMode) return;

      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      rhiPointsRef.current.push(coords);

      // Create "A" or "B" marker
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

        // Draw connecting baseline
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

  // Clean markers if crossSectionMode turns off
  useEffect(() => {
    if (!crossSectionMode) {
      rhiMarkersRef.current.forEach((m) => m.remove());
      rhiMarkersRef.current = [];
      rhiPointsRef.current = [];
      if (mapRef.current && mapRef.current.getLayer(RHI_LINE_LAYER_ID)) {
        mapRef.current.removeLayer(RHI_LINE_LAYER_ID);
        mapRef.current.removeSource(RHI_LINE_SOURCE_ID);
      }
    }
  }, [crossSectionMode]);

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
    }
  }, [site.lon, site.lat, radarSite, mapReady]);

  // Re-render spotter markers whenever spotterData changes
  useEffect(() => {
    if (mapRef.current && mapReady) {
      renderSpotterMarkers(mapRef.current, spotterData ?? []);
    }
  }, [spotterData, mapReady, renderSpotterMarkers]);

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
