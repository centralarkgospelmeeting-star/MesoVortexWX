'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RADAR_SITES } from '../lib/radar-config';
import { computeMaxReflectivityCanvas, interpolateReflectivityFrames } from '../lib/max-reflectivity';
import { registerSyncedMap } from '../lib/map-sync';
import { ALERT_CATEGORY_META, formatAlertTime, type WeatherAlert } from '../lib/alerts/model';
import { DEFAULT_SATELLITE_SELECTION, getSatelliteTileUrl, normalizeSatelliteSelection, type SatelliteSelection } from '../lib/satellite';
import { getModelById } from '../lib/model-registry';
import { getRadarRasterRenderConfig } from '../lib/radar/render-config';
import { distanceMeters, formatArea, formatDistance, polygonAreaMeters2, polylineMeters, type LngLat } from '../lib/map-tools/geo';

// Next/webpack bundles maplibre-gl, so the library's relative worker URL
// (./maplibre-gl-worker.mjs) resolves to a chunk that does not exist. Serve the
// worker that ships with the pinned maplibre-gl version from /public instead
// (scripts/copy-maplibre-worker.mjs copies it on install).
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

export type ModeTab = 'Radar' | '3D Radar' | 'Composite' | 'Satellite' | 'Models' | 'Outlooks';
export type BasemapType = 'satellite-streets' | 'custom-weather' | 'mapbox' | 'satellite';
export type BasemapId = BasemapType;

export type MapToolMode = 'none' | 'measure-distance' | 'measure-area' | 'draw-point' | 'draw-line' | 'draw-polygon' | 'annotate';

export interface MapToolMeasurement {
  id: string;
  kind: 'distance' | 'area';
  label: string;
  value: string;
  points: Array<[number, number]>;
}

export interface MapToolDrawing {
  id: string;
  kind: 'point' | 'line' | 'polygon' | 'annotation';
  label?: string;
  points: Array<[number, number]>;
  color: string;
}

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
  inspectionMode?: boolean;
  showRangeRings?: boolean;
  showRadarPills?: boolean;
  showLightning?: boolean;
  showLSR?: boolean;
  showWatches?: boolean;
  showWarnings?: boolean;
  showMCD?: boolean;
  showSpotters?: boolean; // people/positions layer
  showSpotterReports?: boolean; // report events layer
  spotterFilters?: {
    tornado?: boolean;
    funnel?: boolean;
    wallCloud?: boolean;
    hail?: boolean;
    wind?: boolean;
    flooding?: boolean;
  };
  showSweepAnimation?: boolean;
  sweepAnimation?: boolean;
  showFastScan?: boolean;
  fastScan?: boolean;
  showFlashReflectivity?: boolean;
  flashReflectivity?: boolean;
  flashRange?: [number, number];
  spotterReports?: SpotterPin[];
  spotterData?: any[];
  /** Normalized NWS alerts (warnings, watches, advisories, statements). */
  alertFeatures?: any;
  /** Join camera movement with other maps sharing this id. */
  syncGroup?: string | null;
  /** Shared playback frame index (aligned to 5-min IEM archive cadence). */
  playbackIndex?: number;
  /** True when global playback is active; used to show LIVE ONLY on non-archived sources. */
  playbackActive?: boolean;
  /** GOES satellite selection when mode is Satellite. */
  satelliteSelection?: SatelliteSelection;
  /** Flat mercator or globe projection. */
  projectionMode?: 'mercator' | 'globe';
  /** Show official NHC/CPHC active tropical cyclones. */
  showHurricanes?: boolean;
  /** Map pitch in degrees for 3D camera view (0-75). */
  mapPitch?: number;
  /** Model workstation selection (verified sources only). */
  modelId?: string;
  modelField?: string;
  modelRun?: string;
  modelForecastHour?: number;
  onNewScan?: (info: { latencySec: number; timestamp: string; site: string }) => void;
  onSelectSite?: (siteId: string) => void;
  onSelectWarningFromMap?: (w: any) => void;
  onCrossSectionComplete?: (pointA: [number, number], pointB: [number, number]) => void;
  onToolMeasurementsChange?: (items: MapToolMeasurement[]) => void;
  onToolDrawingsChange?: (items: MapToolDrawing[]) => void;
  onToolModeChange?: (mode: MapToolMode) => void;
  focusTarget?: { lat: number; lon: number; zoom?: number; ts?: number } | null;
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
const SPOTTER_TRAIL_SOURCE_ID = 'mv-spotters-trail-source';
const SPOTTER_TRAIL_LAYER_ID = 'mv-spotters-trail';
const SPOTTER_HALO_LAYER_ID = 'mv-spotters-halo';
const TOOL_SOURCE_ID = 'mv-tool-source';
const TOOL_FILL_ID = 'mv-tool-fill';
const TOOL_LINE_ID = 'mv-tool-line';
const TOOL_POINT_ID = 'mv-tool-point';
const TOOL_LABEL_ID = 'mv-tool-label';
const TOOL_DRAFT_SOURCE_ID = 'mv-tool-draft-source';
const TOOL_DRAFT_LINE_ID = 'mv-tool-draft-line';
const TOOL_DRAFT_POINT_ID = 'mv-tool-draft-point';
const HURRICANE_CONE_SOURCE_ID = 'mv-hurricane-cone-source';
const HURRICANE_CONE_FILL_ID = 'mv-hurricane-cone-fill';
const HURRICANE_CONE_LINE_ID = 'mv-hurricane-cone-line';
const HURRICANE_TRACK_SOURCE_ID = 'mv-hurricane-track-source';
const HURRICANE_TRACK_LINE_ID = 'mv-hurricane-track-line';
const HURRICANE_RADII_SOURCE_ID = 'mv-hurricane-radii-source';
const HURRICANE_RADII_FILL_ID = 'mv-hurricane-radii-fill';
const HURRICANE_RADII_LINE_ID = 'mv-hurricane-radii-line';
const HURRICANE_POINTS_SOURCE_ID = 'mv-hurricane-points-source';
const HURRICANE_POINTS_CIRCLE_ID = 'mv-hurricane-points-circle';
const HURRICANE_POINTS_LABEL_ID = 'mv-hurricane-points-label';
const HURRICANE_CURRENT_SOURCE_ID = 'mv-hurricane-current-source';
const HURRICANE_CURRENT_HALO_ID = 'mv-hurricane-current-halo';
const HURRICANE_CURRENT_CIRCLE_ID = 'mv-hurricane-current-circle';
const HURRICANE_CURRENT_LABEL_ID = 'mv-hurricane-current-label';
const GLM_SOURCE_ID = 'mv-glm-source';
const GLM_LAYER_ID = 'mv-glm-layer';
const GLM_GLOW_ID = 'mv-glm-glow';
const MODEL_SOURCE_ID = 'mv-model-source';
const MODEL_LAYER_ID = 'mv-model-layer';
const SPOTTER_PULSE_LAYER_ID = 'mv-spotters-pulse';
const SPOTTER_POSITION_LAYER_ID = 'mv-spotters-position';
const SPOTTER_REPORT_LAYER_ID = 'mv-spotters-report';

const REPORT_SOURCE_ID = 'mv-reports-source';
const REPORT_CLUSTER_LAYER_ID = 'mv-reports-clusters';
const REPORT_CLUSTER_COUNT_ID = 'mv-reports-cluster-count';
const REPORT_HALO_LAYER_ID = 'mv-reports-halo';
const REPORT_POINT_LAYER_ID = 'mv-reports-point';
const REPORT_ICON_LAYER_ID = 'mv-reports-icon';

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

type SpotterObservation = {
  lon: number;
  lat: number;
  timeMs: number;
};

const SPOTTER_HISTORY_WINDOW_MS = 30 * 60 * 1000;

