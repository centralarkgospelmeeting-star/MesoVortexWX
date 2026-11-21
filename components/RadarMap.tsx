'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RADAR_SITES } from '../lib/radar-config';
import { computeMaxReflectivityCanvas } from '../lib/max-reflectivity';

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
  frameUrl?: string | null;
  frameTime?: string;
  fastScan?: boolean;
  radarSweepAnim?: boolean;
  flashCoreRange?: boolean;
  showSpotters?: boolean;
  showLightning?: boolean;
  showMcd?: boolean;
  showRangeRings?: boolean;
  showRadarPills?: boolean;
  onSelectSite?: (siteId: string) => void;
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
const MCD_SOURCE_ID = 'mv-mcd-source';
const MCD_FILL_ID = 'mv-mcd-fill';
const MCD_LINE_ID = 'mv-mcd-line';
const LIGHTNING_SOURCE_ID = 'mv-lightning-sync-source';
const LIGHTNING_LAYER_ID = 'mv-lightning-sync-layer';
const SPOTTERS_SOURCE_ID = 'mv-spotters-source';
const SPOTTERS_GLOW_LAYER_ID = 'mv-spotters-glow-layer';
const SPOTTERS_CORE_LAYER_ID = 'mv-spotters-core-layer';

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
  frameUrl = null,
  fastScan = true,
  radarSweepAnim = true,
  flashCoreRange = true,
  showSpotters = true,
  showLightning = true,
  showMcd = true,
  showRadarPills = true,
  onSelectSite,
}: RadarMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const siteMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [sweepAngle, setSweepAngle] = useState(0);

  const site =
    RADAR_SITES.find((s) => s.id === radarSite || s.radarId === radarSite) ||
    RADAR_SITES[0];

  useEffect(() => {
    if (!radarSweepAnim) return;
    const timer = setInterval(() => {
      setSweepAngle((prev) => (prev + 4) % 360);
    }, 40);
    return () => clearInterval(timer);
  }, [radarSweepAnim]);

  const updateWarnings = useCallback((map: MapLibreMap) => {
    fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert')
      .then((res) => res.json())
      .then((geojson) => {
        const polygonFeatures = (geojson.features || []).filter((f: any) => {
          const event = f.properties?.event || '';
          return (
            f.geometry &&
            (event.includes('Warning') ||
              event.includes('Tornado') ||
              event.includes('Thunderstorm') ||
              event.includes('Flood'))
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
                'Tornado Warning',
                '#dc2626',
                'Severe Thunderstorm Warning',
                '#f59e0b',
                'Flash Flood Warning',
                '#10b981',
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
                'Tornado Warning',
                '#dc2626',
                'Severe Thunderstorm Warning',
                '#ffffff',
                'Flash Flood Warning',
                '#059669',
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
                'Tornado Warning',
                '#f87171',
                'Severe Thunderstorm Warning',
                '#fbbf24',
                'Flash Flood Warning',
                '#34d399',
                '#60a5fa',
              ],
              'line-width': 1.8,
            },
          });

          map.on('click', WARNINGS_FILL_ID, (e) => {
            const props = e.features?.[0]?.properties;
            if (!props) return;
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
  }, []);

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
              'fill-opacity': 0.15,
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

            const mcdNum = props.md_number || props.mcd_number || props.name || props.id || 'Active';
            const concerning =
              props.concerning || props.area_desc || props.popupinfo || 'Severe Threat';
            const prob = props.watch_prob || props.probability || '';

            new maplibregl.Popup({ closeButton: true, offset: 12 })
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family:system-ui;padding:6px;max-width:280px;color:#0f172a;">
                  <span style="background:#ea580c;color:#fff;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:900;text-transform:uppercase;">
                    SPC Mesoscale Discussion ${mcdNum}
                  </span>
                  <div style="font-size:12px;font-weight:800;margin-top:6px;color:#1e293b;">
                    ${concerning}
                  </div>
                  ${prob ? `<div style="font-size:11px;font-weight:bold;color:#dc2626;margin-top:2px;">Watch Probability: ${prob}</div>` : ''}
                  <div style="font-size:10px;color:#64748b;margin-top:4px;max-height:140px;overflow-y:auto;line-height:1.3;">
                    ${props.discussion || props.summary || props.text || props.popupinfo || 'Forecasters are monitoring storm evolution.'}
                  </div>
                </div>`
              )
              .addTo(map);
          });
        }
      })
      .catch((err) => console.warn('[MCD Layer Notice]:', err));
  }, []);

  const updateSpotterNetwork = useCallback((map: MapLibreMap) => {
    fetch('/api/spotter-network')
      .then((res) => res.json())
      .then((geojson) => {
        const source = map.getSource(SPOTTERS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData(geojson);
        } else {
          map.addSource(SPOTTERS_SOURCE_ID, { type: 'geojson', data: geojson });

          map.addLayer({
            id: SPOTTERS_GLOW_LAYER_ID,
            type: 'circle',
            source: SPOTTERS_SOURCE_ID,
            paint: {
              'circle-radius': 12,
              'circle-color': '#ef4444',
              'circle-opacity': 0.25,
            },
          });

          map.addLayer({
            id: SPOTTERS_CORE_LAYER_ID,
            type: 'circle',
            source: SPOTTERS_SOURCE_ID,
            paint: {
              'circle-radius': 6,
              'circle-color': '#dc2626',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });

          map.on('click', SPOTTERS_CORE_LAYER_ID, (e) => {
            const props = e.features?.[0]?.properties;
            if (!props) return;

            const name = props.name || props.callsign || 'Spotter';
            const status = props.status || props.heading || 'STATIONARY';
            const notes = props.notes || props.extraDetails || status;
            const time = props.time || props.timestamp || 'Live';

            new maplibregl.Popup({ closeButton: true, offset: 10 })
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family:system-ui;padding:10px;max-width:280px;color:#0f172a;">
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;"></span>
                    <b style="font-size:11px;color:#dc2626;text-transform:uppercase;letter-spacing:0.04em;">Spotter Network</b>
                  </div>
                  <div style="font-size:14px;font-weight:900;color:#0f172a;margin-top:6px;">${name}</div>
                  <div style="font-size:11px;color:#334155;margin-top:4px;">
                    Status: <b>${status}</b>
                  </div>
                  <div style="font-size:10px;background:#f1f5f9;padding:6px 8px;border-radius:6px;margin-top:6px;color:#334155;white-space:pre-wrap;">${notes}</div>
                  <div style="font-size:9px;color:#94a3b8;margin-top:6px;text-align:right;">${time}</div>
                </div>`
              )
              .addTo(map);
          });

          map.on('mouseenter', SPOTTERS_CORE_LAYER_ID, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', SPOTTERS_CORE_LAYER_ID, () => {
            map.getCanvas().style.cursor = '';
          });
        }
      })
      .catch((err) => console.warn('[Spotter Ingest Notice]:', err));
  }, []);

  const updateLightning = useCallback(
    (map: MapLibreMap) => {
      if (!map.getSource(LIGHTNING_SOURCE_ID)) {
        map.addSource(LIGHTNING_SOURCE_ID, {
          type: 'raster',
          tiles: ['https://realearth.ssec.wisc.edu/tiles/GOESEastGLMFEDRadC/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: 'NOAA GOES GLM Lightning',
        });

        map.addLayer({
          id: LIGHTNING_LAYER_ID,
          type: 'raster',
          source: LIGHTNING_SOURCE_ID,
          paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 0 },
          layout: { visibility: showLightning ? 'visible' : 'none' },
        });
      }
    },
    [showLightning]
  );

  const updateRadar = useCallback(
    async (map: MapLibreMap) => {
      let tileUrl = frameUrl || '';
      const ridgeId = (site.radarId || site.id || 'LZK').toUpperCase().replace(/^K/, '');

      if (!tileUrl) {
        if (mode === 'Composite') {
          tileUrl =
            'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png';
        } else if (mode === 'Satellite') {
          tileUrl =
            'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-vis-1km-900913/{z}/{x}/{y}.png';
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
            tileUrl = `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${ridgeId}-N0B-0/{z}/{x}/{y}.png`;
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
            tileUrl = `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${ridgeId}-N0B-0/{z}/{x}/{y}.png`;
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

      const beforeId = map.getLayer(WARNINGS_FILL_ID) ? WARNINGS_FILL_ID : undefined;

      map.addLayer(
        {
          id: RADAR_LAYER_ID,
          type: 'raster',
          source: RADAR_SOURCE_ID,
          paint: {
            'raster-opacity': radarOpacity,
            'raster-contrast': flashCoreRange ? 0.45 : 0.25,
            'raster-saturation': flashCoreRange ? 0.65 : 0.45,
            'raster-fade-duration': 0,
          },
        },
        beforeId
      );
    },
    [mode, product, tilt, maxRefWindow, site.radarId, site.id, radarOpacity, frameUrl, flashCoreRange]
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

        const marker = new maplibregl.Marker({ element: pill }).setLngLat([s.lon, s.lat]).addTo(map);
        siteMarkersRef.current.push(marker);
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
      updateSpotterNetwork(map);
      updateLightning(map);
      updateRadar(map);
      if (showRadarPills) renderTowerPills(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  // FastScan: poll radar tiles every 8s when enabled
  useEffect(() => {
    if (!mapReady || !fastScan) return;
    const interval = setInterval(() => {
      if (mapRef.current) updateRadar(mapRef.current);
    }, 8000);
    return () => clearInterval(interval);
  }, [fastScan, mapReady, updateRadar]);

  // Spotter Network refresh ~45s
  useEffect(() => {
    if (!mapReady || !showSpotters) return;
    const interval = setInterval(() => {
      if (mapRef.current) updateSpotterNetwork(mapRef.current);
    }, 45_000);
    return () => clearInterval(interval);
  }, [mapReady, showSpotters, updateSpotterNetwork]);

  // Warnings + MCD refresh
  useEffect(() => {
    if (!mapReady) return;
    const interval = setInterval(() => {
      if (!mapRef.current) return;
      updateWarnings(mapRef.current);
      if (showMcd) updateMCDLayer(mapRef.current);
    }, 60_000);
    return () => clearInterval(interval);
  }, [mapReady, showMcd, updateWarnings, updateMCDLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer(SPOTTERS_CORE_LAYER_ID)) {
      const vis = showSpotters ? 'visible' : 'none';
      map.setLayoutProperty(SPOTTERS_CORE_LAYER_ID, 'visibility', vis);
      if (map.getLayer(SPOTTERS_GLOW_LAYER_ID))
        map.setLayoutProperty(SPOTTERS_GLOW_LAYER_ID, 'visibility', vis);
    }
  }, [showSpotters, mapReady]);

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
    if (mapRef.current && mapReady) {
      updateRadar(mapRef.current);
    }
  }, [product, tilt, maxRefWindow, radarOpacity, frameUrl, flashCoreRange, mapReady, updateRadar]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (radarSite !== 'US') {
      map.flyTo({ center: [site.lon, site.lat], zoom: 7.5, duration: 1100 });
    }
  }, [site.lon, site.lat, radarSite, mapReady]);

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {radarSweepAnim && mode === 'Radar' && radarSite !== 'US' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
          <div
            className="h-[600px] w-[600px] rounded-full transition-transform"
            style={{
              transform: `rotate(${sweepAngle}deg)`,
              background:
                'conic-gradient(from 0deg, rgba(6, 182, 212, 0.25) 0deg, rgba(6, 182, 212, 0.08) 35deg, transparent 65deg)',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default RadarMap;
