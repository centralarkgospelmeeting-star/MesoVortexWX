'use client';

import { useState } from 'react';
import { getRadarCapability } from '../lib/radar/capability-matrix';
import { getSatelliteCapability } from '../lib/satellite/capability-matrix';
import { MainNavTab, SpcDay } from './MainNavbar';
import { RADAR_SITES } from '../lib/radar-config';

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

type RadarCategory = 'Reflectivity' | 'Velocity' | 'Dual-Pol' | 'Severe Weather' | 'Derived Products' | 'Research';

const RADAR_PRODUCT_KEYS: Array<{ key: string; capId: string; short: string; label: string; category: RadarCategory }> = [
  { key: 'ref', capId: 'ref', short: 'REF', label: 'Super-Resolution Reflectivity', category: 'Reflectivity' },
  { key: 'max_ref', capId: 'max_ref', short: 'MAX', label: 'Maximum Reflectivity', category: 'Reflectivity' },
  { key: 'vel', capId: 'vel', short: 'VEL', label: 'Super-Resolution Velocity', category: 'Velocity' },
  { key: 'srvel', capId: 'srvel', short: 'SRV', label: 'Storm-Relative Velocity', category: 'Velocity' },
  { key: 'sw', capId: 'sw', short: 'SW', label: 'Spectrum Width', category: 'Velocity' },
  { key: 'cc', capId: 'cc', short: 'CC', label: 'Correlation Coefficient', category: 'Dual-Pol' },
  { key: 'zdr', capId: 'zdr', short: 'ZDR', label: 'Differential Reflectivity', category: 'Dual-Pol' },
  { key: 'kdp', capId: 'kdp', short: 'KDP', label: 'Specific Differential Phase', category: 'Dual-Pol' },
  { key: 'hhc', capId: 'hhc', short: 'HHC', label: 'Hydrometeor Classification', category: 'Dual-Pol' },
  { key: 'min_cc', capId: 'min_cc', short: 'MCC', label: 'Minimum Correlation Coefficient', category: 'Dual-Pol' },
  { key: 'norm_vel', capId: 'nrot', short: 'NROT', label: 'Normalized Rotation', category: 'Severe Weather' },
  { key: 'azshear', capId: 'azshear', short: 'AZ', label: 'Azimuthal Shear', category: 'Severe Weather' },
  { key: 'rotation_tracks', capId: 'rotation_tracks', short: 'TRK', label: 'Rotation Tracks', category: 'Severe Weather' },
  { key: 'hail_detection', capId: 'hail_detection', short: 'HAIL', label: 'Hail Detection / Swaths', category: 'Severe Weather' },
  { key: 'mesh', capId: 'mesh', short: 'MESH', label: 'Maximum Estimated Size of Hail', category: 'Severe Weather' },
  { key: 'tops', capId: 'tops', short: 'ET', label: 'Echo Tops', category: 'Derived Products' },
  { key: 'vil', capId: 'vil', short: 'VIL', label: 'Vertically Integrated Liquid', category: 'Derived Products' },
  { key: 'vil_density', capId: 'vil_density', short: 'VILD', label: 'VIL Density', category: 'Derived Products' },
  { key: 'qpe', capId: 'qpe', short: 'QPE', label: 'Precipitation Rate / QPE', category: 'Derived Products' },
  { key: 'precip_rate', capId: 'precip_rate', short: 'RATE', label: 'Precipitation Rate', category: 'Derived Products' },
  { key: 'rain_mix_snow', capId: 'rain_mix_snow', short: 'RMS', label: 'Rain/Mix/Snow Intensity', category: 'Derived Products' },
  { key: 'cross_section', capId: 'cross_section', short: 'XSEC', label: 'Reflectivity Cross Sections', category: 'Research' },
  { key: 'gate_filter', capId: 'gate_filter', short: 'GATE', label: 'Reflectivity Gate Filtering', category: 'Research' },
  { key: 'storm_analysis', capId: 'storm_analysis', short: 'ANLZ', label: 'Radar-Derived Storm Analysis', category: 'Research' },
  { key: 'volume_scan', capId: 'volume_scan', short: 'VOL', label: 'Volume Scans / Elevation Selection', category: 'Research' },
  { key: 'tilt_selection', capId: 'tilt_selection', short: 'TILT', label: 'Individual Tilt Selection', category: 'Research' },
];

