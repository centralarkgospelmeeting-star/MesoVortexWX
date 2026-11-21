'use client';

import { useState } from 'react';

export type ProductKey =
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

export type Props = {
  siteId: string;
  siteName: string;
  product: string;
  tilt: string;
  isPlaying: boolean;
  onSelectProduct: (p: any) => void;
  onSelectTilt: (t: string) => void;
  onTogglePlay: () => void;

  // Max Reflectivity Window
  maxRefWindow?: number;
  onSelectMaxRefWindow?: (w: number) => void;

  // Display Controls (All Optional)
  gateFilter?: number;
  onChangeGateFilter?: (val: number) => void;
  opacity?: number;
  onChangeOpacity?: (val: number) => void;
  smoothing?: boolean;
  onToggleSmoothing?: () => void;
  colorTable?: string;
  onChangeColorTable?: (table: string) => void;

  // Map Overlays (All Optional)
  showLightning?: boolean;
  onToggleLightning?: () => void;
  showStormTracks?: boolean;
  onToggleStormTracks?: () => void;
  showRadarSites?: boolean;
  onToggleRadarSites?: () => void;
  showRangeRings?: boolean;
  onToggleRangeRings?: () => void;
  showCounties?: boolean;
  onToggleCounties?: () => void;
  showTornadoAnalysis?: boolean;
  onToggleTornadoAnalysis?: () => void;
  showWarnings?: boolean;
  onToggleWarnings?: () => void;
  showMCD?: boolean;
  onToggleMCD?: () => void;
  showSpotters?: boolean;
  onToggleSpotters?: () => void;
  showSweepAnimation?: boolean;
  onToggleSweepAnimation?: () => void;
  showFastScan?: boolean;
  onToggleFastScan?: () => void;
  showFlashReflectivity?: boolean;
  onToggleFlashReflectivity?: () => void;

  // Advanced Actions (All Optional)
  onOpenComparison?: () => void;
  onOpenCrossSection?: () => void;
  onOpenBeamViz?: () => void;
  onOpen3DAnalysis?: () => void;
  [key: string]: any;
};

const PRODUCT_GROUPS: {
  category: string;
  items: { key: string; short: string; label: string; iconBg: string }[];
}[] = [
  {
    category: 'Reflectivity & Swaths',
    items: [
      { key: 'ref', short: 'REF', label: 'Base Reflectivity', iconBg: 'from-blue-600 via-green-500 to-red-600' },
      { key: 'max_ref', short: 'MAX', label: 'Max Reflectivity Swath', iconBg: 'from-amber-400 via-red-600 to-purple-700' },
      { key: 'ref_x', short: 'RFX', label: 'Reflectivity X (Lerp)', iconBg: 'from-cyan-500 via-yellow-400 to-rose-600' },
    ],
  },
  {
    category: 'Velocity & Moments',
    items: [
      { key: 'vel', short: 'VEL', label: 'Base Velocity', iconBg: 'from-emerald-500 via-slate-800 to-red-600' },
      { key: 'srvel', short: 'SRV', label: 'Storm-Relative Velocity', iconBg: 'from-teal-500 via-slate-900 to-rose-600' },
      { key: 'norm_vel', short: 'NRV', label: 'Normalized Velocity', iconBg: 'from-cyan-600 via-slate-900 to-amber-500' },
      { key: 'sw', short: 'SW', label: 'Spectrum Width', iconBg: 'from-slate-600 via-blue-500 to-emerald-400' },
    ],
  },
  {
    category: 'Dual-Pol Moments',
    items: [
      { key: 'cc', short: 'CC', label: 'Correlation Coefficient', iconBg: 'from-rose-500 via-purple-600 to-blue-500' },
      { key: 'min_cc', short: 'MCC', label: 'Min CC (TDS Focus)', iconBg: 'from-purple-800 via-rose-600 to-blue-400' },
      { key: 'zdr', short: 'ZDR', label: 'Differential Reflectivity', iconBg: 'from-purple-500 via-amber-400 to-cyan-400' },
      { key: 'kdp', short: 'KDP', label: 'Specific Diff Phase', iconBg: 'from-cyan-500 via-blue-600 to-teal-400' },
    ],
  },
  {
    category: 'Derived & Vertical Structure',
    items: [
      { key: 'tops', short: 'TOP', label: 'Digital Echo Tops', iconBg: 'from-indigo-600 via-purple-500 to-pink-500' },
      { key: 'vil', short: 'VIL', label: 'Digital VIL (Hail Mass)', iconBg: 'from-amber-500 via-red-600 to-rose-700' },
      { key: 'hhc', short: 'HHC', label: 'Hydrometeor Class', iconBg: 'from-emerald-500 via-yellow-400 to-blue-600' },
      { key: 'qpe', short: 'QPE', label: '1-Hour Precipitation (DPR)', iconBg: 'from-blue-500 via-cyan-400 to-emerald-400' },
    ],
  },
];

