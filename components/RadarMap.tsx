'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RADAR_SITES } from '../lib/radar-config';
import { WarningAlert } from './WarningDrawerRight';

export type ModeTab = 'Radar' | '3D Radar' | 'Composite' | 'Satellite' | 'Models' | 'Outlooks';
export type BasemapType = 'satellite-streets' | 'custom-weather' | 'mapbox' | 'satellite';
export type BasemapId = BasemapType;

export type SpotterPin = {
  id: string;
  hazardType: string;
  description: string;
  hailSize?: string;
  lat: number;
  lon: number;
  timestamp: string;
  callsign: string;
};

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
  showStormTracks?: boolean;
  /** Force METARs on/off from parent; if omitted, map uses its own toggle */
  showMetars?: boolean;
  selectedWarning?: WarningAlert | null;
  onSelectSite?: (siteId: string) => void;
  onSelectWarningFromMap?: (warning: WarningAlert) => void;
  targetCoords?: [number, number] | null;
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
const WARNINGS_LINE_ID = 'mv-warnings-line';
const RANGE_RINGS_SOURCE_ID = 'mv-range-rings-source';
const RANGE_RINGS_LAYER_ID = 'mv-range-rings-layer';
const METAR_SOURCE_ID = 'mv-metar-source';
const METAR_CIRCLE_ID = 'mv-metar-circle';
const METAR_LABEL_ID = 'mv-metar-label';

const IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

function toRidgeId(raw: string): string {
  return (raw || 'LZK').toUpperCase().replace(/^K/, '') || 'LZK';
}

function productCode(product: string, tilt: string): string {
  const p = (product || 'ref').toLowerCase();
  if (p === 'vel' || p === 'norm_vel') {
    if (tilt === '0.9') return 'N1U';
    if (tilt === '1.3') return 'N2U';
    if (tilt === '1.8') return 'N3U';
    return 'N0U';
  }
  if (p === 'srvel') return 'N0S';
  if (p === 'sw') return 'N0W';
  if (p === 'cc' || p === 'min_cc') return 'N0C';
  if (p === 'zdr') return 'N0X';
  if (p === 'kdp') return 'N0K';
  if (p === 'tops') return 'EET';
  if (p === 'vil') return 'DVL';
  if (p === 'hhc') return 'HHC';
  if (p === 'qpe') return 'DPR';
  if (tilt === '0.9') return 'N1B';
  if (tilt === '1.3') return 'N2B';
  if (tilt === '1.8') return 'N3B';
  return 'N0B';
}

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
    layers: [{ id: 'mapbox-basemap-layer', type: 'raster', source: 'mapbox-basemap-source' }],
  };
}

function generateRangeRingsGeoJSON(lon: number, lat: number, distancesNm: number[] = [50, 100, 150]) {
  const features: any[] = [];
  const points = 64;
  const earthRadiusKm = 6371;
  distancesNm.forEach((nm) => {
    const km = nm * 1.852;
    const coords: [number, number][] = [];
    for (let i = 0; i <= points; i++) {
      const rad = ((i * 360) / points) * (Math.PI / 180);
      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;
      const distRad = km / earthRadiusKm;
      const pLat = Math.asin(
        Math.sin(latRad) * Math.cos(distRad) +
          Math.cos(latRad) * Math.sin(distRad) * Math.cos(rad)
      );
      const pLon =
        lonRad +
        Math.atan2(
          Math.sin(rad) * Math.sin(distRad) * Math.cos(latRad),
          Math.cos(distRad) - Math.sin(latRad) * Math.sin(pLat)
        );
      coords.push([(pLon * 180) / Math.PI, (pLat * 180) / Math.PI]);
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { distanceNm: nm, label: `${nm} nm` },
    });
  });
  return { type: 'FeatureCollection', features };
}

function boundsToBbox(map: MapLibreMap): string {
  const b = map.getBounds();
  // AviationWeather: lat0,lon0,lat1,lon1
  const lat0 = Math.max(-90, b.getSouth());
  const lon0 = Math.max(-180, b.getWest());
  const lat1 = Math.min(90, b.getNorth());
  const lon1 = Math.min(180, b.getEast());
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `${r(lat0)},${r(lon0)},${r(lat1)},${r(lon1)}`;
}

