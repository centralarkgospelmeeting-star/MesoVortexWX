'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { RadarMap, BasemapType, ModeTab } from '../components/RadarMap';
import { CrossSectionModal } from '../components/CrossSectionModal';
import { StormAnalysisPanel } from '../components/radar/StormAnalysisPanel';
import type { LiveCrossSectionResult } from '../lib/radar/cross-section-types';
import { VolumeScanInspector } from '../components/radar/VolumeScanInspector';
import { WeatherWiseRadarCard } from '../components/WeatherWiseRadarCard';
import { MesoAIPanel } from '../components/MesoAIPanel';
import { ToolboxPanel } from '../components/map-tools/ToolboxPanel';
import { WeatherWiseAlertsPanel } from '../components/WeatherWiseAlertsPanel';
import { AlertSettingsPanel } from '../components/AlertSettingsPanel';
import { RADAR_SITES } from '../lib/radar-config';
import { getRadarCapability } from '../lib/radar/capability-matrix';
import { useFastAlerts } from '../lib/alerts/use-fast-alerts';
import { DATA_SOURCES, DATA_SOURCE_STATUS_LABEL, type DataSourceStatus } from '../lib/data-sources';
import {
  ALERT_CATEGORY_META,
  alertsToFeatureCollection,
  alertPriority,
  formatAlertTime,
  alertExpiryLabel,
  type AlertCategory,
  type WeatherAlert,
} from '../lib/alerts/model';
import { AlertDetailsPanel, buildLocationContext } from '../components/AlertDetailsPanel';
import { getCompositeSource, COMPOSITE_SOURCES } from '../lib/radar/composite-sources';
import { ProductInfoBanner } from '../components/ProductInfoBanner';
import { ReportDetailPopup, type ReportDetail } from '../components/reports/ReportDetailPopup';
import { HsiPanel } from '../components/hsi/HsiPanel';
import {
  DEFAULT_OVERLAY_PROFILES,
  DEFAULT_WORKSPACE_PANELS,
  normalizeOverlayProfiles,
  normalizeWorkspacePanels,
  OVERLAY_FIELDS,
  OVERLAY_MODE_FIELDS,
  OVERLAY_MODES,
  WORKSPACE_PANEL_FIELDS,
  type OverlayMode,
} from '../lib/overlay-profiles';
import { METARPanel, type SurfaceSource } from '../components/METARPanel';
import { SurfaceLayersPanel, type SurfaceLayerStatus } from '../components/surface/SurfaceLayersPanel';
import { declusterStationPlots, normalizeStationPlots, observationBbox } from '../lib/surface/station-model';
import { OBSERVATION_MASTER_LAYERS, SURFACE_LAYERS, type SurfaceLayerId, type StationPlot } from '../lib/surface/types';
import {
  DEFAULT_SATELLITE_SELECTION,
  SATELLITE_BIRDS,
  SATELLITE_PRODUCTS,
  getSectorsForBird,
  getSatelliteProductDef,
  normalizeSatelliteSelection,
  type SatelliteSelection,
} from '../lib/satellite';
import { MODEL_CATALOG, getModelById } from '../lib/model-registry';
import { parsePal, type PalTable } from '../lib/pal';
import { DEFAULT_ALERT_SETTINGS, loadAlertSettings, saveAlertSettings, applyAlertSettingsToAlert, shouldSpeakAlert, formatAlertSpeech, type AlertSettings } from '../lib/alerts/settings';

type RadarProduct =
  | 'ref'
  | 'max_ref'
  | 'ref_x'
  | 'vel'
  | 'srvel'
  | 'norm_vel'
  | 'sw'
  | 'cc'
  | 'min_cc'
  | 'zdr'
  | 'kdp'
  | 'tops'
  | 'vil'
  | 'hhc'
  | 'qpe'
  | 'volume_scan'
  | 'comp_ref'
  | 'azshear'
  | 'rotation_tracks'
  | 'mesh'
  | 'hail_detection'
  | 'vil_density'
  | 'precip_rate'
  | 'rain_mix_snow'
  | 'gate_to_gate_shear'
  | 'cross_section'
  | 'storm_analysis'
  | 'tilt_selection'
  | 'super_res_ref'
  | 'super_res_vel';

type SpcDay = 'Day 1' | 'Day 2' | 'Day 3';
type PaneMode = 'Radar' | 'Satellite' | 'Composite' | 'Models';

type FrameMetadata = {
  provider?: string;
  product?: string;
  capabilityId?: string;
  tilt?: string;
  network?: string;
  station?: string;
  scanTime?: string | null;
  scanTimeAvailable?: boolean;
  playbackSupport?: string;
  archiveSupport?: string;
  verificationLevel?: string;
  loopAvailable?: boolean;
};

const BASEMAP_STORAGE_KEY = 'mesovortex_basemap_preference';
const PROJECTION_STORAGE_KEY = 'mesovortex_projection_mode';
const PREFS_STORAGE_KEY = 'mesovortex_preferences_v1';
const HSI_STORAGE_KEY = 'mesovortex_hsi_visible';
const OVERLAY_STORAGE_KEY = 'mesovortex_overlay_profiles_v1';
const WORKSPACE_STORAGE_KEY = 'mesovortex_workspace_panels_v1';
const DEFAULT_MESONET_NETWORK = 'ISUSM';
const DEFAULT_AWOS_NETWORK = 'IA_ASOS';
const PANE_MODES: PaneMode[] = ['Radar', 'Satellite', 'Composite', 'Models'];

type UserPrefs = {
  projectionMode: 'mercator' | 'globe';
  mapPitch: number;
  showRangeRings: boolean;
  radarOpacity: number;
  smoothing: boolean;
  playbackSpeed: 0.5 | 1 | 2;
  playbackDirection: 'forward' | 'backward';
  loopPauseMs: number;
  favorites: string[];
  product: RadarProduct;
  tilt: string;
  radarSite: string;
  colorTable: string;
  showRadarPills: boolean;
  showLightning: boolean;
  showLSR: boolean;
  showWatches: boolean;
  showWarnings: boolean;
  showMCD: boolean;
  showSpotters: boolean;
  showSpotterReports: boolean;
  showMetars: boolean;
  surfaceLayers: Record<SurfaceLayerId, boolean>;
  showStormTracks: boolean;
  showCounties: boolean;
  showTornadoAnalysis: boolean;
  showHurricanes: boolean;
  alertsOpen: boolean;
  alertSidebarState: 'open' | 'closed';
};

const DEFAULT_PREFS: UserPrefs = {
  projectionMode: 'globe',
  mapPitch: 60,
  showRangeRings: false,
  radarOpacity: 0.88,
  smoothing: false,
  playbackSpeed: 1,
  playbackDirection: 'forward',
  loopPauseMs: 500,
  favorites: ['ref', 'vel', 'srvel', 'cc'],
  product: 'ref',
  tilt: '0.5',
  radarSite: 'KLZK',
  colorTable: 'nws',
  showRadarPills: true,
  showLightning: true,
  showLSR: false,
  showWatches: true,
  showWarnings: true,
  showMCD: true,
  showSpotters: true,
  showSpotterReports: true,
  showMetars: true,
  surfaceLayers: { observations: true, metar: true, aviation: false, mesonet: false, pws: false, buoy: false, marine: false },
  showStormTracks: true,
  showCounties: true,
  showTornadoAnalysis: true,
  showHurricanes: true,
  alertsOpen: false,
  alertSidebarState: 'closed',
};