const RADAR_CATEGORIES: RadarCategory[] = ['Reflectivity', 'Velocity', 'Dual-Pol', 'Severe Weather', 'Derived Products', 'Research'];

function radarProductsWithAvailability() {
  return RADAR_PRODUCT_KEYS.map((p) => {
    const cap = getRadarCapability(p.capId);
    const available = cap?.availability === 'WORKING' || cap?.availability === 'PARTIAL';
    const reason = !available ? (cap?.unavailableReason || 'DATA UNAVAILABLE - No verified source.') : undefined;
    const warning = cap?.availability === 'PARTIAL' ? 'PARTIAL - Limited verification' : undefined;
    return { ...p, available, reason, warning };
  });
}
const RADAR_PRODUCTS = radarProductsWithAvailability();

const COMPOSITE_PRODUCTS = [
  { key: 'comp_ref', label: 'Composite Reflectivity (N0Q)' },
];

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
              {/* Product Selector */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Radar Product</label>
                  <span className="text-[9px] text-slate-500">Name / Code / Status</span>
                </div>
                <div className="max-h-52 overflow-auto rounded-md border border-slate-800 bg-[#0f172a]">
                  {RADAR_CATEGORIES.map((category) => {
                    const items = RADAR_PRODUCTS.filter((p) => p.category === category);
                    if (!items.length) return null;
                    return (
                      <div key={category} className="border-b border-slate-800/80 last:border-b-0">
                        <div className="sticky top-0 bg-slate-950/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">{category}</div>
                        {items.map((p) => {
                          const active = p.key === product;
                          const unavailable = !p.available;
                          const status = unavailable ? 'DATA UNAVAILABLE' : p.warning ? 'PARTIAL' : 'AVAILABLE';
                          return (
                            <button
                              key={p.key}
                              type="button"
                              disabled={unavailable}
                              onClick={() => !unavailable && onSelectProduct(p.key)}
                              title={unavailable ? p.reason : p.warning || p.label}
                              className={`grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 border-t border-slate-800/40 px-2.5 py-1 text-left text-[11px] first:border-t-0 ${active ? 'bg-sky-900/30 text-slate-100' : unavailable ? 'text-slate-500 cursor-not-allowed' : 'text-slate-200 hover:bg-slate-800/70'}`}
                            >
                              <span className={`font-mono text-[10px] ${active ? 'text-sky-300' : 'text-slate-400'}`}>{p.short}</span>
                              <span className="truncate">{p.label}</span>
                              <span className={`text-[9px] font-bold uppercase tracking-wide ${unavailable ? 'text-slate-500' : p.warning ? 'text-amber-300' : 'text-emerald-400'}`}>{status}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

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

          {/* DYNAMIC PRODUCT CONTROLS: COMPOSITE */}
          {tab === 'Composite' && (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Composite Product
              </label>
              <select
                value={product}
                onChange={(e) => onSelectProduct(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
              >
                {COMPOSITE_PRODUCTS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              { label: '⚡ Blitzortung Live Lightning', checked: showLightning, toggle: onToggleLightning },
              { label: '🌪️ Local Storm Reports (LSR)', checked: showLSR, toggle: onToggleLSR },
              { label: '🛡️ Severe Watch Boxes', checked: showWatches, toggle: onToggleWatches },
              { label: '↗️ SCIT Storm Tracks', checked: showStormTracks, toggle: onToggleStormTracks },
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
