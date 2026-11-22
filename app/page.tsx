'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { RadarMap, BasemapType, ModeTab } from '../components/RadarMap';
import { WeatherWiseRadarCard } from '../components/WeatherWiseRadarCard';
import { WeatherWiseAlertsPanel } from '../components/WeatherWiseAlertsPanel';
import { RADAR_SITES } from '../lib/radar-config';
import { useFastAlerts } from '../lib/alerts/use-fast-alerts';
import {
  ALERT_CATEGORY_META,
  alertsToFeatureCollection,
  type AlertCategory,
} from '../lib/alerts/model';
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
const PANE_MODES: PaneMode[] = ['Radar', 'Satellite', 'Composite', 'Models'];

export default function MesoVortexWorkstation() {
  const [tab, setTab] = useState<ModeTab>('Radar');
  const [spcDay, setSpcDay] = useState<SpcDay>('Day 1');
  const [product, setProduct] = useState<RadarProduct>('ref');
  const [tilt, setTilt] = useState('0.5');
  const [radarSite, setRadarSite] = useState('KLZK');
  const [maxRefWindow, setMaxRefWindow] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);

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
  const PANEL_STATE_KEY = 'mesovortex_panel_state_v1';
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PANEL_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.openPanel === 'string' || parsed.openPanel === null) setOpenPanel(parsed.openPanel);
        }
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(PANEL_STATE_KEY, JSON.stringify({ openPanel })); } catch {}
  }, [openPanel]);
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
  const [radarOpacity, setRadarOpacity] = useState(0.88);
  const [smoothing, setSmoothing] = useState(false);
  const [colorTable, setColorTable] = useState('nws');

  const [showLightning, setShowLightning] = useState(true);
  const [showStormTracks, setShowStormTracks] = useState(true);
  const [showRadarSites, setShowRadarSites] = useState(true);
  const [showRadarPills, setShowRadarPills] = useState(true);
  const [showRangeRings, setShowRangeRings] = useState(true);
  const [showCounties, setShowCounties] = useState(true);
  const [showTornadoAnalysis, setShowTornadoAnalysis] = useState(true);
  const [showLSR, setShowLSR] = useState(false);
  const [showWatches, setShowWatches] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);
  const [showMCD, setShowMCD] = useState(true);
  const [showSpotters, setShowSpotters] = useState(true);
  const [showHurricanes, setShowHurricanes] = useState(true);
  const [projectionMode, setProjectionMode] = useState<'mercator' | 'globe'>('mercator');
  const [mapPitch, setMapPitch] = useState(0);
  const [showSpotterReports, setShowSpotterReports] = useState(true);
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

  const [alertsOpen, setAlertsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const currentSite =
    RADAR_SITES.find((s) => s.id === radarSite) || RADAR_SITES[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BASEMAP_STORAGE_KEY) as BasemapType | null;
      if (saved === 'satellite-streets' || saved === 'custom-weather') {
        setBasemap(saved);
        setBasemapStatus(saved === 'satellite-streets' ? 'Satellite Streets (Default)' : 'Custom Weather');
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
    const timer = setInterval(() => {
      setPlaybackIndex((prev) => (prev + 1) % playbackFrames.length);
    }, 900);
    return () => clearInterval(timer);
  }, [isPlaying, playbackFrames.length]);

  const handleSelectBasemap = (selected: BasemapType) => {
    setBasemap(selected);
    setBasemapStatus(selected === 'satellite-streets' ? 'Satellite Streets (Default)' : 'Custom Weather');
    try {
      localStorage.setItem(BASEMAP_STORAGE_KEY, selected);
    } catch {
      // fallback
    }
  };

  // Alerts rendered on the map honor the category filters and visibility toggles.
  const mapAlertFeatures = useMemo(() => {
    const visible = filteredAlerts.filter((alert) => {
      if (alert.category === 'warning') return showWarnings;
      if (alert.category === 'watch') return showWatches;
      return true;
    });
    return alertsToFeatureCollection(visible);
  }, [filteredAlerts, showWarnings, showWatches]);

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
    alertFeatures: mapAlertFeatures,
    onSelectSite: (id: string) => setRadarSite(id),
  } as const;

  const currentPlaybackFrame = playbackFrames[playbackIndex] || null;

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
        <div className="rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-300 shadow-xl backdrop-blur">
          {paneMode}
        </div>
        {paneMode === 'Radar' && (
          <div className="rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1 text-[10px] font-bold text-slate-200 shadow-xl backdrop-blur">
            {paneProduct.toUpperCase()} · {tilt}°
          </div>
        )}
        {paneMode === 'Satellite' && (
          <div className="rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1 text-[10px] font-bold text-slate-200 shadow-xl backdrop-blur">
            {getSatelliteProductDef(paneSatelliteSelection.productId).shortLabel}
          </div>
        )}
        {paneMode === 'Models' && (
          <div className="rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1 text-[10px] font-bold text-slate-200 shadow-xl backdrop-blur">
            {(getModelById(modelId)?.name || modelId).split('(')[0].trim()} · {activeModelField.label}{activeModelField.status !== 'READY_NOW' ? ' · DATA UNAVAILABLE' : ''}
          </div>
        )}
        {isPlaying && playbackFrames.length > 1 && (
          <div className="rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1 text-[10px] font-bold text-amber-300 shadow-xl backdrop-blur">
            {currentPlaybackFrame?.label || 'PLAYBACK'}
          </div>
        )}
      </div>

      {onModeChange && (
        <div className={`absolute left-3 ${compact ? 'top-11' : 'top-12'} z-30 flex flex-wrap items-center gap-1 rounded-xl border border-slate-700 bg-slate-950/90 p-1 shadow-xl backdrop-blur`}>
          {PANE_MODES.map((modeOption) => {
            const active = modeOption === paneMode;
            return (
              <button
                key={modeOption}
                type="button"
                onClick={() => onModeChange(modeOption)}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                  active ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {modeOption}
              </button>
            );
          })}
          {onProductChange && paneMode === 'Radar' && (
            <select
              value={paneProduct}
              onChange={(e) => onProductChange(e.target.value as RadarProduct)}
              className="ml-1 rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10px] font-bold text-slate-200 outline-none"
              aria-label={`Pane ${paneId} product`}
            >
              <option value="ref">REF</option>
              <option value="vel">VEL</option>
              <option value="srvel">SRV</option>
              <option value="cc">CC</option>
              <option value="zdr">ZDR</option>
              <option value="kdp">KDP</option>
              <option value="vil">VIL</option>
              <option value="tops">TOPS</option>
            </select>
          )}
          {onSatelliteSelectionChange && paneMode === 'Satellite' && (
            <select
              value={paneSatelliteSelection.productId}
              onChange={(e) => onSatelliteSelectionChange({ ...paneSatelliteSelection, productId: e.target.value as any })}
              className="ml-1 max-w-[140px] rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10px] font-bold text-slate-200 outline-none"
              aria-label={`Pane ${paneId} satellite product`}
            >
              {SATELLITE_PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>{p.available ? '' : '⛔ '}{p.shortLabel}</option>
              ))}
            </select>
          )}
          {paneMode === 'Models' && (
            <>
              <select
                value={modelId}
                onChange={(e) => { setModelId(e.target.value); const m = getModelById(e.target.value); if (m && !m.fields.find(f=>f.id===modelField)) setModelField(m.fields[0]?.id || 'temp'); }}
                className="ml-1 max-w-[140px] rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10px] font-bold text-slate-200 outline-none"
                aria-label={`Pane ${paneId} model`}
              >
                {MODEL_CATALOG.map((m) => (
                  <option key={m.id} value={m.id}>{m.status === 'READY_NOW' ? '' : '⛔ '}{m.name.split('(')[0].trim()}</option>
                ))}
              </select>
              <select
                value={modelField}
                onChange={(e) => setModelField(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10px] font-bold text-slate-200 outline-none"
                aria-label={`Pane ${paneId} model field`}
              >
                {activeModel.fields.map((f) => (
                  <option key={f.id} value={f.id}>{f.status === 'READY_NOW' ? '' : '⛔ '}{f.label}</option>
                ))}
              </select>
            </>
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
    <div className="relative h-screen w-screen overflow-hidden bg-[#070c14] select-none font-sans text-slate-100">
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

          <div className="flex items-center rounded-full border border-slate-700 bg-slate-950/90 p-0.5 shadow-xl backdrop-blur-md">
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
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-2xl border border-slate-200">
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

            <div className="flex items-center gap-1 font-bold text-xs">
              {(['Radar', 'Composite', 'Satellite', 'Outlooks'] as ModeTab[]).map((modeTab) => (
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
                onClick={() => { setQuadMode((v) => !v); setExpertMode(false); }}
                className={`rounded-full px-3 py-1 transition cursor-pointer flex items-center gap-1 ${
                  quadMode ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Four synchronized panes (desktop/tablet)"
              >
                Quad
              </button>
            </div>
          </div>

          {quadMode ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-slate-950/90 px-3 py-1 shadow-xl border border-slate-700 text-[11px] font-bold text-slate-200 backdrop-blur">
              <span className="text-violet-300">Quad View</span>
              <span className="text-slate-500">•</span>
              <span>4 panes synced</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{isPlaying ? 'playback synced' : 'camera synced'}</span>
            </div>
          ) : expertMode ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-slate-950/90 px-3 py-1 shadow-xl border border-slate-700 text-[11px] font-bold text-slate-200 backdrop-blur">
              <span className="text-cyan-300">Expert Mode</span>
              <span className="text-slate-500">•</span>
              <span>{leftPane}</span>
              <span className="text-slate-500">+</span>
              <span>{rightPane}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{isPlaying ? 'playback synced' : 'synced pan/zoom'}</span>
            </div>
          ) : tab === 'Satellite' ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-slate-950/90 px-3 py-1 shadow-xl border border-slate-700 text-[11px] font-bold text-slate-200 backdrop-blur">
              <span className="text-cyan-300">{SATELLITE_BIRDS.find(b=>b.id===activeSatSel.bird)?.label}</span>
              <span className="text-slate-500">•</span>
              <span>{getSectorsForBird(activeSatSel.bird).find(s=>s.id===activeSatSel.sector)?.label}</span>
              <span className="text-slate-500">•</span>
              <span>{activeSatDef.shortLabel}</span>
              {!activeSatDef.available && <span className="text-amber-300">• DATA UNAVAILABLE</span>}
            </div>
          ) : tab === 'Models' ? (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-slate-950/90 px-3 py-1 shadow-xl border border-slate-700 text-[11px] font-bold text-slate-200 backdrop-blur">
              <span className="text-cyan-300">{activeModel.name.split('(')[0].trim()}</span>
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

        <button
          onClick={() => setAlertsOpen((v) => !v)}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-amber-400 hover:bg-amber-300 px-3 py-1.5 text-slate-950 font-black text-xs shadow-xl border border-amber-300 transition cursor-pointer"
          title="Open Fast Alerts"
        >
          <span>{alerts.length || 0}</span>
          <span>alerts</span>
        </button>
      </div>

      <div className="absolute inset-0 pt-[22px]">
        {quadMode ? (
          <>
            <div className="hidden h-full w-full md:grid md:grid-cols-2 md:grid-rows-2">
              {quadPanes.map((pane, idx) => (
                <div key={idx} className={`min-h-0 min-w-0 ${idx % 2 === 0 ? 'border-r border-slate-700/80' : ''} ${idx < 2 ? 'border-b border-slate-700/80' : ''}`}>
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
              <div className="max-w-sm rounded-2xl border border-slate-700 bg-slate-950/95 p-6 text-center shadow-2xl backdrop-blur">
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
          <div className="flex h-full w-full">
            {renderPane(leftPane, product, satelliteSelection, 'left', 'expert-main', (mode) => setLeftPane(mode), undefined, (nextSat) => setSatelliteSelection(nextSat))}
            <div className="w-px bg-slate-700/80 shadow-[0_0_0_1px_rgba(15,23,42,0.8)]" />
            {renderPane(rightPane, product, satelliteSelection, 'right', 'expert-main', (mode) => setRightPane(mode), undefined, (nextSat) => setSatelliteSelection(nextSat))}
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
          />
        )}
      </div>

      <WeatherWiseRadarCard
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
        gateFilter={gateFilter}
        onChangeGateFilter={(val) => setGateFilter(val)}
        opacity={radarOpacity}
        onChangeOpacity={(val) => setRadarOpacity(val)}
        smoothing={smoothing}
        onToggleSmoothing={() => setSmoothing((v) => !v)}
        colorTable={colorTable}
        onChangeColorTable={(tbl) => setColorTable(tbl)}
        showLightning={showLightning}
        onToggleLightning={() => setShowLightning((v) => !v)}
        showFastScan={showFastScan}
        onToggleFastScan={() => setShowFastScan((v) => !v)}
        showFlashReflectivity={showFlashReflectivity}
        onToggleFlashReflectivity={() => setShowFlashReflectivity((v) => !v)}
        showStormTracks={showStormTracks}
        onToggleStormTracks={() => setShowStormTracks((v) => !v)}
        showRadarSites={showRadarSites}
        onToggleRadarSites={() => {
          setShowRadarSites((v) => !v);
          setShowRadarPills((v) => !v);
        }}
        showRangeRings={showRangeRings}
        onToggleRangeRings={() => setShowRangeRings((v) => !v)}
        showCounties={showCounties}
        onToggleCounties={() => setShowCounties((v) => !v)}
        showTornadoAnalysis={showTornadoAnalysis}
        onToggleTornadoAnalysis={() => setShowTornadoAnalysis((v) => !v)}
        showWarnings={showWarnings}
        onToggleWarnings={() => setShowWarnings((v) => !v)}
        showMCD={showMCD}
        onToggleMCD={() => setShowMCD((v) => !v)}
        showSpotters={showSpotters}
        onToggleSpotters={() => setShowSpotters((v) => !v)}
        showSpotterReports={showSpotterReports}
        onToggleSpotterReports={() => setShowSpotterReports((v) => !v)}
        showSweepAnimation={showSweepAnimation}
        onToggleSweepAnimation={() => setShowSweepAnimation((v) => !v)}
      />

      {banner && (
        <div
          className="absolute left-1/2 top-24 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border bg-slate-950/95 p-4 shadow-2xl backdrop-blur"
          style={{ borderColor: banner.color }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: banner.color }}>
                  {ALERT_CATEGORY_META[banner.category].singular}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">{banner.severity}</span>
                {banner.wfo && <span className="text-[11px] font-semibold text-slate-500">{banner.wfo}</span>}
              </div>
              <div className="mt-1 text-sm font-black text-white">{banner.event}</div>
              <div className="mt-1 line-clamp-2 text-xs text-slate-300">{banner.headline}</div>
              <div className="mt-1 truncate text-[11px] text-slate-500">{banner.areaDesc}</div>
            </div>
            <button
              type="button"
              onClick={dismissBanner}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Dismiss alert banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {alertsOpen && (
        <WeatherWiseAlertsPanel
          alerts={filteredAlerts}
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
          onClose={() => setAlertsOpen(false)}
          onSelectAlert={() => {
            setAlertsOpen(true);
          }}
        />
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 bg-slate-950/98 border-r border-slate-800 p-4 shadow-2xl text-slate-100 overflow-y-auto backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <span className="font-black text-sm tracking-wide text-cyan-300">MesoVortex</span>
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
                ['Settings','Settings'],
              ].map(([id,label]) => (
                <button key={id} type="button"
                  onClick={() => { setOpenPanel(id); setMenuOpen(false); }}
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${openPanel===id ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 border-t border-slate-800 pt-3 text-[10px] text-slate-500">
              Weather data first. Panels open on demand.
            </div>
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      {openPanel && (
        <div className="absolute right-4 top-20 z-40 w-[22rem] max-h-[72vh] overflow-auto rounded-2xl border border-slate-700 bg-slate-950/96 p-4 shadow-2xl backdrop-blur-md text-slate-100">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[11px] font-black uppercase tracking-wider text-cyan-300">{openPanel}</div>
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
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1 text-[10px]">
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
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1 text-[10px]">
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
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1 text-[10px]">
                <div><span className="text-slate-500">Source:</span> NOAA GOES-R GLM-L2-LCFA (AWS Open Data)</div>
                <div><span className="text-slate-500">Availability:</span> {showLightning ? 'Enabled (data-dependent)' : 'Disabled by user'}</div>
                <div className="text-slate-500">No synthetic lightning. Data unavailable is shown in-layer behavior, not permanent cards.</div>
              </div>
            </div>
          )}

          {openPanel === 'Settings' && (
            <div className="space-y-3 text-[11px] text-slate-300">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Map Projection</div>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={()=>setProjectionMode('mercator')} className={`rounded-lg px-2 py-1.5 text-[11px] font-black ${projectionMode==='mercator'?'bg-slate-100 text-slate-900':'bg-slate-800 text-slate-200'}`}>Flat Map</button>
                  <button type="button" onClick={()=>setProjectionMode('globe')} className={`rounded-lg px-2 py-1.5 text-[11px] font-black ${projectionMode==='globe'?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>Globe</button>
                </div>
                <div className="mt-2"><div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500"><span>3D Pitch/Tilt</span><span>{mapPitch}°</span></div><input type="range" min={0} max={60} step={5} value={mapPitch} onChange={(e)=>setMapPitch(Number(e.target.value))} className="w-full" /></div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Expert / Quad</div>
                <button type="button" onClick={()=>{ setExpertMode((v)=>!v); }} className={`w-full rounded-lg px-3 py-2 text-xs font-black ${expertMode?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>{expertMode?'Disable Expert Mode':'Enable Expert Mode'}</button>
                <button type="button" onClick={()=>{ setQuadMode((v)=>!v); }} className={`w-full rounded-lg px-3 py-2 text-xs font-black ${quadMode?'bg-violet-600 text-white':'bg-slate-800 text-slate-200'}`}>{quadMode?'Disable Quad View':'Enable Quad View'}</button>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1">
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showRadarPills} onChange={(e)=>{ setShowRadarPills(e.target.checked); setShowRadarSites(e.target.checked); }} />Radar site pills</label>
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showRangeRings} onChange={(e)=>setShowRangeRings(e.target.checked)} />Range rings</label>
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showCounties} onChange={(e)=>setShowCounties(e.target.checked)} />County boundaries</label>
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={showTornadoAnalysis} onChange={(e)=>setShowTornadoAnalysis(e.target.checked)} />Tornado analysis</label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