function loadUserPrefs(): UserPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS;
    const p = parsed as Partial<UserPrefs>;
    const speed = p.playbackSpeed === 0.5 || p.playbackSpeed === 1 || p.playbackSpeed === 2 ? p.playbackSpeed : DEFAULT_PREFS.playbackSpeed;
    const dir = p.playbackDirection === 'backward' ? 'backward' : 'forward';
    const loopPauseMs = Number.isFinite(p.loopPauseMs) ? Math.max(0, Math.min(5000, Number(p.loopPauseMs))) : DEFAULT_PREFS.loopPauseMs;
    const proj = p.projectionMode === 'mercator' || p.projectionMode === 'globe' ? p.projectionMode : DEFAULT_PREFS.projectionMode;
    const mapPitch = typeof p.mapPitch === 'number' && Number.isFinite(p.mapPitch) ? p.mapPitch : DEFAULT_PREFS.mapPitch;
    return {
      ...DEFAULT_PREFS,
      ...p,
      projectionMode: proj,
      mapPitch,
      showRangeRings: typeof p.showRangeRings === 'boolean' ? p.showRangeRings : DEFAULT_PREFS.showRangeRings,
      radarOpacity: Number.isFinite(p.radarOpacity) ? Math.max(0.2, Math.min(1, Number(p.radarOpacity))) : DEFAULT_PREFS.radarOpacity,
      smoothing: typeof p.smoothing === 'boolean' ? p.smoothing : DEFAULT_PREFS.smoothing,
      playbackSpeed: speed,
      playbackDirection: dir,
      loopPauseMs,
      favorites: Array.isArray(p.favorites) ? p.favorites.filter((x): x is string => typeof x === 'string') : DEFAULT_PREFS.favorites,
      product: typeof p.product === 'string' ? (p.product as RadarProduct) : DEFAULT_PREFS.product,
      tilt: typeof p.tilt === 'string' && /^\d+(?:\.\d+)?$/.test(p.tilt) ? p.tilt : DEFAULT_PREFS.tilt,
      radarSite: typeof p.radarSite === 'string' ? p.radarSite : DEFAULT_PREFS.radarSite,
      colorTable: typeof p.colorTable === 'string' ? p.colorTable : DEFAULT_PREFS.colorTable,
      alertsOpen: typeof p.alertsOpen === 'boolean' ? p.alertsOpen : DEFAULT_PREFS.alertsOpen,
      alertSidebarState: p.alertSidebarState === 'open' ? 'open' : 'closed',
      showMetars: typeof p.showMetars === 'boolean' ? p.showMetars : DEFAULT_PREFS.showMetars,
      surfaceLayers: {
        ...DEFAULT_PREFS.surfaceLayers,
        ...(p.surfaceLayers && typeof p.surfaceLayers === 'object' ? p.surfaceLayers : {}),
        ...(p.surfaceLayers ? {} : { metar: typeof p.showMetars === 'boolean' ? p.showMetars : DEFAULT_PREFS.showMetars }),
      },
    } as UserPrefs;
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function MesoVortexWorkstation() {
  const initialPrefs = useMemo(() => loadUserPrefs(), []);
  const [tab, setTab] = useState<ModeTab>('Radar');
  const [compositeSource, setCompositeSource] = useState<string>('iem_n0q');
  const [compositeOptionsExpanded, setCompositeOptionsExpanded] = useState<boolean>(false);
  useEffect(() => {
    if (!compositeOptionsExpanded) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') setCompositeOptionsExpanded(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && !target.closest('[data-composite-options]')) setCompositeOptionsExpanded(false);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', close);
    };
  }, [compositeOptionsExpanded]);

  const [spcDay, setSpcDay] = useState<SpcDay>('Day 1');
  const [product, setProduct] = useState<RadarProduct>(initialPrefs.product);
  const [tilt, setTilt] = useState(initialPrefs.tilt);
  const [volumeInspectorOpen, setVolumeInspectorOpen] = useState(false);
  const [radarSite, setRadarSite] = useState(initialPrefs.radarSite);
  const [maxRefWindow, setMaxRefWindow] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2>(initialPrefs.playbackSpeed);
  const [playbackDirection, setPlaybackDirection] = useState<'forward' | 'backward'>(initialPrefs.playbackDirection);
  const [loopPauseMs, setLoopPauseMs] = useState(initialPrefs.loopPauseMs);

  const [expertMode, setExpertMode] = useState(false);
  const [quadMode, setQuadMode] = useState(false);
  const [leftPane, setLeftPane] = useState<PaneMode>('Radar');
  const [rightPane, setRightPane] = useState<PaneMode>('Satellite');
  const [satelliteSelection, setSatelliteSelection] = useState<SatelliteSelection>(DEFAULT_SATELLITE_SELECTION);
  const [modelId, setModelId] = useState<string>('gdps-geml');
  const [modelField, setModelField] = useState<string>('temp');
  const [modelRun, setModelRun] = useState<string>('latest');
  const [modelForecastHour, setModelForecastHour] = useState<number>(0);
  const [modelSearch, setModelSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{label:string;type:string;lat?:number;lon?:number;siteId?:string}>>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{lat:number;lon:number;zoom:number;ts:number} | null>(null);
  const [bottomBarOpen, setBottomBarOpen] = useState(true);
  const PANEL_STATE_KEY = 'mesovortex_panel_state_v1';
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PANEL_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.openPanel === 'string' || parsed.openPanel === null) setOpenPanel(parsed.openPanel);
          if (typeof parsed.bottomBarOpen === 'boolean') setBottomBarOpen(parsed.bottomBarOpen);
        }
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(PANEL_STATE_KEY, JSON.stringify({ openPanel, bottomBarOpen })); } catch {}
  }, [openPanel, bottomBarOpen]);
  const [quadPanes, setQuadPanes] = useState<Array<{ mode: PaneMode; product: RadarProduct; satelliteSelection: SatelliteSelection; modelId: string; modelField: string }>>([
    { mode: 'Radar', product: 'ref', satelliteSelection: DEFAULT_SATELLITE_SELECTION, modelId: 'gdps-geml', modelField: 'temp' },
    { mode: 'Radar', product: 'vel', satelliteSelection: DEFAULT_SATELLITE_SELECTION, modelId: 'gdps-geml', modelField: 'temp' },
    { mode: 'Radar', product: 'cc', satelliteSelection: DEFAULT_SATELLITE_SELECTION, modelId: 'gdps-geml', modelField: 'temp' },
    { mode: 'Satellite', product: 'ref', satelliteSelection: DEFAULT_SATELLITE_SELECTION, modelId: 'gdps-geml', modelField: 'temp' },
  ]);
  const [playbackFrames, setPlaybackFrames] = useState<Array<{ time: string; tileUrl: string; label: string }>>([]);
  const [playbackMeta, setPlaybackMeta] = useState<FrameMetadata | null>(null);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  // The frames API is authoritative: one live frame is not a loop, regardless
  // of how many times the UI might replay the same tile.
  const timelineLoopAvailable = Boolean(playbackMeta?.loopAvailable) && playbackFrames.length > 1;

  const [basemap, setBasemap] = useState<BasemapType>('satellite-streets');
  const [basemapStatus, setBasemapStatus] = useState('Satellite Streets (Default)');

  const [gateFilter, setGateFilter] = useState(5);
  const [radarOpacity, setRadarOpacity] = useState(initialPrefs.radarOpacity);
  const [smoothing, setSmoothing] = useState(initialPrefs.smoothing);
  const [colorTable, setColorTable] = useState(initialPrefs.colorTable);
  const [velocityUnit, setVelocityUnit] = useState<'mph' | 'knots' | 'kmh'>('mph');
  const [warningPopup, setWarningPopup] = useState(true);
  const [warningVoiceEnabled, setWarningVoiceEnabled] = useState(false);
  const [warningVoicePack, setWarningVoicePack] = useState<'default' | 'short'>('default');
  const [importedPal, setImportedPal] = useState<PalTable | null>(null);
  const [importedPalStatus, setImportedPalStatus] = useState<string>('');

  const [showLightning, setShowLightning] = useState(initialPrefs.showLightning);
  const [showStormTracks, setShowStormTracks] = useState(initialPrefs.showStormTracks);
  const [showRadarSites, setShowRadarSites] = useState(true);
  const [showRadarPills, setShowRadarPills] = useState(initialPrefs.showRadarPills);
  const [showRangeRings, setShowRangeRings] = useState(initialPrefs.showRangeRings);
  const [showCounties, setShowCounties] = useState(initialPrefs.showCounties);
  const [showTornadoAnalysis, setShowTornadoAnalysis] = useState(initialPrefs.showTornadoAnalysis);
  const [showLSR, setShowLSR] = useState(initialPrefs.showLSR);
  const [showWatches, setShowWatches] = useState(initialPrefs.showWatches);
  const [showWarnings, setShowWarnings] = useState(initialPrefs.showWarnings);
  const [showMCD, setShowMCD] = useState(initialPrefs.showMCD);
  const [showSpotters, setShowSpotters] = useState(initialPrefs.showSpotters);
  const [showHurricanes, setShowHurricanes] = useState(initialPrefs.showHurricanes);
  const [projectionMode, setProjectionMode] = useState<'mercator' | 'globe'>(initialPrefs.projectionMode);
  const [mapPitch, setMapPitch] = useState(initialPrefs.mapPitch);
  const [showSpotterReports, setShowSpotterReports] = useState(initialPrefs.showSpotterReports);
  const [showMetars, setShowMetars] = useState(initialPrefs.showMetars);
  const [surfaceLayers, setSurfaceLayers] = useState<Record<SurfaceLayerId, boolean>>(initialPrefs.surfaceLayers);

  const [surfaceSource, setSurfaceSource] = useState<SurfaceSource>('metar');
  const [surfaceGeoJson, setSurfaceGeoJson] = useState<any>({ type: 'FeatureCollection', features: [] });
  const [surfaceStatus, setSurfaceStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [surfaceLayerStatus, setSurfaceLayerStatus] = useState<Record<SurfaceLayerId, SurfaceLayerStatus>>({
    observations: 'idle', metar: 'idle', aviation: 'idle', mesonet: 'unavailable', pws: 'unavailable', buoy: 'unavailable', marine: 'unavailable',
  });
  const [surfaceLayerCounts, setSurfaceLayerCounts] = useState<Record<SurfaceLayerId, number>>({
    observations: 0, metar: 0, aviation: 0, mesonet: 0, pws: 0, buoy: 0, marine: 0,
  });
  const [surfaceLayerErrors, setSurfaceLayerErrors] = useState<Partial<Record<SurfaceLayerId, string>>>({});
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number; zoom: number }>({
    lat: RADAR_SITES[0]?.lat ?? 34.836,
    lon: RADAR_SITES[0]?.lon ?? -92.262,
    zoom: 7,
  });
  const [spotterFilters, setSpotterFilters] = useState({
    tornado: true,
    funnel: true,
    wallCloud: true,
    hail: true,
    wind: true,
    flooding: true,
  });
  const [showFastScan, setShowFastScan] = useState(false);
  const [showFlashReflectivity, setShowFlashReflectivity] = useState(false);
  const [flashRange, setFlashRange] = useState<[number, number]>([60, 80]);
  const [inspectionMode, setInspectionMode] = useState(false);
  const [crossSectionMode, setCrossSectionMode] = useState(false);
  const [crossSectionResult, setCrossSectionResult] = useState<LiveCrossSectionResult | null>(null);
  const [crossSectionLoading, setCrossSectionLoading] = useState(false);
  const [crossSectionError, setCrossSectionError] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<'none'|'measure-distance'|'measure-area'|'draw-point'|'draw-line'|'draw-polygon'|'annotate'>('none');
  const [toolRevision, setToolRevision] = useState(0);
  const [toolMeasurements, setToolMeasurements] = useState<Array<{id:string;kind:'distance'|'area';label:string;value:string;points:Array<[number,number]>}>>([]);
  const [toolDrawings, setToolDrawings] = useState<Array<{id:string;kind:'point'|'line'|'polygon'|'annotation';label?:string;points:Array<[number,number]>;color:string}>>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [tripleMode, setTripleMode] = useState(false);
  const [thirdPane, setThirdPane] = useState<PaneMode>('Composite');
  const spokenBannerIdRef = useRef<string | null>(null);

  const [alertsOpen, setAlertsOpen] = useState(initialPrefs.alertsOpen);
  const [alertSettingsOpen, setAlertSettingsOpen] = useState(false);
  const [favoriteProducts, setFavoriteProducts] = useState<string[]>(initialPrefs.favorites);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [locationContext, setLocationContext] = useState<{ lat: number; lon: number; ts: number } | null>(null);
  const [alertPanelPinned, setAlertPanelPinned] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null);
  const [toolboxOpen, setToolboxOpen] = useState(false);

  const [spotterReportsForContext, setSpotterReportsForContext] = useState<any[]>([]);
  const [mcdFeaturesForContext, setMcdFeaturesForContext] = useState<any[]>([]);

  useEffect(() => {
    try {
      const prefs: UserPrefs = {
        ...DEFAULT_PREFS,
        projectionMode,
        mapPitch,
        showRangeRings,
        radarOpacity,
        smoothing,
        playbackSpeed,
        playbackDirection,
        loopPauseMs,
        favorites: favoriteProducts,
        product,
        tilt,
        radarSite,
        colorTable,
        showRadarPills,
        showLightning,
        showLSR,
        showWatches,
        showWarnings,
        showMCD,
        showSpotters,
        showSpotterReports,
        showMetars,
        surfaceLayers,
        showStormTracks,
        showCounties,
        showTornadoAnalysis,
        showHurricanes,
        alertsOpen,
        alertSidebarState: alertsOpen ? 'open' : 'closed',
      };
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }, [projectionMode, mapPitch, showRangeRings, radarOpacity, smoothing, playbackSpeed, playbackDirection, loopPauseMs, favoriteProducts, product, tilt, radarSite, colorTable, showRadarPills, showLightning, showLSR, showWatches, showWarnings, showMCD, showSpotters, showSpotterReports, showMetars, surfaceLayers, showStormTracks, showCounties, showTornadoAnalysis, showHurricanes, alertsOpen]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hsiOpen, setHsiOpen] = useState(true);
  const [overlayProfiles, setOverlayProfiles] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_OVERLAY_PROFILES;
    try {
      const raw = window.localStorage.getItem(OVERLAY_STORAGE_KEY);
      return raw ? normalizeOverlayProfiles(JSON.parse(raw)) : DEFAULT_OVERLAY_PROFILES;
    } catch {
      return DEFAULT_OVERLAY_PROFILES;
    }
  });
  const [mesoaiOpen, setMesoaiOpen] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [workspacePanels, setWorkspacePanels] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_WORKSPACE_PANELS;
    try {
      const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      return raw ? normalizeWorkspacePanels(JSON.parse(raw)) : DEFAULT_WORKSPACE_PANELS;
    } catch {
      return DEFAULT_WORKSPACE_PANELS;
    }
  });
  const [dataSourceFilter, setDataSourceFilter] = useState<'ALL' | DataSourceStatus>('ALL');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HSI_STORAGE_KEY);
      if (stored !== null) setHsiOpen(stored === '1');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(HSI_STORAGE_KEY, hsiOpen ? '1' : '0');
    } catch {}
  }, [hsiOpen]);

  useEffect(() => {
    try { window.localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlayProfiles)); } catch {}
  }, [overlayProfiles]);

  useEffect(() => {
    try { window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspacePanels)); } catch {}
  }, [workspacePanels]);

  // Mode-specific overlay profile gates. Global switches remain the outer gate
  // so a mode can only remove layers, never enable an unverified source.
  const overlayMode: OverlayMode = broadcastMode
    ? 'broadcast'
    : tab === 'Satellite' ? 'satellite' : tab === 'Models' || tab === 'Outlooks' ? 'forecast' : 'radar';
  const overlay = overlayProfiles[overlayMode];
  const mapWarnings = showWarnings && overlay.warnings;
  const mapWatches = showWatches && overlay.warnings;
  const mapSpotters = showSpotters && overlay.spotters;
  const mapReports = showSpotterReports && overlay.reports;
  const mapCounties = showCounties && overlay.boundaries;
  const mapObservations: Record<SurfaceLayerId, boolean> = {
    observations: surfaceLayers.observations && overlay.observations,
    metar: surfaceLayers.metar && overlay.observations,
    aviation: surfaceLayers.aviation && overlay.observations,
    mesonet: surfaceLayers.mesonet && overlay.observations,
    pws: surfaceLayers.pws && overlay.observations,
    buoy: surfaceLayers.buoy && overlay.observations,
    marine: surfaceLayers.marine && overlay.observations,
  };

  useEffect(() => {
    const loaded = loadAlertSettings();
    setAlertSettings(loaded);
    if (loaded.sidebarPinned) setAlertsOpen(true);
  }, []);
  useEffect(() => { saveAlertSettings(alertSettings); }, [alertSettings]);

  const {
    alerts,
    filtered: filteredAlerts,
    counts: alertCounts,
    filters: alertFilters,
    toggleFilter: toggleAlertFilter,
    setAllFilters: setAllAlertFilters,
    audioEnabled,
    audioCategories,
    enableAudio,
    disableAudio,
    toggleAudioCategory,
    testTone,
    banner: alertBanner,
    dismissBanner,
    lastUpdated,
    error: alertError,
    loading: alertsLoading,
    refresh: refreshAlerts,
  } = useFastAlerts({
    settings: alertSettings,
    bannerVisible: warningPopup && alertSettings.warningDisplayBehavior !== 'sidebar-only',
  });

  useEffect(() => {
    if (!alertBanner) return;
    const speakEnabled = alertSettings.speech.enabled || warningVoiceEnabled;
    if (!speakEnabled) return;
    if (spokenBannerIdRef.current === alertBanner.id) return;
    if (!shouldSpeakAlert(alertBanner.event, alertBanner.category, { ...alertSettings, speech: { ...alertSettings.speech, enabled: true } }) && !(warningVoiceEnabled && !alertSettings.speech.enabled)) return;
    // If using legacy toggle only, allow warning categories as before; prefer alertSettings rules.
    const allow = alertSettings.speech.enabled
      ? shouldSpeakAlert(alertBanner.event, alertBanner.category, alertSettings)
      : warningVoiceEnabled;
    if (!allow) return;
    spokenBannerIdRef.current = alertBanner.id;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const text = alertSettings.speech.enabled
      ? formatAlertSpeech(alertBanner.event, alertBanner.areaDesc, alertBanner.senderName)
      : (warningVoicePack === 'short' ? `${alertBanner.event}.` : `The National Weather Service has issued a ${alertBanner.event}${alertBanner.areaDesc ? ` for ${alertBanner.areaDesc}` : ''}.`);
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1; u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch {}
  }, [alertBanner, warningVoiceEnabled, warningVoicePack, alertSettings]);

  const currentSite =
    RADAR_SITES.find((s) => s.id === radarSite) || RADAR_SITES[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BASEMAP_STORAGE_KEY) as BasemapType | null;
      if (saved === 'satellite-streets' || saved === 'custom-weather' || saved === 'light') {
        setBasemap(saved);
        setBasemapStatus(saved === 'satellite-streets' ? 'Satellite Streets (Default)' : saved === 'light' ? 'Light Map' : 'Dark Map');
      }
      const savedProjection = localStorage.getItem(PROJECTION_STORAGE_KEY);
      if (savedProjection === 'mercator' || savedProjection === 'globe') {
        setProjectionMode(savedProjection);
      }
      const spotterSaved = localStorage.getItem('mesovortex_spotters_enabled');
      if (spotterSaved === '0' || spotterSaved === '1') setShowSpotters(spotterSaved === '1');
      const reportsSaved = localStorage.getItem('mesovortex_spotter_reports_enabled');
      if (reportsSaved === '0' || reportsSaved === '1') setShowSpotterReports(reportsSaved === '1');
      const filtersSaved = localStorage.getItem('mesovortex_spotter_filters');
      if (filtersSaved) {
        const parsed = JSON.parse(filtersSaved);
        if (parsed && typeof parsed === 'object') setSpotterFilters((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem('mesovortex_spotters_enabled', showSpotters ? '1' : '0'); } catch {}
  }, [showSpotters]);

  useEffect(() => {
    try { localStorage.setItem('mesovortex_spotter_reports_enabled', showSpotterReports ? '1' : '0'); } catch {}
  }, [showSpotterReports]);

  useEffect(() => {
    try { localStorage.setItem('mesovortex_spotter_filters', JSON.stringify(spotterFilters)); } catch {}
  }, [spotterFilters]);

  // Master playback timeline. Uses N0B base reflectivity archive (actual IEM
  // timestamps). Products/sources without archive display LIVE ONLY in panes.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/nexrad/frames?site=${encodeURIComponent(currentSite.radarId)}&product=ref&tilt=0.5`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const frames = Array.isArray(data.frames)
          ? data.frames.map((f: any) => ({ time: String(f.time), tileUrl: String(f.tileUrl), label: String(f.label || '') }))
          : [];
        setPlaybackFrames(frames);
        setPlaybackMeta({
          provider: data.provider ? String(data.provider) : undefined,
          product: data.product ? String(data.product) : undefined,
          capabilityId: data.capabilityId ? String(data.capabilityId) : undefined,
          tilt: data.tilt ? String(data.tilt) : undefined,
          network: data.network ? String(data.network) : undefined,
          station: data.station ? String(data.station) : undefined,
          scanTime: data.scanTime ? String(data.scanTime) : null,
          scanTimeAvailable: Boolean(data.scanTimeAvailable),
          playbackSupport: data.playbackSupport ? String(data.playbackSupport) : undefined,
          archiveSupport: data.archiveSupport ? String(data.archiveSupport) : undefined,
          verificationLevel: data.verificationLevel ? String(data.verificationLevel) : undefined,
          loopAvailable: Boolean(data.loopAvailable),
        });
        setPlaybackIndex((prev) => (frames.length ? Math.min(prev, frames.length - 1) : 0));
      } catch {
        if (!cancelled) {
          setPlaybackFrames([]);
          setPlaybackMeta(null);
        }
      }
    };
    load();
    const timer = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [currentSite.radarId]);

  useEffect(() => {
    if (!isPlaying || !timelineLoopAvailable) return;
    const frameMs = Math.max(120, Math.round(900 / playbackSpeed));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const step = () => {
      setPlaybackIndex((prev) => {
        const last = playbackFrames.length - 1;
        if (playbackDirection === 'backward') {
          if (prev <= 0) {
            if (loopPauseMs > 0) { timer = setTimeout(() => setPlaybackIndex(last), loopPauseMs); return 0; }
            return last;
          }
          return prev - 1;
        }
        if (prev >= last) {
          if (loopPauseMs > 0) { timer = setTimeout(() => setPlaybackIndex(0), loopPauseMs); return last; }
          return 0;
        }
        return prev + 1;
      });
      timer = setTimeout(step, frameMs);
    };
    timer = setTimeout(step, frameMs);
    return () => { if (timer) clearTimeout(timer); };
  }, [isPlaying, timelineLoopAvailable, playbackSpeed, playbackDirection, loopPauseMs]);

  const basemapLabel = (id: BasemapType) =>
    id === 'satellite-streets' ? 'Satellite Streets (Default)' : id === 'light' ? 'Light Map' : 'Dark Map';
  const handleSelectBasemap = (selected: BasemapType) => {
    setBasemap(selected);
    setBasemapStatus(basemapLabel(selected));
    try {
      localStorage.setItem(BASEMAP_STORAGE_KEY, selected);
    } catch {
      // fallback
    }
  };

  const handleSelectProjection = (selected: 'mercator' | 'globe') => {
    setProjectionMode(selected);
    try {
      localStorage.setItem(PROJECTION_STORAGE_KEY, selected);
    } catch {
      // fallback
    }
  };

  const styledAlerts = useMemo(() => alerts.map((a) => applyAlertSettingsToAlert(a, alertSettings)), [alerts, alertSettings]);
  const mesoaiWarning = useMemo(() => {
    const alert = styledAlerts.find((a) => a.category === 'warning') || null;
    return alert ? {
      event: alert.event,
      headline: alert.headline,
      description: alert.description,
      instruction: alert.instruction,
      areaDesc: alert.areaDesc,
      category: alert.category,
      severity: alert.severity,
      sent: alert.sent,
    } : null;
  }, [styledAlerts]);
  const styledFilteredAlertsBase = useMemo(() => filteredAlerts.map((a) => applyAlertSettingsToAlert(a, alertSettings)), [filteredAlerts, alertSettings]);
  const styledFilteredAlerts = useMemo(() => {
    const mode = alertSettings.filterMode;
    let out = styledFilteredAlertsBase;
    if (mode === 'warnings') out = out.filter((a) => a.category === 'warning');
    else if (mode === 'watches') out = out.filter((a) => a.category === 'watch');
    else if (mode === 'statements') out = out.filter((a) => a.category === 'statement' || a.category === 'advisory' || a.category === 'other');
    const sorted = [...out];
    if (alertSettings.sortMode === 'newest') sorted.sort((a,b)=>Date.parse(b.sent||'') - Date.parse(a.sent||''));
    else if (alertSettings.sortMode === 'expiring') sorted.sort((a,b)=>Date.parse(a.expires||'9999') - Date.parse(b.expires||'9999'));
    else sorted.sort((a,b)=>alertPriority(b)-alertPriority(a) || Date.parse(b.sent||'')-Date.parse(a.sent||''));
    return sorted;
  }, [styledFilteredAlertsBase, alertSettings.filterMode, alertSettings.sortMode]);
  const styledBanner = useMemo(() => (alertBanner ? applyAlertSettingsToAlert(alertBanner, alertSettings) : null), [alertBanner, alertSettings]);

  // Alerts rendered on the map honor the category filters and visibility toggles.
  // The location card uses the same set so a hidden layer cannot reappear as a popup.
  const visibleMapAlerts = useMemo(() => styledFilteredAlerts.filter((alert) => {
    if (alert.category === 'warning') return mapWarnings;
    if (alert.category === 'watch') return mapWatches;
    return true;
  }), [styledFilteredAlerts, mapWarnings, mapWatches]);
  const mapAlertFeatures = useMemo(() => alertsToFeatureCollection(visibleMapAlerts), [visibleMapAlerts]);

  const selectedAlert = useMemo(() => styledAlerts.find((a) => a.id === selectedAlertId) || null, [styledAlerts, selectedAlertId]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [repRes, mcdRes, mpingRes] = await Promise.all([
          fetch('/api/spotter?mode=reports', { cache: 'no-store' }).catch(() => null),
          fetch('/api/spc/mcd', { cache: 'no-store' }).catch(() => null),
          fetch('/api/mping?minutes=60', { cache: 'no-store' }).catch(() => null),
        ]);
        if (cancelled) return;
        if (repRes?.ok) {
          const d = await repRes.json().catch(() => null);
          setSpotterReportsForContext(Array.isArray(d?.features) ? d.features : []);
        }
        // mPING is public where available; upstream 401/404 leaves it empty and
        // the availability note stays DATA UNAVAILABLE rather than fabricated.
        if (mpingRes?.ok) {
          const d = await mpingRes.json().catch(() => null);
          const mping = (Array.isArray(d?.features) ? d.features : []).map((feature: any, index: number) => {
            const props = feature?.properties || {};
            return {
              type: 'Feature',
              id: `mping-${index}`,
              geometry: feature?.geometry || null,
              properties: {
                id: `mping-${index}`,
                hazard: String(props.wxcodes || props.report || 'mPING report'),
                notes: String(props.remark || props.comment || props.report || ''),
                timeIso: String(props.time || props.observed || props.timestamp || ''),
                source: 'NSSL mPING',
              },
            };
          });
          if (mping.length) setSpotterReportsForContext((prev) => [...prev, ...mping]);
        }
        if (mcdRes?.ok) {
          const d = await mcdRes.json().catch(() => null);
          setMcdFeaturesForContext(Array.isArray(d?.features) ? d.features : []);
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 120000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const alertLocationContext = useMemo(() => {
    if (!locationContext) return null;
    return buildLocationContext(locationContext.lat, locationContext.lon, visibleMapAlerts, RADAR_SITES as any, spotterReportsForContext, mcdFeaturesForContext);
  }, [locationContext, visibleMapAlerts, spotterReportsForContext, mcdFeaturesForContext]);

  useEffect(() => {
    if (!crossSectionMode) return;
    const cancelSelection = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCrossSectionMode(false);
    };
    window.addEventListener('keydown', cancelSelection);
    return () => window.removeEventListener('keydown', cancelSelection);
  }, [crossSectionMode]);

  const handleCrossSectionComplete = async (pointA: [number, number], pointB: [number, number]) => {
    setCrossSectionMode(false);
    setCrossSectionLoading(true);
    setCrossSectionError(null);
    setCrossSectionResult(null);
    try {
      const response = await fetch('/api/radar/cross-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          site: currentSite.radarId || currentSite.id,
          start: { lon: pointA[0], lat: pointA[1] },
          end: { lon: pointB[0], lat: pointB[1] },
          columns: 150,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `Cross-section request failed (HTTP ${response.status}).`);
      if (!Array.isArray(payload?.sweeps) || !payload.sweeps.length) throw new Error('The live radar volume returned no elevation sweeps for this transect.');
      setCrossSectionResult(payload as LiveCrossSectionResult);
    } catch (error) {
      setCrossSectionError(error instanceof Error ? error.message : 'Unable to load a live radar cross section.');
    } finally {
      setCrossSectionLoading(false);
    }
  };

  // Independent surface layers share one canonical station feed. ASOS remains
  // a strict subset of genuine METAR reports; unavailable networks never render
  // placeholder stations.
  useEffect(() => {
    const observationsMaster = surfaceLayers.observations;
    const requested: Record<SurfaceLayerId, boolean> = {
      observations: observationsMaster,
      metar: observationsMaster || surfaceLayers.metar || (openPanel === 'METAR' && surfaceSource === 'metar'),
      aviation: observationsMaster || surfaceLayers.aviation || (openPanel === 'ASOS' || (openPanel === 'METAR' && surfaceSource === 'asos')),
      mesonet: observationsMaster || surfaceLayers.mesonet,
      pws: observationsMaster || surfaceLayers.pws,
      buoy: observationsMaster || surfaceLayers.buoy,
      marine: observationsMaster || surfaceLayers.marine,
    };
    const active = Object.values(requested).some(Boolean) || openPanel === 'Surface';
    if (!active) return;
    let cancelled = false;
    const load = async () => {
      setSurfaceStatus('loading');
      setSurfaceError(null);
      const bbox = observationBbox(mapCenter.lat, mapCenter.lon, mapCenter.zoom);
      const queries: Array<{ layer: SurfaceLayerId; network: string; url: string }> = [];
      if (requested.metar) queries.push({ layer: 'metar', network: 'metar', url: `/api/metar/geojson?${new URLSearchParams({ bbox, hours: '3', source: 'metar' })}` });
      if (requested.aviation) queries.push({ layer: 'aviation', network: 'asos', url: `/api/asos/geojson?${new URLSearchParams({ bbox, hours: '3' })}` });
      if (requested.aviation) queries.push({ layer: 'aviation', network: 'awos', url: `/api/surface/awos?${new URLSearchParams({ bbox, network: DEFAULT_AWOS_NETWORK })}` });
      if (requested.mesonet) queries.push({ layer: 'mesonet', network: 'mesonet', url: `/api/surface/mesonet?${new URLSearchParams({ bbox, network: DEFAULT_MESONET_NETWORK })}` });
      if (requested.pws) queries.push({ layer: 'pws', network: 'pws', url: `/api/surface/pws?${new URLSearchParams({ bbox })}` });
      if (requested.buoy) queries.push({ layer: 'buoy', network: 'buoy', url: `/api/surface/buoy?${new URLSearchParams({ bbox })}` });
      if (requested.marine) queries.push({ layer: 'marine', network: 'marine', url: `/api/surface/marine?${new URLSearchParams({ bbox })}` });

      const settled = await Promise.allSettled(queries.map(async (query) => {
        const res = await fetch(query.url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        return { query, res, data };
      }));
      if (cancelled) return;

      const features: any[] = [];
      const counts: Record<SurfaceLayerId, number> = { observations: 0, metar: 0, aviation: 0, mesonet: 0, pws: 0, buoy: 0, marine: 0 };
      const statuses: Record<SurfaceLayerId, SurfaceLayerStatus> = {
        observations: 'idle',
        metar: requested.metar ? 'loading' : 'idle',
        aviation: requested.aviation ? 'loading' : 'idle',
        mesonet: requested.mesonet ? 'loading' : 'unavailable',
        pws: requested.pws ? 'loading' : 'unavailable',
        buoy: requested.buoy ? 'loading' : 'unavailable',
        marine: requested.marine ? 'loading' : 'unavailable',
      };
      const errors: Partial<Record<SurfaceLayerId, string>> = {};
      settled.forEach((item, index) => {
        if (item.status === 'rejected') {
          statuses[queries[index].layer] = 'error';
          errors[queries[index].layer] = 'Surface observation request failed';
          return;
        }
        const { query, res, data } = item.value;
        if (!res.ok) {
          const message = String(data?.error || `HTTP ${res.status}`);
          statuses[query.layer] = res.status === 404 ? 'unavailable' : 'error';
          if (res.status !== 404) errors[query.layer] = message;
          return;
        }
        const layerFeatures = Array.isArray(data?.features) ? data.features : [];
        for (const feature of layerFeatures) {
          features.push({
            ...feature,
            properties: {
              ...(feature?.properties || {}),
              surfaceLayer: query.layer,
              surfaceNetwork: query.network,
              sourceLabel: data?._meta?.sourceLabel || data?.source || query.layer.toUpperCase(),
              sourceUrl: data?._meta?.source || null,
            },
          });
        }
        counts[query.layer] = layerFeatures.length;
        statuses[query.layer] = 'ready';
      });
      setSurfaceLayerStatus(statuses);
      setSurfaceLayerCounts(counts);
      setSurfaceLayerErrors(errors);
      setSurfaceGeoJson({ type: 'FeatureCollection', features });
      const errorList = Object.values(errors);
      setSurfaceStatus(errorList.length ? 'error' : 'ready');
      setSurfaceError(errorList.length ? errorList[0] || 'Surface observations unavailable' : null);
    };
    const start = window.setTimeout(load, 300);
    const poll = window.setInterval(load, 180_000);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
      window.clearInterval(poll);
    };
  }, [surfaceLayers, openPanel, surfaceSource, mapCenter.lat, mapCenter.lon, mapCenter.zoom]);

  const surfaceStationPlots = useMemo<StationPlot[]>(
    () => normalizeStationPlots(surfaceGeoJson, { layer: 'metar', network: 'metar', sourceLabel: 'Real surface observation' }),
    [surfaceGeoJson]
  );
  const focusSurfaceStation = useCallback((station: StationPlot) => {
    setFocusTarget({ lat: station.lat, lon: station.lon, zoom: Math.max(8, mapCenter.zoom), ts: Date.now() });
  }, [mapCenter.zoom]);
  const toggleSurfaceLayer = useCallback((layer: SurfaceLayerId, enabled: boolean) => {
    if (layer === 'observations') {
      setSurfaceLayers((prev) => {
        const next: Record<SurfaceLayerId, boolean> = { ...prev, observations: enabled };
        if (enabled) {
          next.metar = true;
          next.aviation = true;
          next.mesonet = true;
          next.pws = true;
          next.buoy = true;
          next.marine = true;
        }
        return next;
      });
      return;
    }
    setSurfaceLayers((prev) => ({ ...prev, [layer]: enabled }));
    if (layer === 'metar') setShowMetars(enabled);
  }, []);

  const paneProps = {
    radarSite,
    tilt,
    maxRefWindow,
    basemap,
    spcDay,
    radarOpacity,
    showRangeRings,
    showRadarPills,
    showLightning,
    showLSR,
    showMetars: mapObservations.metar,
    surfaceLayers: mapObservations,
    surfaceGeoJson,
    onCameraChange: setMapCenter,
    showWatches: mapWatches,
    showWarnings: mapWarnings,
    showMCD,
    showSpotters: mapSpotters,
    showSpotterReports: mapReports,
    showStormTracks,
    showHurricanes,
    projectionMode,
    mapPitch,
    modelId,
    modelField,
    modelRun,
    modelForecastHour,
    spotterFilters,
    showFastScan,
    showFlashReflectivity,
    flashRange,
    inspectionMode,
    compositeSource,
    crossSectionMode: crossSectionMode && !expertMode && !quadMode,
    onCrossSectionComplete: handleCrossSectionComplete,
    alertFeatures: mapAlertFeatures,
    alertOutlineThickness: alertSettings.outlineThickness,
    onSelectWarningFromMap: (w: any, lat?: number, lon?: number) => {
      // WeatherWise-style: clicking inside a warning opens the small
      // location summary first, not the full warning.
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setSelectedAlertId(null);
        setLocationContext({ lat: lat as number, lon: lon as number, ts: Date.now() });
      } else {
        const id = String(w?.id || '');
        if (id) { setLocationContext(null); setSelectedAlertId(id); setAlertsOpen(true); }
      }
    },
    onMapContextClick: (lat: number, lon: number) => {
      // Only the warning summary panel is shown, and only inside polygons.
      // Outside warning polygons: clear context so no summary panel appears,
      // unless the detail panel is pinned for active warning work.
      if (alertPanelPinned) return;
      setSelectedAlertId(null);
      setLocationContext(null);
      if (alertSettings.sidebarAutoHide && !alertSettings.sidebarPinned) setAlertsOpen(false);
    },
    onCursorMove: (lat: number, lon: number) => setCursor({ lat, lon }),
    focusTarget,
    onSelectSite: (id: string) => setRadarSite(id),
  } as const;

  const currentPlaybackFrame = playbackFrames[playbackIndex] || null;

  // Selecting a product must not leave a tilt that the frames route rejects.
  // Products with no tilt semantics (national grids, derived fields) keep the
  // persisted value but the UI/banner state explicitly reports "no tilt".
  const selectRadarProduct = (next: string) => {
    const id = String(next);
    setProduct(id as RadarProduct);
    const cap = getRadarCapability(id);
    if (cap && cap.tiltSupport.length > 0 && !cap.tiltSupport.includes(tilt)) {
      setTilt(cap.tiltSupport[0]);
    }
  };

  const parseLatLon = (q: string): { lat: number; lon: number } | null => {
    const m = q.trim().match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
    if (!m) return null;
    const lat = Number(m[1]); const lon = Number(m[2]);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const exportMapPng = async () => {
    setExportBusy(true);
    setExportStatus('');
    try {
      const canvas = document.querySelector('.maplibregl-canvas') as HTMLCanvasElement | null;
      if (!canvas) throw new Error('Map canvas not found.');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Canvas export unavailable (possibly CORS-tainted tiles). No fake export generated.');
      downloadBlob(blob, `mesovortexwx-${stamp}.png`);
      setExportStatus('PNG exported from current map canvas. Includes only currently rendered real pixels.');
    } catch (e: any) {
      setExportStatus(`DATA UNAVAILABLE - PNG export failed: ${String(e?.message || e)}`);
    } finally {
      setExportBusy(false);
    }
  };

  const exportMapGif = async () => {
    setExportBusy(true);
    setExportStatus('');
    try {
      // Honest export: capture real currently-rendered frames only. No fabricated/interpolated frames.
      const canvas = document.querySelector('.maplibregl-canvas') as HTMLCanvasElement | null;
      if (!canvas) throw new Error('Map canvas not found.');
      const frames: Blob[] = [];
      const frameCount = Math.max(2, Math.min(12, playbackFrames.length > 1 ? Math.min(playbackFrames.length, 12) : 4));
      for (let i = 0; i < frameCount; i++) {
        if (playbackFrames.length > 1) setPlaybackIndex(i % playbackFrames.length);
        await new Promise((r) => setTimeout(r, 450));
        const b: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!b) throw new Error('Frame capture unavailable (possibly CORS-tainted). No fake GIF generated.');
        frames.push(b);
      }
      // Without a verified GIF encoder dependency, export an honest frame bundle as individual PNGs is not ideal;
      // instead fail explicitly rather than producing a fake GIF.
      throw new Error('Animated GIF encoding is not verified in this build (no trusted encoder wired). Real PNG frames were capturable; no fake GIF generated.');
    } catch (e: any) {
      setExportStatus(`DATA UNAVAILABLE - GIF export: ${String(e?.message || e)}`);
    } finally {
      setExportBusy(false);
    }
  };

  const runSearch = async (q: string) => {
    const query = q.trim();
    setSearchQuery(q);
    if (!query) { setSearchResults([]); return; }
    setSearchBusy(true);
    try {
      const results: Array<{label:string;type:string;lat?:number;lon?:number;siteId?:string}> = [];
      const ll = parseLatLon(query);
      if (ll) results.push({ label: `${ll.lat.toFixed(4)}, ${ll.lon.toFixed(4)}`, type: 'Lat/Lon', lat: ll.lat, lon: ll.lon });
      const ql = query.toLowerCase();
      for (const s of RADAR_SITES) {
        if (s.id.toLowerCase().includes(ql) || s.radarId.toLowerCase().includes(ql) || s.name.toLowerCase().includes(ql)) {
          results.push({ label: `${s.id} — ${s.name}`, type: 'Radar Site', lat: s.lat, lon: s.lon, siteId: s.id });
        }
        if (results.length >= 8) break;
      }
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || (window as any).__MAPBOX_TOKEN__ || '';
      if (token && query.length >= 2) {
        const types = 'place,postcode,address,poi,district,region,locality';
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&autocomplete=true&limit=6&types=${types}&country=US,CA,MX`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          for (const f of (data.features || [])) {
            const placeType = Array.isArray(f.place_type) ? f.place_type[0] : 'place';
            const typeLabel = placeType === 'postcode' ? 'ZIP/Postal'
              : placeType === 'poi' ? 'Airport/POI'
              : placeType === 'region' ? 'State/Region'
              : placeType === 'district' || placeType === 'locality' ? 'County/Locality'
              : 'City/Place';
            const [lon, lat] = f.center || [];
            if (typeof lat === 'number' && typeof lon === 'number') {
              results.push({ label: f.place_name || f.text || query, type: typeLabel, lat, lon });
            }
          }
        }
      }
      const seen = new Set<string>();
      const deduped = results.filter(r => { const k = `${r.type}|${r.label}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
      setSearchResults(deduped);
    } catch {
      setSearchResults([]);
    } finally { setSearchBusy(false); }
  };

  const handleSearchSelect = (r: {label:string;type:string;lat?:number;lon?:number;siteId?:string}) => {
    if (r.siteId) setRadarSite(r.siteId);
    if (typeof r.lat === 'number' && typeof r.lon === 'number') {
      setFocusTarget({ lat: r.lat, lon: r.lon, zoom: r.type === 'Radar Site' ? 8 : r.type === 'State/Region' ? 6 : r.type === 'County/Locality' ? 9 : 10, ts: Date.now() });
    }
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const renderPane = (
    paneMode: PaneMode,
    paneProduct: RadarProduct,
    paneSatelliteSelection: SatelliteSelection,
    paneId: string,
    syncGroup: string | null,
    onModeChange?: (mode: PaneMode) => void,
    onProductChange?: (product: RadarProduct) => void,
    onSatelliteSelectionChange?: (selection: SatelliteSelection) => void,
    compact = false
  ) => (
    <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
      <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-2">
        <div className="rounded-lg border border-slate-700 bg-[#0b1220] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-300 shadow-xl">
          {paneMode}
        </div>
        {paneMode === 'Radar' && (
          <div className="rounded-lg border border-slate-700 bg-[#0b1220] px-2.5 py-1 text-[10px] font-bold text-slate-200 shadow-xl">
            {paneProduct.toUpperCase()} · {RADAR_SITES.find((s) => s.id === radarSite || s.radarId === radarSite)?.network === 'TDWR' ? 'TDWR FIXED' : getRadarCapability(paneProduct)?.tiltSupport.length ? `${tilt}°` : 'NO TILT'}
          </div>
        )}
        {paneMode === 'Satellite' && (
          <div className="rounded-lg border border-slate-700 bg-[#0b1220] px-2.5 py-1 text-[10px] font-bold text-slate-200 shadow-xl">
            {getSatelliteProductDef(paneSatelliteSelection.productId).shortLabel}
          </div>
        )}
        {paneMode === 'Models' && (
          <div className="rounded-lg border border-slate-700 bg-[#0b1220] px-2.5 py-1 text-[10px] font-bold text-slate-200 shadow-xl">
            {(getModelById(modelId)?.name || modelId).split('(')[0].trim()} · {activeModelField.label}{activeModelField.status !== 'READY_NOW' ? ' · DATA UNAVAILABLE' : ''}
          </div>
        )}
        {isPlaying && timelineLoopAvailable && (
          <div className="rounded-lg border border-slate-700 bg-[#0b1220] px-2.5 py-1 text-[10px] font-bold text-amber-300 shadow-xl">
            {currentPlaybackFrame?.label || 'PLAYBACK'}
          </div>
        )}
      </div>

      {onModeChange && (
        <div className={`absolute left-2 ${compact ? 'top-9' : 'top-10'} z-20 flex items-center gap-0.5 rounded-lg border border-slate-700/70 bg-slate-950/75 p-0.5 shadow-lg`}>
          {PANE_MODES.map((modeOption) => {
            const active = modeOption === paneMode;
            return (
              <button
                key={modeOption}
                type="button"
                onClick={() => onModeChange(modeOption)}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition ${active ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                {modeOption}
              </button>
            );
          })}
          {onProductChange && paneMode === 'Radar' && (
            <select value={paneProduct} onChange={(e) => onProductChange(e.target.value as RadarProduct)} className="ml-0.5 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] font-bold text-slate-200 outline-none" aria-label={`Pane ${paneId} product`}>
              <option value="ref">REF</option><option value="vel">VEL</option><option value="srvel">SRV</option><option value="cc">CC</option><option value="zdr">ZDR</option><option value="kdp">KDP</option>
            </select>
          )}
        </div>
      )}

      <RadarMap
        {...paneProps}
        mode={paneMode}
        product={paneProduct}
        satelliteSelection={paneSatelliteSelection}
        syncGroup={syncGroup}
        playbackIndex={playbackIndex}
        playbackActive={isPlaying && timelineLoopAvailable}
        toolMode={toolMode}
        toolRevision={toolRevision}
        onToolMeasurementsChange={setToolMeasurements}
        onToolDrawingsChange={setToolDrawings}
        onToolModeChange={setToolMode}
      />
    </div>
  );

  const activePaneLabel = quadMode
    ? `Quad: ${quadPanes.map((p) => (p.mode === 'Radar' ? p.product.toUpperCase() : p.mode)).join(' / ')}`
    : expertMode
      ? `${leftPane} + ${rightPane}`
      : tab;

  const hasSatellitePane = quadMode
    ? quadPanes.some((p) => p.mode === 'Satellite')
    : expertMode
      ? leftPane === 'Satellite' || rightPane === 'Satellite'
      : tab === 'Satellite';

  const hasModelsPane = quadMode
    ? quadPanes.some((p) => p.mode === 'Models')
    : expertMode
      ? leftPane === 'Models' || rightPane === 'Models'
      : tab === 'Models';

  const activeSatSel = normalizeSatelliteSelection(satelliteSelection);
  const activeSatDef = getSatelliteProductDef(activeSatSel.productId);
  const activeModel = getModelById(modelId) || MODEL_CATALOG[0];
  const activeModelField = activeModel.fields.find(f => f.id === modelField) || activeModel.fields[0];

  const activeProductLabel = quadMode
    ? quadPanes.map(p => p.mode === 'Radar' ? p.product.toUpperCase() : p.mode).join(' / ')
    : expertMode ? `${leftPane}+${rightPane}` : tab === 'Radar' ? product : tab;
  const bannerProduct = tab === 'Radar' ? product : (expertMode ? product : product);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0b1220] font-sans text-slate-100 selection:bg-sky-500/30">
      <div className="z-50 shrink-0">
        <ProductInfoBanner
          tab={tab}
          product={bannerProduct}
          satelliteLabel={activeSatDef?.label}
          satelliteProductId={activeSatSel.productId}
          outlookDay={spcDay}
          modelLabel={activeModel?.name}
          modelFieldId={activeModelField?.id}
        />
      </div>

      <div className="pointer-events-none relative z-40 flex shrink-0 items-center justify-between border-b border-slate-800 bg-[#111318] px-4 py-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#181c22] text-amber-300 shadow-lg hover:bg-slate-700 transition font-black text-lg border border-slate-700 cursor-pointer"
            title="Menu & Layer Selector"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={() => {
              setCrossSectionError(null);
              setCrossSectionResult(null);
              setCrossSectionMode((active) => !active);
              setToolMode('none');
              setExpertMode(false);
              setQuadMode(false);
              setTripleMode(false);
            }}
            className={`rounded-full border px-3 py-2 text-[10px] font-black tracking-wide transition ${crossSectionMode ? 'border-amber-400 bg-amber-500 text-slate-950' : 'border-sky-700 bg-sky-950/70 text-sky-200 hover:bg-sky-900'}`}
            title="Select two points on the map to extract a live NEXRAD Level II reflectivity cross section"
          >
            {crossSectionMode ? 'XSEC · CLICK A THEN B' : 'XSEC'}
          </button>

          <div className="flex items-center rounded-full border border-slate-700 bg-[#181c22] p-0.5 shadow-lg">
            <button
              onClick={() => handleSelectBasemap('satellite-streets')}
              className={`rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer ${
                basemap === 'satellite-streets'
                  ? 'bg-sky-600 text-white shadow-sm border border-sky-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => handleSelectBasemap('custom-weather')}
              className={`rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer ${
                basemap === 'custom-weather'
                  ? 'bg-sky-600 text-white shadow-sm border border-sky-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-center">
          <div className="flex items-center gap-2 rounded-full bg-[#181c22] px-3 py-1.5 shadow-lg border border-slate-700">
            <div
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 pr-3 border-r border-slate-700 font-black text-xs text-slate-100 cursor-pointer hover:text-white transition"
            >
              <Image
                src="/logo.png"
                alt="MesoVortex Wx"
                width={26}
                height={26}
                className="rounded-full shadow-sm"
                priority
              />
              <span>MesoVortex<span className="text-sky-400">WX</span></span>
              <span className="text-[10px] text-slate-500">▾</span>
            </div>

            <button
              type="button"
              onClick={() => { setSearchOpen((v) => !v); setSearchResults([]); }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-[#111827] text-slate-300 hover:bg-slate-700 hover:text-white transition"
              title="Search cities, ZIP, airports, radar sites, lat/lon, counties, states"
              aria-label="Search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>
            </button>

            <div className="flex items-center gap-1 font-bold text-xs">
              {(['Radar', 'Composite', 'Satellite', 'Outlooks', 'Models'] as ModeTab[]).map((modeTab) => (
                <button
                  key={modeTab}
                  onClick={() => {
                    setTab(modeTab);
                    // Keep the compact control and banner honest when switching
                    // between single-site and national product domains.
                    if (modeTab === 'Composite') {
                      setProduct('comp_ref');
                      setCompositeOptionsExpanded(true);
                    }
                    if (modeTab === 'Radar') setProduct('ref');
                    setExpertMode(false);
                    setQuadMode(false);
                  }}
                  className={`rounded-full px-3.5 py-1.5 transition cursor-pointer flex items-center gap-1 border ${
                    !expertMode && !quadMode && tab === modeTab ? 'bg-sky-600 border-sky-500 text-white shadow-sm' : 'border-slate-700 bg-[#111827] text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {modeTab}
                </button>
              ))}
              {tab === 'Composite' && (
                <>
                  <select
                    value={compositeSource}
                    onChange={(e) => setCompositeSource(e.target.value)}
                    className="rounded-full border border-slate-700 bg-[#111827] px-2 py-1.5 text-xs text-slate-200"
                    aria-label="Composite radar source"
                  >
                    {COMPOSITE_SOURCES.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.status !== 'VERIFIED'}>
                        {s.label}{s.status !== 'VERIFIED' ? ' (DATA UNAVAILABLE)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="hidden max-w-[22rem] truncate text-[11px] text-slate-400 xl:inline">
                    {(() => { const s = COMPOSITE_SOURCES.find((x) => x.id === compositeSource); return s ? `${s.provenance} · refresh ${s.refreshMinutes ?? '—'} min · latency ${s.latencyMinutes ?? '—'} min` : ''; })()}
                  </span>
                  <div data-composite-options="true" className="relative">
                    <button
                      type="button"
                      onClick={() => setCompositeOptionsExpanded((v) => !v)}
                      className="rounded-full border border-slate-700 bg-[#111827] px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700"
                      aria-expanded={compositeOptionsExpanded}
                    >
                      {compositeOptionsExpanded ? '▾' : '▸'} Composite options
                    </button>
                    {compositeOptionsExpanded && (
                      <div className="fixed right-2 top-16 z-50 max-h-[55vh] w-[min(16rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-700 bg-[#0b1220] p-2 text-[11px] shadow-xl">
                        {COMPOSITE_SOURCES.map((s) => (
                          <div key={s.id} className="flex items-start gap-2 border-b border-slate-800 py-1.5 last:border-0">
                            <span className={s.status === 'VERIFIED' ? 'text-emerald-300' : 'text-amber-300'}>{s.status === 'VERIFIED' ? '●' : '○'}</span>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-200">{s.label}</div>
                              <div className="text-slate-400">{s.provenance}</div>
                              <div className="text-slate-500">Refresh: {s.refreshMinutes ?? '—'} min · Latency: {s.latencyMinutes ?? '—'} min · Scope: {s.scope}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
                <button
                onClick={() => { setExpertMode((v) => !v); setQuadMode(false); }}
                className={`rounded-full px-3.5 py-1.5 transition cursor-pointer flex items-center gap-1 border ${
                  expertMode ? 'bg-cyan-600 border-cyan-500 text-white shadow-sm' : 'border-slate-700 bg-[#111827] text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title="Pair any two modes side-by-side with synchronized camera movement"
              >
                Expert
              </button>
              <button
                onClick={() => { setTripleMode((v)=>!v); setExpertMode(true); setQuadMode(false); }}
                className={`rounded-full px-3.5 py-1.5 transition cursor-pointer flex items-center gap-1 border ${
                  tripleMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : 'border-slate-700 bg-[#111827] text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title="Three synchronized panes (Expert layout)"
              >
                Triple
              </button>
              <button
                onClick={() => { setQuadMode((v) => !v); setExpertMode(false); setTripleMode(false); }}
                className={`rounded-full px-3.5 py-1.5 transition cursor-pointer flex items-center gap-1 border ${
                  quadMode ? 'bg-violet-600 border-violet-500 text-white shadow-sm' : 'border-slate-700 bg-[#111827] text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title="Four synchronized panes (desktop/tablet)"
              >
                Quad
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="mt-2 w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-[#111827] p-3 shadow-lg text-slate-100">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => { const v=e.target.value; setSearchQuery(v); runSearch(v); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); } if (e.key === 'Enter' && searchResults[0]) handleSearchSelect(searchResults[0]); }}
                  placeholder="City, ZIP, airport, radar site, lat/lon, county, state..."
                  className="w-full rounded-full border border-slate-700 bg-[#0f172a] px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="rounded-full px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close search">✕</button>
              </div>
              <div className="mt-1 text-[10px] text-slate-500">Supports: Cities, ZIP codes, Airports, Radar sites, Lat/Lon, Counties, States</div>
              <div className="mt-2 max-h-64 overflow-auto space-y-1">
                {searchBusy && <div className="px-2 py-1 text-xs text-slate-400">Searching...</div>}
                {!searchBusy && searchQuery.trim() && searchResults.length === 0 && <div className="px-2 py-1 text-xs text-slate-500">No results.</div>}
                {searchResults.map((r, i) => (
                  <button key={`${r.type}-${r.label}-${i}`} type="button" onClick={() => handleSearchSelect(r)} className="flex w-full items-center justify-between rounded-full px-3 py-1.5 text-left hover:bg-slate-800">
                    <span className="text-xs text-slate-200 truncate pr-2">{r.label}</span>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-sky-400">{r.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {quadMode ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#181c22] px-3 py-1.5 shadow-lg border border-slate-700 text-[11px] font-bold text-slate-200">
              <span className="text-violet-300">Quad View</span>
              <span className="text-slate-500">•</span>
              <span>4 panes synced</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{isPlaying ? 'playback synced' : 'camera synced'}</span>
            </div>
          ) : expertMode ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#181c22] px-3 py-1.5 shadow-lg border border-slate-700 text-[11px] font-bold text-slate-200">
              <span className="text-sky-300">Expert Mode</span>
              <span className="text-slate-500">•</span>
              <span>{leftPane}</span>
              <span className="text-slate-500">+</span>
              <span>{rightPane}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{isPlaying ? 'playback synced' : 'synced pan/zoom'}</span>
            </div>
          ) : tab === 'Satellite' ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#181c22] px-3 py-1.5 shadow-lg border border-slate-700 text-[11px] font-bold text-slate-200">
              <span className="text-sky-300">{SATELLITE_BIRDS.find(b=>b.id===activeSatSel.bird)?.label}</span>
              <span className="text-slate-500">•</span>
              <span>{getSectorsForBird(activeSatSel.bird).find(s=>s.id===activeSatSel.sector)?.label}</span>
              <span className="text-slate-500">•</span>
              <span>{activeSatDef.shortLabel}</span>
              {!activeSatDef.available && <span className="text-amber-300">• DATA UNAVAILABLE</span>}
            </div>
          ) : tab === 'Models' ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#181c22] px-3 py-1.5 shadow-lg border border-slate-700 text-[11px] font-bold text-slate-200">
              <span className="text-sky-300">{activeModel.name.split('(')[0].trim()}</span>
              <span className="text-slate-500">•</span>
              <span>{activeModelField.label}</span>
              <span className="text-slate-500">•</span>
              <span className={activeModelField.status==='READY_NOW' ? 'text-emerald-300' : 'text-amber-300'}>{activeModelField.status==='READY_NOW' ? 'VERIFIED' : 'DATA UNAVAILABLE'}</span>
            </div>
          ) : tab === 'Outlooks' ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#181c22] px-3 py-1.5 shadow-lg border border-slate-700 text-xs font-bold text-slate-200">
              <span className="px-1 text-slate-300">Categorical</span>
              <span className="text-slate-600">|</span>
              {(['Day 1', 'Day 2', 'Day 3'] as SpcDay[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setSpcDay(d)}
                  className={`rounded-full px-3 py-1 text-[11px] transition cursor-pointer border ${
                    spcDay === d ? 'bg-sky-600 border-sky-500 text-white' : 'border-slate-700 bg-[#111827] text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto relative">
          <div className="flex items-center gap-1 rounded-full bg-amber-400 px-1.5 py-1 shadow-lg border border-amber-300">
            <button
              onClick={() => setAlertsOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-slate-950 font-black text-xs hover:bg-amber-300 transition cursor-pointer"
              title="Open Fast Alerts"
            >
              <span>{alerts.length || 0}</span>
              <span>alerts</span>
            </button>
            <button
              onClick={() => setAlertSettingsOpen(true)}
              className="rounded-full px-2 py-0.5 text-[11px] font-black text-slate-900 hover:bg-amber-300 transition cursor-pointer"
              title="Alert settings"
              aria-label="Alert settings"
            >
              ⚙
            </button>
          </div>

          {alertsOpen && (
            <WeatherWiseAlertsPanel
              alerts={styledFilteredAlerts}
              counts={alertCounts}
              filters={alertFilters}
              onToggleFilter={toggleAlertFilter}
              onSetAllFilters={setAllAlertFilters}
              audioEnabled={audioEnabled}
              audioCategories={audioCategories}
              onEnableAudio={enableAudio}
              onDisableAudio={disableAudio}
              onToggleAudioCategory={toggleAudioCategory}
              onTestTone={testTone}
              lastUpdated={lastUpdated}
              error={alertError}
              loading={alertsLoading}
              onRefresh={refreshAlerts}
              onClose={() => { if (!alertSettings.sidebarPinned) setAlertsOpen(false); }}
              onOpenSettings={() => setAlertSettingsOpen(true)}
              onSelectAlert={(a) => { setLocationContext(null); setSelectedAlertId(a.id); setAlertsOpen(true); }}
              selectedAlertId={selectedAlertId}
              pinned={alertSettings.sidebarPinned}
              onTogglePinned={() => setAlertSettings((s) => ({ ...s, sidebarPinned: !s.sidebarPinned }))}
              sortMode={alertSettings.sortMode}
              onChangeSortMode={(mode) => setAlertSettings((s) => ({ ...s, sortMode: mode }))}
              filterMode={alertSettings.filterMode}
              onChangeFilterMode={(mode) => setAlertSettings((s) => ({ ...s, filterMode: mode }))}
            />
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 pb-10">
        {!quadMode && !expertMode && workspacePanels[overlayMode].hsi && (
          <HsiPanel
            open={hsiOpen}
            onClose={() => setHsiOpen(false)}
            siteId={currentSite.id}
            siteName={currentSite.name}
            siteLat={currentSite.lat}
            siteLon={currentSite.lon}
            alerts={styledAlerts}
            customPolygon={toolDrawings.filter((d) => d.kind === 'polygon').slice(-1)[0]?.points ?? null}
            onStartDraw={() => setToolMode('draw-polygon')}
            onClearDraw={() => setToolDrawings((prev) => prev.filter((d) => d.kind !== 'polygon'))}
          />
        )}
        <MesoAIPanel
          open={mesoaiOpen && workspacePanels[overlayMode].mesoai}
          onClose={() => setMesoaiOpen(false)}
          site={{ id: currentSite.id, name: currentSite.name, lat: currentSite.lat, lon: currentSite.lon }}
          productKey={product}
          warning={mesoaiWarning}
          satelliteSelection={activeSatSel}
          surfaceStations={surfaceGeoJson}
        />
        {quadMode ? (
          <>
            <div className="hidden h-full w-full md:grid md:grid-cols-2 md:grid-rows-2">
              {quadPanes.map((pane, idx) => (
                <div key={idx} className={`min-h-0 min-w-0 ${idx % 2 === 0 ? 'border-r border-slate-700' : ''} ${idx < 2 ? 'border-b border-slate-700' : ''}`}>
                  {renderPane(
                    pane.mode,
                    pane.product,
                    pane.satelliteSelection,
                    String(idx),
                    'quad-main',
                    (mode) => setQuadPanes((prev) => prev.map((p, i) => (i === idx ? { ...p, mode } : p))),
                    (nextProduct) => setQuadPanes((prev) => prev.map((p, i) => (i === idx ? { ...p, product: nextProduct } : p))),
                    (nextSat) => setQuadPanes((prev) => prev.map((p, i) => (i === idx ? { ...p, satelliteSelection: nextSat } : p))),
                    true
                  )}
                </div>
              ))}
            </div>
            <div className="flex h-full w-full items-center justify-center p-6 md:hidden">
              <div className="max-w-sm rounded-md border border-slate-700 bg-[#111827] p-6 text-center shadow-lg">
                <div className="text-sm font-black uppercase tracking-wider text-violet-300">Quad View</div>
                <div className="mt-2 text-base font-bold text-white">Quad View is available on tablet and desktop.</div>
                <div className="mt-2 text-sm text-slate-400">Use a larger screen for four synchronized panes.</div>
                <button
                  type="button"
                  onClick={() => setQuadMode(false)}
                  className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500"
                >
                  Return to single view
                </button>
              </div>
            </div>
          </>
        ) : expertMode ? (
          <div className={`flex h-full w-full ${tripleMode ? 'flex-col lg:flex-row' : ''}`}>
            <div className={`min-h-0 min-w-0 ${tripleMode ? 'flex-1 border-b lg:border-b-0 lg:border-r border-slate-700' : 'flex-1'}`}>
              {renderPane(leftPane, product, satelliteSelection, 'left', 'expert-main', (mode) => setLeftPane(mode), undefined, (nextSat) => setSatelliteSelection(nextSat))}
            </div>
            <div className={`${tripleMode ? 'hidden lg:block w-px bg-slate-700/80' : 'w-px bg-slate-700/80 '}`} />
            <div className={`min-h-0 min-w-0 ${tripleMode ? 'flex-1 border-b lg:border-b-0 lg:border-r border-slate-700' : 'flex-1'}`}>
              {renderPane(rightPane, product, satelliteSelection, 'right', 'expert-main', (mode) => setRightPane(mode), undefined, (nextSat) => setSatelliteSelection(nextSat))}
            </div>
            {tripleMode && (
              <>
                <div className="hidden lg:block w-px bg-slate-700/80" />
                <div className="min-h-0 min-w-0 flex-1">
                  {renderPane(thirdPane, product, satelliteSelection, 'third', 'expert-main', (mode) => setThirdPane(mode), undefined, (nextSat) => setSatelliteSelection(nextSat))}
                </div>
              </>
            )}
          </div>
        ) : (
          <RadarMap
            {...paneProps}
            mode={tab}
            product={product}
            satelliteSelection={satelliteSelection}
            syncGroup={null}
            playbackIndex={playbackIndex}
            playbackActive={isPlaying && timelineLoopAvailable}
            toolMode={toolMode}
            toolRevision={toolRevision}
            onToolMeasurementsChange={setToolMeasurements}
            onToolDrawingsChange={setToolDrawings}
            onToolModeChange={setToolMode}
          />
        )}
        {product === 'storm_analysis' && !quadMode && !expertMode && tab === 'Radar' && (
          <StormAnalysisPanel siteId={currentSite.id} siteName={currentSite.name} onClose={() => setProduct('ref')} />
        )}
        {volumeInspectorOpen && !quadMode && !expertMode && tab === 'Radar' && (
          <VolumeScanInspector
            siteId={currentSite.id}
            onSelectProduct={selectRadarProduct}
            onSelectTilt={setTilt}
            onSelectMoment={(nextProduct, nextTilt) => {
              // Moment selection must not close the volume inspector: it is the
              // workflow that lets an operator keep exploring elevation cuts.
              setProduct(nextProduct as RadarProduct);
              setTilt(nextTilt);
            }}
            onClose={() => setVolumeInspectorOpen(false)}
          />
        )}
      </div>

      {crossSectionMode && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-xl border border-amber-400/60 bg-slate-950/95 px-4 py-3 text-center text-xs text-amber-100 shadow-2xl">
          <div className="font-black tracking-wide">XSEC TRANSECT SELECTION</div>
          <div className="mt-1 text-[11px] text-slate-300">Click Point A, then click Point B on the map. Press Escape to cancel.</div>
        </div>
      )}
      {crossSectionLoading && (
        <div className="absolute left-1/2 top-1/2 z-[80] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-sky-700 bg-slate-950 px-5 py-4 text-sm font-bold text-sky-200 shadow-2xl">Extracting measured Level II reflectivity gates…</div>
      )}
      {crossSectionError && (
        <div className="absolute left-1/2 top-20 z-[80] -translate-x-1/2 rounded-xl border border-rose-500/60 bg-slate-950 px-4 py-3 text-xs text-rose-200 shadow-2xl">
          <div className="font-bold">XSEC unavailable</div>
          <div className="mt-1">{crossSectionError}</div>
          <button type="button" className="mt-2 rounded bg-slate-800 px-2 py-1 text-slate-100" onClick={() => setCrossSectionError(null)}>Dismiss</button>
        </div>
      )}
      {crossSectionResult && <CrossSectionModal data={crossSectionResult} onClose={() => setCrossSectionResult(null)} />}

      {bottomBarOpen ? (
        <WeatherWiseRadarCard
          mode={quadMode ? (quadPanes[0]?.mode || 'Radar') : expertMode ? leftPane : tab}
          siteId={currentSite.id}
          siteName={currentSite.name}
          product={product}
          tilt={tilt}
          maxRefWindow={maxRefWindow}
          loopAvailable={timelineLoopAvailable}
          frameMetadata={playbackMeta ?? undefined}
          isPlaying={isPlaying}
          onSelectProduct={(p) => {
            selectRadarProduct(p);
            setVolumeInspectorOpen(p === 'volume_scan');
          }}
          onSelectTilt={(t) => setTilt(t)}
          onSelectMaxRefWindow={(w) => setMaxRefWindow(w)}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onClose={() => setBottomBarOpen(false)}
          colorTable={colorTable}
          onChangeColorTable={(tbl) => setColorTable(tbl)}
          showFastScan={showFastScan}
          onToggleFastScan={() => setShowFastScan((v) => !v)}
          showRangeRings={showRangeRings}
          onToggleRangeRings={() => setShowRangeRings((v) => !v)}
          favorites={favoriteProducts}
          onToggleFavorite={(key) => setFavoriteProducts((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])}
          showStormTracks={showStormTracks}
          onToggleStormTracks={() => setShowStormTracks((v) => !v)}
          showRadarPills={showRadarPills}
          onToggleRadarPills={() => { setShowRadarPills((v) => !v); setShowRadarSites((v) => !v); }}
          inspectionMode={inspectionMode}
          onToggleInspection={() => setInspectionMode((v) => !v)}
          satelliteBird={activeSatSel.bird}
          satelliteProductId={activeSatSel.productId}
          onSelectSatelliteBird={(bird) => {
            const b = bird as SatelliteSelection['bird'];
            const sectors = getSectorsForBird(b);
            const next = normalizeSatelliteSelection({ ...activeSatSel, bird: b, sector: sectors.some(s=>s.id===activeSatSel.sector)?activeSatSel.sector:sectors[0]?.id });
            setSatelliteSelection(next);
            if (quadMode) setQuadPanes((prev)=>prev.map((p)=>p.mode==='Satellite'?{...p,satelliteSelection:next}:p));
          }}
          onSelectSatelliteProduct={(id) => {
            const next = normalizeSatelliteSelection({ ...activeSatSel, productId: id as SatelliteSelection['productId'] });
            setSatelliteSelection(next);
            if (quadMode) setQuadPanes((prev)=>prev.map((p)=>p.mode==='Satellite'?{...p,satelliteSelection:next}:p));
          }}
          satelliteProducts={SATELLITE_PRODUCTS.map(p => ({ id: p.id, label: p.shortLabel, available: p.available }))}
          modelId={modelId}
          modelField={modelField}
          modelOptions={MODEL_CATALOG.map(m => ({ id: m.id, label: m.name.split('(')[0].trim(), status: m.status }))}
          modelFieldOptions={activeModel.fields.map(f => ({ id: f.id, label: f.label, status: f.status }))}
          onSelectModel={(id) => { setModelId(id); const m=getModelById(id); if(m && !m.fields.find(f=>f.id===modelField)) setModelField(m.fields[0]?.id||'temp'); }}
          onSelectModelField={(id) => setModelField(id)}
          spcDay={spcDay}
          onSelectSpcDay={(d) => setSpcDay(d as SpcDay)}
          compositeProduct={product}
          onSelectCompositeProduct={selectRadarProduct}
        />
      ) : (
        <button type="button" onClick={() => setBottomBarOpen(true)} className="absolute bottom-14 left-3 z-30 rounded-md border border-slate-700 bg-[#111827] px-3 py-2 text-[11px] font-bold text-slate-200 shadow-xl hover:bg-slate-900">Controls ▴</button>
      )}

      {styledBanner && warningPopup && alertSettings.warningDisplayBehavior !== 'sidebar-only' && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="warning-banner-enter absolute left-1/2 top-24 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border bg-[#0b1220] p-4 text-left shadow-lg"
          style={{ borderColor: styledBanner.color }}
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => { setLocationContext(null); setSelectedAlertId(styledBanner.id); setAlertsOpen(true); }}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: styledBanner.color }}>
                  {ALERT_CATEGORY_META[styledBanner.category].singular}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">{styledBanner.severity}</span>
                {styledBanner.wfo && <span className="text-[11px] font-semibold text-slate-500">{styledBanner.wfo}</span>}
              </div>
              <div className="mt-1 text-sm font-black text-white">{styledBanner.event}</div>
              <div className="mt-1 line-clamp-2 text-xs text-slate-300">{styledBanner.headline}</div>
              <div className="mt-1 truncate text-[11px] text-slate-500">{styledBanner.areaDesc}</div>
              <div className="mt-2 text-[10px] font-bold text-sky-300">Click for detailed warning panel</div>
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Dismiss alert banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}



      {(selectedAlert || alertLocationContext) && (
        <AlertDetailsPanel
          alert={selectedAlert}
          context={alertLocationContext}
          onClose={() => { setSelectedAlertId(null); setLocationContext(null); setAlertPanelPinned(false); }}
          onSelectAlert={(a) => { setSelectedAlertId(a.id); setAlertsOpen(true); }}
          pinned={alertPanelPinned}
          onTogglePin={() => setAlertPanelPinned((v) => !v)}
          onSelectReport={(report) => setSelectedReport(report)}
          onSelectNearestRadar={(site) => {
            setRadarSite(site.id);
            setFocusTarget({ lat: site.lat, lon: site.lon, zoom: 8, ts: Date.now() });
          }}
        />
      )}

      {selectedReport && <ReportDetailPopup report={selectedReport} onClose={() => setSelectedReport(null)} />}

      {toolboxOpen && workspacePanels[overlayMode].toolbox && (
        <div className="absolute bottom-16 right-3 z-40 w-[min(20rem,calc(100vw-1.5rem))]">
          <ToolboxPanel
            toolMode={toolMode}
            onSetToolMode={setToolMode}
            measurements={toolMeasurements}
            drawings={toolDrawings}
            onClearMeasurements={() => { setToolMeasurements([]); setToolRevision((v) => v + 1); }}
            onClearDrawings={() => { setToolDrawings([]); setToolRevision((v) => v + 1); }}
            onUndoDrawing={() => { setToolDrawings((d) => d.slice(0, -1)); }}
            onExportPng={exportMapPng}
            onExportGif={exportMapGif}
            exportBusy={exportBusy}
            exportStatus={exportStatus}
            canExport={true}
            cursor={cursor}
            onCopyCoordinates={() => {
              if (cursor) void navigator.clipboard?.writeText(`${cursor.lat.toFixed(5)}, ${cursor.lon.toFixed(5)}`).catch(() => {});
            }}
          />
        </div>
      )}

      {alertSettingsOpen && (
        <AlertSettingsPanel
          settings={alertSettings}
          onChange={setAlertSettings}
          onClose={() => setAlertSettingsOpen(false)}
        />
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-64 max-w-[min(16rem,85vw)] bg-[#0b1220] border-r border-slate-800 p-3 shadow-lg text-slate-100 overflow-y-auto max-h-screen">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <span className="font-black text-sm tracking-wide text-sky-300">MesoVortex</span>
              <button onClick={() => setMenuOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-1 text-[13px] font-semibold">
              {[
                ['Weather','Weather'],
                ['Alerts','Alerts'],
                ['Spotters','Spotters'],
                ['Reports','Reports'],
                ['Models','Models'],
                ['Satellite','Satellite'],
                ['Tropics','Tropics'],
                ['Discussions','Discussions'],
                ['Surface','Surface Observations'],
                ['METAR','METAR Observations'],
                ['ASOS','ASOS Stations'],
                ['Lightning','Lightning'],
                ['Settings','Settings'],
              ].map(([id,label]) => (
                <button key={id} type="button"
                  onClick={() => {
                    if (id === 'METAR') setSurfaceSource('metar');
                    if (id === 'ASOS') setSurfaceSource('asos');
                    setOpenPanel(id);
                    setMenuOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${openPanel===id ? 'bg-sky-900/30 text-sky-300 border border-sky-700' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-800 pt-3">
              <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Map</div>
              <div className="flex flex-wrap gap-1">
                {([['custom-weather', 'Dark'], ['satellite-streets', 'Satellite'], ['light', 'Light']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { handleSelectBasemap(id); setMenuOpen(false); }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      basemap === id ? 'border-sky-600 bg-sky-900/30 text-sky-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 border-t border-slate-800 pt-3">
              <button
                key="MesoAI"
                type="button"
                data-menu-mesoai="true"
                onClick={() => { setMesoaiOpen((v) => !v); setMenuOpen(false); }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {mesoaiOpen ? 'Hide MesoAI Analysis' : 'Show MesoAI Analysis'}
              </button>
              <button
                key="HazardSeverityIndex"
                type="button"
                data-menu-hsi-toggle="true"
                onClick={() => { setHsiOpen((v) => !v); setMenuOpen(false); }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {hsiOpen ? 'Hide' : 'Show'} Hazard Severity Index (HSI)
              </button>
              <button
                key="ForecasterToolbox"
                type="button"
                data-menu-toolbox="true"
                onClick={() => { setToolboxOpen((v) => !v); setMenuOpen(false); }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {toolboxOpen ? 'Hide' : 'Show'} Forecaster Toolbox
              </button>
              <button
                key="BroadcastWorkspace"
                type="button"
                data-menu-broadcast="true"
                onClick={() => { setBroadcastMode((v) => !v); setMenuOpen(false); }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {broadcastMode ? 'Exit' : 'Enter'} Broadcast Workspace
              </button>
              <a
                href="/about"
                data-menu-about="true"
                onClick={() => setMenuOpen(false)}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                Credits &amp; About
              </a>
            </div>
            <div className="mt-4 border-t border-slate-800 pt-3 text-[10px] text-slate-500">
              Weather data first. Panels open on demand.
            </div>
          </div>
          <div className="flex-1 bg-[#050a12]/80" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      {openPanel && (
        <div className="absolute right-4 top-20 bottom-24 z-40 w-[22rem] max-h-[72vh] overflow-auto rounded-md border border-slate-700 bg-[#111827] p-4 shadow-lg text-slate-100">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[11px] font-black uppercase tracking-wider text-sky-300">{openPanel}</div>
            <button type="button" onClick={() => setOpenPanel(null)} className="rounded-md px-2 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close panel">✕</button>
          </div>

          {openPanel === 'Weather' && (
            <div className="space-y-2 text-[11px] text-slate-300">
              <div><span className="text-slate-500">Active view:</span> {activePaneLabel}</div>
              <div><span className="text-slate-500">Basemap:</span> {basemapStatus}</div>
              <div><span className="text-slate-500">Radar site:</span> {currentSite?.id || radarSite}</div>
              <div className="text-slate-500">Map is primary. Open other panels only when needed.</div>
            </div>
          )}

          {openPanel === 'Surface' && (
            <SurfaceLayersPanel
              layers={surfaceLayers}
              statuses={surfaceLayerStatus}
              counts={surfaceLayerCounts}
              stations={surfaceStationPlots}
              errors={surfaceLayerErrors}
              onToggle={toggleSurfaceLayer}
              onFocusStation={focusSurfaceStation}
            />
          )}

          {(openPanel === 'METAR' || openPanel === 'ASOS') && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMetars}
                  onChange={(e) => { setShowMetars(e.target.checked); setSurfaceLayers((prev) => ({ ...prev, metar: e.target.checked })); }}
                />
                Show stations on map
              </label>
              <div data-surface-source-toggle="true" className="flex gap-1.5">
                {(['metar', 'asos'] as SurfaceSource[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSurfaceSource(value)}
                    className={`flex-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      surfaceSource === value
                        ? 'border-sky-600 bg-sky-900/30 text-sky-300'
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {value === 'metar' ? 'METAR' : 'ASOS'}
                  </button>
                ))}
              </div>
              <METARPanel
                center={mapCenter}
                features={Array.isArray(surfaceGeoJson?.features)
                  ? surfaceGeoJson.features.filter((feature: any) => feature?.properties?.surfaceLayer === (surfaceSource === 'asos' ? 'aviation' : 'metar'))
                  : []}
                source={surfaceSource}
                status={surfaceStatus}
                error={surfaceError}
              />
            </div>
          )}

          {openPanel === 'Alerts' && (
            <div className="space-y-3 text-[11px]">
              <div className="text-slate-400">Fast Alerts controls. Alert polygons remain on map only when enabled.</div>
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showWarnings} onChange={(e)=>setShowWarnings(e.target.checked)} />Warning polygons</label>
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showWatches} onChange={(e)=>setShowWatches(e.target.checked)} />Watch polygons</label>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                {(['warning','watch','advisory','statement','other'] as AlertCategory[]).map((category) => (
                  <label key={category} className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input type="checkbox" checked={alertFilters[category]} onChange={() => toggleAlertFilter(category)} />
                    <span>{ALERT_CATEGORY_META[category].label}</span>
                    <span className="ml-auto text-slate-500">{alertCounts[category] || 0}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={audioEnabled ? disableAudio : enableAudio} className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-black ${audioEnabled ? 'bg-slate-800 text-white' : 'bg-emerald-500 text-slate-950'}`}>{audioEnabled ? 'Mute Tones' : 'Enable Tones'}</button>
                <button type="button" onClick={() => setAlertsOpen(true)} className="flex-1 rounded-lg bg-amber-400 px-2 py-1.5 text-[11px] font-black text-slate-950">Alert Panel</button>
              </div>
              <button type="button" onClick={() => setAlertSettingsOpen(true)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-black text-slate-200 hover:bg-slate-800">⚙ Alert Settings</button>
            </div>
          )}

          {openPanel === 'Spotters' && (
            <div className="space-y-2 text-[11px] text-slate-300">
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showSpotters} onChange={(e)=>setShowSpotters(e.target.checked)} />Spotters</label>
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showSpotterReports} onChange={(e)=>setShowSpotterReports(e.target.checked)} />Spotter Reports</label>
              <div className="grid grid-cols-2 gap-1">
                {[['tornado','Tornado'],['funnel','Funnel Cloud'],['wallCloud','Wall Cloud'],['hail','Hail'],['wind','Wind Damage'],['flooding','Flooding']].map(([key,label]) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={(spotterFilters as any)[key]} onChange={(e)=>setSpotterFilters((prev)=>({...prev,[key]:e.target.checked}))} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="text-[10px] text-slate-500">No permanent map card. Data appears on map only as layers when enabled.</div>
            </div>
          )}

          {openPanel === 'Reports' && (
            <div className="space-y-2 text-[11px] text-slate-300">
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showLSR} onChange={(e)=>setShowLSR(e.target.checked)} />Local Storm Reports</label>
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showSpotterReports} onChange={(e)=>setShowSpotterReports(e.target.checked)} />Spotter Reports</label>
              <div className="text-[10px] text-slate-500">Reports are shown on-map as data layers; details available on click/inspection where supported.</div>
            </div>
          )}

          {openPanel === 'Models' && (
            <div className="space-y-2 text-[11px] text-slate-300">
              <input value={modelSearch} onChange={(e)=>setModelSearch(e.target.value)} placeholder="Search models..." className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200 outline-none placeholder:text-slate-500" />
              <label className="block"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Model</div>
                <select value={modelId} onChange={(e)=>{ setModelId(e.target.value); const m=getModelById(e.target.value); if(m && !m.fields.find(f=>f.id===modelField)) setModelField(m.fields[0]?.id||'temp'); }} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-slate-200 outline-none">
                  {MODEL_CATALOG.filter(m=>{ const q=modelSearch.toLowerCase().trim(); return !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q) || m.id.includes(q); }).map(m=> <option key={m.id} value={m.id}>{m.status==='READY_NOW'?'':'⛔ '}{m.name}</option>)}
                </select></label>
              <label className="block"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Field</div>
                <select value={modelField} onChange={(e)=>setModelField(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-slate-200 outline-none">
                  {activeModel.fields.map(f=> <option key={f.id} value={f.id}>{f.status==='READY_NOW'?'':'⛔ '}{f.label}</option>)}
                </select></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Run</div><select value={modelRun} onChange={(e)=>setModelRun(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"><option value="latest">Latest</option></select></label>
                <label className="block"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Forecast Hour</div><select value={modelForecastHour} onChange={(e)=>setModelForecastHour(Number(e.target.value))} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]">{[0,1,3,6,12,24,48].map(h=> <option key={h} value={h}>F{String(h).padStart(3,'0')}</option>)}</select></label>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-1 text-[10px]">
                <div><span className="text-slate-500">Source:</span> {activeModel.source}</div>
                <div><span className="text-slate-500">Run:</span> {modelRun==='latest'?'Latest available':modelRun}</div>
                <div><span className="text-slate-500">Forecast hour:</span> F{String(modelForecastHour).padStart(3,'0')}</div>
                <div><span className="text-slate-500">Update:</span> {activeModel.updateFrequency || 'Unknown'}</div>
                <div><span className="text-slate-500">Availability:</span> {activeModelField.status==='READY_NOW' ? <span className="text-emerald-300">Available</span> : <span className="text-amber-300">DATA UNAVAILABLE — {activeModelField.note || activeModel.status}</span>}</div>
                <div><span className="text-slate-500">License:</span> {activeModel.license}</div>
              </div>
            </div>
          )}

          {openPanel === 'Satellite' && (
            <div className="space-y-2 text-[11px] text-slate-300">
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Satellite</div>
                  <select value={activeSatSel.bird} onChange={(e)=>{ const bird=e.target.value as SatelliteSelection['bird']; const sectors=getSectorsForBird(bird); const next=normalizeSatelliteSelection({ ...activeSatSel, bird, sector: sectors.some(s=>s.id===activeSatSel.sector)?activeSatSel.sector:sectors[0]?.id }); setSatelliteSelection(next); if(quadMode) setQuadPanes((prev)=>prev.map((p)=>p.mode==='Satellite'?{...p,satelliteSelection:next}:p)); }} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-slate-200 outline-none">
                    {SATELLITE_BIRDS.map((b)=> <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select></label>
                <label className="block"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sector</div>
                  <select value={activeSatSel.sector} onChange={(e)=>{ const next=normalizeSatelliteSelection({ ...activeSatSel, sector: e.target.value as SatelliteSelection['sector'] }); setSatelliteSelection(next); if(quadMode) setQuadPanes((prev)=>prev.map((p)=>p.mode==='Satellite'?{...p,satelliteSelection:next}:p)); }} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-slate-200 outline-none">
                    {getSectorsForBird(activeSatSel.bird).map((s)=> <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select></label>
              </div>
              <label className="block"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Product</div>
                <select value={activeSatSel.productId} onChange={(e)=>{ const next=normalizeSatelliteSelection({ ...activeSatSel, productId: e.target.value as SatelliteSelection['productId'] }); setSatelliteSelection(next); if(quadMode) setQuadPanes((prev)=>prev.map((p)=>p.mode==='Satellite'?{...p,satelliteSelection:next}:p)); }} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-slate-200 outline-none">
                  {['Featured','Visible/IR','Water Vapor','RGB','Channels'].map((group)=>{ const items=SATELLITE_PRODUCTS.filter((p)=>p.group===group); if(!items.length) return null; return <optgroup key={group} label={group}>{items.map((p)=> <option key={p.id} value={p.id}>{p.available ? '' : '⛔ '}{p.label}</option>)}</optgroup>; })}
                </select></label>
              {!activeSatDef.available && <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">DATA UNAVAILABLE — {activeSatDef.unavailableReason || 'No verified real tile source'}</div>}
              <div className="text-[10px] text-slate-500">{activeSatDef.description}</div>
            </div>
          )}

          {openPanel === 'Tropics' && (
            <div className="space-y-2 text-[11px] text-slate-300">
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showHurricanes} onChange={(e)=>setShowHurricanes(e.target.checked)} />Active Tropical Cyclones</label>
              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-1 text-[10px]">
                <div><span className="text-slate-500">Source:</span> NOAA NHC/CPHC official feeds</div>
                <div><span className="text-slate-500">Availability:</span> {showHurricanes ? 'Enabled (data-dependent)' : 'Disabled by user'}</div>
                <div className="text-slate-500">No placeholder storms. Details in Layer Details/Inspector behavior on map click when available.</div>
              </div>
            </div>
          )}

          {openPanel === 'Discussions' && (
            <div className="space-y-2 text-[11px] text-slate-300">
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showMCD} onChange={(e)=>setShowMCD(e.target.checked)} />SPC Mesoscale Discussions</label>
              <div className="text-[10px] text-slate-500">MCD polygons render on map when enabled. No permanent floating diagnostics card.</div>
            </div>
          )}

          {openPanel === 'Lightning' && (
            <div className="space-y-2 text-[11px] text-slate-300">
              <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showLightning} onChange={(e)=>setShowLightning(e.target.checked)} />GLM Lightning</label>
              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-1 text-[10px]">
                <div><span className="text-slate-500">Source:</span> NOAA GOES-R GLM-L2-LCFA (AWS Open Data)</div>
                <div><span className="text-slate-500">Availability:</span> {showLightning ? 'Enabled (data-dependent)' : 'Disabled by user'}</div>
                <div className="text-slate-500">No synthetic lightning. Data unavailable is shown in-layer behavior, not permanent cards.</div>
              </div>
            </div>
          )}

          {openPanel === 'DataSources' && (
            <div className="space-y-3 text-[11px] text-slate-300">
              <div className="text-slate-400">Evidence-based source registry. Status reflects MesoVortexWX implementation/verification, not upstream existence.</div>
              <div className="flex flex-wrap gap-1">
                {(['ALL','IMPLEMENTED','PARTIAL','NOT_IMPLEMENTED'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setDataSourceFilter(s)} className={`rounded-full px-2 py-1 text-[10px] font-bold ${dataSourceFilter===s ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
                    {s === 'ALL' ? 'All' : DATA_SOURCE_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-[55vh] overflow-auto pr-1">
                {DATA_SOURCES.filter((d) => dataSourceFilter === 'ALL' || d.status === dataSourceFilter).map((d) => (
                  <div key={d.id} className="rounded-lg border border-slate-800 bg-[#111827] p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-100">{d.data}</div>
                        <div className="text-[10px] text-slate-400">{d.source}{d.attribution ? ` · ${d.attribution}` : ''}</div>
                      </div>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${d.status==='IMPLEMENTED' ? 'bg-emerald-500/20 text-emerald-300' : d.status==='PARTIAL' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>
                        {DATA_SOURCE_STATUS_LABEL[d.status]}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">{d.category}{d.url ? <> · <a href={d.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">source</a></> : null}</div>
                    {d.notes && <div className="mt-1 text-[10px] text-slate-400">{d.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {openPanel === 'Settings' && (
            <div className="space-y-3 text-[11px] text-slate-300 max-h-[70vh] overflow-auto pr-1">
              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Layers</div>
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showLightning} onChange={(e)=>setShowLightning(e.target.checked)} />Lightning</label>
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showRadarPills} onChange={(e)=>{ setShowRadarPills(e.target.checked); setShowRadarSites(e.target.checked); }} />Secondary Towers / Radar Pills</label>
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showRangeRings} onChange={(e)=>setShowRangeRings(e.target.checked)} />Range rings</label>
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showCounties} onChange={(e)=>setShowCounties(e.target.checked)} />County boundaries</label>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Surface observations</div>
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={surfaceLayers.observations}
                    onChange={(e)=>toggleSurfaceLayer('observations', e.target.checked)}
                  />
                  OBSERVATIONS (all supported networks)
                </label>
                <details>
                  <summary className="cursor-pointer text-[10px] text-slate-400">Network-specific controls (advanced)</summary>
                  <div className="mt-1 space-y-1">
                    {OBSERVATION_MASTER_LAYERS.map((id) => {
                      const layer = SURFACE_LAYERS.find((l) => l.id === id);
                      return (
                        <label key={id} className={`flex items-center gap-2 font-bold ${surfaceLayers.observations ? 'text-slate-500' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={surfaceLayers.observations || surfaceLayers[id]}
                            disabled={surfaceLayers.observations}
                            onChange={(e)=>toggleSurfaceLayer(id, e.target.checked)}
                          />
                          {layer?.name ?? id.toUpperCase()}
                        </label>
                      );
                    })}
                  </div>
                </details>
                <div className="text-[10px] text-slate-500">When OBSERVATIONS is on, every supported network plots together; duplicate stations resolve by source priority. Vendor networks without a verified feed stay DATA UNAVAILABLE.</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Overlay profiles by mode</div>
                {OVERLAY_MODES.map((mode) => (
                  <div key={mode.id} className="rounded border border-slate-800 p-2">
                    <div className="mb-1 text-[10px] font-bold text-sky-300">{mode.label} mode</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {OVERLAY_MODE_FIELDS[mode.id].map((key) => {
                        const field = OVERLAY_FIELDS.find((item) => item.key === key);
                        return (
                          <label key={key} className="flex items-center gap-1 text-[10px]">
                            <input
                              type="checkbox"
                              checked={overlayProfiles[mode.id][key]}
                              onChange={(e) => setOverlayProfiles((prev) => ({ ...prev, [mode.id]: { ...prev[mode.id], [key]: e.target.checked } }))}
                            />
                            {field?.label ?? key}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="text-[10px] text-slate-500">Profiles only hide layers; global switches remain the outer gate.</div>
                <div className="mt-2 border-t border-slate-800 pt-2">
                  <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Workspace panels</div>
                  {OVERLAY_MODES.map((mode) => (
                    <div key={mode.id} className="mb-1 rounded border border-slate-800 p-1.5">
                      <div className="text-[10px] font-bold text-slate-300">{mode.label}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {WORKSPACE_PANEL_FIELDS.map((field) => (
                          <label key={field.key} className="flex items-center gap-1 text-[10px]">
                            <input
                              type="checkbox"
                              checked={workspacePanels[mode.id][field.key]}
                              onChange={(e) => setWorkspacePanels((prev) => ({ ...prev, [mode.id]: { ...prev[mode.id], [field.key]: e.target.checked } }))}
                            />
                            {field.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Velocity Units</div>
                <div className="flex gap-1">
                  {(['mph','knots','kmh'] as const).map(u => (
                    <button key={u} type="button" onClick={()=>setVelocityUnit(u)} className={`rounded-full px-2 py-1 text-[11px] font-bold ${velocityUnit===u?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>{u==='kmh'?'km/h':u}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Color Tables / Palettes</div>
                <label className="block text-[10px] text-slate-500">Reflectivity Palette</label>
                <select value={colorTable} onChange={(e)=>setColorTable(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200 outline-none">
                  <option value="nws">NWS</option><option value="br">BR</option><option value="vel">Velocity</option><option value="cc">CC</option>
                </select>
                <label className="block text-[10px] text-slate-500">Import .pal (Gibson Ridge / NOAA Weather / WX Tools compatible)</label>
                <input type="file" accept=".pal,.txt,text/plain" onChange={async (e)=>{
                  const f=e.target.files?.[0]; if(!f) return;
                  try { const txt=await f.text(); const pal=parsePal(txt, f.name.replace(/\.(pal|txt)$/i,'')); setImportedPal(pal); setImportedPalStatus(`Imported ${pal.name} (${pal.colors.length} colors). Rendering uses existing verified palette pipeline; custom palette mapping is not yet applied to raster tiles.`); }
                  catch { setImportedPal(null); setImportedPalStatus('DATA UNAVAILABLE - could not parse palette file.'); }
                  e.currentTarget.value='';
                }} className="block w-full text-[10px] text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-[10px] file:font-bold file:text-slate-200" />
                {importedPalStatus && <div className="text-[10px] text-slate-400">{importedPalStatus}</div>}
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Warning Settings</div>
                                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={warningPopup} onChange={(e)=>setWarningPopup(e.target.checked)} />Show warning popup details</label>
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={warningVoiceEnabled} onChange={(e)=>setWarningVoiceEnabled(e.target.checked)} />Voice alerts (browser speech)</label>
                <div className="flex gap-1">
                  <button type="button" onClick={()=>setWarningVoicePack('default')} className={`rounded-full px-2 py-1 text-[11px] font-bold ${warningVoicePack==='default'?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>Default voice</button>
                  <button type="button" onClick={()=>setWarningVoicePack('short')} className={`rounded-full px-2 py-1 text-[11px] font-bold ${warningVoicePack==='short'?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>Short voice</button>
                </div>
                <div className="text-[10px] text-slate-500">Default: "The National Weather Service has issued a..." Custom sound files can be added later; no fake audio assets included.</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2">
                <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Map Projection</div>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={()=>handleSelectProjection('mercator')} className={`rounded-lg px-2 py-1.5 text-[11px] font-black ${projectionMode==='mercator'?'bg-slate-100 text-slate-900':'bg-slate-800 text-slate-200'}`}>Flat Map</button>
                  <button type="button" onClick={()=>handleSelectProjection('globe')} className={`rounded-lg px-2 py-1.5 text-[11px] font-black ${projectionMode==='globe'?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>Globe</button>
                </div>
                <div className="mt-2"><div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500"><span>3D Pitch/Tilt</span><span>{mapPitch}°</span></div><input type="range" min={0} max={60} step={5} value={mapPitch} onChange={(e)=>setMapPitch(Number(e.target.value))} className="w-full" /></div>
              </div>
                  <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Expert / Multi-View</div>
                <button type="button" onClick={()=>{ setExpertMode((v)=>!v); setQuadMode(false); }} className={`w-full rounded-lg px-3 py-2 text-xs font-black ${expertMode?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>{expertMode?'Disable Expert Mode':'Enable Expert Mode'}</button>
                <button type="button" onClick={()=>{ setTripleMode((v)=>!v); setExpertMode(true); setQuadMode(false); }} className={`w-full rounded-lg px-3 py-2 text-xs font-black ${tripleMode?'bg-indigo-600 text-white':'bg-slate-800 text-slate-200'}`}>{tripleMode?'Disable Triple View':'Enable Triple View'}</button>
                <button type="button" onClick={()=>{ setQuadMode((v)=>!v); setExpertMode(false); setTripleMode(false); }} className={`w-full rounded-lg px-3 py-2 text-xs font-black ${quadMode?'bg-violet-600 text-white':'bg-slate-800 text-slate-200'}`}>{quadMode?'Disable Quad View':'Enable Quad View'}</button>
                <div className="text-[10px] text-slate-500">Dual/Triple use Expert panes with synced camera. Quad uses 4 synced panes. Product comparison is limited to verified available products per pane.</div>
              </div>

              <ToolboxPanel
                toolMode={toolMode}
                onSetToolMode={setToolMode}
                measurements={toolMeasurements}
                drawings={toolDrawings}
                onClearMeasurements={() => { setToolMeasurements([]); setToolRevision((v)=>v+1); }}
                onClearDrawings={() => { setToolDrawings([]); setToolRevision((v)=>v+1); }}
                onUndoDrawing={() => { setToolDrawings((d)=>d.slice(0,-1)); }}
                onExportPng={exportMapPng}
                onExportGif={exportMapGif}
                exportBusy={exportBusy}
                exportStatus={exportStatus}
                canExport={true}
                cursor={cursor}
                onCopyCoordinates={() => {
                  if (cursor) void navigator.clipboard?.writeText(`${cursor.lat.toFixed(5)}, ${cursor.lon.toFixed(5)}`).catch(() => {});
                }}
              />
            </div>
          )}
        </div>
      )}

      <footer
        className="shrink-0 border-t border-slate-800/40 bg-[#050a12] px-3 py-1 text-center text-[10px] leading-tight text-slate-500"
        aria-label="Workstation footer"
      >
        <p className="mx-auto max-w-4xl px-2 text-slate-500/90">
          Weather data first. Source-scoped, verified, and non-operational.{' '}
          <a href="/about" className="text-slate-400 underline hover:text-white">Credits &amp; About</a>
        </p>
      </footer>
    </div>
  );
}
