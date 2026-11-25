'use client';

import { useMemo, useState } from 'react';
import { getRadarCapability } from '../lib/radar/capability-matrix';
import { getSatelliteCapability } from '../lib/satellite/capability-matrix';
import { RADAR_SITES } from '../lib/radar-config';
import {
  getCatalogProductViews,
  PRODUCT_DOMAINS,
  categoriesForDomain,
  type ProductDomain,
} from '../lib/radar/product-catalog';

export type ModeTab = 'Radar' | '3D Radar' | 'Composite' | 'Satellite' | 'Models' | 'Outlooks';

export type FrameMetadata = {
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
  /** True only when the master timeline has more than one verified frame. */
  loopAvailable?: boolean;
  frameMetadata?: FrameMetadata;
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
  showStormTracks?: boolean;
  onToggleStormTracks?: () => void;
  [key: string]: any;
};

const CATALOG_PRODUCTS = getCatalogProductViews();
const RADAR_PRODUCTS = CATALOG_PRODUCTS.filter((p) => p.domain === 'RADAR');
const COMPOSITE_PRODUCTS = CATALOG_PRODUCTS.filter((p) => p.domain === 'COMPOSITE');

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
  loopAvailable = false,
  frameMetadata,
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
  showStormTracks = false,
  onToggleStormTracks,
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
    const found = CATALOG_PRODUCTS.find((p) => p.key === product);
    if (found) return found;
    return {
      key: product,
      capId: '',
      short: product.toUpperCase(),
      label: product,
      domain: 'RADAR' as ProductDomain,
      category: 'Unverified / Not Claimed' as const,
      cap: undefined,
      available: false,
      reason: 'DATA UNAVAILABLE - Unknown radar product.',
      warning: undefined,
    };
  }, [product]);

  const siteNetwork = RADAR_SITES.find((s) => s.id === siteId || s.radarId === siteId)?.network;
  // Tilt controls come from the authoritative capability matrix. TDWR uses
  // fixed low-elevation codes and ignores the global tilt in the frames API.
  const tiltOptions = useMemo(() => {
    if (siteNetwork === 'TDWR') return [] as string[];
    return getRadarCapability(product)?.tiltSupport ?? [] as string[];
  }, [product, siteNetwork]);
  const tiltLabel = siteNetwork === 'TDWR' ? 'TDWR FIXED' : tiltOptions.length ? `${tilt}°` : 'NO TILT';

  const frameTitle = frameMetadata
    ? [
        'MASTER TIMELINE PROVENANCE',
        frameMetadata.provider || 'Provider unavailable',
        frameMetadata.product ? `${frameMetadata.product}${frameMetadata.tilt ? ` @ ${frameMetadata.tilt}°` : ''}` : 'No verified product code',
        frameMetadata.scanTime ? `VERIFIED SCAN ${frameMetadata.scanTime.replace('T', ' ').replace('Z', ' UTC')}` : 'LIVE ONLY',
        frameMetadata.playbackSupport ? `playback ${frameMetadata.playbackSupport}` : null,
        frameMetadata.archiveSupport ? `archive ${frameMetadata.archiveSupport}` : null,
        frameMetadata.verificationLevel || null,
      ].filter(Boolean).join(' · ')
    : undefined;

  const productStyle = (key: string) => {
    if (key === 'ref' || key === 'max_ref') return { bg: 'bg-gradient-to-br from-emerald-900/60 via-yellow-900/40 to-red-900/50', code: 'text-emerald-200' };
    if (key === 'vel' || key === 'srvel' || key === 'sw') return { bg: 'bg-gradient-to-r from-green-900/50 to-red-900/50', code: 'text-slate-100' };
    if (key === 'cc' || key === 'min_cc' || key === 'zdr' || key === 'kdp') return { bg: 'bg-gradient-to-br from-sky-900/50 via-emerald-900/30 to-amber-900/40', code: 'text-sky-100' };
    if (key === 'azshear' || key === 'rotation_tracks') return { bg: 'bg-gradient-to-r from-fuchsia-900/50 to-indigo-900/50', code: 'text-fuchsia-100' };
    if (key === 'mesh' || key === 'hail_detection') return { bg: 'bg-gradient-to-br from-amber-900/50 to-red-900/50', code: 'text-amber-100' };
    return { bg: 'bg-gradient-to-br from-slate-800 to-slate-900', code: 'text-slate-200' };
  };

  const renderProductGrid = (items: typeof CATALOG_PRODUCTS, domain: ProductDomain, onSelect: (key: string) => void) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((p) => {
        const active = p.key === product;
        const unavailable = !p.available;
        const fav = favorites.includes(p.key);
        const style = productStyle(p.key);
        return (
          <button key={p.key} type="button" disabled={unavailable}
            data-product-domain={domain}
            data-product-category={p.category}
            onClick={() => !unavailable && onSelect(p.key)}
            title={unavailable ? p.reason : p.warning ? `PARTIAL: ${p.warning}` : `${p.label} (${p.short})`}
            className={`relative rounded-md border p-1.5 text-left transition-colors ${active ? 'border-sky-500 bg-[#162033]' : unavailable ? 'border-slate-800 bg-[#0b1220] opacity-55 cursor-not-allowed' : 'border-slate-700 bg-[#101826] hover:border-slate-500 hover:bg-[#162033]'}`}>
            {domain === 'RADAR' && (
              <span onClick={(e) => { e.stopPropagation(); toggleFavorite(p.key); }} role="button" tabIndex={0} title={fav ? 'Remove favorite' : 'Add favorite'} className={`absolute right-1.5 top-1 z-10 text-xs ${fav ? 'text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}>{fav ? '★' : '☆'}</span>
            )}
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

  const renderDomainCatalog = (domain: ProductDomain, items: typeof CATALOG_PRODUCTS, onSelect: (key: string) => void) => {
    const definition = PRODUCT_DOMAINS.find((d) => d.id === domain);
    const favItems = domain === 'RADAR' ? items.filter((p) => favorites.includes(p.key)) : [];
    return (
      <div data-product-domain-group={domain}>
        <div className="mb-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-sky-300">{definition?.label || domain}</div>
          <div className="text-[9px] leading-snug text-slate-500">{definition?.description}</div>
        </div>
        <div className="max-h-72 overflow-auto rounded border border-slate-700 bg-[#0f172a] p-2 space-y-2">
          {favItems.length > 0 && (
            <div>
              <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-amber-300">Radar Favorites</div>
              {renderProductGrid(favItems, domain, onSelect)}
            </div>
          )}
          {categoriesForDomain(domain).map((category) => {
            const categoryItems = items.filter((p) => p.category === category);
            if (!categoryItems.length) return null;
            return (
              <div key={category}>
                <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-slate-500">{category}</div>
                {renderProductGrid(categoryItems, domain, onSelect)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
                {renderDomainCatalog('RADAR', RADAR_PRODUCTS, onSelectProduct)}
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Elevation / Tilt</span>
                    <span className="text-[9px] text-slate-600">{tiltLabel}</span>
                  </div>
                  {tiltOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {tiltOptions.map((t) => (
                        <button key={t} type="button" onClick={() => onSelectTilt(t)} className={`rounded-full px-2 py-1 text-[11px] font-bold ${tilt === t ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{t}°</button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] leading-snug text-slate-500">
                      {siteNetwork === 'TDWR'
                        ? 'TDWR uses fixed low-elevation codes; tilt selection has no effect.'
                        : 'This product is a national grid, derived field, or live volume inventory; it has no per-tilt raster selection.'}
                    </div>
                  )}
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
                <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={showFastScan} onChange={onToggleFastScan} />Fast Scan (verified scan reveal)</label>
                <div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300">
                    <input type="checkbox" checked={showStormTracks} onChange={onToggleStormTracks} />
                    MRMS Rotation Tracks (30-min overlay)
                  </label>
                  <div className="pl-5 text-[9px] leading-snug text-slate-500">Live national raster maximum; no track objects or mesocyclone IDs.</div>
                </div>
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

            {isComposite && renderDomainCatalog('COMPOSITE', COMPOSITE_PRODUCTS, (key) => onSelectCompositeProduct?.(key))}

            {isOutlooks && (
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">SPC Outlook Day</div>
                <div className="flex gap-1">{['Day 1', 'Day 2', 'Day 3'].map((d) => <button key={d} type="button" onClick={() => onSelectSpcDay?.(d)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold ${spcDay === d ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200'}`}>{d}</button>)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        data-radar-controls="compact"
        data-product-domain={activeProduct.domain}
        data-frame-metadata-scope="master-timeline"
        data-frame-metadata={frameMetadata ? JSON.stringify(frameMetadata) : undefined}
        title={frameTitle}
        className="flex items-center gap-1.5 rounded-2xl border border-slate-700/80 bg-[#0b1220] px-2.5 py-2 shadow-2xl"
      >
        <div className="min-w-0 pr-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{isRadarMode ? 'Radar Site' : mode}</div>
          <div className="text-xs font-black text-white leading-tight">{isRadarMode ? siteId : (isSatellite ? 'Satellite' : isModels ? 'Models' : isComposite ? 'Composite' : 'Outlooks')}</div>
        </div>
        <div className="min-w-0 border-l border-slate-800 pl-2 pr-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{isRadarMode ? 'Product' : 'Selection'}</div>
          <div className="max-w-[10rem] truncate text-xs font-bold text-slate-200" title={activeProduct.reason || activeProduct.warning || activeProduct.label}>{isRadarMode ? `${!activeProduct.available ? '⛔ ' : activeProduct.warning ? '⚠ ' : ''}${activeProduct.label}` : isSatellite ? (satelliteProductId || '') : isModels ? (modelField || '') : isOutlooks ? spcDay : (compositeProduct || 'Reflectivity')}</div>
          {isRadarMode && <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{activeProduct.domain === 'RADAR' ? 'Single radar' : 'Multi-radar / MRMS'}</div>}
        </div>
        {isRadarMode && (
          <div className="min-w-0 border-l border-slate-800 pl-2 pr-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Elevation</div>
            <div className="max-w-[6rem] truncate text-xs font-bold text-cyan-200" title={tiltLabel}>{tiltLabel}</div>
          </div>
        )}

        {isRadarMode && (
          <button type="button" onClick={onToggleInspection} title="Inspection / Sampling Tool" className={`rounded-lg px-2 py-1.5 text-[11px] font-bold border ${inspectionMode ? 'border-cyan-500 bg-sky-900/30 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>◎</button>
        )}

        <button type="button" onClick={onTogglePlay} disabled={!loopAvailable} title={loopAvailable ? (isPlaying ? 'Pause' : 'Play') : 'LIVE ONLY - no verified archive loop'} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black ${loopAvailable ? 'bg-cyan-600 text-white hover:bg-cyan-500' : 'cursor-not-allowed bg-slate-800 text-slate-500'}`}>{isPlaying ? '❚❚' : '▶'}</button>
        <button type="button" onClick={onTogglePlay} disabled={!loopAvailable} title={loopAvailable ? 'Loop' : 'LIVE ONLY - no verified archive loop'} className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold ${!loopAvailable ? 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600' : isPlaying ? 'border-sky-600 bg-sky-900/25 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>↻</button>

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
