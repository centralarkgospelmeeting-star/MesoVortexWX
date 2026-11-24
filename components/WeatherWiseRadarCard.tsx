'use client';

import { useMemo, useState } from 'react';
import { getRadarCapability, type RadarProductCapability } from '../lib/radar/capability-matrix';
import { getSatelliteCapability } from '../lib/satellite/capability-matrix';

export type ModeTab = 'Radar' | '3D Radar' | 'Composite' | 'Satellite' | 'Models' | 'Outlooks';

type ProductItem = {
  key: string;
  short: string;
  label: string;
  available: boolean;
  reason?: string;
  warning?: string;
};

type RadarProductDef = { key: string; capId: string; short: string; label: string; category: 'Reflectivity' | 'Velocity' | 'Dual-Pol' | 'Severe Weather' | 'Derived Products' | 'Research' };

const PRODUCT_KEYS: RadarProductDef[] = [
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
  { key: 'hail_detection', capId: 'hail_detection', short: 'HAIL', label: 'Hail Severity Index (SHI)', category: 'Severe Weather' },
  { key: 'mesh', capId: 'mesh', short: 'MESH', label: 'Maximum Estimated Size of Hail', category: 'Severe Weather' },
  { key: 'tops', capId: 'tops', short: 'ET', label: 'Echo Tops', category: 'Derived Products' },
  { key: 'vil', capId: 'vil', short: 'VIL', label: 'Vertically Integrated Liquid', category: 'Derived Products' },
  { key: 'vil_density', capId: 'vil_density', short: 'VILD', label: 'VIL Density', category: 'Derived Products' },
  { key: 'qpe', capId: 'qpe', short: 'QPE', label: '1-Hour MultiSensor QPE', category: 'Derived Products' },
  { key: 'precip_rate', capId: 'precip_rate', short: 'RATE', label: 'Precipitation Rate', category: 'Derived Products' },
  { key: 'rain_mix_snow', capId: 'rain_mix_snow', short: 'RMS', label: 'Surface Precipitation Type', category: 'Derived Products' },
  { key: 'cross_section', capId: 'cross_section', short: 'XSEC', label: 'Reflectivity Cross Sections', category: 'Research' },
  { key: 'gate_to_gate_shear', capId: 'gate_to_gate_shear', short: 'GATE', label: 'Gate-to-Gate Velocity Shear', category: 'Research' },
  { key: 'storm_analysis', capId: 'storm_analysis', short: 'ANLZ', label: 'Radar-Derived Storm Analysis', category: 'Research' },
  { key: 'volume_scan', capId: 'volume_scan', short: 'VOL', label: 'Volume Scans / Elevation Selection', category: 'Research' },
  { key: 'tilt_selection', capId: 'tilt_selection', short: 'TILT', label: 'Individual Tilt Selection', category: 'Research' },
];

const RADAR_CATEGORIES: Array<RadarProductDef['category']> = ['Reflectivity', 'Velocity', 'Dual-Pol', 'Severe Weather', 'Derived Products', 'Research'];

function buildRadarProducts(): Array<ProductItem & { category: RadarProductDef['category'] }> {
  return PRODUCT_KEYS.map((p) => {
    const cap: RadarProductCapability | undefined = getRadarCapability(p.capId);
    const available = cap?.availability === 'WORKING' || cap?.availability === 'PARTIAL';
    const reason = !available ? (cap?.unavailableReason || 'DATA UNAVAILABLE - No verified source.') : undefined;
    const warning = cap?.availability === 'PARTIAL' ? (cap.dataHonesty.reason || 'PARTIAL - Limited verification or archive support.') : undefined;
    return { key: p.key, short: p.short, label: p.label, category: p.category, available, reason, warning };
  });
}

const RADAR_PRODUCTS = buildRadarProducts();

