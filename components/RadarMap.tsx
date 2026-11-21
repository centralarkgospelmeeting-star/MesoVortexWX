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

  // ── Spotter Network Markers (WeatherWise & WeatherFront Red Dot Design) ───
  // Renders live spotters as distinct red dots; clicking opens spotter dossier
  const renderSpotterMarkers = useCallback(
    (map: MapLibreMap, data: SpotterReport[]) => {
      // Clear old spotter markers
      spotterMarkersRef.current.forEach((m) => m.remove());
      spotterMarkersRef.current = [];

      data.forEach((s) => {
        if (!s.lat || !s.lon) return;

        // Container
        const el = document.createElement('div');
        el.className = 'spotter-dot-marker';
        el.title = `${s.name}${s.status ? ' (' + s.status + ')' : ''}`;

        // Outer pulsing ring for live effect
        const pulse = document.createElement('div');
        pulse.className = 'spotter-dot-pulse';

        // Core Red Dot (WeatherWise & WeatherFront style)
        const dot = document.createElement('div');
        dot.className = 'spotter-dot-inner';

        el.appendChild(pulse);
        el.appendChild(dot);

        // Click Handler: WeatherWise & WeatherFront dark info popup
        el.addEventListener('click', (e) => {
          e.stopPropagation();

          // Format extra fields (Phone, Email, Notes, Ham, etc.)
          const extraLines = (s.extraDetails || '').split('\n').filter(Boolean);
          const detailsHtml = extraLines.length > 0
            ? extraLines.map((line) => {
                const sepIdx = line.indexOf(':');
                if (sepIdx > -1) {
                  const label = line.slice(0, sepIdx).trim();
                  const val = line.slice(sepIdx + 1).trim();
                  return `
                    <div style="display:flex; justify-content:space-between; gap:8px; font-size:11px; padding:3px 0; border-top:1px solid rgba(255,255,255,0.06);">
                      <span style="color:#64748b; font-weight:600;">${label}:</span>
                      <span style="color:#e2e8f0; font-weight:500; text-align:right; word-break:break-word;">${val}</span>
                    </div>
                  `;
                }
                return `<div style="font-size:10px; color:#94a3b8; font-style:italic; padding-top:2px;">${line}</div>`;
              }).join('')
            : (s.description ? `<div style="font-size:11px; color:#94a3b8; padding-top:2px;">${s.description}</div>` : '');

          const isMobile = (s.status || '').toUpperCase().includes('MOBILE');

          new maplibregl.Popup({
            closeButton: true,
            className: 'mv-spotter-popup',
            maxWidth: '320px',
            offset: [0, -8],
          })
            .setLngLat([s.lon, s.lat])
            .setHTML(`
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#080e18; color:#f8fafc; padding:14px; border-radius:12px; min-width:250px; box-shadow:0 20px 35px -5px rgba(0,0,0,0.85); border:1px solid rgba(255,255,255,0.12);">
                
                <!-- Header: Badge & Status -->
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.08);">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444; box-shadow:0 0 8px #ef4444;"></span>
                    <span style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#f87171;">Spotter Network</span>
                  </div>
                  <span style="font-size:9px; font-weight:800; background:${isMobile ? '#0369a1' : '#1e293b'}; color:${isMobile ? '#38bdf8' : '#cbd5e1'}; padding:2px 7px; border-radius:4px; text-transform:uppercase; letter-spacing:0.04em;">
                    ${s.status || 'STATIONARY'}
                  </span>
                </div>

                <!-- Spotter Name -->
                <div style="font-size:15px; font-weight:800; color:#ffffff; line-height:1.2; margin-bottom:2px; letter-spacing:-0.01em;">
                  ${s.name}
                </div>
                ${s.callsign ? `<div style="font-size:11px; font-family:monospace; font-weight:600; color:#38bdf8; margin-bottom:8px;">Callsign: ${s.callsign}</div>` : '<div style="margin-bottom:6px;"></div>'}

                <!-- Location & Time Box -->
                <div style="background:#0f172a; border-radius:8px; padding:8px 10px; margin:8px 0; border:1px solid rgba(255,255,255,0.08); font-size:11px; font-family:monospace;">
                  <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:4px;">
                    <span>Position:</span>
                    <span style="color:#f1f5f9; font-weight:bold;">${s.lat.toFixed(4)}°N, ${Math.abs(s.lon).toFixed(4)}°W</span>
                  </div>
                  ${(s.time || s.timestamp) ? `
                  <div style="display:flex; justify-content:space-between; color:#94a3b8;">
                    <span>Reported:</span>
                    <span style="color:#e2e8f0;">${s.time || s.timestamp}</span>
                  </div>` : ''}
                </div>

                <!-- Ground Observation Alert if present -->
                ${s.hazard ? `
                <div style="margin:8px 0; padding:6px 9px; border-radius:6px; background:#450a0a; border:1px solid #7f1d1d; font-size:11px; font-weight:bold; color:#fca5a5; display:flex; align-items:center; gap:6px;">
                  <span>⚠️</span>
                  <span>${s.hazard}${s.magnitude ? ` · ${s.magnitude}` : ''}</span>
                </div>` : ''}

                <!-- Extra Details / Skywarn / Contact -->
                ${detailsHtml ? `
                <div style="margin-top:8px; display:flex; flex-direction:column; gap:2px;">
                  ${detailsHtml}
                </div>` : ''}
              </div>
            `)
            .addTo(map);
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