/** Great-circle distance in statute miles. */
function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 0.621371;
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
  inspectionMode = false,
  toolMode = 'none',
  toolRevision = 0,
  showRangeRings = true,
  showRadarPills = true,
  showWarnings = true,
  showMCD = true,
  showSpotters = false,
  showSpotterReports = false,
  spotterFilters = {
    tornado: true,
    funnel: true,
    wallCloud: true,
    hail: true,
    wind: true,
    flooding: true,
  },
  showSweepAnimation = true,
  sweepAnimation: sweepAnimationProp,
  showFastScan = false,
  fastScan: fastScanProp,
  showFlashReflectivity = false,
  flashReflectivity: flashReflectivityProp,
  flashRange = [60, 80],
  showLightning = false,
  spotterData = [],
  alertFeatures = { type: 'FeatureCollection', features: [] },
  syncGroup = null,
  playbackIndex = 0,
  playbackActive = false,
  satelliteSelection = DEFAULT_SATELLITE_SELECTION,
  projectionMode = 'mercator',
  showHurricanes = false,
  mapPitch = 0,
  modelId = 'gdps-geml',
  modelField = 'temp',
  modelRun = 'latest',
  modelForecastHour = 0,
  onNewScan,
  onSelectSite,
  onSelectWarningFromMap,
  onCrossSectionComplete,
  onToolMeasurementsChange,
  onToolDrawingsChange,
  onToolModeChange,
  focusTarget = null,
}: RadarMapProps) {
  const [scanIngesting, setScanIngesting] = useState(false);
  const [scanIngestDismissed, setScanIngestDismissed] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<{ lat: number; lon: number; product: string; site: string; tilt: string; time: string; value: string; note?: string } | null>(null);
  const [toolMeasurements, setToolMeasurements] = useState<MapToolMeasurement[]>([]);
  const [toolDrawings, setToolDrawings] = useState<MapToolDrawing[]>([]);
  const toolDraftRef = useRef<LngLat[]>([]);
  const toolModeRef = useRef<MapToolMode>(toolMode);
  const toolRevRef = useRef<number>(toolRevision);
  const onToolMeasurementsChangeRef = useRef(onToolMeasurementsChange);
  const onToolDrawingsChangeRef = useRef(onToolDrawingsChange);
  const onToolModeChangeRef = useRef(onToolModeChange);
  const lastFrameRef = useRef<{ time: string; product: string; site: string; tilt: string }>({ time: '', product: '', site: '', tilt: '' });
  const isRadarMode = mode === 'Radar' || mode === '3D Radar';
  const radarVisualsEnabled = isRadarMode; // beam/sweep/towers/pills/range rings/scan-ingest visuals
  const fastScanEnabled = radarVisualsEnabled && (fastScanProp ?? showFastScan);
  const sweepEnabled = radarVisualsEnabled && ((sweepAnimationProp ?? showSweepAnimation) || fastScanEnabled);
  const flashEnabled = radarVisualsEnabled && (flashReflectivityProp ?? showFlashReflectivity);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const sweepCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sweepAngleRef = useRef<number>(0);
  const paintInBoostRef = useRef<number>(0);
  const prevTileUrlRef = useRef<string>('');
  const [mapReady, setMapReady] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);
  const [sweepAngle, setSweepAngle] = useState(0);
  const [liveOnly, setLiveOnly] = useState(false);
  const [hurricaneStatus, setHurricaneStatus] = useState<{ state: 'idle' | 'loading' | 'ready' | 'unavailable'; count: number; message?: string }>({ state: 'idle', count: 0 });
  const hurricaneHandlersBoundRef = useRef(false);
  const [glmStatus, setGlmStatus] = useState<{ state: 'idle'|'loading'|'ready'|'unavailable'; count: number; message?: string }>({ state: 'idle', count: 0 });
  const [modelStatus, setModelStatus] = useState<{ state: 'idle'|'ready'|'unavailable'; message?: string; source?: string; runTime?: string; forecastHour?: number; updateFrequency?: string; availability?: string }>({ state: 'idle' });
  const [tileErrorDismissed, setTileErrorDismissed] = useState(false);
  const [liveOnlyDismissed, setLiveOnlyDismissed] = useState(false);
  const [flashDismissed, setFlashDismissed] = useState(false);
  useEffect(() => { if (liveOnly) setLiveOnlyDismissed(false); }, [liveOnly]);
  useEffect(() => { if (flashEnabled) setFlashDismissed(false); }, [flashEnabled]);
  useEffect(() => { if (!scanIngesting) return; setScanIngestDismissed(false); const t = setTimeout(() => setScanIngesting(false), 90000); return () => clearTimeout(t); }, [scanIngesting]);
  useEffect(() => { toolModeRef.current = toolMode; }, [toolMode]);
  useEffect(() => { onToolMeasurementsChangeRef.current = onToolMeasurementsChange; }, [onToolMeasurementsChange]);
  useEffect(() => { onToolDrawingsChangeRef.current = onToolDrawingsChange; }, [onToolDrawingsChange]);
  useEffect(() => { onToolModeChangeRef.current = onToolModeChange; }, [onToolModeChange]);
  useEffect(() => {
    // External revision bump signals clear/undo from UI.
    if (toolRevRef.current === toolRevision) return;
    toolRevRef.current = toolRevision;
    toolDraftRef.current = [];
    setToolMeasurements([]);
    setToolDrawings([]);
  }, [toolRevision]);
  useEffect(() => { onToolMeasurementsChangeRef.current?.(toolMeasurements); }, [toolMeasurements]);
  useEffect(() => { onToolDrawingsChangeRef.current?.(toolDrawings); }, [toolDrawings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try {
      (map as any).setProjection({ type: projectionMode === 'globe' ? 'globe' : 'mercator' });
    } catch {
      // Older style/runtime may reject projection changes; keep mercator safely.
    }
  }, [mapReady, projectionMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try { map.setPitch(Math.max(0, Math.min(75, Number(mapPitch) || 0))); } catch {}
  }, [mapReady, mapPitch]);

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
  const reportHandlersBoundRef = useRef(false);
  const showSpottersRef = useRef(showSpotters);
  const showSpotterReportsRef = useRef(showSpotterReports);
  const spotterHistoryRef = useRef<Map<string, SpotterObservation[]>>(new Map());
  const [spotterStatus, setSpotterStatus] = useState<{
    state: 'idle' | 'loading' | 'ready' | 'unavailable';
    positions: number;
    reports: number;
    message?: string;
  }>({ state: 'idle', positions: 0, reports: 0 });
  const warningHandlersBoundRef = useRef(false);
  const mcdHandlersBoundRef = useRef(false);
  const showMCDRef = useRef(showMCD);
  const showHurricanesRef = useRef(showHurricanes);
  const showWarningsRef = useRef(showWarnings);
  const alertFeaturesRef = useRef<any>(alertFeatures);
  const onSelectWarningRef = useRef(onSelectWarningFromMap);
  const towerPillMarkersRef = useRef<maplibregl.Marker[]>([]);
  const showRadarPillsRef = useRef(showRadarPills);
  const selectedRadarSiteRef = useRef(radarSite);
  const onSelectSiteRef = useRef(onSelectSite);
  const [mcdStatus, setMcdStatus] = useState<{
    state: 'idle' | 'loading' | 'ready' | 'unavailable';
    count: number;
    message?: string;
  }>({ state: 'idle', count: 0 });

  const site =
    RADAR_SITES.find((s) => s.id === radarSite || s.radarId === radarSite) ||
    RADAR_SITES[0];

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
    reportHandlersBoundRef.current = false;
    setMapReady(false);

    map.on('error', (e: any) => {
      if (e?.sourceId && e.sourceId !== RADAR_SOURCE_ID) return;
      const status = e?.error?.status || e?.status;
      if (status !== 404 && status !== 503) return;
      if (radarSourceHealthyRef.current) return;
      if (tileErrorTimerRef.current) clearTimeout(tileErrorTimerRef.current);
      tileErrorTimerRef.current = setTimeout(() => {
        tileErrorTimerRef.current = null;
        if (radarSourceHealthyRef.current) return;
        setTileError(`Tile Error (${status}): Data unavailable for this region.`);
      }, 1200);
    });

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
      if (radarVisualsEnabled && showRangeRings) updateRangeRings(map, site.lat, site.lon);
      if (showRadarPillsRef.current && radarVisualsEnabled) renderTowerPills(map);
      if (showSpottersRef.current || showSpotterReportsRef.current) updateSpotters(map);
    });

    return () => {
      if (tileErrorTimerRef.current) {
        clearTimeout(tileErrorTimerRef.current);
        tileErrorTimerRef.current = null;
      }
      radarSourceHealthyRef.current = false;
      setMapReady(false);
      clearTowerPills();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  const updateWarnings = useCallback((map: MapLibreMap, geojson?: any) => {
    const sourceData = geojson ?? alertFeaturesRef.current ?? { type: 'FeatureCollection', features: [] };
    const features = Array.isArray(sourceData?.features) ? sourceData.features : [];
    const validGeoJSON = { type: 'FeatureCollection', features };

    const source = map.getSource(WARNINGS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(validGeoJSON as any);
      return;
    }

    map.addSource(WARNINGS_SOURCE_ID, { type: 'geojson', data: validGeoJSON as any });

    const beforeId =
      map.getLayer(MCD_FILL_ID) ? MCD_FILL_ID :
      map.getLayer(SPOTTER_HALO_LAYER_ID) ? SPOTTER_HALO_LAYER_ID :
      undefined;

    // Category-aware styling: colors come from normalized alert properties.
    // Watches/advisories/statements render with dashed outlines so they are
    // visually distinct from solid warning polygons at a glance.
    map.addLayer(
      {
        id: WARNINGS_FILL_ID,
        type: 'fill',
        source: WARNINGS_SOURCE_ID,
        paint: {
          'fill-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'fill-opacity': [
            'match',
            ['get', 'category'],
            'warning', 0.18,
            'watch', 0.1,
            'advisory', 0.08,
            'statement', 0.06,
            0.08,
          ],
        },
      },
      beforeId
    );

    map.addLayer(
      {
        id: WARNINGS_LINE_OUTER_ID,
        type: 'line',
        source: WARNINGS_SOURCE_ID,
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#1d4ed8'],
          'line-width': [
            'match',
            ['get', 'category'],
            'warning', 3.5,
            'watch', 2.8,
            'advisory', 2.2,
            2,
          ],
          'line-dasharray': [
            'match',
            ['get', 'category'],
            'warning', ['literal', [1, 0]],
            'watch', ['literal', [2, 1.5]],
            'advisory', ['literal', [4, 2]],
            'statement', ['literal', [1.5, 1.5]],
            ['literal', [3, 2]],
          ],
        },
      },
      beforeId
    );

    map.addLayer(
      {
        id: WARNINGS_LINE_INNER_ID,
        type: 'line',
        source: WARNINGS_SOURCE_ID,
        paint: {
          'line-color': ['coalesce', ['get', 'lineColor'], '#60a5fa'],
          'line-width': [
            'match',
            ['get', 'category'],
            'warning', 1.8,
            'watch', 1.2,
            'advisory', 1,
            0.8,
          ],
          'line-opacity': 0.9,
        },
      },
      beforeId
    );

    if (!warningHandlersBoundRef.current) {
      warningHandlersBoundRef.current = true;
      map.on('click', WARNINGS_FILL_ID, (e) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        if (onSelectWarningRef.current) onSelectWarningRef.current(props);

        const category = String(props.category || 'warning');
        const meta = ALERT_CATEGORY_META[category as keyof typeof ALERT_CATEGORY_META] || ALERT_CATEGORY_META.warning;
        const headline = escapeHtml(props.headline || props.event || 'Active Alert');
        const area = escapeHtml(props.areaDesc || '');
        const event = escapeHtml(props.event || 'Weather Alert');
        const severity = escapeHtml(props.severity || 'Unknown');
        const expires = props.expires ? escapeHtml(formatAlertTime(String(props.expires))) : 'Unavailable';
        const color = escapeHtml(String(props.color || '#dc2626'));

        new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '320px' })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;padding:8px;max-width:300px;color:#0f172a;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span style="background:${color};color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:900;text-transform:uppercase;">
                  ${escapeHtml(meta.singular)}
                </span>
                <span style="font-size:10px;font-weight:700;color:#475569;">${severity}</span>
              </div>
              <div style="font-size:12px;font-weight:800;line-height:1.35;color:#0f172a;">${event}</div>
              <div style="font-size:11px;color:#334155;margin-top:5px;line-height:1.35;">${headline}</div>
              ${area ? `<div style="font-size:10px;color:#64748b;margin-top:6px;">${area}</div>` : ''}
              <div style="font-size:10px;color:#64748b;margin-top:4px;">Expires: ${expires}</div>
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
  }, []);

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

  const removeHurricaneLayers = useCallback((map: MapLibreMap) => {
    [
      HURRICANE_CURRENT_LABEL_ID, HURRICANE_CURRENT_CIRCLE_ID, HURRICANE_CURRENT_HALO_ID,
      HURRICANE_POINTS_LABEL_ID, HURRICANE_POINTS_CIRCLE_ID,
      HURRICANE_RADII_LINE_ID, HURRICANE_RADII_FILL_ID,
      HURRICANE_TRACK_LINE_ID,
      HURRICANE_CONE_LINE_ID, HURRICANE_CONE_FILL_ID,
    ].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
    [
      HURRICANE_CURRENT_SOURCE_ID, HURRICANE_POINTS_SOURCE_ID, HURRICANE_RADII_SOURCE_ID,
      HURRICANE_TRACK_SOURCE_ID, HURRICANE_CONE_SOURCE_ID,
    ].forEach((id) => { if (map.getSource(id)) map.removeSource(id); });
    hurricaneHandlersBoundRef.current = false;
  }, []);

  const updateHurricanes = useCallback(async (map: MapLibreMap) => {
    try {
      setHurricaneStatus({ state: 'loading', count: 0 });
      const res = await fetch('/api/tropical/cyclones', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.available) {
        removeHurricaneLayers(map);
        setHurricaneStatus({ state: 'unavailable', count: 0, message: data?.error || 'Tropical cyclone data unavailable' });
        return;
      }
      const storms = Array.isArray(data.storms) ? data.storms : [];
      if (storms.length === 0) {
        removeHurricaneLayers(map);
        setHurricaneStatus({ state: 'ready', count: 0 });
        return;
      }

      const coneFeatures: any[] = [];
      const trackFeatures: any[] = [];
      const radiiFeatures: any[] = [];
      const pointFeatures: any[] = [];
      const currentFeatures: any[] = [];
      for (const storm of storms) {
        const propsBase = {
          stormId: storm.id,
          stormName: storm.name,
          basin: storm.basin,
          intensity: storm.intensity,
          maxWindKt: storm.maxWindKt ?? '',
          pressureMb: storm.pressureMb ?? '',
          movement: storm.movement,
          advisoryNumber: storm.advisory?.number ?? 'Unavailable',
          advisoryDate: storm.advisory?.date ?? 'Unavailable',
          advisoryHeadline: storm.advisory?.headline ?? '',
          advisoryUrl: storm.advisory?.url ?? 'https://www.nhc.noaa.gov/',
          advisorySource: storm.advisory?.source ?? 'NHC',
          lat: storm.position?.lat ?? '',
          lon: storm.position?.lon ?? '',
        };
        for (const f of (storm.forecastCone?.features || [])) coneFeatures.push({ ...f, properties: { ...(f.properties||{}), ...propsBase } });
        for (const f of (storm.forecastTrack?.features || [])) trackFeatures.push({ ...f, properties: { ...(f.properties||{}), ...propsBase } });
        for (const f of (storm.windRadii?.features || [])) radiiFeatures.push({ ...f, properties: { ...(f.properties||{}), ...propsBase } });
        for (const f of (storm.forecastPoints?.features || [])) pointFeatures.push({ ...f, properties: { ...(f.properties||{}), ...propsBase } });
        if (storm.position && Number.isFinite(storm.position.lat) && Number.isFinite(storm.position.lon)) {
          currentFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [storm.position.lon, storm.position.lat] },
            properties: propsBase,
          });
        }
      }

      const coneData = { type: 'FeatureCollection', features: coneFeatures };
      const trackData = { type: 'FeatureCollection', features: trackFeatures };
      const radiiData = { type: 'FeatureCollection', features: radiiFeatures };
      const pointsData = { type: 'FeatureCollection', features: pointFeatures };
      const currentData = { type: 'FeatureCollection', features: currentFeatures };

      const beforeId = map.getLayer(MCD_FILL_ID) ? MCD_FILL_ID : map.getLayer(WARNINGS_FILL_ID) ? WARNINGS_FILL_ID : undefined;
      const setOrAdd = (sourceId: string, layerId: string, layer: any) => {
        const src = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData((layer as any).__data || ({} as any));
      };
      // Simpler: set or add for each source
      const upsert = (sourceId: string, data: any) => {
        const src = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(data as any);
        else map.addSource(sourceId, { type: 'geojson', data: data as any });
      };
      upsert(HURRICANE_CONE_SOURCE_ID, coneData);
      upsert(HURRICANE_TRACK_SOURCE_ID, trackData);
      upsert(HURRICANE_RADII_SOURCE_ID, radiiData);
      upsert(HURRICANE_POINTS_SOURCE_ID, pointsData);
      upsert(HURRICANE_CURRENT_SOURCE_ID, currentData);

      if (!map.getLayer(HURRICANE_CONE_FILL_ID)) map.addLayer({ id: HURRICANE_CONE_FILL_ID, type: 'fill', source: HURRICANE_CONE_SOURCE_ID, paint: { 'fill-color': '#f97316', 'fill-opacity': 0.12 } }, beforeId);
      if (!map.getLayer(HURRICANE_CONE_LINE_ID)) map.addLayer({ id: HURRICANE_CONE_LINE_ID, type: 'line', source: HURRICANE_CONE_SOURCE_ID, paint: { 'line-color': '#fb923c', 'line-width': 1.5, 'line-dasharray': [2, 2], 'line-opacity': 0.8 } }, beforeId);
      if (!map.getLayer(HURRICANE_TRACK_LINE_ID)) map.addLayer({ id: HURRICANE_TRACK_LINE_ID, type: 'line', source: HURRICANE_TRACK_SOURCE_ID, paint: { 'line-color': '#f8fafc', 'line-width': 2.5, 'line-opacity': 0.95 } }, beforeId);
      if (!map.getLayer(HURRICANE_RADII_FILL_ID)) map.addLayer({ id: HURRICANE_RADII_FILL_ID, type: 'fill', source: HURRICANE_RADII_SOURCE_ID, paint: { 'fill-color': ['match', ['to-string', ['get', 'radval']], '34', '#f59e0b', '50', '#f97316', '64', '#ef4444', '#fb7185'], 'fill-opacity': 0.10 } }, beforeId);
      if (!map.getLayer(HURRICANE_RADII_LINE_ID)) map.addLayer({ id: HURRICANE_RADII_LINE_ID, type: 'line', source: HURRICANE_RADII_SOURCE_ID, paint: { 'line-color': ['match', ['to-string', ['get', 'radval']], '34', '#f59e0b', '50', '#f97316', '64', '#ef4444', '#fb7185'], 'line-width': 1.2, 'line-opacity': 0.7 } }, beforeId);
      if (!map.getLayer(HURRICANE_POINTS_CIRCLE_ID)) map.addLayer({ id: HURRICANE_POINTS_CIRCLE_ID, type: 'circle', source: HURRICANE_POINTS_SOURCE_ID, paint: { 'circle-radius': 4, 'circle-color': '#f8fafc', 'circle-stroke-color': '#0f172a', 'circle-stroke-width': 1 } }, beforeId);
      if (!map.getLayer(HURRICANE_POINTS_LABEL_ID)) map.addLayer({ id: HURRICANE_POINTS_LABEL_ID, type: 'symbol', source: HURRICANE_POINTS_SOURCE_ID, layout: { 'text-field': ['coalesce', ['get', 'dvlabel'], ['get', 'fltlbl'], ''], 'text-size': 9, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-allow-overlap': false }, paint: { 'text-color': '#e2e8f0', 'text-halo-color': '#020617', 'text-halo-width': 1 } }, beforeId);
      if (!map.getLayer(HURRICANE_CURRENT_HALO_ID)) map.addLayer({ id: HURRICANE_CURRENT_HALO_ID, type: 'circle', source: HURRICANE_CURRENT_SOURCE_ID, paint: { 'circle-radius': 12, 'circle-color': '#ef4444', 'circle-opacity': 0.18, 'circle-blur': 0.4 } }, beforeId);
      if (!map.getLayer(HURRICANE_CURRENT_CIRCLE_ID)) map.addLayer({ id: HURRICANE_CURRENT_CIRCLE_ID, type: 'circle', source: HURRICANE_CURRENT_SOURCE_ID, paint: { 'circle-radius': 7, 'circle-color': '#ef4444', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } }, beforeId);
      if (!map.getLayer(HURRICANE_CURRENT_LABEL_ID)) map.addLayer({ id: HURRICANE_CURRENT_LABEL_ID, type: 'symbol', source: HURRICANE_CURRENT_SOURCE_ID, layout: { 'text-field': ['coalesce', ['get', 'stormName'], 'Storm'], 'text-size': 11, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-offset': [0, 1.4], 'text-anchor': 'top' }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#020617', 'text-halo-width': 1.4 } }, beforeId);

      if (!hurricaneHandlersBoundRef.current) {
        hurricaneHandlersBoundRef.current = true;
        const openStormPopup = (e: any) => {
          const props = e.features?.[0]?.properties || {};
          const name = escapeHtml(props.stormName || 'Tropical Cyclone');
          const intensity = escapeHtml(props.intensity || 'Unknown');
          const lat = props.lat;
          const lon = props.lon;
          const pos = (lat !== '' && lon !== '' && lat != null && lon != null) ? `${Number(lat).toFixed(2)}°, ${Number(lon).toFixed(2)}°` : 'Unavailable';
          const movement = escapeHtml(props.movement || 'Unavailable');
          const advNum = escapeHtml(props.advisoryNumber || 'Unavailable');
          const advDate = escapeHtml(props.advisoryDate || 'Unavailable');
          const headline = escapeHtml(props.advisoryHeadline || '');
          const advUrl = typeof props.advisoryUrl === 'string' && /^https?:\/\/(www\.)?nhc\.noaa\.gov\//i.test(props.advisoryUrl) ? props.advisoryUrl : 'https://www.nhc.noaa.gov/';
          const source = escapeHtml(props.advisorySource || 'NHC');
          const wind = props.maxWindKt !== '' && props.maxWindKt != null ? `${escapeHtml(String(props.maxWindKt))} kt` : 'Unavailable';
          const pres = props.pressureMb !== '' && props.pressureMb != null ? `${escapeHtml(String(props.pressureMb))} mb` : 'Unavailable';
          new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '340px' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="font-family:system-ui;padding:10px;color:#0f172a;max-width:320px;">
              <div style="display:inline-block;background:#dc2626;color:#fff;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:0.04em;">ACTIVE TROPICAL CYCLONE</div>
              <div style="font-size:15px;font-weight:900;margin-top:6px;color:#111827;">${name}</div>
              <div style="font-size:11px;color:#334155;margin-top:6px;line-height:1.55;">
                <div><strong>Intensity:</strong> ${intensity}</div>
                <div><strong>Max Wind:</strong> ${wind} &nbsp; <strong>Pressure:</strong> ${pres}</div>
                <div><strong>Position:</strong> ${escapeHtml(pos)}</div>
                <div><strong>Movement:</strong> ${movement}</div>
                <div><strong>Advisory:</strong> ${advNum} (${advDate})</div>
                <div><strong>Source:</strong> ${source}</div>
              </div>
              ${headline ? `<div style="font-size:11px;color:#475569;margin-top:6px;line-height:1.4;">${headline}</div>` : ''}
              <a href="${escapeHtml(advUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-size:11px;font-weight:700;color:#2563eb;">Official advisory ↗</a>
            </div>`)
            .addTo(map);
        };
        [HURRICANE_CURRENT_CIRCLE_ID, HURRICANE_CURRENT_HALO_ID, HURRICANE_POINTS_CIRCLE_ID, HURRICANE_CONE_FILL_ID, HURRICANE_TRACK_LINE_ID].forEach((layerId) => {
          map.on('click', layerId, openStormPopup);
          map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
        });
      }

      setHurricaneStatus({ state: 'ready', count: storms.length });
    } catch (err: any) {
      removeHurricaneLayers(map);
      setHurricaneStatus({ state: 'unavailable', count: 0, message: String(err?.message || err) });
    }
  }, [removeHurricaneLayers]);

  useEffect(() => {
    showHurricanesRef.current = showHurricanes;
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!showHurricanes) {
      removeHurricaneLayers(map);
      setHurricaneStatus({ state: 'idle', count: 0 });
      return;
    }
    updateHurricanes(map);
    const timer = setInterval(() => {
      if (showHurricanesRef.current) updateHurricanes(map);
    }, 300000);
    return () => clearInterval(timer);
  }, [mapReady, showHurricanes, updateHurricanes, removeHurricaneLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const removeGlm = () => {
      [GLM_GLOW_ID, GLM_LAYER_ID].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(GLM_SOURCE_ID)) map.removeSource(GLM_SOURCE_ID);
    };
    if (!showLightning) {
      removeGlm();
      setGlmStatus({ state: 'idle', count: 0 });
      return;
    }
    let cancelled = false;
    const load = async () => {
      setGlmStatus(s => ({ ...s, state: 'loading' }));
      try {
        const res = await fetch('/api/lightning/glm?minutes=5', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (!data?.available) {
          removeGlm();
          setGlmStatus({ state: 'unavailable', count: 0, message: data?.reason || 'DATA UNAVAILABLE' });
          return;
        }
        const fc = data.features?.type === 'FeatureCollection' ? data.features : { type: 'FeatureCollection', features: [] };
        const src = map.getSource(GLM_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(fc as any);
        else map.addSource(GLM_SOURCE_ID, { type: 'geojson', data: fc as any });
        const beforeId = map.getLayer(MCD_FILL_ID) ? MCD_FILL_ID : map.getLayer(WARNINGS_FILL_ID) ? WARNINGS_FILL_ID : undefined;
        if (!map.getLayer(GLM_GLOW_ID)) map.addLayer({ id: GLM_GLOW_ID, type: 'circle', source: GLM_SOURCE_ID, paint: { 'circle-radius': 5, 'circle-color': '#fde047', 'circle-opacity': 0.18, 'circle-blur': 0.6 } }, beforeId);
        if (!map.getLayer(GLM_LAYER_ID)) map.addLayer({ id: GLM_LAYER_ID, type: 'circle', source: GLM_SOURCE_ID, paint: { 'circle-radius': 2.2, 'circle-color': '#facc15', 'circle-stroke-color': '#713f12', 'circle-stroke-width': 0.4, 'circle-opacity': 0.9 } }, beforeId);
        setGlmStatus({ state: 'ready', count: Number(data.count || fc.features?.length || 0) });
      } catch (e: any) {
        if (!cancelled) { removeGlm(); setGlmStatus({ state: 'unavailable', count: 0, message: String(e?.message || e) }); }
      }
    };
    load();
    const timer = setInterval(load, 120000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [mapReady, showLightning]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const removeModel = () => {
      if (map.getLayer(MODEL_LAYER_ID)) map.removeLayer(MODEL_LAYER_ID);
      if (map.getSource(MODEL_SOURCE_ID)) map.removeSource(MODEL_SOURCE_ID);
    };
    if (mode !== 'Models') {
      removeModel();
      setModelStatus({ state: 'idle' });
      return;
    }

    const model = getModelById(modelId);
    const field = model?.fields.find(f => f.id === modelField) || model?.fields[0];
    const provenance = {
      source: model?.source || 'Unknown',
      runTime: modelRun === 'latest' ? 'Latest available' : modelRun,
      forecastHour: modelForecastHour,
      updateFrequency: model?.updateFrequency || 'Unknown',
    };

    if (!model || !field || model.status !== 'READY_NOW' || field.status !== 'READY_NOW' || !field.wmsLayer) {
      removeModel();
      setModelStatus({
        state: 'unavailable',
        message: field?.note || model?.notes || 'DATA UNAVAILABLE - no verified real source integrated for this model/field.',
        ...provenance,
        availability: 'DATA UNAVAILABLE',
      });
      return;
    }

    const wmsUrl = `https://geo.weather.gc.ca/geomet?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=${encodeURIComponent(field.wmsLayer)}&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`;
    const beforeId = map.getLayer('radar-layer') ? 'radar-layer' : map.getLayer(MCD_FILL_ID) ? MCD_FILL_ID : map.getLayer(WARNINGS_FILL_ID) ? WARNINGS_FILL_ID : undefined;
    try {
      const src = map.getSource(MODEL_SOURCE_ID) as maplibregl.RasterTileSource | undefined;
      if (src) {
        // @ts-ignore - setTiles exists on raster tile sources
        src.setTiles([wmsUrl]);
      } else {
        map.addSource(MODEL_SOURCE_ID, { type: 'raster', tiles: [wmsUrl], tileSize: 256 });
      }
      if (!map.getLayer(MODEL_LAYER_ID)) {
        map.addLayer({ id: MODEL_LAYER_ID, type: 'raster', source: MODEL_SOURCE_ID, paint: { 'raster-opacity': 0.75 } }, beforeId);
      }
      setModelStatus({ state: 'ready', ...provenance, availability: 'Available (verified WMS)' });
    } catch (e: any) {
      removeModel();
      setModelStatus({ state: 'unavailable', message: String(e?.message || e), ...provenance, availability: 'DATA UNAVAILABLE' });
    }
  }, [mapReady, mode, modelId, modelField, modelRun, modelForecastHour]);

  const updateRadar = useCallback(
    async (map: MapLibreMap) => {
      setTileError(null);
      setTileErrorDismissed(false);
      if (tileErrorTimerRef.current) {
        clearTimeout(tileErrorTimerRef.current);
        tileErrorTimerRef.current = null;
      }
      let tileUrl = '';
      let archiveAvailable = false;

      if (mode === 'Composite') {
        tileUrl = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png';
        archiveAvailable = false;
      } else if (mode === 'Satellite') {
        const satSel = normalizeSatelliteSelection(satelliteSelection);
        const sat = getSatelliteTileUrl(satSel);
        tileUrl = sat.url || '';
        archiveAvailable = false;
        if (!tileUrl) {
          if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
          if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);
          setTileError(sat.unavailableReason ? `DATA UNAVAILABLE` : 'DATA UNAVAILABLE');
          setLiveOnly(false);
          return;
        }
        try {
          const probe = await fetch(tileUrl.replace('{z}/{x}/{y}', '0/0/0'), { cache: 'no-store' });
          if (!probe.ok) {
            if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
            if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);
            setTileError('DATA UNAVAILABLE');
            setLiveOnly(false);
            return;
          }
        } catch {
          if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
          if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);
          setTileError('DATA UNAVAILABLE');
          setLiveOnly(false);
          return;
        }
      } else if (mode === 'Models' || mode === 'Outlooks') {
        if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
        if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);
        setLiveOnly(false);
        setTileError(null);
        return;
      } else if (product === 'max_ref') {
        try {
          const res = await fetch(
            `/api/nexrad/frames?site=${encodeURIComponent(site.radarId)}&product=ref&tilt=${encodeURIComponent(tilt)}`,
            { cache: 'no-store' }
          );
          const data = await res.json();
          const frames = (data.frames || []).map((f: any) => f.tileUrl);
          archiveAvailable = Boolean(data.loopAvailable);
          const end = playbackActive && archiveAvailable ? Math.max(0, Math.min(playbackIndex, frames.length - 1)) + 1 : frames.length;
          const windowFrames = frames.slice(0, end);
          const sliceCount = Math.min(windowFrames.length, maxRefWindow);
          tileUrl = await computeMaxReflectivityCanvas(windowFrames.slice(-sliceCount));
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
          archiveAvailable = Boolean(data.loopAvailable);
          if (frames.length >= 2) {
            const idx = playbackActive && archiveAvailable ? Math.max(1, Math.min(playbackIndex, frames.length - 1)) : frames.length - 1;
            tileUrl = await interpolateReflectivityFrames(frames[idx - 1], frames[idx]);
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
            setLiveOnly(false);
            return;
          }
          const data = await res.json();
          archiveAvailable = Boolean(data.loopAvailable);
          const frames = Array.isArray(data.frames) ? data.frames : [];
          if (playbackActive && archiveAvailable && frames.length > 0) {
            const idx = Math.max(0, Math.min(playbackIndex, frames.length - 1));
            tileUrl = String(frames[idx]?.tileUrl || data.latestTileUrl);
            lastFrameRef.current = { time: String(frames[idx]?.time || frames[idx]?.label || ''), product, site: site.radarId, tilt };
          } else {
            tileUrl = data.latestTileUrl;
            const last = frames[frames.length - 1];
            lastFrameRef.current = { time: String(last?.time || last?.label || ''), product, site: site.radarId, tilt };
          }
        } catch {
          if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
          if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);
          setTileError(`Network error loading ${product.toUpperCase()}.`);
          setLiveOnly(false);
          return;
        }
      }

      setLiveOnly(Boolean(playbackActive && !archiveAvailable));

      if (!tileUrl) return;

      if (tileUrl !== prevTileUrlRef.current) {
        if (prevTileUrlRef.current && fastScanEnabled) {
          setScanIngesting(true);
          onNewScan?.({
            latencySec: 0,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            site: site.radarId,
          });
        }
        prevTileUrlRef.current = tileUrl;
      }

      // New/changed source: clear prior banner state and health flag so a
      // genuinely unavailable product still reports its own failure.
      radarSourceHealthyRef.current = false;
      if (tileErrorTimerRef.current) {
        clearTimeout(tileErrorTimerRef.current);
        tileErrorTimerRef.current = null;
      }
      setTileError(null);

      const existingSource = map.getSource(RADAR_SOURCE_ID) as any;
      const beforeId = map.getLayer(WARNINGS_FILL_ID) ? WARNINGS_FILL_ID : undefined;

      const isSatelliteMode = mode === 'Satellite';
      const renderConfig = getRadarRasterRenderConfig({ mode, product });
      const usesWmsBbox = tileUrl.includes('{bbox-epsg-3857}');
      const rasterPaint: any = {
        'raster-opacity': radarOpacity,
        'raster-fade-duration': renderConfig.rasterFadeDuration,
        // Product-aware resampling inspired by Supercell-Wx view/render separation:
        // nearest for radar gates, linear for satellite imagery.
        'raster-resampling': renderConfig.rasterResampling,
        'raster-saturation': isSatelliteMode ? 0.18 : 0,
        'raster-contrast': isSatelliteMode ? 0.18 : 0,
        'raster-brightness-min': isSatelliteMode ? 0.02 : 0,
        'raster-brightness-max': isSatelliteMode ? 1 : 1,
      };

      const currentScheme = (existingSource as any)?.scheme || (existingSource as any)?.tileScheme;
      const needsRebuild = !existingSource || typeof existingSource.setTiles !== 'function' || (usesWmsBbox && currentScheme !== 'tms');

      if (!needsRebuild && existingSource && typeof existingSource.setTiles === 'function') {
        // Switch raster tiles without rebuilding the map or tearing down layers.
        existingSource.setTiles([tileUrl]);
        if (!map.getLayer(RADAR_LAYER_ID)) {
          map.addLayer(
            {
              id: RADAR_LAYER_ID,
              type: 'raster',
              source: RADAR_SOURCE_ID,
              paint: rasterPaint,
            },
            beforeId
          );
        } else {
          map.setPaintProperty(RADAR_LAYER_ID, 'raster-opacity', rasterPaint['raster-opacity']);
          map.setPaintProperty(RADAR_LAYER_ID, 'raster-resampling', rasterPaint['raster-resampling']);
          map.setPaintProperty(RADAR_LAYER_ID, 'raster-fade-duration', rasterPaint['raster-fade-duration']);
          map.setPaintProperty(RADAR_LAYER_ID, 'raster-saturation', rasterPaint['raster-saturation']);
          map.setPaintProperty(RADAR_LAYER_ID, 'raster-contrast', rasterPaint['raster-contrast']);
          map.setPaintProperty(RADAR_LAYER_ID, 'raster-brightness-min', rasterPaint['raster-brightness-min']);
          map.setPaintProperty(RADAR_LAYER_ID, 'raster-brightness-max', rasterPaint['raster-brightness-max']);
        }
      } else {
        if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
        if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);

        const source: any = {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: renderConfig.tileSize,
        };
        // NCEP opengeo proxy uses WMS 1.1.1 EPSG:3857 {bbox-epsg-3857}.
        if (!usesWmsBbox) source.scheme = 'xyz';
        if (typeof renderConfig.maxzoom === 'number') source.maxzoom = renderConfig.maxzoom;

        map.addSource(RADAR_SOURCE_ID, source);

        map.addLayer(
          {
            id: RADAR_LAYER_ID,
            type: 'raster',
            source: RADAR_SOURCE_ID,
            paint: rasterPaint,
          },
          beforeId
        );
      }
    },
    [mode, product, tilt, maxRefWindow, site.radarId, radarOpacity, fastScanEnabled, onNewScan, playbackIndex, playbackActive, satelliteSelection?.bird, satelliteSelection?.sector, satelliteSelection?.productId]
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

  const clearTowerPills = useCallback(() => {
    towerPillMarkersRef.current.forEach((marker) => marker.remove());
    towerPillMarkersRef.current = [];
  }, []);

  const removeRangeRings = useCallback((map: MapLibreMap) => {
    if (map.getLayer(RINGS_LABEL_ID)) map.removeLayer(RINGS_LABEL_ID);
    if (map.getLayer(RINGS_LAYER_ID)) map.removeLayer(RINGS_LAYER_ID);
    if (map.getSource(RINGS_SOURCE_ID)) map.removeSource(RINGS_SOURCE_ID);
  }, []);

  const renderTowerPills = useCallback(
    (map: MapLibreMap) => {
      clearTowerPills();
      const activeSite = selectedRadarSiteRef.current;

      RADAR_SITES.forEach((s) => {
        const isActive = s.id === activeSite || s.radarId === activeSite;
        const pill = document.createElement('div');
        pill.className = 'ww-radar-pill' + (isActive ? ' active' : '');
        pill.title = `${s.name} (${s.id})`;
        pill.innerHTML = `<span class="ww-dot"></span><span>${s.radarId}</span>`;
        pill.onclick = (e) => {
          e.stopPropagation();
          onSelectSiteRef.current?.(s.id);
        };

        const marker = new maplibregl.Marker({ element: pill })
          .setLngLat([s.lon, s.lat])
          .addTo(map);

        towerPillMarkersRef.current.push(marker);
      });
    },
    [clearTowerPills]
  );

  const removeSpotterLayers = useCallback((map: MapLibreMap) => {
    [SPOTTER_REPORT_LAYER_ID, SPOTTER_POSITION_LAYER_ID, SPOTTER_PULSE_LAYER_ID, SPOTTER_HALO_LAYER_ID, SPOTTER_TRAIL_LAYER_ID].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
    if (map.getSource(SPOTTER_TRAIL_SOURCE_ID)) map.removeSource(SPOTTER_TRAIL_SOURCE_ID);
    if (map.getSource(SPOTTER_SOURCE_ID)) map.removeSource(SPOTTER_SOURCE_ID);
  }, []);

  const removeReportLayers = useCallback((map: MapLibreMap) => {
    [REPORT_CLUSTER_COUNT_ID, REPORT_CLUSTER_LAYER_ID, REPORT_ICON_LAYER_ID, REPORT_POINT_LAYER_ID, REPORT_HALO_LAYER_ID].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
    if (map.getSource(REPORT_SOURCE_ID)) map.removeSource(REPORT_SOURCE_ID);
  }, []);

  const updateSpotters = useCallback(async (map: MapLibreMap) => {
    try {
      setSpotterStatus((prev) => ({ ...prev, state: 'loading' }));
      const res = await fetch('/api/spotter?mode=all', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const meta = data?.meta ?? {};
      if (meta.available === false) {
        setSpotterStatus({ state: 'unavailable', positions: 0, reports: 0, message: (meta.notes && meta.notes[0]) || 'Spotter Network feeds unreachable' });
        return;
      }

      const all = Array.isArray(data?.features) ? data.features : [];
      const rawPositions = all.filter((f: any) => f?.properties?.kind === 'position');
      const reports = all.filter((f: any) => {
        const p = f?.properties || {};
        if (p.kind !== 'report') return false;
        const hazard = String(p.hazard || '').toLowerCase();
        if (hazard.includes('tornado')) return spotterFilters.tornado !== false;
        if (hazard.includes('funnel')) return spotterFilters.funnel !== false;
        if (hazard.includes('wall')) return spotterFilters.wallCloud !== false;
        if (hazard.includes('hail')) return spotterFilters.hail !== false;
        if (hazard.includes('wind')) return spotterFilters.wind !== false;
        if (hazard.includes('flood')) return spotterFilters.flooding !== false;
        return true;
      });

      // The public Spotter Network position feed does not publish a speed or
      // movement field. Derive the state from consecutive real position fixes
      // held in memory. Movement history also feeds the optional trail layer.
      const nowMs = Date.now();
      const history = spotterHistoryRef.current;

      const enrichedPositions = rawPositions.map((feature: any) => {
        const props = feature?.properties || {};
        const coords = feature?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return feature;

        const lon = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return feature;

        const id = String(props.id || `${lat.toFixed(5)},${lon.toFixed(5)}`);
        const feedTime = typeof props.timeIso === 'string' ? Date.parse(props.timeIso) : NaN;
        const timeMs = Number.isFinite(feedTime) ? feedTime : nowMs;

        let track = history.get(id) || [];
        const previousObservation = track[track.length - 1];
        if (previousObservation && previousObservation.timeMs === timeMs) {
          previousObservation.lon = lon;
          previousObservation.lat = lat;
        } else {
          track.push({ lon, lat, timeMs });
        }
        track = track.filter((obs) => nowMs - obs.timeMs <= SPOTTER_HISTORY_WINDOW_MS);
        if (!track.length) track = [{ lon, lat, timeMs }];
        history.set(id, track);

        let speedMph: number | null = null;
        let movementKnown = false;
        if (track.length >= 2) {
          const previous = track[track.length - 2];
          const latest = track[track.length - 1];
          const minutes = (latest.timeMs - previous.timeMs) / 60000;
          if (minutes >= 0.25) {
            speedMph =
              Math.round(
                (distanceMiles(previous.lat, previous.lon, latest.lat, latest.lon) / (minutes / 60)) * 10
              ) / 10;
            movementKnown = true;
          }
        }

        // Small threshold filters GPS jitter while still catching real movement.
        const mobile = movementKnown && speedMph !== null && speedMph > 0.5;
        let movement = 'MOVEMENT UNKNOWN';
        if (movementKnown && speedMph !== null) {
          movement = mobile ? `MOBILE · ${speedMph.toFixed(1)} mph` : 'STATIONARY';
        }

        return {
          ...feature,
          properties: { ...props, id, mobile, movementKnown, speedMph, movement },
        };
      });

      history.forEach((track, id) => {
        const fresh = track.filter((obs) => nowMs - obs.timeMs <= SPOTTER_HISTORY_WINDOW_MS);
        if (fresh.length) history.set(id, fresh);
        else history.delete(id);
      });

      const mobileIds = new Set(
        enrichedPositions
          .filter((f: any) => f?.properties?.mobile === true)
          .map((f: any) => String(f.properties.id))
      );
      const trailFeatures: any[] = [];
      history.forEach((track, id) => {
        if (!mobileIds.has(id) || track.length < 2) return;
        trailFeatures.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: track.map((obs) => [obs.lon, obs.lat]) },
          properties: { id },
        });
      });

      const posGeo = { type: 'FeatureCollection' as const, features: enrichedPositions };
      const trailGeo = { type: 'FeatureCollection' as const, features: trailFeatures };
      const repGeo = { type: 'FeatureCollection' as const, features: reports };

      const warningsBefore = map.getLayer(WARNINGS_FILL_ID) ? WARNINGS_FILL_ID : undefined;

      // Reports layer (events) - above radar, below warnings
      if (showSpotterReportsRef.current) {
        const repSrc = map.getSource(REPORT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (repSrc) {
          repSrc.setData(repGeo as any);
          if (!map.getLayer(REPORT_ICON_LAYER_ID) && map.getLayer(REPORT_POINT_LAYER_ID)) {
            map.addLayer({ id: REPORT_ICON_LAYER_ID, type: 'symbol', source: REPORT_SOURCE_ID, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['match', ['get', 'hazard'], 'Tornado', '🌪', 'Funnel Cloud', '🌪', 'Wall Cloud', '🧱', 'Hail', '🧊', 'Wind', '💨', 'Flooding', '🌊', '⚠'], 'text-size': 10, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.5)', 'text-halo-width': 0.5 } }, warningsBefore);
          }
        } else {
          map.addSource(REPORT_SOURCE_ID, { type: 'geojson', data: repGeo as any, cluster: true, clusterMaxZoom: 11, clusterRadius: 48 });
          map.addLayer({ id: REPORT_CLUSTER_LAYER_ID, type: 'circle', source: REPORT_SOURCE_ID, filter: ['has', 'point_count'], paint: { 'circle-color': ['step', ['get', 'point_count'], '#7f1d1d', 10, '#991b1b', 25, '#dc2626'], 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 25, 24], 'circle-stroke-width': 2, 'circle-stroke-color': '#fecaca', 'circle-opacity': 0.92 } }, warningsBefore);
          map.addLayer({ id: REPORT_CLUSTER_COUNT_ID, type: 'symbol', source: REPORT_SOURCE_ID, filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 11, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'] }, paint: { 'text-color': '#ffffff' } }, warningsBefore);
          map.addLayer({ id: REPORT_HALO_LAYER_ID, type: 'circle', source: REPORT_SOURCE_ID, filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 12, 'circle-color': '#ef4444', 'circle-opacity': 0.14, 'circle-blur': 0.5 } }, warningsBefore);
          map.addLayer({ id: REPORT_POINT_LAYER_ID, type: 'circle', source: REPORT_SOURCE_ID, filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 8, 'circle-color': ['match', ['get', 'hazard'], 'Tornado', '#dc2626', 'Funnel Cloud', '#f97316', 'Wall Cloud', '#f59e0b', 'Hail', '#22c55e', 'Wind', '#eab308', 'Flooding', '#3b82f6', '#a855f7'], 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } }, warningsBefore);
          map.addLayer({ id: REPORT_ICON_LAYER_ID, type: 'symbol', source: REPORT_SOURCE_ID, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['match', ['get', 'hazard'], 'Tornado', '🌪', 'Funnel Cloud', '🌪', 'Wall Cloud', '🧱', 'Hail', '🧊', 'Wind', '💨', 'Flooding', '🌊', '⚠'], 'text-size': 10, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.5)', 'text-halo-width': 0.5 } }, warningsBefore);
        }
      } else {
        removeReportLayers(map);
      }

      // Spotters layer (people) - below reports, above radar. No clustering:
      // every spotter stays an individual marker at every zoom level.
      if (showSpottersRef.current) {
        const reportLayerBefore = map.getLayer(REPORT_CLUSTER_LAYER_ID) ? REPORT_CLUSTER_LAYER_ID : warningsBefore;
        const posSrc = map.getSource(SPOTTER_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (posSrc) {
          posSrc.setData(posGeo as any);
          const trailSrc = map.getSource(SPOTTER_TRAIL_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
          if (trailSrc) trailSrc.setData(trailGeo as any);
        } else {
          // Faint 30-minute movement trail for mobile spotters only. The
          // public feed has no track endpoint, so this is accumulated from
          // successive real position fixes while the app is open.
          map.addSource(SPOTTER_TRAIL_SOURCE_ID, { type: 'geojson', data: trailGeo as any });
          map.addLayer(
            {
              id: SPOTTER_TRAIL_LAYER_ID,
              type: 'line',
              source: SPOTTER_TRAIL_SOURCE_ID,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': '#ef4444',
                'line-width': 1.4,
                'line-opacity': 0.22,
                'line-dasharray': [2, 2],
              },
            },
            reportLayerBefore
          );

          map.addSource(SPOTTER_SOURCE_ID, { type: 'geojson', data: posGeo as any });
          map.addLayer(
            {
              id: SPOTTER_HALO_LAYER_ID,
              type: 'circle',
              source: SPOTTER_SOURCE_ID,
              paint: {
                'circle-radius': ['case', ['==', ['get', 'mobile'], true], 11, 7],
                'circle-color': '#ef4444',
                'circle-opacity': ['case', ['==', ['get', 'mobile'], true], 0.3, 0.16],
                'circle-blur': 0.8,
              },
            },
            reportLayerBefore
          );
          map.addLayer(
            {
              id: SPOTTER_PULSE_LAYER_ID,
              type: 'circle',
              source: SPOTTER_SOURCE_ID,
              filter: ['==', ['get', 'mobile'], true],
              paint: {
                'circle-radius': 6,
                'circle-color': 'rgba(255, 45, 45, 0)',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ff3b3b',
                'circle-stroke-opacity': 0.7,
              },
            },
            reportLayerBefore
          );
          map.addLayer(
            {
              id: SPOTTER_POSITION_LAYER_ID,
              type: 'circle',
              source: SPOTTER_SOURCE_ID,
              paint: {
                'circle-radius': ['case', ['==', ['get', 'mobile'], true], 5, 3.5],
                'circle-color': ['case', ['==', ['get', 'mobile'], true], '#ff1f1f', '#dc2626'],
                'circle-opacity': 0.96,
                'circle-stroke-width': 1.25,
                'circle-stroke-color': '#ffffff',
              },
            },
            reportLayerBefore
          );
        }
      } else {
        removeSpotterLayers(map);
      }

      if (!reportHandlersBoundRef.current) {
        reportHandlersBoundRef.current = true;
        const openReportPopup = (e: any) => {
          const props = e.features?.[0]?.properties;
          if (!props) return;
          const when = props.timeIso ? new Date(props.timeIso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'Unavailable';
          const age = typeof props.ageMinutes === 'number' && props.ageMinutes >= 0 ? `${props.ageMinutes} min` : 'Unavailable';
          const coords = e.features?.[0]?.geometry?.coordinates;
          const lon = Array.isArray(coords) ? Number(coords[0]) : NaN;
          const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;
          const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
          const posText = hasCoords ? `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}` : 'Unavailable';
          let distanceText = 'Unavailable';
          if (hasCoords && Number.isFinite(site?.lat) && Number.isFinite(site?.lon)) {
            const toRad = (d: number) => (d * Math.PI) / 180;
            const dLat = toRad(lat - site.lat);
            const dLon = toRad(lon - site.lon);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(site.lat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2;
            const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distanceText = `${(km * 0.621371).toFixed(1)} mi`;
          }
          const name = escapeHtml(props.name || 'Spotter');
          const reportType = escapeHtml(props.reportType || props.hazard || 'Report');
          const remarks = props.notes ? escapeHtml(props.notes) : 'No remarks provided.';
          const rawUrl = typeof props.url === 'string' ? props.url : '';
          const safeUrl = /^https:\/\/(www\.)?spotternetwork\.org\//i.test(rawUrl) || /^https:\/\/mesonet\.agron\.iastate\.edu\//i.test(rawUrl) ? rawUrl : null;
          const sourceLabel = escapeHtml(props.source || props.network || 'Unknown');
          const row = (label: string, value: string) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;"><span style="color:#94a3b8;font-weight:600;">${label}</span><span style="color:#e2e8f0;font-weight:600;text-align:right;word-break:break-word;">${value}</span></div>`;
          const linkLabel = /^https:\/\/(www\.)?spotternetwork\.org\//i.test(rawUrl) ? 'View on Spotter Network ↗' : /^https:\/\/mesonet\.agron\.iastate\.edu\//i.test(rawUrl) ? 'View NWS/LSR Source ↗' : 'View Source ↗';
          const link = safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px;font-size:11px;font-weight:700;color:#38bdf8;">${linkLabel}</a>` : '';
          new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '360px', className: 'mv-spotter-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:rgba(8,14,24,0.96);color:#f8fafc;padding:0;border-radius:14px;min-width:300px;max-width:350px;box-shadow:0 20px 35px -5px rgba(0,0,0,0.85);border:1px solid rgba(239,68,68,0.35);overflow:hidden;backdrop-filter:blur(10px);">
              <div style="background:linear-gradient(90deg,#7f1d1d,#b91c1c);padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:10px;font-weight:900;letter-spacing:0.08em;color:#fecaca;text-transform:uppercase;">REPORT</div>
                <div style="font-size:18px;font-weight:800;color:#fff;margin-top:4px;line-height:1.2;">${reportType}</div>
                <div style="font-size:11px;color:#fee2e2;margin-top:2px;">${name}</div>
              </div>
              <div style="padding:12px 14px;max-height:340px;overflow-y:auto;">
                <div style="background:#0f172a;border-radius:10px;padding:10px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.08);">
                  ${row('Reported', escapeHtml(when))}
                  ${row('Age', escapeHtml(age))}
                  ${row('Position', escapeHtml(posText))}
                </div>
                <div style="margin-bottom:10px;">
                  <div style="font-size:10px;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Report</div>
                  ${row('Report Type', reportType)}
                  ${row('Source', sourceLabel)}
                </div>
                <div style="margin-bottom:10px;">
                  <div style="font-size:10px;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Remarks</div>
                  <div style="font-size:11px;color:#cbd5e1;line-height:1.5;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px;">${remarks}</div>
                </div>
                <div>
                  <div style="font-size:10px;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Storm Context</div>
                  ${row('Nearest Radar', escapeHtml(site?.radarId || 'Unavailable'))}
                  ${row('Distance From Radar', escapeHtml(distanceText))}
                </div>
                ${link}
              </div>
            </div>`)
            .addTo(map);
        };
        map.on('click', REPORT_CLUSTER_LAYER_ID, (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: [REPORT_CLUSTER_LAYER_ID] });
          const clusterId = features[0]?.properties?.cluster_id;
          const source = map.getSource(REPORT_SOURCE_ID) as any;
          if (!source || clusterId == null) return;
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => { if (err) return; map.easeTo({ center: (features[0].geometry as any).coordinates, zoom }); });
        });
        map.on('click', REPORT_POINT_LAYER_ID, openReportPopup);
        map.on('click', REPORT_ICON_LAYER_ID, openReportPopup);
        [REPORT_CLUSTER_LAYER_ID, REPORT_POINT_LAYER_ID, REPORT_ICON_LAYER_ID].forEach((id) => {
          map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
        });
      }

      if (!spotterHandlersBoundRef.current) {
        spotterHandlersBoundRef.current = true;
        const openSpotterPopup = (e: any) => {
          const props = e.features?.[0]?.properties;
          if (!props) return;
          const when = props.timeIso ? new Date(props.timeIso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'Unavailable';
          const age = typeof props.ageMinutes === 'number' && props.ageMinutes >= 0 ? `${props.ageMinutes} min` : 'Unavailable';
          const coords = e.features?.[0]?.geometry?.coordinates;
          const lon = Array.isArray(coords) ? Number(coords[0]) : NaN;
          const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;
          const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
          const posText = hasCoords ? `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}` : 'Unavailable';
          let distanceText = 'Unavailable';
          if (hasCoords && Number.isFinite(site?.lat) && Number.isFinite(site?.lon)) {
            const toRad = (d: number) => (d * Math.PI) / 180;
            const dLat = toRad(lat - site.lat);
            const dLon = toRad(lon - site.lon);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(site.lat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2;
            const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distanceText = `${(km * 0.621371).toFixed(1)} mi`;
          }
          const name = escapeHtml(props.name || 'Spotter');
          const spotterId = escapeHtml(props.id || 'Unavailable');
          const movementKnown = props.movementKnown === true;
          const isMobile = props.mobile === true;
          const rawSpeed = typeof props.speedMph === 'number' ? props.speedMph : Number(props.speedMph);
          const speedText = movementKnown && Number.isFinite(rawSpeed) ? `${rawSpeed.toFixed(1)} mph` : 'Unavailable';
          const movementStatus = movementKnown ? (isMobile ? 'MOBILE' : 'STATIONARY') : 'MOVEMENT UNKNOWN';
          const movementBadge = movementKnown ? `[${movementStatus}]` : '[MOVEMENT UNKNOWN]';
          const movementBg = !movementKnown ? '#334155' : isMobile ? '#b91c1c' : '#1e293b';
          const movementColor = isMobile ? '#fecaca' : '#cbd5e1';
          const movementDetail = movementKnown
            ? `${movementStatus} · ${speedText}`
            : 'Movement unknown — waiting for a second position fix';
          const row = (label: string, value: string) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;"><span style="color:#94a3b8;font-weight:600;">${label}</span><span style="color:#e2e8f0;font-weight:600;text-align:right;word-break:break-word;">${value}</span></div>`;
          new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '340px', className: 'mv-spotter-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:rgba(8,14,24,0.96);color:#f8fafc;padding:14px;border-radius:12px;min-width:280px;max-width:330px;box-shadow:0 20px 35px -5px rgba(0,0,0,0.85);border:1px solid rgba(239,68,68,0.35);backdrop-filter:blur(10px);">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;"></span><span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#f87171;">SPOTTER NETWORK</span></div>
                <span style="font-size:9px;font-weight:800;background:${movementBg};color:${movementColor};padding:2px 7px;border-radius:4px;text-transform:uppercase;letter-spacing:0.04em;border:1px solid rgba(255,255,255,0.12);">${movementBadge}</span>
              </div>
              <div style="font-size:16px;font-weight:800;color:#ffffff;line-height:1.2;margin-bottom:2px;">${name}</div>
              <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Live spotter position</div>
              <div style="background:#0f172a;border-radius:8px;padding:10px;margin:8px 0;border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Location</div>
                ${row('Position', escapeHtml(posText))}
                ${row('Reported', escapeHtml(when))}
                ${row('Age', escapeHtml(age))}
              </div>
              <div style="margin-top:4px;">
                ${row('Spotter ID', spotterId)}
                ${row('Network', 'Spotter Network')}
                ${row('Movement', escapeHtml(movementDetail))}
                ${row('Distance From Radar', escapeHtml(distanceText))}
              </div>
              <div style="margin-top:8px;font-size:10px;color:#64748b;line-height:1.4;">Movement status is derived from consecutive public position fixes. Contact details (phone/email/web) are not shown because public feeds do not expose them.</div>
            </div>`)
            .addTo(map);
        };
        map.on('click', SPOTTER_POSITION_LAYER_ID, openSpotterPopup);
        map.on('mouseenter', SPOTTER_POSITION_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', SPOTTER_POSITION_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });
      }

      setSpotterStatus({ state: 'ready', positions: enrichedPositions.length, reports: reports.length, message: meta?.notes?.[0] });
    } catch (err: any) {
      setSpotterStatus({ state: 'unavailable', positions: 0, reports: 0, message: String(err?.message || err) });
    }
  }, [site.lat, site.lon, site.radarId, spotterFilters, removeReportLayers, removeSpotterLayers]);

  useEffect(() => {
    showSpottersRef.current = showSpotters;
    if (!showSpotters) document.querySelectorAll('.maplibregl-popup').forEach((p) => p.remove());
  }, [showSpotters]);
  useEffect(() => {
    showSpotterReportsRef.current = showSpotterReports;
    if (!showSpotterReports) document.querySelectorAll('.maplibregl-popup').forEach((p) => p.remove());
  }, [showSpotterReports]);

  useEffect(() => {
    showWarningsRef.current = showWarnings;
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (showWarnings) updateWarnings(map, alertFeaturesRef.current);
    else removeWarningLayers(map);
  }, [showWarnings, mapReady, updateWarnings, removeWarningLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (showWarningsRef.current) updateWarnings(map, alertFeatures);
  }, [alertFeatures, mapReady, updateWarnings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !syncGroup) return;
    return registerSyncedMap(syncGroup, map);
  }, [syncGroup, mapReady]);

  // Mobile spotter pulse. Imperative MapLibre paint updates only: no React
  // state changes per frame, so the rest of the workstation is not re-rendered.
  useEffect(() => {
    if (!mapReady || !showSpotters) return;

    let frame = 0;
    let lastPaint = 0;
    const startedAt = performance.now();

    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      if (now - lastPaint < 40) return;
      lastPaint = now;

      const map = mapRef.current;
      if (!map || !map.getLayer(SPOTTER_PULSE_LAYER_ID)) return;

      const phase = ((now - startedAt) % 2200) / 2200;
      const eased = 1 - Math.pow(1 - phase, 2);
      map.setPaintProperty(SPOTTER_PULSE_LAYER_ID, 'circle-radius', 4 + eased * 18);
      map.setPaintProperty(SPOTTER_PULSE_LAYER_ID, 'circle-stroke-opacity', 0.7 * (1 - phase));
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [mapReady, showSpotters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (showSpotters || showSpotterReports) {
      updateSpotters(map);
      const timer = setInterval(() => updateSpotters(map), 60_000);
      return () => clearInterval(timer);
    }
    removeSpotterLayers(map);
    removeReportLayers(map);
    document.querySelectorAll('.maplibregl-popup').forEach((p) => p.remove());
    setSpotterStatus({ state: 'idle', positions: 0, reports: 0 });
  }, [showSpotters, showSpotterReports, mapReady, updateSpotters, removeSpotterLayers, removeReportLayers]);

  useEffect(() => {
    if (mapRef.current && mapReady) {
      updateRadar(mapRef.current);
    }
  }, [product, tilt, maxRefWindow, radarOpacity, mapReady, updateRadar]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!radarVisualsEnabled || !showRangeRings) {
      removeRangeRings(map);
      return;
    }
    if (radarSite !== 'US') {
      map.flyTo({ center: [site.lon, site.lat], zoom: 7.5, duration: 1100 });
      updateRangeRings(map, site.lat, site.lon);
    } else {
      removeRangeRings(map);
    }
  }, [site.lon, site.lat, radarSite, mapReady, updateRangeRings, removeRangeRings, radarVisualsEnabled, showRangeRings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusTarget) return;
    if (typeof focusTarget.lat !== 'number' || typeof focusTarget.lon !== 'number') return;
    map.flyTo({ center: [focusTarget.lon, focusTarget.lat], zoom: focusTarget.zoom ?? 9, duration: 1200 });
  }, [focusTarget?.ts, focusTarget?.lat, focusTarget?.lon, focusTarget?.zoom, mapReady]);

  useEffect(() => {
    onSelectSiteRef.current = onSelectSite;
  }, [onSelectSite]);

  useEffect(() => {
    alertFeaturesRef.current = alertFeatures;
  }, [alertFeatures]);

  useEffect(() => {
    onSelectWarningRef.current = onSelectWarningFromMap;
  }, [onSelectWarningFromMap]);

  useEffect(() => {
    showRadarPillsRef.current = showRadarPills && radarVisualsEnabled;
    selectedRadarSiteRef.current = radarSite;

    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (showRadarPills && radarVisualsEnabled) renderTowerPills(map);
    else clearTowerPills();
  }, [showRadarPills, radarSite, mapReady, renderTowerPills, clearTowerPills, radarVisualsEnabled]);

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
    const fillOpacity = scanIngesting ? 0.22 : 0.08;
    const lineOpacity = scanIngesting ? 1 : 0.55;
    const lineWidth = scanIngesting ? 2.5 : 1.5;
    if (existing) {
      existing.setData(geojson as any);
      if (map.getLayer(SWEEP_FILL_ID)) map.setPaintProperty(SWEEP_FILL_ID, 'fill-opacity', fillOpacity);
      if (map.getLayer(SWEEP_LINE_ID)) {
        map.setPaintProperty(SWEEP_LINE_ID, 'line-opacity', lineOpacity);
        map.setPaintProperty(SWEEP_LINE_ID, 'line-width', lineWidth);
      }
    } else {
      map.addSource(SWEEP_SOURCE_ID, { type: 'geojson', data: geojson as any });
      map.addLayer({
        id: SWEEP_FILL_ID,
        type: 'fill',
        source: SWEEP_SOURCE_ID,
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#22c55e',
          'fill-opacity': fillOpacity,
        },
      });
      map.addLayer({
        id: SWEEP_LINE_ID,
        type: 'line',
        source: SWEEP_SOURCE_ID,
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#4ade80',
          'line-width': lineWidth,
          'line-opacity': lineOpacity,
        },
      });
    }

    return () => {
      // Data updates every tick; layers persist across ticks for smooth animation.
    };
  }, [sweepEnabled, mapReady, sweepAngle, site.lat, site.lon, scanIngesting]);

  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (!map) return;
      if (map.getLayer(SWEEP_FILL_ID)) map.removeLayer(SWEEP_FILL_ID);
      if (map.getLayer(SWEEP_LINE_ID)) map.removeLayer(SWEEP_LINE_ID);
      if (map.getSource(SWEEP_SOURCE_ID)) map.removeSource(SWEEP_SOURCE_ID);
    };
  }, [mapReady]);


  const makeToolId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toolColor = (kind: string) => kind === 'distance' ? '#22d3ee' : kind === 'area' ? '#a78bfa' : kind === 'annotation' ? '#fbbf24' : '#34d399';

  const toolGeoJSON = useCallback(() => {
    const features: any[] = [];
    for (const m of toolMeasurements) {
      if (m.kind === 'distance' && m.points.length >= 2) {
        features.push({ type:'Feature', properties:{ kind:'distance', label:m.value, stroke:'#22d3ee', fill:'#22d3ee' }, geometry:{ type:'LineString', coordinates:m.points } });
        features.push({ type:'Feature', properties:{ kind:'label', label:m.value }, geometry:{ type:'Point', coordinates:m.points[Math.floor(m.points.length/2)] } });
      }
      if (m.kind === 'area' && m.points.length >= 3) {
        const ring = [...m.points, m.points[0]];
        features.push({ type:'Feature', properties:{ kind:'area', label:m.value, stroke:'#a78bfa', fill:'#a78bfa' }, geometry:{ type:'Polygon', coordinates:[ring] } });
        features.push({ type:'Feature', properties:{ kind:'label', label:m.value }, geometry:{ type:'Point', coordinates:m.points[0] } });
      }
    }
    for (const d of toolDrawings) {
      if (d.kind === 'point' && d.points[0]) {
        features.push({ type:'Feature', properties:{ kind:'draw-point', label:d.label||'Point', stroke:d.color, fill:d.color }, geometry:{ type:'Point', coordinates:d.points[0] } });
        if (d.label) features.push({ type:'Feature', properties:{ kind:'label', label:d.label }, geometry:{ type:'Point', coordinates:d.points[0] } });
      }
      if (d.kind === 'line' && d.points.length >= 2) {
        features.push({ type:'Feature', properties:{ kind:'draw-line', label:d.label||'', stroke:d.color, fill:d.color }, geometry:{ type:'LineString', coordinates:d.points } });
      }
      if (d.kind === 'polygon' && d.points.length >= 3) {
        features.push({ type:'Feature', properties:{ kind:'draw-polygon', label:d.label||'', stroke:d.color, fill:d.color }, geometry:{ type:'Polygon', coordinates:[[...d.points, d.points[0]]] } });
      }
      if (d.kind === 'annotation' && d.points[0]) {
        features.push({ type:'Feature', properties:{ kind:'label', label:d.label||'Note' }, geometry:{ type:'Point', coordinates:d.points[0] } });
      }
    }
    return { type:'FeatureCollection' as const, features };
  }, [toolMeasurements, toolDrawings]);

  const draftGeoJSON = useCallback(() => {
    const pts = toolDraftRef.current;
    const mode = toolModeRef.current;
    const features: any[] = [];
    if (pts.length) {
      features.push(...pts.map(p => ({ type:'Feature', properties:{}, geometry:{ type:'Point', coordinates:p } })));
      if ((mode === 'measure-distance' || mode === 'draw-line') && pts.length >= 2) {
        features.push({ type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates:pts } });
      }
      if ((mode === 'measure-area' || mode === 'draw-polygon') && pts.length >= 3) {
        features.push({ type:'Feature', properties:{}, geometry:{ type:'Polygon', coordinates:[[...pts, pts[0]]] } });
      }
    }
    return { type:'FeatureCollection' as const, features };
  }, []);

  const ensureToolLayers = useCallback((map: MapLibreMap) => {
    if (!map.getSource(TOOL_SOURCE_ID)) map.addSource(TOOL_SOURCE_ID, { type:'geojson', data: toolGeoJSON() as any });
    if (!map.getSource(TOOL_DRAFT_SOURCE_ID)) map.addSource(TOOL_DRAFT_SOURCE_ID, { type:'geojson', data: draftGeoJSON() as any });
    if (!map.getLayer(TOOL_FILL_ID)) map.addLayer({ id: TOOL_FILL_ID, type:'fill', source: TOOL_SOURCE_ID, filter:['==',['geometry-type'],'Polygon'], paint:{ 'fill-color':['coalesce',['get','fill'],'#22d3ee'], 'fill-opacity':0.14 } });
    if (!map.getLayer(TOOL_LINE_ID)) map.addLayer({ id: TOOL_LINE_ID, type:'line', source: TOOL_SOURCE_ID, filter:['any',['==',['geometry-type'],'Polygon'],['==',['geometry-type'],'LineString']], paint:{ 'line-color':['coalesce',['get','stroke'],'#22d3ee'], 'line-width':2.2, 'line-dasharray':[2,1.5] } });
    if (!map.getLayer(TOOL_POINT_ID)) map.addLayer({ id: TOOL_POINT_ID, type:'circle', source: TOOL_SOURCE_ID, filter:['==',['get','kind'],'draw-point'], paint:{ 'circle-radius':5, 'circle-color':['coalesce',['get','fill'],'#34d399'], 'circle-stroke-color':'#0f172a', 'circle-stroke-width':1.5 } });
    if (!map.getLayer(TOOL_LABEL_ID)) map.addLayer({ id: TOOL_LABEL_ID, type:'symbol', source: TOOL_SOURCE_ID, filter:['==',['get','kind'],'label'], layout:{ 'text-field':['get','label'], 'text-size':11, 'text-offset':[0,1.1], 'text-anchor':'top' }, paint:{ 'text-color':'#e2e8f0', 'text-halo-color':'#020617', 'text-halo-width':1.2 } });
    if (!map.getLayer(TOOL_DRAFT_LINE_ID)) map.addLayer({ id: TOOL_DRAFT_LINE_ID, type:'line', source: TOOL_DRAFT_SOURCE_ID, filter:['any',['==',['geometry-type'],'Polygon'],['==',['geometry-type'],'LineString']], paint:{ 'line-color':'#f8fafc', 'line-width':2, 'line-dasharray':[1,1] } });
    if (!map.getLayer(TOOL_DRAFT_POINT_ID)) map.addLayer({ id: TOOL_DRAFT_POINT_ID, type:'circle', source: TOOL_DRAFT_SOURCE_ID, filter:['==',['geometry-type'],'Point'], paint:{ 'circle-radius':4, 'circle-color':'#f8fafc', 'circle-stroke-color':'#0f172a', 'circle-stroke-width':1 } });
  }, [draftGeoJSON, toolGeoJSON]);

  const refreshToolLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    ensureToolLayers(map);
    const src = map.getSource(TOOL_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    const draft = map.getSource(TOOL_DRAFT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    src?.setData(toolGeoJSON() as any);
    draft?.setData(draftGeoJSON() as any);
  }, [draftGeoJSON, ensureToolLayers, mapReady, toolGeoJSON]);

  useEffect(() => { refreshToolLayers(); }, [refreshToolLayers, toolMeasurements, toolDrawings, toolMode]);
  useEffect(() => { toolDraftRef.current = []; refreshToolLayers(); }, [toolMode, refreshToolLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const finishDraft = () => {
      const mode = toolModeRef.current;
      const pts = [...toolDraftRef.current];
      if (mode === 'measure-distance' && pts.length >= 2) {
        const meters = polylineMeters(pts);
        setToolMeasurements(prev => [...prev, { id: makeToolId(), kind:'distance', label:`Distance ${prev.length+1}`, value: formatDistance(meters), points: pts }]);
        toolDraftRef.current = [];
      } else if (mode === 'measure-area' && pts.length >= 3) {
        const m2 = polygonAreaMeters2(pts);
        setToolMeasurements(prev => [...prev, { id: makeToolId(), kind:'area', label:`Area ${prev.length+1}`, value: formatArea(m2), points: pts }]);
        toolDraftRef.current = [];
      } else if (mode === 'draw-line' && pts.length >= 2) {
        setToolDrawings(prev => [...prev, { id: makeToolId(), kind:'line', points: pts, color: toolColor('line') }]);
        toolDraftRef.current = [];
      } else if (mode === 'draw-polygon' && pts.length >= 3) {
        setToolDrawings(prev => [...prev, { id: makeToolId(), kind:'polygon', points: pts, color: toolColor('polygon') }]);
        toolDraftRef.current = [];
      }
      refreshToolLayers();
    };
    const onClick = (e: any) => {
      const mode = toolModeRef.current;
      if (!mode || mode === 'none' || inspectionMode) return;
      const pt: LngLat = [e.lngLat.lng, e.lngLat.lat];
      if (mode === 'draw-point') {
        setToolDrawings(prev => [...prev, { id: makeToolId(), kind:'point', points:[pt], color: toolColor('point') }]);
        return;
      }
      if (mode === 'annotate') {
        const label = window.prompt('Annotation text (local map note):', 'Note');
        if (label && label.trim()) setToolDrawings(prev => [...prev, { id: makeToolId(), kind:'annotation', label: label.trim().slice(0, 80), points:[pt], color: toolColor('annotation') }]);
        return;
      }
      toolDraftRef.current = [...toolDraftRef.current, pt];
      refreshToolLayers();
    };
    const onDblClick = (e: any) => { if (['measure-distance','measure-area','draw-line','draw-polygon'].includes(toolModeRef.current)) { e.preventDefault?.(); finishDraft(); } };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { toolDraftRef.current = []; refreshToolLayers(); onToolModeChangeRef.current?.('none'); }
      if (e.key === 'Enter') finishDraft();
    };
    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    window.addEventListener('keydown', onKey);
    return () => { map.off('click', onClick); map.off('dblclick', onDblClick); window.removeEventListener('keydown', onKey); };
  }, [mapReady, inspectionMode, refreshToolLayers]);

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

  useEffect(() => {
    if (!inspectionMode) { setInspectionResult(null); return; }
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const handler = (e: any) => {
      const lng = Number(e?.lngLat?.lng);
      const lat = Number(e?.lngLat?.lat);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const frame = lastFrameRef.current;
      // Honest: no verified raster-to-value sampling pipeline. Do not fake values.
      setInspectionResult({
        lat,
        lon: lng,
        product: frame.product || product,
        site: frame.site || site.radarId,
        tilt: frame.tilt || tilt,
        time: frame.time || (playbackActive ? 'Playback frame' : 'Live/Current frame'),
        value: 'DATA UNAVAILABLE',
        note: 'Raster tile value sampling not verified for this source/palette. No fake values shown.',
      });
    };
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [inspectionMode, mapReady, product, site.radarId, tilt, playbackActive]);

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden', cursor: (crossSectionMode || inspectionMode) ? 'crosshair' : 'default' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas ref={sweepCanvasRef} className="radar-sweep-canvas" />

      {flashEnabled && !flashDismissed && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-purple-500/80 bg-slate-950/90 px-4 py-1.5 text-xs font-mono font-black text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.4)] backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
          <span>FLASH REFLECTIVITY (VISUAL)</span>
          <button type="button" onClick={() => setFlashDismissed(true)} className="ml-1 text-slate-400 hover:text-white" aria-label="Dismiss flash indicator">×</button>
        </div>
      )}

      {liveOnly && !tileError && !liveOnlyDismissed && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-amber-500/60 bg-slate-950/95 px-4 py-2 font-mono text-xs font-bold text-amber-300 shadow-2xl backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>LIVE ONLY</span>
          <span className="font-normal text-slate-400">No archive for this source</span>
          <button type="button" onClick={() => setLiveOnlyDismissed(true)} className="ml-1 text-slate-400 hover:text-white" aria-label="Dismiss LIVE ONLY">×</button>
        </div>
      )}

      {tileError && !tileErrorDismissed && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-red-500/60 bg-slate-950/95 px-4 py-2 font-mono text-xs text-red-400 shadow-2xl backdrop-blur-md">
          <span>⚠️</span>
          <span>{tileError}</span>
          <button type="button" onClick={() => setTileErrorDismissed(true)} className="ml-1 text-slate-400 hover:text-white" aria-label="Dismiss error">×</button>
        </div>
      )}

      {fastScanEnabled && scanIngesting && !scanIngestDismissed && !tileError && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-emerald-500/60 bg-slate-950/95 px-4 py-2 font-mono text-xs font-bold text-emerald-300 shadow-2xl backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>SCAN INGEST FRONTIER</span>
          <span className="font-normal text-slate-400">New scan detected; sweep indicates ingest window</span>
          <button type="button" onClick={() => setScanIngestDismissed(true)} className="ml-1 text-slate-400 hover:text-white" aria-label="Dismiss scan ingest">×</button>
        </div>
      )}

      {inspectionMode && (
        <div className="absolute left-3 top-20 z-40 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-cyan-500/40 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Inspection / Sampling</div>
            <button type="button" onClick={() => setInspectionResult(null)} className="text-slate-400 hover:text-white" aria-label="Clear inspection">×</button>
          </div>
          {!inspectionResult ? (
            <div className="mt-2 text-slate-400">Click the map to sample a point. Values shown only when verified; no fake values.</div>
          ) : (
            <div className="mt-2 space-y-1 font-mono text-[11px]">
              <div><span className="text-slate-500">Lat/Lon:</span> {inspectionResult.lat.toFixed(4)}, {inspectionResult.lon.toFixed(4)}</div>
              <div><span className="text-slate-500">Site:</span> {inspectionResult.site} <span className="text-slate-500">Tilt:</span> {inspectionResult.tilt}°</div>
              <div><span className="text-slate-500">Product:</span> {inspectionResult.product.toUpperCase()}</div>
              <div><span className="text-slate-500">Frame:</span> {inspectionResult.time || 'Unknown'}</div>
              <div className="pt-1 border-t border-slate-800"><span className="text-slate-500">Value:</span> <span className="text-amber-300 font-bold">{inspectionResult.value}</span></div>
              {inspectionResult.note && <div className="text-[10px] text-slate-500 leading-snug">{inspectionResult.note}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RadarMap;