const TILTS = ['0.5', '0.9', '1.3', '1.8'];

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
  showRangeRings?: boolean;
  onToggleRangeRings?: () => void;
  satelliteBird?: string;
  satelliteProductId?: string;
  onSelectSatelliteBird?: (bird: string) => void;
  onSelectSatelliteProduct?: (id: string) => void;
  satelliteProducts?: Array<{ id: string; label: string; available: boolean }>;
  modelId?: string;
  modelField?: string;
  modelOptions?: Array<{ id: string; label: string; status: string }>;
  modelFieldOptions?: Array<{ id: string; label: string; status: string }>;
  onSelectModel?: (id: string) => void;
  onSelectModelField?: (id: string) => void;
  spcDay?: string;
  onSelectSpcDay?: (day: string) => void;
  compositeProduct?: string;
  onSelectCompositeProduct?: (id: string) => void;
  favorites?: string[];
  onToggleFavorite?: (key: string) => void;
  [key: string]: any;
};

const FAVORITES_KEY = 'mesovortex_radar_favorites_v1';

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
  showRangeRings = true,
  onToggleRangeRings,
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
  favorites: favoritesProp,
  onToggleFavorite,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [favoritesLocal, setFavoritesLocal] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['ref', 'vel', 'srvel', 'cc'];
    try { const raw = localStorage.getItem(FAVORITES_KEY); const parsed = raw ? JSON.parse(raw) : null; return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : ['ref', 'vel', 'srvel', 'cc']; } catch { return ['ref', 'vel', 'srvel', 'cc']; }
  });
  const favorites = favoritesProp ?? favoritesLocal;
  const isRadarMode = mode === 'Radar' || mode === '3D Radar';
  const isSatellite = mode === 'Satellite';
  const isModels = mode === 'Models';
  const isComposite = mode === 'Composite';
  const isOutlooks = mode === 'Outlooks';

  const toggleFavorite = (key: string) => {
    if (onToggleFavorite) { onToggleFavorite(key); return; }
    setFavoritesLocal((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const activeProduct = useMemo(() => {
    const found = RADAR_PRODUCTS.find((p) => p.key === product);
    if (found) return found;
    return { key: product, short: product.toUpperCase(), label: product, category: 'Research' as const, available: false, reason: 'DATA UNAVAILABLE - Unknown radar product.', warning: undefined };
  }, [product]);

  return (
    <div className="pointer-events-auto absolute bottom-14 left-3 z-30 font-sans text-slate-100 select-none">
      {expanded && (
        <div className="mb-2 w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(60vh,32rem)] overflow-auto rounded-2xl border border-slate-700/80 bg-[#0b1220] shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-sky-400">{mode} Controls</div>
            <button type="button" onClick={() => setExpanded(false)} className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close drawer">✕</button>
          </div>
          <div className="p-3 space-y-3 text-xs">
            {isRadarMode && (
              <>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Radar Products</div>
                    <div className="text-[9px] text-slate-500">Verified availability shown</div>
                  </div>
                  <div className="max-h-72 overflow-auto rounded border border-slate-700 bg-[#0f172a] p-2 space-y-2">
                    {(() => {
                      const productStyle = (key: string) => {
                        if (key === 'ref' || key === 'max_ref' || key === 'ref_x') return { bg: 'bg-gradient-to-br from-emerald-900/60 via-yellow-900/40 to-red-900/50', code: 'text-emerald-200' };
                        if (key === 'vel' || key === 'srvel' || key === 'norm_vel' || key === 'sw') return { bg: 'bg-gradient-to-r from-green-900/50 to-red-900/50', code: 'text-slate-100' };
                        if (key === 'cc' || key === 'min_cc' || key === 'zdr' || key === 'kdp') return { bg: 'bg-gradient-to-br from-sky-900/50 via-emerald-900/30 to-amber-900/40', code: 'text-sky-100' };
                        return { bg: 'bg-gradient-to-br from-slate-800 to-slate-900', code: 'text-slate-200' };
                      };
                      const renderGrid = (items: typeof RADAR_PRODUCTS) => (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {items.map((p) => {
                            const active = p.key === product;
                            const unavailable = !p.available;
                            const fav = favorites.includes(p.key);
                            const style = productStyle(p.key);
                            return (
                              <button key={p.key} type="button" disabled={unavailable}
                                onClick={() => !unavailable && onSelectProduct(p.key)}
                                title={unavailable ? p.reason : p.warning ? `PARTIAL: ${p.warning}` : `${p.label} (${p.short})`}
                                className={`relative rounded-md border p-1.5 text-left transition-colors ${active ? 'border-sky-500 bg-[#162033]' : unavailable ? 'border-slate-800 bg-[#0b1220] opacity-55 cursor-not-allowed' : 'border-slate-700 bg-[#101826] hover:border-slate-500 hover:bg-[#162033]'}`}>
                                <span onClick={(e)=>{e.stopPropagation(); toggleFavorite(p.key);}} role="button" tabIndex={0} title={fav ? 'Remove favorite' : 'Add favorite'} className={`absolute right-1.5 top-1 z-10 text-xs ${fav ? 'text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}>{fav ? '★' : '☆'}</span>
                                <div className={`flex h-16 w-full items-center justify-center rounded border ${active ? 'border-sky-700' : 'border-slate-700'} ${style.bg} mb-1.5`}>
                                  <span className={`text-2xl font-black tracking-wide ${style.code}`}>{p.short}</span>
                                </div>
                                <div className="text-[11px] font-bold text-slate-100 leading-tight min-h-[2rem] pr-4">{p.label}</div>
                                <div className="mt-1 flex items-center justify-between gap-1">
                                  <span className={`text-[9px] font-bold uppercase ${unavailable ? 'text-slate-500' : p.warning ? 'text-amber-300' : 'text-emerald-400'}`}>{unavailable ? 'DATA UNAVAILABLE' : p.warning ? 'PARTIAL' : 'AVAILABLE'}</span>
                                  {active && <span className="text-[9px] font-black text-sky-300">SELECTED</span>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                      const favItems = RADAR_PRODUCTS.filter((p) => favorites.includes(p.key));
                      return (
                        <>
                          {favItems.length > 0 && (
                            <div>
                              <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-amber-300">Favorites</div>
                              {renderGrid(favItems)}
                            </div>
                          )}
                          {RADAR_CATEGORIES.map((category) => {
                            const items = RADAR_PRODUCTS.filter((p) => p.category === category);
                            if (!items.length) return null;
                            return (
                              <div key={category}>
                                <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-slate-500">{category}</div>
                                {renderGrid(items)}
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tilt</div>
                  <div className="flex flex-wrap gap-1">
                    {TILTS.map((t) => (
                      <button key={t} type="button" onClick={() => onSelectTilt(t)} className={`rounded-full px-2 py-1 text-[11px] font-bold ${tilt === t ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{t}°</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Palette</div>
                  <select value={colorTable} onChange={(e) => onChangeColorTable?.(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200 outline-none">
                    <option value="nws">NWS</option><option value="br">BR</option><option value="vel">Velocity</option><option value="cc">CC</option>
                  </select>
                </div>
                {product === 'max_ref' && onSelectMaxRefWindow && (
                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Max Ref Window</div>
                    <div className="flex gap-1">{[5, 10, 20, 30].map((w) => <button key={w} type="button" onClick={() => onSelectMaxRefWindow(w)} className={`rounded-full px-2 py-1 text-[11px] font-bold ${maxRefWindow === w ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{w}</button>)}</div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={showFastScan} onChange={onToggleFastScan} />Fast Scan (ingest indicator)</label>
                <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={showRangeRings} onChange={onToggleRangeRings} />Range rings</label>
              </>
            )}

            {isSatellite && (
              <>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Satellite Platform</div>
                  <div className="flex flex-wrap gap-1">
                    {['goes-east', 'goes-west'].map((b) => <button key={b} type="button" onClick={() => onSelectSatelliteBird?.(b)} className={`rounded-full px-2 py-1 text-[11px] font-bold ${satelliteBird === b ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{b === 'goes-east' ? 'GOES-East' : 'GOES-West'}</button>)}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Live Product (verified tile source)</div>
                  <div className="space-y-1">
                    {(satelliteProducts.length ? satelliteProducts : [{ id: 'visible', label: 'Visible', available: true }, { id: 'ir', label: 'Infrared', available: true }, { id: 'wv-mid', label: 'Water Vapor', available: true }]).map((p) => (
                      <button key={p.id} type="button" disabled={!p.available} onClick={() => p.available && onSelectSatelliteProduct?.(p.id)} className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] ${satelliteProductId === p.id ? 'bg-sky-900/30 text-cyan-200' : 'text-slate-200 hover:bg-slate-800'} ${!p.available ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <span>{!p.available ? '⛔ ' : ''}{p.label}</span>{satelliteProductId === p.id && <span className="text-sky-400">●</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Requested Satellite Catalog (honest status)</div>
                  <div className="max-h-56 overflow-auto space-y-1 pr-1">
                    {[
                      { id: 'goes_east', label: 'GOES-East' },
                      { id: 'goes_west', label: 'GOES-West' },
                      { id: 'abi_channels', label: 'GOES ABI Channels' },
                      { id: 'visible', label: 'Visible Satellite Imagery' },
                      { id: 'infrared', label: 'Infrared Satellite Imagery' },
                      { id: 'water_vapor', label: 'Water Vapor Imagery' },
                      { id: 'wv_upper', label: 'Upper-Level Water Vapor' },
                      { id: 'wv_mid', label: 'Mid-Level Water Vapor' },
                      { id: 'wv_lower', label: 'Lower-Level Water Vapor' },
                      { id: 'enhanced_ir', label: 'Enhanced Infrared Imagery' },
                      { id: 'geocolor', label: 'GeoColor' },
                      { id: 'airmass_rgb', label: 'Air Mass RGB' },
                      { id: 'dust_rgb', label: 'Dust RGB' },
                      { id: 'fire_smoke', label: 'Fire and Smoke Imagery' },
                      { id: 'cloud_phase', label: 'Cloud-Phase Products' },
                      { id: 'day_night', label: 'Day/Night Satellite Imagery' },
                      { id: 'glm_lightning', label: 'Satellite Lightning Imagery (GLM)' },
                      { id: 'sector_fulldisk', label: 'Full-Disk Imagery' },
                      { id: 'sector_conus', label: 'CONUS Imagery' },
                      { id: 'sector_mesoscale', label: 'Mesoscale Sector Imagery' },
                      { id: 'rapid_scan', label: 'One-Minute Rapid-Scan Imagery' },
                      { id: 'himawari', label: 'Himawari Coverage' },
                      { id: 'meteosat', label: 'Meteosat Coverage' },
                      { id: 'viirs', label: 'VIIRS Polar-Orbiting Satellite Imagery' },
                      { id: 'sat_history', label: 'Satellite History and Playback' },
                      { id: 'sat_smoothing', label: 'Satellite Smoothing and Enhancement' },
                      { id: 'sat_custom_color', label: 'Custom Satellite Color Enhancements' },
                      { id: 'sat_cross_section', label: 'Satellite Cross Sections' },
                      { id: 'sat_3d', label: 'Three-Dimensional Satellite Visualization' },
                      { id: 'sat_radar_compare', label: 'Satellite and Radar Comparison' },
                      { id: 'sat_atmo_overlays', label: 'Satellite and Atmospheric-Analysis Overlays' },
                    ].map((item) => {
                      const cap = getSatelliteCapability(item.id);
                      const available = cap?.availability === 'WORKING' || cap?.availability === 'PARTIAL';
                      const reason = !available ? (cap?.unavailableReason || 'DATA UNAVAILABLE') : (cap?.availability === 'PARTIAL' ? cap.notes : undefined);
                      return (
                        <div key={item.id} title={reason} className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] ${available ? 'bg-slate-800/60 text-slate-200' : 'bg-[#111827] text-slate-500'}`}>
                          <span>{!available ? '⛔ ' : cap?.availability === 'PARTIAL' ? '⚠ ' : '✓ '}{item.label}</span>
                          <span className={`text-[10px] font-bold ${available ? 'text-amber-300' : 'text-slate-500'}`}>{cap?.availability || 'UNAVAILABLE'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {isModels && (
              <>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Model</div>
                  <div className="max-h-40 overflow-auto rounded border border-slate-700 bg-[#0f172a]">
                    {modelOptions.map((m) => (
                      <button key={m.id} type="button" onClick={() => onSelectModel?.(m.id)} className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] border-b border-slate-800/60 last:border-b-0 ${modelId === m.id ? 'bg-sky-900/30 text-cyan-200' : 'text-slate-200 hover:bg-slate-800'}`}>
                        <span>{m.status !== 'READY_NOW' ? '⛔ ' : ''}{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Field</div>
                  <div className="grid grid-cols-2 gap-1">
                    {modelFieldOptions.map((f) => (
                      <button key={f.id} type="button" onClick={() => onSelectModelField?.(f.id)} className={`rounded-md px-2 py-1.5 text-[11px] font-bold text-left ${modelField === f.id ? 'bg-cyan-600 text-white' : f.status === 'READY_NOW' ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-900 text-slate-500'}`}>{f.status !== 'READY_NOW' ? '⛔ ' : ''}{f.label}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {isComposite && (
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Composite Product</div>
                {[{ id: 'ref', label: 'Regional/National Reflectivity' }, { id: 'max_ref', label: 'Max Reflectivity Swath' }].map((p) => (
                  <button key={p.id} type="button" onClick={() => onSelectCompositeProduct?.(p.id)} className={`flex w-full rounded-md px-2.5 py-1.5 text-[11px] mb-1 ${compositeProduct === p.id ? 'bg-sky-900/30 text-cyan-200' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>{p.label}</button>
                ))}
              </div>
            )}

            {isOutlooks && (
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">SPC Outlook Day</div>
                <div className="flex gap-1">{['Day 1', 'Day 2', 'Day 3'].map((d) => <button key={d} type="button" onClick={() => onSelectSpcDay?.(d)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold ${spcDay === d ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200'}`}>{d}</button>)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 rounded-2xl border border-slate-700/80 bg-[#0b1220] px-2.5 py-2 shadow-2xl">
        <div className="min-w-0 pr-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{isRadarMode ? 'Radar Site' : mode}</div>
          <div className="text-xs font-black text-white leading-tight">{isRadarMode ? siteId : (isSatellite ? 'Satellite' : isModels ? 'Models' : isComposite ? 'Composite' : 'Outlooks')}</div>
        </div>
        <div className="min-w-0 border-l border-slate-800 pl-2 pr-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{isRadarMode ? 'Product' : 'Selection'}</div>
          <div className="max-w-[10rem] truncate text-xs font-bold text-slate-200" title={activeProduct.reason || activeProduct.warning || activeProduct.label}>{isRadarMode ? `${!activeProduct.available ? '⛔ ' : activeProduct.warning ? '⚠ ' : ''}${activeProduct.label}` : isSatellite ? (satelliteProductId || '') : isModels ? (modelField || '') : isOutlooks ? spcDay : (compositeProduct || 'Reflectivity')}</div>
        </div>

        {isRadarMode && (
          <button type="button" onClick={onToggleInspection} title="Inspection / Sampling Tool" className={`rounded-lg px-2 py-1.5 text-[11px] font-bold border ${inspectionMode ? 'border-cyan-500 bg-sky-900/30 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>◎</button>
        )}

        <button type="button" onClick={onTogglePlay} title={isPlaying ? 'Pause' : 'Play'} className="rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-cyan-500">{isPlaying ? '❚❚' : '▶'}</button>
        <button type="button" onClick={onTogglePlay} title="Loop" className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold ${isPlaying ? 'border-sky-600 bg-sky-900/25 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>↻</button>

        {isRadarMode && (
          <button type="button" onClick={onToggleRadarPills} title="Radar Tower Pills Toggle" className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold ${showRadarPills ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>⌖</button>
        )}

        <button type="button" onClick={() => setExpanded((v) => !v)} title={expanded ? 'Collapse' : 'Expand'} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-800">{expanded ? '▾' : '▴'}</button>
        {onClose && <button type="button" onClick={onClose} className="rounded-lg px-1.5 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close controls">✕</button>}
      </div>
    </div>
  );
}

export default WeatherWiseRadarCard;
