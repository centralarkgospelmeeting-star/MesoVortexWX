'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { RadarMap, BasemapType, ModeTab } from '../components/RadarMap';
import { WeatherWiseRadarCard } from '../components/WeatherWiseRadarCard';
import { ToolboxPanel } from '../components/map-tools/ToolboxPanel';
import { WeatherWiseAlertsPanel } from '../components/WeatherWiseAlertsPanel';
import { AlertSettingsPanel } from '../components/AlertSettingsPanel';
import { RADAR_SITES } from '../lib/radar-config';
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
import { DEFAULT_ALERT_SETTINGS, loadAlertSettings, saveAlertSettings, applyAlertSettingsToAlert, shouldSpeakAlert, formatAlertSpeech, alertSoundForEvent, profileAllowsTone, type AlertSettings } from '../lib/alerts/settings';

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
  | 'qpe';

type SpcDay = 'Day 1' | 'Day 2' | 'Day 3';
type PaneMode = 'Radar' | 'Satellite' | 'Composite' | 'Models';

const BASEMAP_STORAGE_KEY = 'mesovortex_basemap_preference';
const PROJECTION_STORAGE_KEY = 'mesovortex_projection_mode';
const PREFS_STORAGE_KEY = 'mesovortex_preferences_v1';
const PANE_MODES: PaneMode[] = ['Radar', 'Satellite', 'Composite', 'Models'];

type UserPrefs = {
  projectionMode: 'mercator' | 'globe';
  showRangeRings: boolean;
  radarOpacity: number;
  smoothing: boolean;
  playbackSpeed: 0.5 | 1 | 2;
  playbackDirection: 'forward' | 'backward';
  loopPauseMs: number;
  favorites: string[];
  product: RadarProduct;
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
  showStormTracks: boolean;
  showCounties: boolean;
  showTornadoAnalysis: boolean;
  showHurricanes: boolean;
  alertsOpen: boolean;
  alertSidebarState: 'open' | 'closed';
};