export function RadarMap({
  product = 'ref',
  radarSite = 'KLZK',
  mode = 'Radar',
  tilt = '0.5',
  basemap = 'satellite-streets',
  radarOpacity = 0.88,
  showRangeRings = true,
  showRadarPills = true,
  showMetars: showMetarsProp,
  selectedWarning = null,
  onSelectSite,
  onSelectWarningFromMap,
  targetCoords,
}: RadarMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [metarsOn, setMetarsOn] = useState(!!showMetarsProp);
  const [metarCount, setMetarCount] = useState(0);
  const [metarLoading, setMetarLoading] = useState(false);

  // Sync external prop if provided
  useEffect(() => {
    if (typeof showMetarsProp === 'boolean') setMetarsOn(showMetarsProp);
  }, [showMetarsProp]);

  const site =
    RADAR_SITES.find((s) => s.id === radarSite || s.radarId === radarSite) || RADAR_SITES[0];
  const ridgeId = toRidgeId(site.radarId || site.id);

  const updateWarnings = useCallback(
    (map: MapLibreMap) => {
      fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert')
        .then((res) => res.json())
        .then((geojson) => {
          const features = (geojson.features || []).filter((f: any) => {
            const event = f.properties?.event || '';
            return (
              f.geometry &&
              (event.includes('Warning') || event.includes('Tornado') || event.includes('Thunderstorm'))
            );
          });
          const data = { type: 'FeatureCollection', features };
          const source = map.getSource(WARNINGS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
          if (source) {
            source.setData(data as any);
          } else {
            map.addSource(WARNINGS_SOURCE_ID, { type: 'geojson', data: data as any });
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
                'fill-opacity': 0.22,
              },
            });
            map.addLayer({
              id: WARNINGS_LINE_ID,
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
                'line-width': 2.5,
              },
            });
            map.on('click', WARNINGS_FILL_ID, (e) => {
              const feat = e.features?.[0];
              if (!feat || !onSelectWarningFromMap) return;
              const props = feat.properties || {};
              onSelectWarningFromMap({
                id: String(feat.id || props.id || `alert-${Date.now()}`),
                event: props.event || 'Severe Warning',
                headline: props.headline || props.description || 'Active Warning',
                severity: props.severity || 'Immediate',
                areaDesc: props.areaDesc || '',
                sent: props.sent || new Date().toISOString(),
                expires: props.expires || '',
                wfo: props.senderName?.split('/')?.[0] || 'NWS',
                lat: e.lngLat.lat,
                lon: e.lngLat.lng,
                geometry: feat.geometry,
              });
            });
          }
        })
        .catch((err) => console.warn('[Warnings]', err));
    },
    [onSelectWarningFromMap]
  );

  const updateRangeRings = useCallback(
    (map: MapLibreMap) => {
      if (!showRangeRings) {
        if (map.getLayer(RANGE_RINGS_LAYER_ID)) map.removeLayer(RANGE_RINGS_LAYER_ID);
        if (map.getSource(RANGE_RINGS_SOURCE_ID)) map.removeSource(RANGE_RINGS_SOURCE_ID);
        return;
      }
      const rings = generateRangeRingsGeoJSON(site.lon, site.lat);
      const source = map.getSource(RANGE_RINGS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(rings as any);
      } else {
        map.addSource(RANGE_RINGS_SOURCE_ID, { type: 'geojson', data: rings as any });
        map.addLayer({
          id: RANGE_RINGS_LAYER_ID,
          type: 'line',
          source: RANGE_RINGS_SOURCE_ID,
          paint: {
            'line-color': '#00ffff',
            'line-width': 1.2,
            'line-dasharray': [4, 4],
            'line-opacity': 0.45,
          },
        });
      }
    },
    [showRangeRings, site.lon, site.lat]
  );

  const updateRadar = useCallback(
    (map: MapLibreMap) => {
      let tileUrl: string;
      if (mode === 'Composite') {
        tileUrl = `${IEM}/nexrad-n0q-900913/{z}/{x}/{y}.png`;
      } else if (mode === 'Satellite') {
        tileUrl = `${IEM}/goes-east-vis-1km-900913/{z}/{x}/{y}.png`;
      } else {
        const code = productCode(product, tilt);
        tileUrl = `${IEM}/ridge::${ridgeId}-${code}-0/{z}/{x}/{y}.png`;
      }

      if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
      if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);

      map.addSource(RADAR_SOURCE_ID, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        scheme: 'xyz',
        attribution: 'NOAA NEXRAD / IEM',
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
    [mode, product, tilt, ridgeId, radarOpacity]
  );

  const clearMetars = useCallback((map: MapLibreMap) => {
    if (map.getLayer(METAR_LABEL_ID)) map.removeLayer(METAR_LABEL_ID);
    if (map.getLayer(METAR_CIRCLE_ID)) map.removeLayer(METAR_CIRCLE_ID);
    if (map.getSource(METAR_SOURCE_ID)) map.removeSource(METAR_SOURCE_ID);
    setMetarCount(0);
  }, []);

  const updateMetars = useCallback(
    async (map: MapLibreMap) => {
      if (!metarsOn) {
        clearMetars(map);
        return;
      }

      setMetarLoading(true);
      try {
        const bbox = boundsToBbox(map);
        const res = await fetch(`/api/metar/geojson?bbox=${encodeURIComponent(bbox)}&hours=3`, {
          cache: 'no-store',
        });
        const data = await res.json();
        const features = (data.features || []).filter(
          (f: any) => f?.geometry?.coordinates?.length >= 2
        );

        // Enrich for labels
        const enriched = {
          type: 'FeatureCollection',
          features: features.map((f: any) => {
            const p = f.properties || {};
            const id = p.id || p.icaoId || f.id || '';
            const temp = p.temp != null ? Math.round((Number(p.temp) * 9) / 5 + 32) : null;
            const wspd = p.wspd != null ? Number(p.wspd) : null;
            const label =
              temp != null && wspd != null
                ? `${id} ${temp}° ${wspd}kt`
                : temp != null
                  ? `${id} ${temp}°`
                  : String(id);
            return {
              ...f,
              properties: {
                ...p,
                station: id,
                label,
                rawOb: p.rawOb || p.raw_text || '',
              },
            };
          }),
        };

        const source = map.getSource(METAR_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData(enriched as any);
        } else {
          map.addSource(METAR_SOURCE_ID, { type: 'geojson', data: enriched as any });

          map.addLayer({
            id: METAR_CIRCLE_ID,
            type: 'circle',
            source: METAR_SOURCE_ID,
            paint: {
              'circle-radius': 5,
              'circle-color': '#22d3ee',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#0e7490',
              'circle-opacity': 0.9,
            },
          });

          map.addLayer({
            id: METAR_LABEL_ID,
            type: 'symbol',
            source: METAR_SOURCE_ID,
            layout: {
              'text-field': ['get', 'label'],
              'text-size': 10,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              'text-optional': true,
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': '#ecfeff',
              'text-halo-color': '#0f172a',
              'text-halo-width': 1.5,
            },
          });

          map.on('click', METAR_CIRCLE_ID, (e) => {
            const feat = e.features?.[0];
            if (!feat) return;
            const p = feat.properties || {};
            const html = `<div style="font:12px/1.4 system-ui,sans-serif;max-width:260px">
              <strong style="color:#22d3ee">${p.station || p.id || ''}</strong>
              <div style="margin-top:4px;color:#cbd5e1;word-break:break-all">${p.rawOb || 'No raw METAR'}</div>
            </div>`;
            if (popupRef.current) popupRef.current.remove();
            popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
              .setLngLat(e.lngLat)
              .setHTML(html)
              .addTo(map);
          });

          map.on('mouseenter', METAR_CIRCLE_ID, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', METAR_CIRCLE_ID, () => {
            map.getCanvas().style.cursor = '';
          });
        }

        setMetarCount(enriched.features.length);
      } catch (err) {
        console.warn('[METARs]', err);
        setMetarCount(0);
      } finally {
        setMetarLoading(false);
      }
    },
    [metarsOn, clearMetars]
  );

  const renderTowerPills = useCallback(
    (map: MapLibreMap) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (!showRadarPills) return;

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
        markersRef.current.push(marker);
      });
    },
    [radarSite, onSelectSite, showRadarPills]
  );

  // Init map
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapboxRasterStyle(basemap),
      center: [site.lon, site.lat],
      zoom: 7,
      pitch: mode === '3D Radar' ? 55 : 0,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on('load', () => {
      setMapReady(true);
      map.resize();
      updateWarnings(map);
      updateRadar(map);
      updateRangeRings(map);
      renderTowerPills(map);
      updateMetars(map);
    });

    // Refresh METARs when map moves (debounced)
    let moveTimer: number | undefined;
    const onMoveEnd = () => {
      window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => updateMetars(map), 400);
    };
    map.on('moveend', onMoveEnd);

    return () => {
      window.clearTimeout(moveTimer);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({ pitch: mode === '3D Radar' ? 55 : 0, duration: 400 });
  }, [mode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    updateRadar(map);
    updateRangeRings(map);
    renderTowerPills(map);
  }, [mapReady, updateRadar, updateRangeRings, renderTowerPills]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    updateMetars(map);
  }, [mapReady, metarsOn, updateMetars]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.flyTo({ center: [site.lon, site.lat], zoom: Math.max(map.getZoom(), 7), duration: 800 });
  }, [site.lat, site.lon, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !targetCoords) return;
    map.flyTo({ center: targetCoords, zoom: Math.max(map.getZoom(), 8), duration: 800 });
  }, [targetCoords, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const id = window.setInterval(() => {
      updateWarnings(map);
      if (metarsOn) updateMetars(map);
    }, 120_000);
    return () => window.clearInterval(id);
  }, [mapReady, updateWarnings, updateMetars, metarsOn]);

  void selectedWarning;

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* METAR / station network toggle */}
      <button
        type="button"
        onClick={() => setMetarsOn((v) => !v)}
        className={`absolute bottom-6 left-3 z-20 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur transition ${
          metarsOn
            ? 'border-cyan-400/60 bg-cyan-950/80 text-cyan-200'
            : 'border-white/20 bg-slate-950/80 text-slate-300 hover:border-white/40'
        }`}
        title="Toggle live METAR / weather station network"
      >
        {metarLoading ? 'METARs…' : metarsOn ? `METARs ON · ${metarCount}` : 'METARs OFF'}
      </button>
    </div>
  );
}
