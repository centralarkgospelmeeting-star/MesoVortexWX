'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RADAR_SITES } from '../lib/radar-config';
import { computeMaxReflectivityCanvas, interpolateReflectivityFrames } from '../lib/max-reflectivity';

// Next/webpack bundles maplibre-gl, so the library's relative worker URL
// (./maplibre-gl-worker.mjs) resolves to a chunk that does not exist. Serve the
// worker that ships with the pinned maplibre-gl version from /public instead
// (scripts/copy-maplibre-worker.mjs copies it on install).
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

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
  showLightning?: boolean;
  showLSR?: boolean;
  showWatches?: boolean;
  showWarnings?: boolean;
  showMCD?: boolean;
  showSpotters?: boolean;
  showSweepAnimation?: boolean;
  sweepAnimation?: boolean;
  showFastScan?: boolean;
  fastScan?: boolean;
  showFlashReflectivity?: boolean;
  flashReflectivity?: boolean;
  flashRange?: [number, number];
  spotterReports?: SpotterPin[];
  spotterData?: any[];
  onNewScan?: (info: { latencySec: number; timestamp: string; site: string }) => void;
  onSelectSite?: (siteId: string) => void;
  onSelectWarningFromMap?: (w: any) => void;
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
const MCD_SOURCE_ID = 'mv-mcd-source';
const MCD_FILL_ID = 'mv-mcd-fill';
const MCD_LINE_ID = 'mv-mcd-line';
const MCD_LABEL_ID = 'mv-mcd-label';
const RINGS_SOURCE_ID = 'mv-rings-source';
const RINGS_LAYER_ID = 'mv-rings-layer';
const RINGS_LABEL_ID = 'mv-rings-label';
const SWEEP_SOURCE_ID = 'mv-sweep-source';
const SWEEP_LINE_ID = 'mv-sweep-line';
const SWEEP_FILL_ID = 'mv-sweep-fill';
const SPOTTER_SOURCE_ID = 'mv-spotters-source';
const SPOTTER_HALO_LAYER_ID = 'mv-spotters-halo';
const SPOTTER_POSITION_LAYER_ID = 'mv-spotters-position';
const SPOTTER_REPORT_LAYER_ID = 'mv-spotters-report';

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

