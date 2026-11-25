'use client';

import { useState } from 'react';
import { getRadarCapability } from '../lib/radar/capability-matrix';
import { getSatelliteCapability } from '../lib/satellite/capability-matrix';
import { MainNavTab, SpcDay } from './MainNavbar';
import { RADAR_SITES } from '../lib/radar-config';
import {
  getCatalogProductViews,
  PRODUCT_DOMAINS,
  categoriesForDomain,
  type ProductDomain,
} from '../lib/radar/product-catalog';

type Props = {
  tab: MainNavTab;
  currentSiteId: string;
  onSelectSite: (id: string) => void;
  product: string;
  onSelectProduct: (p: string) => void;
  tilt: string;
  onSelectTilt: (t: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepFrame: (dir: -1 | 1) => void;
  onGoLive: () => void;
  timestampLabel: string;
  radarOpacity: number;
  onChangeOpacity: (op: number) => void;
  smoothing: boolean;
  onToggleSmoothing: () => void;
  colorTable: string;
  onSelectColorTable: (tbl: string) => void;
  // Overlays
  showLightning: boolean;
  onToggleLightning: () => void;
  showLSR: boolean;
  onToggleLSR: () => void;
  showWatches: boolean;
  onToggleWatches: () => void;
  showStormTracks: boolean;
  onToggleStormTracks: () => void;
  showRadarPills: boolean;
  onToggleRadarPills: () => void;
  showRangeRings: boolean;
  onToggleRangeRings: () => void;
  showCountyBoundaries: boolean;
  onToggleCountyBoundaries: () => void;
  showTornadoAnalysis: boolean;
  onToggleTornadoAnalysis: () => void;
  // Advanced Modals Launcher
  onOpenQuadView?: () => void;
  onOpenCrossSection?: () => void;
  onOpenSkewT?: () => void;
  onOpenMCD?: () => void;
  // Frame Scrubber
  currentFrameIndex?: number;
  totalFrames?: number;
  onScrubFrame?: (idx: number) => void;
  // Outlooks
  spcDay?: SpcDay;
  onSelectSpcDay?: (day: SpcDay) => void;
};

const CATALOG_PRODUCTS = getCatalogProductViews();
const RADAR_PRODUCTS = CATALOG_PRODUCTS.filter((p) => p.domain === 'RADAR');
const COMPOSITE_PRODUCTS = CATALOG_PRODUCTS.filter((p) => p.domain === 'COMPOSITE');

const SATELLITE_PRODUCTS = [
  { key: 'goes_east', capId: 'goes_east', label: 'GOES-East' },
  { key: 'goes_west', capId: 'goes_west', label: 'GOES-West' },
  { key: 'abi_channels', capId: 'abi_channels', label: 'GOES ABI Channels' },
  { key: 'visible', capId: 'visible', label: 'Visible Satellite Imagery' },
  { key: 'clean_ir', capId: 'infrared', label: 'Infrared Satellite Imagery' },
  { key: 'water_vapor', capId: 'water_vapor', label: 'Water Vapor Imagery' },
  { key: 'wv_upper', capId: 'wv_upper', label: 'Upper-Level Water Vapor' },
  { key: 'wv_mid', capId: 'wv_mid', label: 'Mid-Level Water Vapor' },
  { key: 'wv_lower', capId: 'wv_lower', label: 'Lower-Level Water Vapor' },
  { key: 'enhanced_ir', capId: 'enhanced_ir', label: 'Enhanced Infrared Imagery' },
  { key: 'geocolor', capId: 'geocolor', label: 'GeoColor' },
  { key: 'airmass', capId: 'airmass_rgb', label: 'Air Mass RGB' },
  { key: 'dust', capId: 'dust_rgb', label: 'Dust RGB' },
  { key: 'fire_smoke', capId: 'fire_smoke', label: 'Fire and Smoke Imagery' },
  { key: 'cloud_phase', capId: 'cloud_phase', label: 'Cloud-Phase Products' },
  { key: 'day_night', capId: 'day_night', label: 'Day/Night Satellite Imagery' },
  { key: 'glm', capId: 'glm_lightning', label: 'Satellite Lightning Imagery (GLM)' },
  { key: 'fulldisk', capId: 'sector_fulldisk', label: 'Full-Disk Imagery' },
  { key: 'conus', capId: 'sector_conus', label: 'CONUS Imagery' },
  { key: 'mesoscale', capId: 'sector_mesoscale', label: 'Mesoscale Sector Imagery' },
  { key: 'rapid_scan', capId: 'rapid_scan', label: 'One-Minute Rapid-Scan Imagery' },
  { key: 'himawari', capId: 'himawari', label: 'Himawari Coverage' },
  { key: 'meteosat', capId: 'meteosat', label: 'Meteosat Coverage' },
  { key: 'viirs', capId: 'viirs', label: 'VIIRS Polar-Orbiting Satellite Imagery' },
  { key: 'sat_history', capId: 'sat_history', label: 'Satellite History and Playback' },
  { key: 'sat_smoothing', capId: 'sat_smoothing', label: 'Satellite Smoothing and Enhancement' },
  { key: 'sat_custom_color', capId: 'sat_custom_color', label: 'Custom Satellite Color Enhancements' },
  { key: 'sat_cross_section', capId: 'sat_cross_section', label: 'Satellite Cross Sections' },
  { key: 'sat_3d', capId: 'sat_3d', label: 'Three-Dimensional Satellite Visualization' },
  { key: 'sat_radar_compare', capId: 'sat_radar_compare', label: 'Satellite and Radar Comparison' },
  { key: 'sat_atmo_overlays', capId: 'sat_atmo_overlays', label: 'Satellite and Atmospheric-Analysis Overlays' },
];

const FORECAST_MODELS = [
  { id: 'hrrr', name: 'HRRR (High-Res Rapid Refresh 3km)' },
  { id: 'rap', name: 'RAP (Rapid Refresh 13km)' },
  { id: 'nam_nest', name: 'NAM Nest (3km High-Res)' },
  { id: 'gfs', name: 'GFS (0.25° Global)' },
  { id: 'ecmwf', name: 'ECMWF (European Center)' },
];

const MODEL_VARIABLES = [
  { key: 'ref', label: 'Simulated Composite Reflectivity' },
  { key: 'sbcape', label: 'Surface-Based CAPE (SBCAPE)' },
  { key: 'mlcape', label: 'Mixed-Layer CAPE (MLCAPE)' },
  { key: 'srh01', label: '0-1km Storm Relative Helicity' },
  { key: 'temp', label: '2m Surface Temperature' },
  { key: 'dewpt', label: '2m Surface Dew Point' },
  { key: 'pwat', label: 'Precipitable Water (PWAT)' },
  { key: 'h500', label: '500mb Geopotential Heights & Vorticity' },
];

const PRESSURE_LEVELS = ['Surface', '1000 mb', '925 mb', '850 mb', '700 mb', '500 mb', '300 mb', '250 mb'];

const COLOR_TABLES = [
  { id: 'default', name: 'NWS Standard' },
  { id: 'radarscope', name: 'RadarScope Style' },
  { id: 'cod', name: 'College of DuPage (COD)' },
  { id: 'smooth', name: 'Smooth Gradient' },
  { id: 'couplet', name: 'Severe Couplet Enhanced' },
];

export function FloatingProductPanel({
  tab,
  currentSiteId,
  onSelectSite,
  product,
  onSelectProduct,
  tilt,
  onSelectTilt,
  isPlaying,
  onTogglePlay,
  onStepFrame,
  onGoLive,
  timestampLabel,
  radarOpacity,
  onChangeOpacity,
  smoothing,
  onToggleSmoothing,
  colorTable,
  onSelectColorTable,
  showLightning,
  onToggleLightning,
  showLSR,
  onToggleLSR,
  showWatches,
  onToggleWatches,
  showStormTracks,
  onToggleStormTracks,
  showRadarPills,
  onToggleRadarPills,
  showRangeRings,
  onToggleRangeRings,
  showCountyBoundaries,
  onToggleCountyBoundaries,
  showTornadoAnalysis,
  onToggleTornadoAnalysis,
  onOpenQuadView,
  onOpenCrossSection,
  onOpenSkewT,
  onOpenMCD,
  currentFrameIndex = 9,
  totalFrames = 10,
  onScrubFrame,
  spcDay = 'Day 1',
  onSelectSpcDay,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('1x');
  const [selectedModel, setSelectedModel] = useState('hrrr');
  const [selectedVariable, setSelectedVariable] = useState('ref');
  const [selectedPressure, setSelectedPressure] = useState('Surface');
  const [forecastHour, setForecastHour] = useState(0);
  const productTilts = getRadarCapability(product)?.tiltSupport;
  const supportedTilts = productTilts?.length ? productTilts : ['0.5'];

  const renderDomainList = (domain: ProductDomain, items: typeof CATALOG_PRODUCTS, onSelect: (key: string) => void) => {
    const definition = PRODUCT_DOMAINS.find((d) => d.id === domain);
    return (
      <div data-product-domain-group={domain}>
        <div className="mb-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-sky-400">{definition?.label || domain}</div>
          <div className="text-[9px] leading-snug text-slate-500">{definition?.description}</div>
        </div>
        <div className="max-h-64 overflow-auto rounded-md border border-slate-700 bg-[#0f172a]">
          {categoriesForDomain(domain).map((category) => {
            const categoryItems = items.filter((p) => p.category === category);
            if (!categoryItems.length) return null;
            return (
              <div key={category} className="border-b border-slate-700 last:border-b-0">
                <div className="sticky top-0 bg-[#111827] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-700">{category}</div>
                {categoryItems.map((p) => {
                  const active = p.key === product;
                  const unavailable = !p.available;
                  const status = unavailable ? 'DATA UNAVAILABLE' : p.warning ? 'PARTIAL' : 'AVAILABLE';
                  const style = (p.key === 'ref' || p.key === 'max_ref')
                    ? 'bg-gradient-to-br from-emerald-900/60 via-yellow-900/40 to-red-900/50'
                    : (p.key === 'vel' || p.key === 'srvel' || p.key === 'sw')
                    ? 'bg-gradient-to-r from-green-900/50 to-red-900/50'
                    : (p.key === 'cc' || p.key === 'min_cc' || p.key === 'zdr' || p.key === 'kdp')
                    ? 'bg-gradient-to-br from-sky-900/50 via-emerald-900/30 to-amber-900/40'
                    : (p.key === 'azshear' || p.key === 'rotation_tracks')
                    ? 'bg-gradient-to-r from-fuchsia-900/50 to-indigo-900/50'
                    : 'bg-gradient-to-br from-slate-800 to-slate-900';
                  return (
                    <button
                      key={p.key}
                      type="button"
                      disabled={unavailable}
                      data-product-domain={domain}
                      data-product-category={p.category}
                      onClick={() => !unavailable && onSelect(p.key)}
                      title={unavailable ? p.reason : p.warning || p.label}
                      className={`grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 border-t border-slate-700 px-2 py-1.5 text-left first:border-t-0 ${active ? 'bg-[#162033]' : unavailable ? 'opacity-55 cursor-not-allowed' : 'hover:bg-[#162033]'}`}
                    >
                      <div className={`flex h-11 items-center justify-center rounded border ${active ? 'border-sky-600' : 'border-slate-700'} ${style}`}>
                        <span className="text-base font-black tracking-wide text-slate-100">{p.short}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-bold text-slate-200">{p.label}</div>
                        <div className={`text-[9px] font-bold uppercase tracking-wide ${unavailable ? 'text-slate-500' : p.warning ? 'text-amber-300' : 'text-emerald-400'}`}>{status}</div>
                      </div>
                      {active ? <span className="text-[9px] font-black text-sky-300 pr-1">SELECTED</span> : <span className="w-10" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute bottom-4 left-4 z-30 w-80 sm:w-84 max-h-[82vh] flex flex-col rounded-3xl border border-slate-800 bg-[#0b1220] font-sans text-slate-100 shadow-2xl select-none overflow-hidden transition-all">
      {/* Header with Title and Minimize Button (Section 3) */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-900/80">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">
            MESOVORTEX WX
          </span>
          <h2 className="text-xs font-black uppercase text-white">{tab.toUpperCase()} CONTROLS</h2>
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* PLAYBACK CONTROLS (Inside floating panel, per Section 3) */}
          <div className="space-y-2 rounded-md border border-slate-800/80 bg-[#0f172a] p-3">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
              <span>Playback</span>
              <span className="font-mono text-sky-300">{timestampLabel || 'LIVE'}</span>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <button
                onClick={() => onStepFrame(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold transition cursor-pointer"
                title="Previous Frame"
              >
                ◀
              </button>
              <button
                onClick={onTogglePlay}
                className="flex h-8 flex-1 items-center justify-center rounded-md bg-blue-600 font-bold text-white shadow-lg hover:bg-blue-500 transition cursor-pointer"
              >
                {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
              </button>
              <button
                onClick={() => onStepFrame(1)}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold transition cursor-pointer"
                title="Next Frame"
              >
                ▶
              </button>
              <button
                onClick={onGoLive}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
                title="Jump to Live Scan"
              >
                LIVE
              </button>
            </div>

            {/* Timeline Scrubber Slider */}
            {onScrubFrame && totalFrames > 1 && (
              <div className="pt-1">
                <input
                  type="range"
                  min={0}
                  max={totalFrames - 1}
                  value={currentFrameIndex}
                  onChange={(e) => onScrubFrame(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-800 rounded-lg"
                />
              </div>
            )}

            {/* Playback Speed Selection */}
            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
              <span>Speed:</span>
              <div className="flex gap-1">
                {['0.5x', '1x', '2x'].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`rounded-lg px-2 py-0.5 transition cursor-pointer ${
                      playbackSpeed === spd
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* DYNAMIC PRODUCT CONTROLS: RADAR / 3D RADAR */}
          {(tab === 'Radar' || tab === '3D Radar') && (
            <>
              {/* Product Selector — single-site radar products only. */}
              {renderDomainList('RADAR', RADAR_PRODUCTS, onSelectProduct)}

              {/* Station Selector */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Radar Station
                </label>
                <select
                  value={currentSiteId}
                  onChange={(e) => onSelectSite(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
                >
                  {RADAR_SITES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Elevation Beam Tilt */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Elevation Beam Tilt
                </label>
                <div className="grid grid-cols-4 gap-1 font-mono text-[11px] font-bold">
                  {supportedTilts.map((t) => (
                    <button
                      key={t}
                      onClick={() => onSelectTilt(t)}
                      className={`rounded-lg py-1 transition cursor-pointer ${
                        tilt === t
                          ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t}°
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* DYNAMIC PRODUCT CONTROLS: COMPOSITE — multi-radar products only. */}
          {tab === 'Composite' && renderDomainList('COMPOSITE', COMPOSITE_PRODUCTS, onSelectProduct)}

          {/* DYNAMIC PRODUCT CONTROLS: SATELLITE */}
          {tab === 'Satellite' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Satellite Source
                </label>
                <select className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none">
                  <option>GOES-East (CONUS 1km)</option>
                  <option>GOES-West (Pacific / West US)</option>
                  <option>NASA GIBS TrueColor Global</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Imagery Band
                </label>
                <select
                  value={product}
                  onChange={(e) => onSelectProduct(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
                >
                  {SATELLITE_PRODUCTS.map((s) => {
                    const cap = getSatelliteCapability(s.capId);
                    const available = cap?.availability === 'WORKING' || cap?.availability === 'PARTIAL';
                    return (
                      <option key={s.key} value={s.key} disabled={!available}>
                        {!available ? '⛔ ' : cap?.availability === 'PARTIAL' ? '⚠ ' : ''}{s.label}{!available ? ' (DATA UNAVAILABLE)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          )}

          {/* DYNAMIC PRODUCT CONTROLS: MODELS */}
          {tab === 'Models' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Numerical Weather Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
                >
                  {FORECAST_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Atmospheric Variable
                </label>
                <select
                  value={selectedVariable}
                  onChange={(e) => setSelectedVariable(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
                >
                  {MODEL_VARIABLES.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pressure Level
                </label>
                <select
                  value={selectedPressure}
                  onChange={(e) => setSelectedPressure(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
                >
                  {PRESSURE_LEVELS.map((pl) => (
                    <option key={pl} value={pl}>
                      {pl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-300 text-[11px] mb-1">
                  <span>Forecast Hour</span>
                  <span className="font-mono text-sky-400">F{String(forecastHour).padStart(2, '0')}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={48}
                  step={1}
                  value={forecastHour}
                  onChange={(e) => setForecastHour(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC PRODUCT CONTROLS: OUTLOOKS */}
          {tab === 'Outlooks' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Issuing Agency
                </label>
                <select className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none">
                  <option>Storm Prediction Center (SPC)</option>
                  <option>Weather Prediction Center (WPC)</option>
                  <option>National Hurricane Center (NHC)</option>
                  <option>Climate Prediction Center (CPC)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Outlook Product
                </label>
                <select className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none">
                  <option>Categorical Convective Outlook</option>
                  <option>Tornado Probability</option>
                  <option>Damaging Wind Probability</option>
                  <option>Severe Hail Probability</option>
                  <option>Fire Weather Outlook</option>
                  <option>Excessive Rainfall (WPC)</option>
                </select>
              </div>

              {onSelectSpcDay && (
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Forecast Period
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['Day 1', 'Day 2', 'Day 3'] as SpcDay[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => onSelectSpcDay(d)}
                        className={`rounded-lg py-1 font-bold text-[11px] transition cursor-pointer ${
                          spcDay === d ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DISPLAY CONTROLS */}
          <div className="space-y-2.5 border-t border-slate-800 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Display &amp; Styling
            </span>

            {/* Opacity Slider */}
            <div>
              <div className="flex justify-between font-bold text-slate-300 text-[11px] mb-1">
                <span>Opacity</span>
                <span className="font-mono text-sky-400">{Math.round(radarOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={1.0}
                step={0.05}
                value={radarOpacity}
                onChange={(e) => onChangeOpacity(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Smoothing Toggle */}
            <div className="flex items-center justify-between text-slate-300 text-[11px]">
              <span>Radar Smoothing</span>
              <button
                onClick={onToggleSmoothing}
                className={`rounded-lg px-2.5 py-0.5 font-bold transition cursor-pointer ${
                  smoothing ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {smoothing ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Color Table Dropdown */}
            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-400 uppercase">
                Color Palette
              </label>
              <select
                value={colorTable}
                onChange={(e) => onSelectColorTable(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 p-1.5 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
              >
                {COLOR_TABLES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* MAP OVERLAYS CHECKLIST */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Map Overlays
            </span>
            {[
              { label: '⚡ GLM Optical Flashes (GOES-19)', checked: showLightning, toggle: onToggleLightning },
              { label: '🌪️ Local Storm Reports (LSR)', checked: showLSR, toggle: onToggleLSR },
              { label: '🛡️ Severe Watch Boxes', checked: showWatches, toggle: onToggleWatches },
              { label: '↗️ MRMS Rotation Tracks (30-min raster)', checked: showStormTracks, toggle: onToggleStormTracks },
              { label: '📡 Radar Station Badges', checked: showRadarPills, toggle: onToggleRadarPills },
              { label: '⭕ Radar Range Rings (50-150nm)', checked: showRangeRings, toggle: onToggleRangeRings },
              { label: '🗺️ County Boundaries', checked: showCountyBoundaries, toggle: onToggleCountyBoundaries },
              { label: '🎯 Tornado / TVS Analysis', checked: showTornadoAnalysis, toggle: onToggleTornadoAnalysis },
            ].map((item) => (
              <label
                key={item.label}
                className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer text-[11px]"
              >
                <span>{item.label}</span>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={item.toggle}
                  className="accent-cyan-400 h-3.5 w-3.5 rounded cursor-pointer"
                />
              </label>
            ))}
          </div>

          {/* ADVANCED RADAR WORKSTATION TOOLS */}
          <div className="space-y-1.5 border-t border-slate-800 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Workstation Tools
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {onOpenQuadView && (
                <button
                  onClick={onOpenQuadView}
                  className="rounded-md border border-slate-700 bg-slate-900/80 p-2 text-center font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  🔲 Quad Compare
                </button>
              )}
              {onOpenCrossSection && (() => {
                const cap = getRadarCapability('cross_section');
                const available = cap?.availability === 'WORKING' || cap?.availability === 'PARTIAL';
                const reason = !available ? (cap?.unavailableReason || 'DATA UNAVAILABLE - Cross sections not verified.') : undefined;
                return (
                  <button
                    onClick={available ? onOpenCrossSection : undefined}
                    disabled={!available}
                    title={reason}
                    className={`rounded-md border p-2 text-center font-bold transition ${available ? 'border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer' : 'border-slate-800/80 bg-slate-950/40 text-slate-500 cursor-not-allowed'}`}
                  >
                    📐 Cross Section{!available ? ' (Unavailable)' : ''}
                  </button>
                );
              })()}
              {onOpenSkewT && (
                <button
                  onClick={onOpenSkewT}
                  className="rounded-md border border-slate-700 bg-slate-900/80 p-2 text-center font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  📈 Skew-T Sounding
                </button>
              )}
              {onOpenMCD && (
                <button
                  onClick={onOpenMCD}
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-center font-bold text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
                >
                  📝 AI SPC MCD
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
