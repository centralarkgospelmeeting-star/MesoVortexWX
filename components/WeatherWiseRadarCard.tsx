'use client';

import { useMemo, useState } from 'react';

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

export type ModeTab = 'Radar' | '3D Radar' | 'Composite' | 'Satellite' | 'Models' | 'Outlooks';

export type Props = {
  mode?: ModeTab | string;
  siteId: string;
  siteName: string;
  product: string;
  tilt: string;
  isPlaying: boolean;
  onSelectProduct: (p: any) => void;
  onSelectTilt: (t: string) => void;
  onTogglePlay: () => void;
  onClose?: () => void;

  maxRefWindow?: number;
  onSelectMaxRefWindow?: (w: number) => void;

  gateFilter?: number;
  onChangeGateFilter?: (val: number) => void;
  opacity?: number;
  onChangeOpacity?: (val: number) => void;
  smoothing?: boolean;
  onToggleSmoothing?: () => void;
  colorTable?: string;
  onChangeColorTable?: (table: string) => void;

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
  showSpotterReports?: boolean;
  onToggleSpotterReports?: () => void;
  showSweepAnimation?: boolean;
  onToggleSweepAnimation?: () => void;
  showFastScan?: boolean;
  onToggleFastScan?: () => void;
  showFlashReflectivity?: boolean;
  onToggleFlashReflectivity?: () => void;

  // Satellite
  satelliteBird?: string;
  satelliteProductId?: string;
  onSelectSatelliteBird?: (bird: string) => void;
  onSelectSatelliteProduct?: (id: string) => void;
  satelliteProducts?: Array<{ id: string; label: string; available: boolean }>;

  // Models
  modelId?: string;
  modelField?: string;
  modelOptions?: Array<{ id: string; label: string; status: string }>;
  modelFieldOptions?: Array<{ id: string; label: string; status: string }>;
  onSelectModel?: (id: string) => void;
  onSelectModelField?: (id: string) => void;

  // Outlooks/Composite
  spcDay?: string;
  onSelectSpcDay?: (day: string) => void;
  compositeProduct?: string;
  onSelectCompositeProduct?: (id: string) => void;

  [key: string]: any;
};

const PRODUCT_GROUPS: {
  category: string;
  items: { key: string; short: string; label: string; iconBg: string; available?: boolean; reason?: string }[];
}[] = [
  {
    category: 'Reflectivity & Swaths',
    items: [
      { key: 'ref', short: 'REF', label: 'Base Reflectivity', iconBg: 'from-blue-600 via-green-500 to-red-600', available: true },
      { key: 'max_ref', short: 'MAX', label: 'Max Reflectivity Swath', iconBg: 'from-amber-400 via-red-600 to-purple-700', available: true },
      { key: 'ref_x', short: 'RFX', label: 'Reflectivity X (Lerp)', iconBg: 'from-cyan-500 via-yellow-400 to-rose-600', available: true },
    ],
  },
  {
    category: 'Velocity & Moments',
    items: [
      { key: 'vel', short: 'VEL', label: 'Base Velocity', iconBg: 'from-emerald-500 via-slate-800 to-red-600', available: true },
      { key: 'srvel', short: 'SRV', label: 'Storm-Relative Velocity', iconBg: 'from-teal-500 via-slate-900 to-rose-600', available: true },
      { key: 'norm_vel', short: 'NRV', label: 'Normalized Rotation/Shear', iconBg: 'from-cyan-600 via-slate-900 to-amber-500', available: false, reason: 'DATA UNAVAILABLE - no verified normalized rotation/shear source; current source duplicates velocity' },
      { key: 'sw', short: 'SW', label: 'Spectrum Width', iconBg: 'from-slate-600 via-blue-500 to-emerald-400', available: false, reason: 'DATA UNAVAILABLE - IEM ridge N0W not verified/rendering for current source' },
    ],
  },
  {
    category: 'Dual-Pol Moments',
    items: [
      { key: 'cc', short: 'CC', label: 'Correlation Coefficient', iconBg: 'from-rose-500 via-purple-600 to-blue-500', available: false, reason: 'DATA UNAVAILABLE - IEM ridge N0C not verified/rendering for current source' },
      { key: 'min_cc', short: 'MCC', label: 'Min CC (TDS Focus)', iconBg: 'from-purple-800 via-rose-600 to-blue-400', available: false, reason: 'DATA UNAVAILABLE - no verified real source' },
      { key: 'zdr', short: 'ZDR', label: 'Differential Reflectivity', iconBg: 'from-purple-500 via-amber-400 to-cyan-400', available: false, reason: 'DATA UNAVAILABLE - IEM ridge N0X not verified/rendering for current source' },
      { key: 'kdp', short: 'KDP', label: 'Specific Diff Phase', iconBg: 'from-cyan-500 via-blue-600 to-teal-400', available: false, reason: 'DATA UNAVAILABLE - IEM ridge N0K not verified/rendering for current source' },
    ],
  },
  {
    category: 'Derived & Vertical Structure',
    items: [
      { key: 'tops', short: 'TOP', label: 'Digital Echo Tops', iconBg: 'from-indigo-600 via-purple-500 to-pink-500', available: true },
      { key: 'vil', short: 'VIL', label: 'Digital VIL (Hail Mass)', iconBg: 'from-amber-500 via-red-600 to-rose-700', available: true },
      { key: 'hhc', short: 'HHC', label: 'Hydrometeor Class', iconBg: 'from-emerald-500 via-yellow-400 to-blue-600', available: false, reason: 'DATA UNAVAILABLE - no verified real IEM ridge tile endpoint for HHC' },
      { key: 'qpe', short: 'QPE', label: '1-Hour Precipitation (DPR)', iconBg: 'from-blue-500 via-cyan-400 to-emerald-400', available: false, reason: 'DATA UNAVAILABLE - no verified real IEM ridge tile endpoint for DPR/QPE' },
    ],
  },
];