const DEFAULT_PREFS: UserPrefs = {
  projectionMode: 'globe',
  showRangeRings: false,
  radarOpacity: 0.88,
  smoothing: false,
  playbackSpeed: 1,
  playbackDirection: 'forward',
  loopPauseMs: 500,
  favorites: ['ref', 'vel', 'srvel', 'cc'],
  product: 'ref',
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
    return {
      ...DEFAULT_PREFS,
      ...p,
      projectionMode: proj,
      showRangeRings: typeof p.showRangeRings === 'boolean' ? p.showRangeRings : DEFAULT_PREFS.showRangeRings,
      radarOpacity: Number.isFinite(p.radarOpacity) ? Math.max(0.2, Math.min(1, Number(p.radarOpacity))) : DEFAULT_PREFS.radarOpacity,
      smoothing: typeof p.smoothing === 'boolean' ? p.smoothing : DEFAULT_PREFS.smoothing,
      playbackSpeed: speed,
      playbackDirection: dir,
      loopPauseMs,
      favorites: Array.isArray(p.favorites) ? p.favorites.filter((x): x is string => typeof x === 'string') : DEFAULT_PREFS.favorites,
      product: typeof p.product === 'string' ? (p.product as RadarProduct) : DEFAULT_PREFS.product,
      radarSite: typeof p.radarSite === 'string' ? p.radarSite : DEFAULT_PREFS.radarSite,
      colorTable: typeof p.colorTable === 'string' ? p.colorTable : DEFAULT_PREFS.colorTable,
      alertsOpen: typeof p.alertsOpen === 'boolean' ? p.alertsOpen : DEFAULT_PREFS.alertsOpen,
      alertSidebarState: p.alertSidebarState === 'open' ? 'open' : 'closed',
    } as UserPrefs;
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function MesoVortexWorkstation() {
  const initialPrefs = useMemo(() => loadUserPrefs(), []);
  const [tab, setTab] = useState<ModeTab>('Radar');
  const [spcDay, setSpcDay] = useState<SpcDay>('Day 1');
  const [product, setProduct] = useState<RadarProduct>(initialPrefs.product);
  const [tilt, setTilt] = useState('0.5');
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
  const [playbackIndex, setPlaybackIndex] = useState(0);

  const [basemap, setBasemap] = useState<BasemapType>('satellite-streets');
  const [basemapStatus, setBasemapStatus] = useState('Satellite Streets (Default)');

  const [gateFilter, setGateFilter] = useState(5);
  const [radarOpacity, setRadarOpacity] = useState(initialPrefs.radarOpacity);
  const [smoothing, setSmoothing] = useState(initialPrefs.smoothing);
  const [colorTable, setColorTable] = useState(initialPrefs.colorTable);
  const [velocityUnit, setVelocityUnit] = useState<'mph' | 'knots' | 'kmh'>('mph');
  const [warningFlash, setWarningFlash] = useState(true);
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
  const [mapPitch, setMapPitch] = useState(0);
  const [showSpotterReports, setShowSpotterReports] = useState(initialPrefs.showSpotterReports);
  const [spotterFilters, setSpotterFilters] = useState({
    tornado: true,
    funnel: true,
    wallCloud: true,
    hail: true,
    wind: true,
    flooding: true,
  });
  const [showSweepAnimation, setShowSweepAnimation] = useState(true);
  const [showFastScan, setShowFastScan] = useState(false);
  const [showFlashReflectivity, setShowFlashReflectivity] = useState(false);
  const [flashRange, setFlashRange] = useState<[number, number]>([60, 80]);
  const [inspectionMode, setInspectionMode] = useState(false);
  const [toolMode, setToolMode] = useState<'none'|'measure-distance'|'measure-area'|'draw-point'|'draw-line'|'draw-polygon'|'annotate'>('none');
  const [toolRevision, setToolRevision] = useState(0);
  const [toolMeasurements, setToolMeasurements] = useState<Array<{id:string;kind:'distance'|'area';label:string;value:string;points:Array<[number,number]>}>>([]);
  const [toolDrawings, setToolDrawings] = useState<Array<{id:string;kind:'point'|'line'|'polygon'|'annotation';label?:string;points:Array<[number,number]>;color:string}>>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [tripleMode, setTripleMode] = useState(false);
  const [thirdPane, setThirdPane] = useState<PaneMode>('Composite');
  const spokenBannerIdRef = useRef<string | null>(null);
  const playedSoundBannerIdRef = useRef<string | null>(null);

  const [alertsOpen, setAlertsOpen] = useState(initialPrefs.alertsOpen);
  const [alertSettingsOpen, setAlertSettingsOpen] = useState(false);
  const [favoriteProducts, setFavoriteProducts] = useState<string[]>(initialPrefs.favorites);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [locationContext, setLocationContext] = useState<{ lat: number; lon: number; ts: number } | null>(null);
  const [spotterReportsForContext, setSpotterReportsForContext] = useState<any[]>([]);
  const [mcdFeaturesForContext, setMcdFeaturesForContext] = useState<any[]>([]);

  useEffect(() => {
    try {
      const prefs: UserPrefs = {
        ...DEFAULT_PREFS,
        projectionMode,
        showRangeRings,
        radarOpacity,
        smoothing,
        playbackSpeed,
        playbackDirection,
        loopPauseMs,
        favorites: favoriteProducts,
        product,
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
        showStormTracks,
        showCounties,
        showTornadoAnalysis,
        showHurricanes,
        alertsOpen,
        alertSidebarState: alertsOpen ? 'open' : 'closed',
      };
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }, [projectionMode, showRangeRings, radarOpacity, smoothing, playbackSpeed, playbackDirection, loopPauseMs, favoriteProducts, product, radarSite, colorTable, showRadarPills, showLightning, showLSR, showWatches, showWarnings, showMCD, showSpotters, showSpotterReports, showStormTracks, showCounties, showTornadoAnalysis, showHurricanes, alertsOpen]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dataSourceFilter, setDataSourceFilter] = useState<'ALL' | DataSourceStatus>('ALL');

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
    banner,
    dismissBanner,
    lastUpdated,
    error: alertError,
    loading: alertsLoading,
    refresh: refreshAlerts,
  } = useFastAlerts();

  useEffect(() => {
    if (!banner) return;
    const speakEnabled = alertSettings.speech.enabled || warningVoiceEnabled;
    if (!speakEnabled) return;
    if (spokenBannerIdRef.current === banner.id) return;
    if (!shouldSpeakAlert(banner.event, banner.category, { ...alertSettings, speech: { ...alertSettings.speech, enabled: true } }) && !(warningVoiceEnabled && !alertSettings.speech.enabled)) return;
    // If using legacy toggle only, allow warning categories as before; prefer alertSettings rules.
    const allow = alertSettings.speech.enabled
      ? shouldSpeakAlert(banner.event, banner.category, alertSettings)
      : warningVoiceEnabled;
    if (!allow) return;
    spokenBannerIdRef.current = banner.id;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const text = alertSettings.speech.enabled
      ? formatAlertSpeech(banner.event, banner.areaDesc, banner.senderName)
      : (warningVoicePack === 'short' ? `${banner.event}.` : `The National Weather Service has issued a ${banner.event}${banner.areaDesc ? ` for ${banner.areaDesc}` : ''}.`);
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1; u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch {}
  }, [banner, warningVoiceEnabled, warningVoicePack, alertSettings]);

  useEffect(() => {
    if (!banner) return;
    if (playedSoundBannerIdRef.current === banner.id) return;
    if (!profileAllowsTone(alertSettings.soundProfile)) return;
    const custom = alertSoundForEvent(banner.event, alertSettings);
    if (!custom) return;
    playedSoundBannerIdRef.current = banner.id;
    try {
      const audio = new Audio(custom);
      audio.volume = 0.9;
      void audio.play().catch(() => {});
    } catch {}
  }, [banner, alertSettings]);

  const currentSite =
    RADAR_SITES.find((s) => s.id === radarSite) || RADAR_SITES[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BASEMAP_STORAGE_KEY) as BasemapType | null;
      if (saved === 'satellite-streets' || saved === 'custom-weather') {
        setBasemap(saved);
        setBasemapStatus(saved === 'satellite-streets' ? 'Satellite Streets (Default)' : 'Custom Weather');
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
        setPlaybackIndex((prev) => (frames.length ? Math.min(prev, frames.length - 1) : 0));
      } catch {
        if (!cancelled) setPlaybackFrames([]);
      }
    };
    load();
    const timer = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [currentSite.radarId]);

  useEffect(() => {
    if (!isPlaying || playbackFrames.length < 2) return;
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
  }, [isPlaying, playbackFrames.length, playbackSpeed, playbackDirection, loopPauseMs]);

  const handleSelectBasemap = (selected: BasemapType) => {
    setBasemap(selected);
    setBasemapStatus(selected === 'satellite-streets' ? 'Satellite Streets (Default)' : 'Custom Weather');
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
  const styledBanner = useMemo(() => (banner ? applyAlertSettingsToAlert(banner, alertSettings) : null), [banner, alertSettings]);

  // Alerts rendered on the map honor the category filters and visibility toggles.
  const mapAlertFeatures = useMemo(() => {
    const visible = styledFilteredAlerts.filter((alert) => {
      if (alert.category === 'warning') return showWarnings;
      if (alert.category === 'watch') return showWatches;
      return true;
    });
    return alertsToFeatureCollection(visible);
  }, [styledFilteredAlerts, showWarnings, showWatches]);

  const selectedAlert = useMemo(() => styledAlerts.find((a) => a.id === selectedAlertId) || null, [styledAlerts, selectedAlertId]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [repRes, mcdRes] = await Promise.all([
          fetch('/api/spotters/reports', { cache: 'no-store' }).catch(() => null),
          fetch('/api/spc/mcd', { cache: 'no-store' }).catch(() => null),
        ]);
        if (cancelled) return;
        if (repRes?.ok) {
          const d = await repRes.json().catch(() => null);
          setSpotterReportsForContext(Array.isArray(d?.features) ? d.features : []);
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
    return buildLocationContext(locationContext.lat, locationContext.lon, styledAlerts, RADAR_SITES as any, spotterReportsForContext, mcdFeaturesForContext);
  }, [locationContext, styledAlerts, spotterReportsForContext, mcdFeaturesForContext]);

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
    showWatches,
    showWarnings,
    showMCD,
    showSpotters,
    showSpotterReports,
    showHurricanes,
    projectionMode,
    mapPitch,
    modelId,
    modelField,
    modelRun,
    modelForecastHour,
    spotterFilters,
    showSweepAnimation,
    showFastScan,
    showFlashReflectivity,
    flashRange,
    inspectionMode,
    alertFeatures: mapAlertFeatures,
    alertOutlineThickness: alertSettings.outlineThickness,
    onSelectWarningFromMap: (w: any) => {
      const id = String(w?.id || '');
      if (id) { setSelectedAlertId(id); setAlertsOpen(true); }
    },
    onMapContextClick: (lat: number, lon: number) => {
      setLocationContext({ lat, lon, ts: Date.now() });
      if (alertSettings.sidebarAutoHide && !alertSettings.sidebarPinned) setAlertsOpen(false);
      else setAlertsOpen(true);
    },
    focusTarget,
    onSelectSite: (id: string) => setRadarSite(id),
  } as const;

  const currentPlaybackFrame = playbackFrames[playbackIndex] || null;

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
            {paneProduct.toUpperCase()} · {tilt}°
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
        {isPlaying && playbackFrames.length > 1 && (
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
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold transition ${active ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                {modeOption}
              </button>
            );
          })}
          {onProductChange && paneMode === 'Radar' && (
            <select value={paneProduct} onChange={(e) => onProductChange(e.target.value as RadarProduct)} className="ml-0.5 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[9px] font-bold text-slate-200 outline-none" aria-label={`Pane ${paneId} product`}>
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
        playbackActive={isPlaying && playbackFrames.length > 1}
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

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0b1220] font-sans text-slate-100 selection:bg-cyan-500/30">
      <aside aria-label="Product legend" className="flex h-[22px] shrink-0 items-center justify-between border-t border-slate-800 bg-slate-950 px-3 text-[9px] font-mono">
        <span className="font-bold text-slate-400 whitespace-nowrap">
          {product === 'max_ref' ? `MAX REF (${maxRefWindow} scans)` :
           product === 'ref' ? 'REF (dBZ)' :
           product === 'ref_x' ? 'REF X (dBZ)' :
           product === 'vel' ? 'VEL (kt)' :
           product === 'srvel' ? 'SRV (kt)' :
           product === 'cc' ? 'CC' :
           product === 'zdr' ? 'ZDR (dB)' :
           product === 'kdp' ? 'KDP (deg/km)' :
           product === 'tops' ? 'TOPS (kft)' :
           product === 'vil' ? 'VIL (kg/m\u00b2)' :
           product.toUpperCase()}
        </span>
        <div className="mx-2 flex h-2 w-72 overflow-hidden rounded border border-slate-700">
          <div className="flex-1 bg-[#04e9e7]" />
          <div className="flex-1 bg-[#019ff4]" />
          <div className="flex-1 bg-[#0300f4]" />
          <div className="flex-1 bg-[#02fd02]" />
          <div className="flex-1 bg-[#01c501]" />
          <div className="flex-1 bg-[#008e00]" />
          <div className="flex-1 bg-[#fdf802]" />
          <div className="flex-1 bg-[#e5bc00]" />
          <div className="flex-1 bg-[#fd9500]" />
          <div className="flex-1 bg-[#fd0000]" />
          <div className="flex-1 bg-[#d40000]" />
          <div className="flex-1 bg-[#f800fd]" />
          <div className="flex-1 bg-[#9854c6]" />
          <div className="flex-1 bg-[#ffffff]" />
        </div>
        <span className="text-slate-400">5 · 15 · 30 · 45 · 60 · 70+</span>
      </aside>

      <div className="pointer-events-none absolute top-7 left-0 right-0 z-40 flex items-center justify-between px-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-xl hover:bg-amber-300 transition font-black text-lg border border-amber-300 cursor-pointer"
            title="Menu & Layer Selector"
          >
            ☰
          </button>

          <div className="flex items-center rounded-full border border-slate-700 bg-[#0b1220] p-0.5 shadow-xl">
            <button
              onClick={() => handleSelectBasemap('satellite-streets')}
              className={`rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer ${
                basemap === 'satellite-streets'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => handleSelectBasemap('custom-weather')}
              className={`rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer ${
                basemap === 'custom-weather'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-center">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-lg border border-slate-200">
            <div
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 pr-2 border-r border-slate-200 font-black text-xs text-slate-900 cursor-pointer hover:opacity-80 transition"
            >
              <Image
                src="/logo.png"
                alt="MesoVortex Wx"
                width={26}
                height={26}
                className="rounded-full shadow-sm"
                priority
              />
              <span>MesoVortex</span>
              <span className="text-[10px] text-slate-400">▾</span>
            </div>

            <button
              type="button"
              onClick={() => { setSearchOpen((v) => !v); setSearchResults([]); }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
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
                    setExpertMode(false);
                    setQuadMode(false);
                  }}
                  className={`rounded-full px-3 py-1 transition cursor-pointer flex items-center gap-1 ${
                    !expertMode && !quadMode && tab === modeTab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {modeTab}
                </button>
              ))}
              <button
                onClick={() => { setExpertMode((v) => !v); setQuadMode(false); }}
                className={`rounded-full px-3 py-1 transition cursor-pointer flex items-center gap-1 ${
                  expertMode ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Pair any two modes side-by-side with synchronized camera movement"
              >
                Expert
              </button>
              <button
                onClick={() => { setTripleMode((v)=>!v); setExpertMode(true); setQuadMode(false); }}
                className={`rounded-full px-3 py-1 transition cursor-pointer flex items-center gap-1 ${
                  tripleMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Three synchronized panes (Expert layout)"
              >
                Triple
              </button>
              <button
                onClick={() => { setQuadMode((v) => !v); setExpertMode(false); setTripleMode(false); }}
                className={`rounded-full px-3 py-1 transition cursor-pointer flex items-center gap-1 ${
                  quadMode ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Four synchronized panes (desktop/tablet)"
              >
                Quad
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="mt-2 w-[min(32rem,calc(100vw-2rem))] rounded-md border border-slate-700 bg-[#111827] p-3 shadow-lg text-slate-100">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => { const v=e.target.value; setSearchQuery(v); runSearch(v); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); } if (e.key === 'Enter' && searchResults[0]) handleSearchSelect(searchResults[0]); }}
                  placeholder="City, ZIP, airport, radar site, lat/lon, county, state..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="rounded-lg px-2 py-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close search">✕</button>
              </div>
              <div className="mt-1 text-[10px] text-slate-500">Supports: Cities, ZIP codes, Airports, Radar sites, Lat/Lon, Counties, States</div>
              <div className="mt-2 max-h-64 overflow-auto space-y-1">
                {searchBusy && <div className="px-2 py-1 text-xs text-slate-400">Searching...</div>}
                {!searchBusy && searchQuery.trim() && searchResults.length === 0 && <div className="px-2 py-1 text-xs text-slate-500">No results.</div>}
                {searchResults.map((r, i) => (
                  <button key={`${r.type}-${r.label}-${i}`} type="button" onClick={() => handleSearchSelect(r)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-slate-800">
                    <span className="text-xs text-slate-200 truncate pr-2">{r.label}</span>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-sky-400">{r.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {quadMode ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#0b1220] px-3 py-1 shadow-xl border border-slate-700 text-[11px] font-bold text-slate-200">
              <span className="text-violet-300">Quad View</span>
              <span className="text-slate-500">•</span>
              <span>4 panes synced</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{isPlaying ? 'playback synced' : 'camera synced'}</span>
            </div>
          ) : expertMode ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#0b1220] px-3 py-1 shadow-xl border border-slate-700 text-[11px] font-bold text-slate-200">
              <span className="text-sky-300">Expert Mode</span>
              <span className="text-slate-500">•</span>
              <span>{leftPane}</span>
              <span className="text-slate-500">+</span>
              <span>{rightPane}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{isPlaying ? 'playback synced' : 'synced pan/zoom'}</span>
            </div>
          ) : tab === 'Satellite' ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#0b1220] px-3 py-1 shadow-xl border border-slate-700 text-[11px] font-bold text-slate-200">
              <span className="text-sky-300">{SATELLITE_BIRDS.find(b=>b.id===activeSatSel.bird)?.label}</span>
              <span className="text-slate-500">•</span>
              <span>{getSectorsForBird(activeSatSel.bird).find(s=>s.id===activeSatSel.sector)?.label}</span>
              <span className="text-slate-500">•</span>
              <span>{activeSatDef.shortLabel}</span>
              {!activeSatDef.available && <span className="text-amber-300">• DATA UNAVAILABLE</span>}
            </div>
          ) : tab === 'Models' ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#0b1220] px-3 py-1 shadow-xl border border-slate-700 text-[11px] font-bold text-slate-200">
              <span className="text-sky-300">{activeModel.name.split('(')[0].trim()}</span>
              <span className="text-slate-500">•</span>
              <span>{activeModelField.label}</span>
              <span className="text-slate-500">•</span>
              <span className={activeModelField.status==='READY_NOW' ? 'text-emerald-300' : 'text-amber-300'}>{activeModelField.status==='READY_NOW' ? 'VERIFIED' : 'DATA UNAVAILABLE'}</span>
            </div>
          ) : tab === 'Outlooks' ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-xl border border-slate-200 text-xs font-bold text-slate-700">
              <span className="px-1">Categorical</span>
              <span className="text-slate-300">|</span>
              {(['Day 1', 'Day 2', 'Day 3'] as SpcDay[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setSpcDay(d)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] transition cursor-pointer ${
                    spcDay === d ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-amber-400 px-1.5 py-1 shadow-xl border border-amber-300">
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
      </div>

      <div className="relative min-h-0 flex-1 pt-[22px] pb-10">
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
            playbackActive={isPlaying && playbackFrames.length > 1}
            toolMode={toolMode}
            toolRevision={toolRevision}
            onToolMeasurementsChange={setToolMeasurements}
            onToolDrawingsChange={setToolDrawings}
            onToolModeChange={setToolMode}
          />
        )}
      </div>

      {bottomBarOpen ? (
        <WeatherWiseRadarCard
          mode={quadMode ? (quadPanes[0]?.mode || 'Radar') : expertMode ? leftPane : tab}
          siteId={currentSite.id}
          siteName={currentSite.name}
          product={product}
          tilt={tilt}
          maxRefWindow={maxRefWindow}
          isPlaying={isPlaying}
          onSelectProduct={(p) => setProduct(p as RadarProduct)}
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
          onSelectCompositeProduct={(id) => setProduct(id as RadarProduct)}
        />
      ) : (
        <button type="button" onClick={() => setBottomBarOpen(true)} className="absolute bottom-14 left-3 z-30 rounded-md border border-slate-700 bg-[#111827] px-3 py-2 text-[11px] font-bold text-slate-200 shadow-xl hover:bg-slate-900">Controls ▴</button>
      )}

      {styledBanner && warningPopup && alertSettings.warningDisplayBehavior !== 'sidebar-only' && (
        <button
          type="button"
          onClick={() => { setSelectedAlertId(styledBanner.id); setAlertsOpen(true); }}
          className={`absolute left-1/2 top-24 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border bg-[#0b1220] p-4 text-left shadow-lg ${warningFlash ? 'animate-pulse' : ''}`}
          style={{ borderColor: styledBanner.color }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
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
            </div>
            <span
              onClick={(e) => { e.stopPropagation(); dismissBanner(); }}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Dismiss alert banner"
              role="button"
              tabIndex={0}
            >
              ✕
            </span>
          </div>
        </button>
      )}

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
          onSelectAlert={(a) => { setSelectedAlertId(a.id); setAlertsOpen(true); }}
          selectedAlertId={selectedAlertId}
          pinned={alertSettings.sidebarPinned}
          onTogglePinned={() => setAlertSettings((s) => ({ ...s, sidebarPinned: !s.sidebarPinned }))}
          sortMode={alertSettings.sortMode}
          onChangeSortMode={(mode) => setAlertSettings((s) => ({ ...s, sortMode: mode }))}
          filterMode={alertSettings.filterMode}
          onChangeFilterMode={(mode) => setAlertSettings((s) => ({ ...s, filterMode: mode }))}
        />
      )}

      {(selectedAlert || alertLocationContext) && (
        <AlertDetailsPanel
          alert={selectedAlert}
          context={alertLocationContext}
          onClose={() => { setSelectedAlertId(null); setLocationContext(null); }}
          onSelectAlert={(a) => { setSelectedAlertId(a.id); setAlertsOpen(true); }}
        />
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
          <div className="w-72 bg-[#0b1220] border-r border-slate-800 p-4 shadow-lg text-slate-100 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <span className="font-black text-sm tracking-wide text-sky-300">MesoVortex</span>
              <button onClick={() => setMenuOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-1 text-sm font-semibold">
              {[
                ['Weather','Weather'],
                ['Alerts','Alerts'],
                ['Spotters','Spotters'],
                ['Reports','Reports'],
                ['Models','Models'],
                ['Satellite','Satellite'],
                ['Tropics','Tropics'],
                ['Discussions','Discussions'],
                ['Lightning','Lightning'],
                ['DataSources','Data Sources'],
                ['Settings','Settings'],
              ].map(([id,label]) => (
                <button key={id} type="button"
                  onClick={() => { setOpenPanel(id); setMenuOpen(false); }}
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${openPanel===id ? 'bg-sky-900/30 text-sky-300 border border-sky-700' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                  {label}
                </button>
              ))}
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
                  <button key={s} type="button" onClick={() => setDataSourceFilter(s)} className={`rounded-md px-2 py-1 text-[10px] font-bold ${dataSourceFilter===s ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
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
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${d.status==='IMPLEMENTED' ? 'bg-emerald-500/20 text-emerald-300' : d.status==='PARTIAL' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>
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

              <div className="rounded-lg border border-slate-800 bg-[#111827] p-2 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Velocity Units</div>
                <div className="flex gap-1">
                  {(['mph','knots','kmh'] as const).map(u => (
                    <button key={u} type="button" onClick={()=>setVelocityUnit(u)} className={`rounded-md px-2 py-1 text-[11px] font-bold ${velocityUnit===u?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>{u==='kmh'?'km/h':u}</button>
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
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={warningFlash} onChange={(e)=>setWarningFlash(e.target.checked)} />Flash warning polygons/banners</label>
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={warningPopup} onChange={(e)=>setWarningPopup(e.target.checked)} />Show warning popup details</label>
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={warningVoiceEnabled} onChange={(e)=>setWarningVoiceEnabled(e.target.checked)} />Voice alerts (browser speech)</label>
                <div className="flex gap-1">
                  <button type="button" onClick={()=>setWarningVoicePack('default')} className={`rounded-md px-2 py-1 text-[11px] font-bold ${warningVoicePack==='default'?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>Default voice</button>
                  <button type="button" onClick={()=>setWarningVoicePack('short')} className={`rounded-md px-2 py-1 text-[11px] font-bold ${warningVoicePack==='short'?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>Short voice</button>
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
              />
            </div>
          )}
        </div>
      )}

      <footer
        className="shrink-0 border-t border-slate-800/40 bg-[#050a12] px-3 py-1 text-center text-[10px] leading-tight text-slate-500"
        aria-label="Creator note"
      >
        <p className="mx-auto max-w-4xl px-2 text-slate-500/90">
          &ldquo;He sends the lightning with the rain and brings out the wind from his storehouses.&rdquo; <span className="text-slate-600">&mdash; Psalm 135:7</span>
        </p>
      </footer>
    </div>
  );
}