const TILTS = ['0.5', '0.9', '1.3', '1.8', '2.4', '3.1'];
const MAX_REF_WINDOWS = [5, 10, 20, 30];

export function WeatherWiseRadarCard({
  siteId,
  product,
  tilt,
  isPlaying,
  onSelectProduct,
  onSelectTilt,
  onTogglePlay,
  maxRefWindow = 10,
  onSelectMaxRefWindow,
  showWarnings = true,
  onToggleWarnings,
  showMCD = true,
  onToggleMCD,
  showSpotters = false,
  onToggleSpotters,
  showSweepAnimation = true,
  onToggleSweepAnimation,
  showFastScan = false,
  onToggleFastScan,
  showFlashReflectivity = false,
  onToggleFlashReflectivity,
  showLightning = false,
  onToggleLightning,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [tiltMenuOpen, setTiltMenuOpen] = useState(false);

  let activeLabel = 'Base Reflectivity';
  for (const group of PRODUCT_GROUPS) {
    const item = group.items.find((i) => i.key === product);
    if (item) {
      activeLabel = item.label;
      break;
    }
  }

  const isMaxRef = product === 'max_ref';

  return (
    <div className="absolute bottom-5 left-5 z-30 w-[360px] max-h-[82vh] rounded-2xl bg-white/95 text-slate-800 shadow-2xl backdrop-blur-md border border-slate-200/90 font-sans select-none overflow-hidden transition-all flex flex-col">
      {/* Top Header Row */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200/80 bg-slate-50/80">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">MESOVORTEX WX</span>
          <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-900 leading-tight">
            <span>{siteId}</span>
            <span className="text-slate-400">·</span>
            <span className="truncate max-w-[170px]">{activeLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer text-xs"
            title="Expand / Collapse"
          >
            {expanded ? '▾' : '▴'}
          </button>
          <button
            onClick={() => setTiltMenuOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer text-xs"
            title="Elevation Tilts"
          >
            🔲
          </button>
          <button
            onClick={onTogglePlay}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-bold cursor-pointer text-xs"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
          {/* Metadata & Tilt Row */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="text-[11px] text-slate-500 font-medium">
              <div>VCP: 212 Convective ⓘ</div>
              <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Feed Active
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setTiltMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1 font-bold text-slate-700 border border-slate-300 transition cursor-pointer"
              >
                <span>Tilt: {tilt}°</span>
                <span className="text-[10px]">▾</span>
              </button>

              {tiltMenuOpen && (
                <div className="absolute right-0 bottom-full mb-1 w-24 rounded-xl bg-white shadow-2xl border border-slate-200 p-1 space-y-1 z-40">
                  {TILTS.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        onSelectTilt(t);
                        setTiltMenuOpen(false);
                      }}
                      className={`w-full rounded-lg py-1 text-center text-xs font-bold transition cursor-pointer ${
                        tilt === t ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t}°
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rolling Window Selector (Only active on Max Reflectivity) */}
          {isMaxRef && onSelectMaxRefWindow && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-2.5 space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between text-[11px] font-bold text-purple-900">
                <span>Maximum Composite Window:</span>
                <span className="font-mono text-purple-700">{maxRefWindow} Scans</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MAX_REF_WINDOWS.map((w) => (
                  <button
                    key={w}
                    onClick={() => onSelectMaxRefWindow(w)}
                    className={`rounded-lg py-1 text-[11px] font-bold transition cursor-pointer ${
                      maxRefWindow === w
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-purple-800 border border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    {w} Scans
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product Grid */}
          <div className="space-y-3">
            {PRODUCT_GROUPS.map((group) => (
              <div key={group.category} className="space-y-1">
                <span className="text-[9px] font-bold uppercase text-slate-400">{group.category}</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {group.items.map((item) => {
                    const active = product === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => onSelectProduct(item.key)}
                        title={item.label}
                        className={`flex flex-col items-center p-1.5 rounded-xl border transition cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-50/80 shadow-sm ring-1 ring-blue-500'
                            : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100'
                        }`}
                      >
                        <div
                          className={`h-7 w-7 rounded-lg bg-gradient-to-br ${item.iconBg} shadow-inner border border-white/60 mb-0.5 flex items-center justify-center text-[9px] font-black text-white`}
                        >
                          {item.short}
                        </div>
                        <span className={`text-[8.5px] font-bold leading-none truncate w-full text-center ${active ? 'text-blue-700' : 'text-slate-600'}`}>
                          {item.short}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Real-data map overlays */}
          <div className="space-y-1.5 border-t border-slate-200/80 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase text-slate-400">Map Overlays</span>
              <span className="text-[9px] text-slate-400">Real feeds only</span>
            </div>

            <button
              onClick={onToggleWarnings}
              className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 transition cursor-pointer ${
                showWarnings
                  ? 'border-amber-500 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Warning Polygons
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                  showWarnings ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {showWarnings ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              onClick={onToggleMCD}
              className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 transition cursor-pointer ${
                showMCD
                  ? 'border-purple-600 bg-purple-50 text-purple-900'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                SPC Mesoscale Discussions
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                  showMCD ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {showMCD ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              onClick={onToggleSpotters}
              className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 transition cursor-pointer ${
                showSpotters
                  ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Spotter Network
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                  showSpotters ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {showSpotters ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              onClick={onToggleSweepAnimation}
              className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 transition cursor-pointer ${
                showSweepAnimation
                  ? 'border-green-600 bg-green-50 text-green-900'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Radar Sweep Animation
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                  showSweepAnimation ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {showSweepAnimation ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              onClick={onToggleFastScan}
              className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 transition cursor-pointer ${
                showFastScan
                  ? 'border-amber-600 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                FastScan (Ultra-Low Latency)
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                  showFastScan ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {showFastScan ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              onClick={onToggleFlashReflectivity}
              className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 transition cursor-pointer ${
                showFlashReflectivity
                  ? 'border-pink-600 bg-pink-50 text-pink-900'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className="h-2 w-2 rounded-full bg-pink-500" />
                Flash Reflectivity Range
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                  showFlashReflectivity ? 'bg-pink-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {showFlashReflectivity ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              onClick={onToggleLightning}
              className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 transition cursor-pointer ${
                showLightning
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-900'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className="h-2 w-2 rounded-full bg-yellow-400" />
                Synchronized Lightning
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                  showLightning ? 'bg-yellow-500 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {showLightning ? 'ON' : 'OFF'}
              </span>
            </button>

            <p className="text-[9px] leading-snug text-slate-400">
              Warnings/MCDs: real NWS/SPC feeds. Spotters: real Spotter Network feed. Sweep: visual animation. FastScan/Lightning show explicit unavailable state until verified real sources are configured.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeatherWiseRadarCard;