/** Escape untrusted upstream text before it reaches MapLibre's setHTML. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .slice(0, 600)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function makeSweepGeoJSON(lat: number, lon: number, angleDeg: number) {
  const radiusNm = 124;
  const radDeg = (radiusNm * 1.852) / 111.32;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const endLat = lat + radDeg * Math.cos(toRad(angleDeg));
  const endLon = lon + (radDeg * Math.sin(toRad(angleDeg))) / Math.cos(toRad(lat));
  // Small wedge behind the sweep line for a "paint" feel.
  const wedgeWidth = 18; // degrees
  const wedgeCoords: [number, number][] = [[lon, lat]];
  for (let a = angleDeg - wedgeWidth; a <= angleDeg; a += 2) {
    const wLat = lat + radDeg * Math.cos(toRad(a));
    const wLon = lon + (radDeg * Math.sin(toRad(a))) / Math.cos(toRad(lat));
    wedgeCoords.push([wLon, wLat]);
  }
  wedgeCoords.push([lon, lat]);
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: [[lon, lat], [endLon, endLat]] },
        properties: {},
      },
      {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [wedgeCoords] },
        properties: {},
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
  showRangeRings = true,
  showRadarPills = true,
  showWarnings = true,
  showMCD = true,
  showSpotters = false,
  showSweepAnimation = true,
  sweepAnimation: sweepAnimationProp,
  showFastScan = false,
  fastScan: fastScanProp,
  showFlashReflectivity = false,
  flashReflectivity: flashReflectivityProp,
  flashRange = [60, 80],
  showLightning = false,
  spotterData = [],
  onNewScan,
  onSelectSite,
  onSelectWarningFromMap,
  onCrossSectionComplete,
}: RadarMapProps) {
  const sweepEnabled = sweepAnimationProp ?? showSweepAnimation;
  const fastScanEnabled = fastScanProp ?? showFastScan;
  const flashEnabled = flashReflectivityProp ?? showFlashReflectivity;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const sweepCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sweepAngleRef = useRef<number>(0);
  const paintInBoostRef = useRef<number>(0);
  const prevTileUrlRef = useRef<string>('');
  const [mapReady, setMapReady] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);
  const [sweepAngle, setSweepAngle] = useState(0);

  useEffect(() => {
    if (!sweepEnabled) return;

    const timer = setInterval(() => {
      setSweepAngle((prev) => (prev + 3) % 360);
    }, 16);

    return () => clearInterval(timer);
  }, [sweepEnabled]);
  // True once the radar tile source has reported a successful load. Used to
  // suppress false-positive 503/404 banners (e.g. historical frames or
  // unrelated map sources failing while the live product renders fine).
  const radarSourceHealthyRef = useRef(false);
  const tileErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spotterHandlersBoundRef = useRef(false);
  const showSpottersRef = useRef(showSpotters);
  const [spotterStatus, setSpotterStatus] = useState<{
    state: 'idle' | 'loading' | 'ready' | 'unavailable';
    positions: number;
    reports: number;
    message?: string;
  }>({ state: 'idle', positions: 0, reports: 0 });
  const warningHandlersBoundRef = useRef(false);
  const mcdHandlersBoundRef = useRef(false);
  const showMCDRef = useRef(showMCD);
  const showWarningsRef = useRef(showWarnings);
  const [mcdStatus, setMcdStatus] = useState<{
    state: 'idle' | 'loading' | 'ready' | 'unavailable';
    count: number;
    message?: string;
  }>({ state: 'idle', count: 0 });

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

          const beforeId =
            map.getLayer(MCD_FILL_ID) ? MCD_FILL_ID :
            map.getLayer(SPOTTER_HALO_LAYER_ID) ? SPOTTER_HALO_LAYER_ID :
            undefined;

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
          }, beforeId);

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
          }, beforeId);

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
          }, beforeId);

          if (!warningHandlersBoundRef.current) {
            warningHandlersBoundRef.current = true;
            map.on('click', WARNINGS_FILL_ID, (e) => {
              const props = e.features?.[0]?.properties;
              if (!props) return;
              if (onSelectWarningFromMap) onSelectWarningFromMap(props);

              const isTor = props.event === 'Tornado Warning';
              const headline = escapeHtml(props.headline || props.description || 'Active Warning');
              const area = escapeHtml(props.areaDesc || '');
              const event = escapeHtml(props.event || 'Warning');
              new maplibregl.Popup({ closeButton: true, offset: 12 })
                .setLngLat(e.lngLat)
                .setHTML(
                  `<div style="font-family:system-ui;padding:6px;max-width:260px;color:#0f172a;">
                    <span style="background:${isTor ? '#dc2626' : '#d97706'};color:#fff;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:900;text-transform:uppercase;">
                      ${event}
                    </span>
                    <div style="font-size:12px;font-weight:800;margin-top:6px;line-height:1.3;">
                      ${headline}
                    </div>
                    <div style="font-size:10px;color:#64748b;margin-top:4px;">${area}</div>
                  </div>`
                )
                .addTo(map);
            });
            map.on('mouseenter', WARNINGS_FILL_ID, () => {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', WARNINGS_FILL_ID, () => {
              map.getCanvas().style.cursor = '';
            });
          }
        }
      })
      .catch((err) => console.warn('[Warnings Notice]:', err));
  }, [onSelectWarningFromMap]);

  const removeWarningLayers = useCallback((map: MapLibreMap) => {
    [WARNINGS_LINE_INNER_ID, WARNINGS_LINE_OUTER_ID, WARNINGS_FILL_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    if (map.getSource(WARNINGS_SOURCE_ID)) map.removeSource(WARNINGS_SOURCE_ID);
  }, []);

  const removeMCDLayers = useCallback((map: MapLibreMap) => {
    [MCD_LABEL_ID, MCD_LINE_ID, MCD_FILL_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    if (map.getSource(MCD_SOURCE_ID)) map.removeSource(MCD_SOURCE_ID);
    mcdHandlersBoundRef.current = false;
  }, []);

  const updateMCD = useCallback(async (map: MapLibreMap) => {
    try {
      setMcdStatus((prev) => ({ ...prev, state: 'loading' }));

      const res = await fetch('/api/spc/mcd', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const meta = data?.meta ?? {};

      if (meta.available === false) {
        removeMCDLayers(map);
        setMcdStatus({
          state: 'unavailable',
          count: 0,
          message: meta?.notes?.[0] || 'SPC mesoscale discussion service unavailable',
        });
        return;
      }

      const geojson = {
        type: 'FeatureCollection' as const,
        features: Array.isArray(data?.features) ? data.features : [],
      };

      const existing = map.getSource(MCD_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(geojson as any);
      } else {
        map.addSource(MCD_SOURCE_ID, { type: 'geojson', data: geojson as any });

        const beforeId =
          map.getLayer(SPOTTER_HALO_LAYER_ID) ? SPOTTER_HALO_LAYER_ID :
          map.getLayer(SPOTTER_POSITION_LAYER_ID) ? SPOTTER_POSITION_LAYER_ID :
          undefined;

        map.addLayer({
          id: MCD_FILL_ID,
          type: 'fill',
          source: MCD_SOURCE_ID,
          paint: {
            'fill-color': '#a855f7',
            'fill-opacity': 0.10,
          },
        }, beforeId);

        map.addLayer({
          id: MCD_LINE_ID,
          type: 'line',
          source: MCD_SOURCE_ID,
          paint: {
            'line-color': '#9333ea',
            'line-width': 2.5,
            'line-opacity': 0.95,
          },
        }, beforeId);

        map.addLayer({
          id: MCD_LABEL_ID,
          type: 'symbol',
          source: MCD_SOURCE_ID,
          layout: {
            'text-field': ['coalesce', ['get', 'discussionNumber'], 'MD'],
            'text-size': 11,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#581c87',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.6,
          },
        }, beforeId);
      }

      if (!mcdHandlersBoundRef.current) {
        mcdHandlersBoundRef.current = true;

        const openMcdPopup = (e: any) => {
          const props = e.features?.[0]?.properties;
          if (!props) return;
          const issueTime = props.issueTime
            ? `${new Date(props.issueTime).toISOString().replace('T', ' ').slice(0, 16)}Z`
            : null;
          const ingestTime = props.ingestTime
            ? `${new Date(props.ingestTime).toISOString().replace('T', ' ').slice(0, 16)}Z`
            : null;
          const safeUrl =
            typeof props.url === 'string' && /^https?:\/\/([a-z0-9-]+\.)*noaa\.gov\//i.test(props.url)
              ? props.url
              : null;
          const info = props.info ? escapeHtml(props.info).slice(0, 280) : '';

          new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '320px' })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-family:system-ui;padding:8px;background:#faf5ff;color:#1e1b4b;border-radius:10px;max-width:310px;border:1px solid #d8b4fe;">
                <div style="display:inline-block;background:#9333ea;color:#fff;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:0.04em;">SPC MCD</div>
                <div style="font-size:13px;font-weight:800;margin-top:6px;line-height:1.3;">${escapeHtml(props.name || `Mesoscale Discussion ${props.discussionNumber || ''}`)}</div>
                <div style="font-size:10px;color:#6b21a8;margin-top:5px;line-height:1.5;">
                  ${issueTime ? `<div><strong>Issued:</strong> ${escapeHtml(issueTime)}</div>` : ''}
                  ${ingestTime ? `<div><strong>Updated:</strong> ${escapeHtml(ingestTime)}</div>` : ''}
                </div>
                ${info ? `<div style="font-size:11px;color:#3b0764;margin-top:6px;line-height:1.45;">${info}</div>` : ''}
                ${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-size:11px;font-weight:700;color:#7e22ce;">Open SPC discussion ↗</a>` : ''}
                <div style="font-size:9px;color:#7c3aed;margin-top:6px;">Source: NOAA/NWS Storm Prediction Center</div>
              </div>`
            )
            .addTo(map);
        };

        [MCD_FILL_ID, MCD_LINE_ID, MCD_LABEL_ID].forEach((layerId) => {
          map.on('click', layerId, openMcdPopup);
          map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
          });
        });
      }

      setMcdStatus({
        state: 'ready',
        count: Number(meta?.count ?? geojson.features.length),
        message: meta?.notes?.[0],
      });
    } catch (err: any) {
      removeMCDLayers(map);
      setMcdStatus({
        state: 'unavailable',
        count: 0,
        message: String(err?.message || err),
      });
    }
  }, [removeMCDLayers]);

  const updateRadar = useCallback(
    async (map: MapLibreMap) => {
      setTileError(null);
      if (tileErrorTimerRef.current) {
        clearTimeout(tileErrorTimerRef.current);
        tileErrorTimerRef.current = null;
      }
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

      if (tileUrl !== prevTileUrlRef.current) {
        if (prevTileUrlRef.current && fastScanEnabled) {
          onNewScan?.({
            latencySec: 0,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            site: site.radarId,
          });
        }
        prevTileUrlRef.current = tileUrl;
      }

      if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
      if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);

      // New source: clear any prior banner state and health flag so a genuinely
      // unavailable product still reports its own failure.
      radarSourceHealthyRef.current = false;
      if (tileErrorTimerRef.current) {
        clearTimeout(tileErrorTimerRef.current);
        tileErrorTimerRef.current = null;
      }
      setTileError(null);

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
    [mode, product, tilt, maxRefWindow, site.radarId, radarOpacity, fastScanEnabled, onNewScan]
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

  const updateSpotters = useCallback(async (map: MapLibreMap) => {
    try {
      setSpotterStatus((prev) => ({ ...prev, state: 'loading' }));

      const res = await fetch('/api/spotter?mode=all', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const meta = data?.meta ?? {};

      if (meta.available === false) {
        setSpotterStatus({
          state: 'unavailable',
          positions: 0,
          reports: 0,
          message: (meta.notes && meta.notes[0]) || 'Spotter Network feeds unreachable',
        });
        return;
      }

      const geojson = {
        type: 'FeatureCollection' as const,
        features: Array.isArray(data?.features) ? data.features : [],
      };

      const existing = map.getSource(SPOTTER_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

      if (existing) {
        existing.setData(geojson as any);
      } else {
        map.addSource(SPOTTER_SOURCE_ID, { type: 'geojson', data: geojson as any });

        map.addLayer({
          id: SPOTTER_HALO_LAYER_ID,
          type: 'circle',
          source: SPOTTER_SOURCE_ID,
          filter: ['==', ['get', 'kind'], 'report'],
          paint: {
            'circle-radius': 12,
            'circle-color': '#ef4444',
            'circle-opacity': 0.16,
            'circle-blur': 0.5,
          },
        });

        map.addLayer({
          id: SPOTTER_POSITION_LAYER_ID,
          type: 'circle',
          source: SPOTTER_SOURCE_ID,
          filter: ['==', ['get', 'kind'], 'position'],
          paint: {
            'circle-radius': 4,
            'circle-color': '#ef4444',
            'circle-opacity': 0.92,
            'circle-stroke-width': 1.2,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.addLayer({
          id: SPOTTER_REPORT_LAYER_ID,
          type: 'circle',
          source: SPOTTER_SOURCE_ID,
          filter: ['==', ['get', 'kind'], 'report'],
          paint: {
            'circle-radius': 5.5,
            'circle-color': [
              'match',
              ['get', 'hazard'],
              'Tornado', '#ef4444',
              'Funnel Cloud', '#f97316',
              'Wall Cloud', '#f59e0b',
              'Hail', '#22c55e',
              'Wind', '#eab308',
              'Flooding', '#3b82f6',
              'Precipitation', '#06b6d4',
              '#a855f7',
            ],
            'circle-stroke-width': 1.6,
            'circle-stroke-color': '#ffffff',
          },
        });
      }

      // Bind popups once per map instance (layers may be removed/re-added when
      // the overlay is toggled off and on).
      if (!spotterHandlersBoundRef.current) {
        spotterHandlersBoundRef.current = true;

        const openSpotterPopup = (e: any) => {
          const props = e.features?.[0]?.properties;
          if (!props) return;

          const isReport = props.kind === 'report';
          const when = props.timeIso
            ? new Date(props.timeIso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
            : 'time unknown';
          const age =
            typeof props.ageMinutes === 'number' && props.ageMinutes >= 0
              ? `${props.ageMinutes} min ago`
              : '';
          const safeUrl =
            typeof props.url === 'string' && /^https:\/\/(www\.)?spotternetwork\.org\//i.test(props.url)
              ? props.url
              : null;

          const heading = isReport
            ? `<div style="font-size:13px;font-weight:900;color:#fff;">${escapeHtml(props.reportType || 'Report')}</div>
               <div style="font-size:11px;color:#e2e8f0;margin-top:2px;">${escapeHtml(props.name || 'Spotter')}</div>`
            : `<div style="font-size:12px;font-weight:800;color:#e2e8f0;">Spotter position</div>
               <div style="font-size:12px;font-weight:700;color:#fff;margin-top:2px;">${escapeHtml(props.name || 'Spotter')}</div>`;

          const location = props.location
            ? `<div style="font-size:11px;color:#cbd5e1;margin-top:4px;">${escapeHtml(props.location)}</div>`
            : '';
          const notes = props.notes
            ? `<div style="font-size:11px;color:#e2e8f0;margin-top:6px;line-height:1.45;">${escapeHtml(props.notes)}</div>`
            : '';
          const link = safeUrl
            ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:7px;font-size:11px;font-weight:700;color:#38bdf8;">View on Spotter Network ↗</a>`
            : '';

          new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '290px' })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-family:system-ui;padding:8px;background:#0f172a;border-radius:10px;max-width:280px;">
                ${heading}
                ${location}
                ${notes}
                <div style="font-size:10px;color:#94a3b8;margin-top:7px;">${escapeHtml(when)}${age ? ` · ${escapeHtml(age)}` : ''}</div>
                ${link}
              </div>`
            )
            .addTo(map);
        };

        [SPOTTER_REPORT_LAYER_ID, SPOTTER_POSITION_LAYER_ID].forEach((layerId) => {
          map.on('click', layerId, openSpotterPopup);
          map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
          });
        });
      }

      setSpotterStatus({
        state: 'ready',
        positions: Number(meta?.counts?.positions ?? 0),
        reports: Number(meta?.counts?.reports ?? 0),
        message: meta?.notes?.[0],
      });
    } catch (err: any) {
      setSpotterStatus({
        state: 'unavailable',
        positions: 0,
        reports: 0,
        message: String(err?.message || err),
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
    spotterHandlersBoundRef.current = false;

    // Radar tile status: only the radar product layer may raise the banner,
    // and only when the current live source has not rendered successfully.
    // Historical-frame failures (e.g. archived scans that 503) and failures
    // from unrelated sources (basemap, NWS warnings) are ignored.
    map.on('error', (e: any) => {
      if (e?.sourceId && e.sourceId !== RADAR_SOURCE_ID) return;

      const status = e?.error?.status || e?.status;
      if (status !== 404 && status !== 503) return;

      // The live radar source already rendered -> ignore stray/history failures.
      if (radarSourceHealthyRef.current) return;

      if (tileErrorTimerRef.current) clearTimeout(tileErrorTimerRef.current);
      tileErrorTimerRef.current = setTimeout(() => {
        tileErrorTimerRef.current = null;
        if (radarSourceHealthyRef.current) return;
        setTileError(`Tile Error (${status}): Data unavailable for this region.`);
      }, 1200);
    });

    // Clear the banner as soon as the radar source loads successfully.
    map.on('sourcedata', (e: any) => {
      if (e?.sourceId !== RADAR_SOURCE_ID) return;
      if (!e?.isSourceLoaded) return;

      radarSourceHealthyRef.current = true;
      if (tileErrorTimerRef.current) {
        clearTimeout(tileErrorTimerRef.current);
        tileErrorTimerRef.current = null;
      }
      setTileError(null);
    });

    setTimeout(() => map.resize(), 100);
    setTimeout(() => map.resize(), 300);

    map.on('load', () => {
      setMapReady(true);
      map.resize();
      if (showWarningsRef.current) updateWarnings(map);
      if (showMCDRef.current) updateMCD(map);
      updateRadar(map);
      updateRangeRings(map, site.lat, site.lon);
      if (showRadarPills) renderTowerPills(map);
      if (showSpottersRef.current) updateSpotters(map);
    });

    return () => {
      if (tileErrorTimerRef.current) {
        clearTimeout(tileErrorTimerRef.current);
        tileErrorTimerRef.current = null;
      }
      radarSourceHealthyRef.current = false;
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

  // NWS warning polygons: real active alerts from api.weather.gov.
  useEffect(() => {
    showWarningsRef.current = showWarnings;
  }, [showWarnings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (showWarnings) {
      updateWarnings(map);
      const timer = setInterval(() => updateWarnings(map), 120_000);
      return () => clearInterval(timer);
    }

    removeWarningLayers(map);
  }, [showWarnings, mapReady, updateWarnings, removeWarningLayers]);

  // SPC mesoscale discussions: real polygons from NOAA/NWS SPC MapServer.
  useEffect(() => {
    showMCDRef.current = showMCD;
  }, [showMCD]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (showMCD) {
      updateMCD(map);
      const timer = setInterval(() => updateMCD(map), 120_000);
      return () => clearInterval(timer);
    }

    removeMCDLayers(map);
    setMcdStatus({ state: 'idle', count: 0 });
  }, [showMCD, mapReady, updateMCD, removeMCDLayers]);

  // Spotter Network overlay: independent of the radar product layer so it can
  // be shown alongside any product/loop. Feeds refresh roughly once a minute.
  useEffect(() => {
    showSpottersRef.current = showSpotters;
  }, [showSpotters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (showSpotters) {
      updateSpotters(map);
      const timer = setInterval(() => updateSpotters(map), 60_000);
      return () => clearInterval(timer);
    }

    [SPOTTER_REPORT_LAYER_ID, SPOTTER_POSITION_LAYER_ID, SPOTTER_HALO_LAYER_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    if (map.getSource(SPOTTER_SOURCE_ID)) map.removeSource(SPOTTER_SOURCE_ID);
    setSpotterStatus({ state: 'idle', positions: 0, reports: 0 });
  }, [showSpotters, mapReady, updateSpotters]);

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
  
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const removeSweep = () => {
      if (map.getLayer(SWEEP_FILL_ID)) map.removeLayer(SWEEP_FILL_ID);
      if (map.getLayer(SWEEP_LINE_ID)) map.removeLayer(SWEEP_LINE_ID);
      if (map.getSource(SWEEP_SOURCE_ID)) map.removeSource(SWEEP_SOURCE_ID);
    };

    if (!sweepEnabled) {
      removeSweep();
      return;
    }

    const geojson = makeSweepGeoJSON(site.lat, site.lon, sweepAngle);
    const existing = map.getSource(SWEEP_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson as any);
    } else {
      map.addSource(SWEEP_SOURCE_ID, { type: 'geojson', data: geojson as any });
      map.addLayer({
        id: SWEEP_FILL_ID,
        type: 'fill',
        source: SWEEP_SOURCE_ID,
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#22c55e',
          'fill-opacity': 0.12,
        },
      });
      map.addLayer({
        id: SWEEP_LINE_ID,
        type: 'line',
        source: SWEEP_SOURCE_ID,
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#4ade80',
          'line-width': 2,
          'line-opacity': 0.9,
        },
      });
    }

    return () => {
      // Data updates every tick; layers persist across ticks for smooth animation.
    };
  }, [sweepEnabled, mapReady, sweepAngle, site.lat, site.lon]);

  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (!map) return;
      if (map.getLayer(SWEEP_FILL_ID)) map.removeLayer(SWEEP_FILL_ID);
      if (map.getLayer(SWEEP_LINE_ID)) map.removeLayer(SWEEP_LINE_ID);
      if (map.getSource(SWEEP_SOURCE_ID)) map.removeSource(SWEEP_SOURCE_ID);
    };
  }, [mapReady]);

  // FastScan: poll real frames endpoint more frequently. Honest: this is faster polling of IEM, not a verified ultra-low-latency feed.
  useEffect(() => {
    if (!fastScanEnabled || !mapReady || !mapRef.current) return;
    const interval = setInterval(() => {
      if (mapRef.current) updateRadar(mapRef.current);
    }, 10_000);
    return () => clearInterval(interval);
  }, [fastScanEnabled, mapReady, updateRadar]);

  // Flash reflectivity: visual pulse on raster layer (not true value-range isolation on raster tiles).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (flashEnabled) container.classList.add('radar-flash-active');
    else container.classList.remove('radar-flash-active');
  }, [flashEnabled]);

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden', cursor: crossSectionMode ? 'crosshair' : 'default' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas ref={sweepCanvasRef} className="radar-sweep-canvas" />

      {flashEnabled && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-purple-500/80 bg-slate-950/90 px-4 py-1.5 text-xs font-mono font-black text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.4)] backdrop-blur-md animate-pulse">
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
          <span>FLASH REFLECTIVITY (VISUAL)</span>
          <span className="text-slate-500">|</span>
          <span className="text-yellow-400 font-bold">{flashRange ? `${flashRange[0]}–${flashRange[1]}+ dBZ` : '60+ dBZ'}</span>
        </div>
      )}

      {showSpotters && spotterStatus.state !== 'idle' && (
        <div className="absolute right-4 top-16 z-40 max-w-[230px] rounded-xl border border-cyan-500/40 bg-slate-950/95 px-3 py-2 font-mono text-[10px] text-slate-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-cyan-300">
            <span>◎</span> Spotter Network
          </div>
          {spotterStatus.state === 'loading' ? (
            <div className="mt-1 text-slate-400">Loading live positions…</div>
          ) : spotterStatus.state === 'unavailable' ? (
            <div className="mt-1 leading-snug text-amber-300">
              Unavailable{spotterStatus.message ? ` — ${spotterStatus.message}` : ''}
            </div>
          ) : (
            <>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span>{spotterStatus.positions} positions</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                <span>{spotterStatus.reports} reports (3 h)</span>
              </div>
              {spotterStatus.message && (
                <div className="mt-1 leading-snug text-slate-400">{spotterStatus.message}</div>
              )}
            </>
          )}
        </div>
      )}

      {showMCD && mcdStatus.state !== 'idle' && (
        <div className="absolute right-4 top-[11.5rem] z-40 max-w-[230px] rounded-xl border border-purple-500/40 bg-slate-950/95 px-3 py-2 font-mono text-[10px] text-slate-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-purple-300">
            <span>◈</span> SPC MCDs
          </div>
          {mcdStatus.state === 'loading' ? (
            <div className="mt-1 text-slate-400">Loading mesoscale discussions…</div>
          ) : mcdStatus.state === 'unavailable' ? (
            <div className="mt-1 leading-snug text-amber-300">
              Unavailable{mcdStatus.message ? ` — ${mcdStatus.message}` : ''}
            </div>
          ) : (
            <>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                <span>{mcdStatus.count} active discussion{mcdStatus.count === 1 ? '' : 's'}</span>
              </div>
              {mcdStatus.message && (
                <div className="mt-1 leading-snug text-slate-400">{mcdStatus.message}</div>
              )}
            </>
          )}
        </div>
      )}

      {fastScanEnabled && (
        <div className="absolute right-4 top-[17rem] z-40 max-w-[230px] rounded-xl border border-amber-500/40 bg-slate-950/95 px-3 py-2 font-mono text-[10px] text-slate-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-300">
            <span>⚡</span> FastScan
          </div>
          <div className="mt-1 leading-snug text-amber-200/90">
            Polling real IEM radar frames every 10s. No verified ultra-low-latency source is configured beyond this polling.
          </div>
        </div>
      )}

      {flashEnabled && (
        <div className="absolute right-4 top-[21.5rem] z-40 max-w-[230px] rounded-xl border border-pink-500/40 bg-slate-950/95 px-3 py-2 font-mono text-[10px] text-slate-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-pink-300">
            <span>✦</span> Flash Reflectivity
          </div>
          <div className="mt-1 leading-snug text-pink-200/90">
            Visual pulse effect on raster radar. True value-range isolation is unavailable for current raster tile source.
          </div>
        </div>
      )}

      {showLightning && (
        <div className="absolute right-4 top-[26rem] z-40 max-w-[230px] rounded-xl border border-yellow-500/40 bg-slate-950/95 px-3 py-2 font-mono text-[10px] text-slate-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-yellow-300">
            <span>☇</span> Lightning
          </div>
          <div className="mt-1 leading-snug text-yellow-200/90">
            Unavailable — no verified real-time lightning source (US/CA/CO) is configured in this build.
          </div>
        </div>
      )}

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
