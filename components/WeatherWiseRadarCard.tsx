'use client';

import { useMemo, useState } from 'react';

export type ModeTab = 'Radar' | '3D Radar' | 'Composite' | 'Satellite' | 'Models' | 'Outlooks';

type ProductItem = { key: string; short: string; label: string; available?: boolean; reason?: string };

const RADAR_PRODUCTS: ProductItem[] = [
  { key: 'ref', short: 'REF', label: 'Base Reflectivity', available: true },
  { key: 'max_ref', short: 'MAX', label: 'Max Reflectivity Swath', available: true },
  { key: 'ref_x', short: 'RFX', label: 'Reflectivity X (Lerp)', available: true },
  { key: 'vel', short: 'VEL', label: 'Base Velocity', available: true },
  { key: 'srvel', short: 'SRV', label: 'Storm-Relative Velocity', available: true },
  { key: 'norm_vel', short: 'NRV', label: 'Normalized Rotation/Shear', available: false, reason: 'DATA UNAVAILABLE - no verified normalized rotation/shear source; duplicates velocity' },
  { key: 'sw', short: 'SW', label: 'Spectrum Width', available: false, reason: 'DATA UNAVAILABLE - unverified IEM ridge source' },
  { key: 'cc', short: 'CC', label: 'Correlation Coefficient', available: false, reason: 'DATA UNAVAILABLE - unverified IEM ridge source' },
  { key: 'min_cc', short: 'MCC', label: 'Min CC', available: false, reason: 'DATA UNAVAILABLE - no verified real source' },
  { key: 'zdr', short: 'ZDR', label: 'Differential Reflectivity', available: false, reason: 'DATA UNAVAILABLE - unverified IEM ridge source' },
  { key: 'kdp', short: 'KDP', label: 'Specific Diff Phase', available: false, reason: 'DATA UNAVAILABLE - unverified IEM ridge source' },
  { key: 'tops', short: 'TOP', label: 'Digital Echo Tops', available: true },
  { key: 'vil', short: 'VIL', label: 'Digital VIL', available: true },
  { key: 'hhc', short: 'HHC', label: 'Hydrometeor Class', available: false, reason: 'DATA UNAVAILABLE - no verified real endpoint' },
  { key: 'qpe', short: 'QPE', label: '1-Hour Precipitation (DPR)', available: false, reason: 'DATA UNAVAILABLE - no verified real endpoint' },
];

const TILTS = ['0.5','0.9','1.3','1.8','2.4','3.1'];

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
  showRadarPills?: boolean;
  onToggleRadarPills?: () => void;
  inspectionMode?: boolean;
  onToggleInspection?: () => void;
  maxRefWindow?: number;
  onSelectMaxRefWindow?: (w: number) => void;
  colorTable?: string;
  onChangeColorTable?: (table: string) => void;
  showFastScan?: boolean;
  onToggleFastScan?: () => void;
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