const TILTS = ['0.5', '0.9', '1.3', '1.8', '2.4', '3.1'];
const MAX_REF_WINDOWS = [5, 10, 20, 30];

export function WeatherWiseRadarCard({
  mode = 'Radar',
  siteId,
  siteName,
  product,
  tilt,
  isPlaying,
  onSelectProduct,
  onSelectTilt,
  onTogglePlay,
  onClose,
  maxRefWindow = 10,
  onSelectMaxRefWindow,
  colorTable = 'nws',
  onChangeColorTable,
  showSweepAnimation = true,
  onToggleSweepAnimation,
  showFastScan = false,
  onToggleFastScan,
  satelliteBird,
  satelliteProductId,
  onSelectSatelliteBird,
  onSelectSatelliteProduct,
  satelliteProducts = [],
  modelId,
  modelField,
  modelOptions = [],
  modelFieldOptions = [],
  onSelectModel,
  onSelectModelField,
  spcDay = 'Day 1',
  onSelectSpcDay,
  compositeProduct = 'ref',
  onSelectCompositeProduct,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tiltMenuOpen, setTiltMenuOpen] = useState(false);
  const isRadarMode = mode === 'Radar' || mode === '3D Radar';
  const isComposite = mode === 'Composite';
  const isSatellite = mode === 'Satellite';
  const isModels = mode === 'Models';
  const isOutlooks = mode === 'Outlooks';

  const activeLabel = useMemo(() => {
    for (const group of PRODUCT_GROUPS) {
      const item = group.items.find((i) => i.key === product);
      if (item) return item.label;
    }
    return product;
  }, [product]);

  const isMaxRef = product === 'max_ref';

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-30 w-[min(72rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-slate-700/80 bg-slate-950/92 text-slate-100 shadow-2xl backdrop-blur-md font-sans select-none overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400">MesoVortexWX • {mode}</div>
          <div className="truncate text-xs font-bold text-slate-200">
            {isRadarMode ? `${siteId} · ${activeLabel}` : isSatellite ? 'Satellite Controls' : isModels ? 'Model Controls' : isComposite ? 'Composite Controls' : 'Outlook Controls'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {isRadarMode && (
            <>
              <div className="relative">
                <button type="button" onClick={() => setTiltMenuOpen((v) => !v)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold hover:bg-slate-800">Tilt {tilt}°</button>
                {tiltMenuOpen && (
                  <div className="absolute right-0 bottom-full mb-1 w-24 rounded-xl bg-slate-950 shadow-2xl border border-slate-700 p-1 space-y-1 z-40">
                    {TILTS.map((t) => (
                      <button key={t} type="button" onClick={() => { onSelectTilt(t); setTiltMenuOpen(false); }} className={`w-full rounded-lg py-1 text-center text-xs font-bold transition ${tilt === t ? 'bg-cyan-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}>{t}°</button>
                    ))}
                  </div>
                )}
              </div>
              <select value={colorTable} onChange={(e) => onChangeColorTable?.(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-200 outline-none">
                <option value="nws">NWS</option>
                <option value="br">BR</option>
                <option value="vel">VEL</option>
                <option value="cc">CC</option>
              </select>
            </>
          )}
          <button type="button" onClick={onTogglePlay} className="rounded-lg bg-cyan-600 px-2.5 py-1 text-[11px] font-black text-white hover:bg-cyan-500">{isPlaying ? 'Pause' : 'Play'}</button>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold hover:bg-slate-800">{expanded ? 'Less' : 'More'}</button>
          {onClose && <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close control bar">✕</button>}
        </div>
      </div>

      <div className="px-3 py-2">
        {isRadarMode && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_GROUPS.flatMap(g => g.items).map((item) => {
                const active = product === item.key;
                const unavailable = item.available === false;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => { if (!unavailable) onSelectProduct(item.key); }}
                    title={unavailable ? `${item.label} — ${item.reason || 'DATA UNAVAILABLE'}` : item.label}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${active ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200' : unavailable ? 'border-amber-900/40 bg-slate-900/40 text-slate-500 cursor-not-allowed' : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800'}`}
                  >
                    {unavailable ? '⛔ ' : ''}{item.short}
                  </button>
                );
              })}
            </div>

            {expanded && (
              <div className="space-y-2 border-t border-slate-800 pt-2">
                {isMaxRef && onSelectMaxRefWindow && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400 font-bold">Max window:</span>
                    {MAX_REF_WINDOWS.map((w) => (
                      <button key={w} type="button" onClick={() => onSelectMaxRefWindow(w)} className={`rounded-md px-2 py-0.5 font-bold ${maxRefWindow===w ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{w}</button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <button type="button" onClick={onToggleSweepAnimation} className={`rounded-md px-2 py-1 font-bold border ${showSweepAnimation ? 'border-green-500/60 bg-green-500/10 text-green-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>Sweep {showSweepAnimation?'ON':'OFF'}</button>
                  <button type="button" onClick={onToggleFastScan} className={`rounded-md px-2 py-1 font-bold border ${showFastScan ? 'border-amber-500/60 bg-amber-500/10 text-amber-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>Fast Scan {showFastScan?'ON':'OFF'}</button>
                  <span className="text-[10px] text-slate-500 self-center">Fast Scan is a visual ingest indicator; real scan availability depends on source.</span>
                </div>
                <div className="text-[10px] text-slate-500">Map overlays moved to sidebar/drawer panels. Weather data remains primary.</div>
              </div>
            )}
          </div>
        )}

        {isSatellite && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Satellite</span>
              {['goes-east','goes-west'].map((b) => (
                <button key={b} type="button" onClick={() => onSelectSatelliteBird?.(b)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${satelliteBird===b ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{b === 'goes-east' ? 'GOES-East' : 'GOES-West'}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Product</span>
              {(satelliteProducts.length ? satelliteProducts : [
                {id:'visible',label:'Visible',available:true},{id:'ir',label:'Infrared',available:true},{id:'wv-mid',label:'Water Vapor',available:true}
              ]).filter(p=>['visible','ir','wv-mid','wv-upper','wv-lower','ch13','ch02','ch09'].includes(p.id)).slice(0,5).map((p) => (
                <button key={p.id} type="button" onClick={() => p.available && onSelectSatelliteProduct?.(p.id)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${satelliteProductId===p.id ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200' : p.available ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-amber-700/50 bg-slate-900 text-amber-400/70 cursor-not-allowed'}`} title={p.available ? p.label : `${p.label} (DATA UNAVAILABLE)`}>{!p.available ? '⛔ ' : ''}{p.label}</button>
              ))}
            </div>
          </div>
        )}

        {isModels && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Model</span>
              <select value={modelId} onChange={(e) => onSelectModel?.(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-slate-200 outline-none min-w-[14rem]">
                {modelOptions.map((m) => <option key={m.id} value={m.id}>{m.status==='READY_NOW'?'':'⛔ '}{m.label}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Field</span>
              {modelFieldOptions.map((f) => (
                <button key={f.id} type="button" onClick={() => onSelectModelField?.(f.id)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${modelField===f.id ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200' : f.status==='READY_NOW' ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-amber-700/40 bg-slate-900 text-amber-400/70'}`}>
                  {f.status!=='READY_NOW' ? '⛔ ' : ''}{f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isComposite && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Composite</span>
            {[
              {id:'ref', label:'Regional/National Reflectivity'},
              {id:'max_ref', label:'Max Reflectivity Swath'},
            ].map((p) => (
              <button key={p.id} type="button" onClick={() => onSelectCompositeProduct?.(p.id)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${(compositeProduct||product)===p.id ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{p.label}</button>
            ))}
            <span className="text-[10px] text-slate-500">Composite uses real IEM/NEXRAD mosaic where available.</span>
          </div>
        )}

        {isOutlooks && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SPC Outlook</span>
            {['Day 1','Day 2','Day 3'].map((d) => (
              <button key={d} type="button" onClick={() => onSelectSpcDay?.(d)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${spcDay===d ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{d}</button>
            ))}
            <span className="text-[10px] text-slate-500">Categorical outlook displayed on map from real SPC/NWS source.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default WeatherWiseRadarCard;