export function WeatherWiseRadarCard({
  mode = 'Radar',
  siteId,
  product,
  tilt,
  isPlaying,
  onSelectProduct,
  onSelectTilt,
  onTogglePlay,
  onClose,
  showRadarPills = true,
  onToggleRadarPills,
  inspectionMode = false,
  onToggleInspection,
  maxRefWindow = 10,
  onSelectMaxRefWindow,
  colorTable = 'nws',
  onChangeColorTable,
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
  const isRadarMode = mode === 'Radar' || mode === '3D Radar';
  const isSatellite = mode === 'Satellite';
  const isModels = mode === 'Models';
  const isComposite = mode === 'Composite';
  const isOutlooks = mode === 'Outlooks';

  const activeProduct = useMemo(() => RADAR_PRODUCTS.find(p => p.key === product) || { key: product, short: product.toUpperCase(), label: product, available: true }, [product]);

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-30 font-sans text-slate-100 select-none">
      {expanded && (
        <div className="mb-2 w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(60vh,32rem)] overflow-auto rounded-2xl border border-slate-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400">{mode} Controls</div>
            <button type="button" onClick={() => setExpanded(false)} className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close drawer">✕</button>
          </div>
          <div className="p-3 space-y-3 text-xs">
            {isRadarMode && (
              <>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Product</div>
                  <div className="max-h-56 overflow-auto rounded-lg border border-slate-800 bg-slate-900/40">
                    {RADAR_PRODUCTS.map((p) => {
                      const active = p.key === product;
                      const unavailable = p.available === false;
                      return (
                        <button key={p.key} type="button" disabled={unavailable} onClick={() => !unavailable && onSelectProduct(p.key)}
                          title={unavailable ? p.reason : p.label}
                          className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] border-b border-slate-800/60 last:border-b-0 ${active ? 'bg-cyan-500/15 text-cyan-200' : unavailable ? 'text-slate-500 cursor-not-allowed' : 'text-slate-200 hover:bg-slate-800'}`}>
                          <span>{unavailable ? '⛔ ' : ''}{p.label}</span>
                          <span className="text-[10px] text-slate-500">{p.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tilt</div>
                  <div className="flex flex-wrap gap-1">
                    {TILTS.map((t) => (
                      <button key={t} type="button" onClick={() => onSelectTilt(t)} className={`rounded-md px-2 py-1 text-[11px] font-bold ${tilt===t ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{t}°</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Palette</div>
                  <select value={colorTable} onChange={(e)=>onChangeColorTable?.(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200 outline-none">
                    <option value="nws">NWS</option><option value="br">BR</option><option value="vel">Velocity</option><option value="cc">CC</option>
                  </select>
                </div>
                {product === 'max_ref' && onSelectMaxRefWindow && (
                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Max Ref Window</div>
                    <div className="flex gap-1">{[5,10,20,30].map(w => <button key={w} type="button" onClick={()=>onSelectMaxRefWindow(w)} className={`rounded-md px-2 py-1 text-[11px] font-bold ${maxRefWindow===w?'bg-purple-600 text-white':'bg-slate-800 text-slate-300'}`}>{w}</button>)}</div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={showFastScan} onChange={onToggleFastScan} />Fast Scan (ingest indicator)</label>
              </>
            )}

            {isSatellite && (
              <>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Satellite</div>
                  <div className="flex gap-1">
                    {['goes-east','goes-west'].map(b => <button key={b} type="button" onClick={()=>onSelectSatelliteBird?.(b)} className={`rounded-md px-2 py-1 text-[11px] font-bold ${satelliteBird===b?'bg-cyan-600 text-white':'bg-slate-800 text-slate-300'}`}>{b==='goes-east'?'GOES-East':'GOES-West'}</button>)}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Product</div>
                  <div className="space-y-1">
                    {(satelliteProducts.length ? satelliteProducts : [{id:'visible',label:'Visible',available:true},{id:'ir',label:'Infrared',available:true},{id:'wv-mid',label:'Water Vapor',available:true}]).map(p => (
                      <button key={p.id} type="button" disabled={!p.available} onClick={()=>p.available&&onSelectSatelliteProduct?.(p.id)} className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] ${satelliteProductId===p.id?'bg-cyan-500/15 text-cyan-200':'text-slate-200 hover:bg-slate-800'} ${!p.available?'opacity-50 cursor-not-allowed':''}`}>
                        <span>{!p.available?'⛔ ':''}{p.label}</span>{satelliteProductId===p.id && <span className="text-cyan-400">●</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {isModels && (
              <>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Model</div>
                  <div className="max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-900/40">
                    {modelOptions.map(m => (
                      <button key={m.id} type="button" onClick={()=>onSelectModel?.(m.id)} className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] border-b border-slate-800/60 last:border-b-0 ${modelId===m.id?'bg-cyan-500/15 text-cyan-200':'text-slate-200 hover:bg-slate-800'}`}>
                        <span>{m.status!=='READY_NOW'?'⛔ ':''}{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Field</div>
                  <div className="grid grid-cols-2 gap-1">
                    {modelFieldOptions.map(f => (
                      <button key={f.id} type="button" onClick={()=>onSelectModelField?.(f.id)} className={`rounded-md px-2 py-1.5 text-[11px] font-bold text-left ${modelField===f.id?'bg-cyan-600 text-white':f.status==='READY_NOW'?'bg-slate-800 text-slate-200 hover:bg-slate-700':'bg-slate-900 text-slate-500'}`}>{f.status!=='READY_NOW'?'⛔ ':''}{f.label}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {isComposite && (
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Composite Product</div>
                {[{id:'ref',label:'Regional/National Reflectivity'},{id:'max_ref',label:'Max Reflectivity Swath'}].map(p => (
                  <button key={p.id} type="button" onClick={()=>onSelectCompositeProduct?.(p.id)} className={`flex w-full rounded-md px-2.5 py-1.5 text-[11px] mb-1 ${compositeProduct===p.id?'bg-cyan-500/15 text-cyan-200':'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>{p.label}</button>
                ))}
              </div>
            )}

            {isOutlooks && (
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">SPC Outlook Day</div>
                <div className="flex gap-1">{['Day 1','Day 2','Day 3'].map(d => <button key={d} type="button" onClick={()=>onSelectSpcDay?.(d)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold ${spcDay===d?'bg-cyan-600 text-white':'bg-slate-800 text-slate-200'}`}>{d}</button>)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-950/94 px-2.5 py-2 shadow-2xl backdrop-blur-md">
        <div className="min-w-0 pr-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{isRadarMode ? 'Radar Site' : mode}</div>
          <div className="text-xs font-black text-white leading-tight">{isRadarMode ? siteId : (isSatellite ? 'Satellite' : isModels ? 'Models' : isComposite ? 'Composite' : 'Outlooks')}</div>
        </div>
        <div className="min-w-0 border-l border-slate-800 pl-2 pr-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{isRadarMode ? 'Product' : 'Selection'}</div>
          <div className="max-w-[10rem] truncate text-xs font-bold text-slate-200">{isRadarMode ? activeProduct.label : isSatellite ? (satelliteProductId||'') : isModels ? (modelField||'') : isOutlooks ? spcDay : (compositeProduct||'Reflectivity')}</div>
        </div>

        {isRadarMode && (
          <button type="button" onClick={onToggleInspection} title="Inspection / Sampling Tool" className={`rounded-lg px-2 py-1.5 text-[11px] font-bold border ${inspectionMode ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>◎</button>
        )}

        <button type="button" onClick={onTogglePlay} title={isPlaying ? 'Pause' : 'Play'} className="rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-cyan-500">{isPlaying ? '❚❚' : '▶'}</button>
        <button type="button" onClick={onTogglePlay} title="Loop" className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold ${isPlaying ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>↻</button>

        {isRadarMode && (
          <button type="button" onClick={onToggleRadarPills} title="Radar Tower Pills Toggle" className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold ${showRadarPills ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>⌖</button>
        )}

        <button type="button" onClick={() => setExpanded(v=>!v)} title={expanded ? 'Collapse' : 'Expand'} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-800">{expanded ? '▾' : '▴'}</button>
        {onClose && <button type="button" onClick={onClose} className="rounded-lg px-1.5 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close controls">✕</button>}
      </div>
    </div>
  );
}

export default WeatherWiseRadarCard;
