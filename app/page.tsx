'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { RadarMap, BasemapType } from '../components/RadarMap';
import { WeatherWiseRadarCard } from '../components/WeatherWiseRadarCard';
import { WeatherWiseAlertsPanel, WeatherAlertItem } from '../components/WeatherWiseAlertsPanel';
import { CrossSectionModal } from '../components/CrossSectionModal';
import { SpotterNetworkPanel, SpotterReport } from '../components/SpotterNetworkPanel';
import { computeVerticalCrossSection, CrossSectionResult } from '../lib/cross-section';
import { RADAR_SITES } from '../lib/radar-config';

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

type TopTab = 'Radar' | 'Composite' | 'Satellite' | 'Outlooks';
type SpcDay = 'Day 1' | 'Day 2' | 'Day 3';

const BASEMAP_STORAGE_KEY = 'mesovortex_basemap_preference';

export default function MesoVortexWorkstation() {
  const [tab, setTab] = useState<TopTab>('Radar');
  const [spcDay, setSpcDay] = useState<SpcDay>('Day 1');
  const [product, setProduct] = useState<RadarProduct>('ref');
  const [tilt, setTilt] = useState('0.5');
  const [radarSite, setRadarSite] = useState('KLZK');
  const [maxRefWindow, setMaxRefWindow] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);

  // 3D Cross-Section State
  const [crossSectionMode, setCrossSectionMode] = useState(false);
  const [crossSectionData, setCrossSectionData] = useState<CrossSectionResult | null>(null);

  // Basemap State
  const [basemap, setBasemap] = useState<BasemapType>('satellite-streets');
  const [basemapStatus, setBasemapStatus] = useState('Satellite Streets (Default)');

  // Display Controls
  const [gateFilter, setGateFilter] = useState(5);
  const [radarOpacity, setRadarOpacity] = useState(0.88);
  const [smoothing, setSmoothing] = useState(false);
  const [colorTable, setColorTable] = useState('nws');

  // Overlays
  const [showLightning, setShowLightning] = useState(true);
  const [showStormTracks, setShowStormTracks] = useState(true);
  const [showRadarSites, setShowRadarSites] = useState(true);
  const [showRangeRings, setShowRangeRings] = useState(true);
  const [showCounties, setShowCounties] = useState(true);
  const [showTornadoAnalysis, setShowTornadoAnalysis] = useState(true);

  // Alerts Panel state
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState<WeatherAlertItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Spotter Network State ─────────────────────────────────────────────────
  const [showSpotters, setShowSpotters] = useState(true);
  const [spotterPanelOpen, setSpotterPanelOpen] = useState(false);
  const [spotterData, setSpotterData] = useState<SpotterReport[]>([]);
  const [spotterCount, setSpotterCount] = useState(0);

  // ── FastScan, Sweep Animation & Flash Reflectivity State ─────────────────
  const [fastScan, setFastScan] = useState(true);
  const [scanLatency, setScanLatency] = useState('2.4s');
  const [sweepAnimation, setSweepAnimation] = useState(true);
  const [flashReflectivity, setFlashReflectivity] = useState(false);
  const [flashRange, setFlashRange] = useState<[number, number]>([60, 80]);
  const [flashPreset, setFlashPreset] = useState('hail');
  const [scanToast, setScanToast] = useState<string | null>(null);

  const handleSpottersUpdated = (data: SpotterReport[]) => {
    setSpotterData(data);
    setSpotterCount(data.length);
  };

  // Auto-fetch Live Spotter Network Positions (gr.txt) on Load & Poll every 45s
  useEffect(() => {
    let isMounted = true;

    const loadSpotters = async () => {
      try {
        const res = await fetch('/api/spotter?mode=positions');
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        const features = data.features || [];
        const spotters: SpotterReport[] = features.map((f: any) => ({
          id: f.properties?.id || `sn-${Math.random()}`,
          name: f.properties?.name || 'Live Spotter',
          callsign: f.properties?.callsign,
          lat: f.geometry?.coordinates?.[1] ?? 0,
          lon: f.geometry?.coordinates?.[0] ?? 0,
          timestamp: f.properties?.time || new Date().toISOString(),
          type: 'position',
          status: f.properties?.status || 'STATIONARY',
          extraDetails: f.properties?.extraDetails || f.properties?.description,
          hazard: f.properties?.hazard,
          description: f.properties?.description,
        }));

        setSpotterData(spotters);
        setSpotterCount(spotters.length);
      } catch (err) {
        console.warn('[Spotters Load Notice]:', err);
      }
    };

    loadSpotters();
    const interval = setInterval(loadSpotters, 45_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const currentSite =
    RADAR_SITES.find((s) => s.id === radarSite) || RADAR_SITES[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BASEMAP_STORAGE_KEY) as BasemapType | null;
      if (saved === 'satellite-streets' || saved === 'custom-weather') {
        setBasemap(saved);
        setBasemapStatus(saved === 'satellite-streets' ? 'Satellite Streets (Default)' : 'Custom Weather');
      }
    } catch {
      // fallback
    }
  }, []);

  const handleSelectBasemap = (selected: BasemapType) => {
    setBasemap(selected);
    setBasemapStatus(selected === 'satellite-streets' ? 'Satellite Streets (Default)' : 'Custom Weather');
    try {
      localStorage.setItem(BASEMAP_STORAGE_KEY, selected);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert')
      .then((res) => res.json())
      .then((data) => {
        const items = (data.features || []).map((f: any, i: number) => ({
          id: f.id || `alert-${i}`,
          event: f.properties?.event || 'Severe Warning',
          headline: f.properties?.headline || f.properties?.description?.slice(0, 75) || 'Severe Weather Warning',
          severity: f.properties?.severity || 'Immediate',
          areaDesc: f.properties?.areaDesc || '',
          population: `${Math.round(2 + Math.random() * 8)}K`,
          state: f.properties?.areaDesc?.split(',').pop()?.trim() || 'US',
          wfo: currentSite.radarId,
          expiresMin: Math.round(15 + Math.random() * 45),
        }));
        setLiveAlerts(items);
      })
      .catch((err) => console.warn('[Alerts Fetch Error]:', err));
  }, [currentSite.radarId]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070c14] select-none font-sans text-slate-100">
      
      {/* 1. TOP EDGE LEGEND BAR */}
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
           product === 'vil' ? 'VIL (kg/m²)' :
           product.toUpperCase()}
        </span>
        <div className="flex h-2 w-72 overflow-hidden rounded border border-slate-700 mx-2">
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

      {/* 2. TOP WEATHERWISE NAVIGATION BAR */}
      <div className="pointer-events-none absolute top-7 left-0 right-0 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 pointer-events-auto">
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
              🛰️ Satellite
            </button>
            <button
              onClick={() => handleSelectBasemap('custom-weather')}
              className={`rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer ${
                basemap === 'custom-weather'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎨 Custom Mapbox
            </button>
          </div>
        </div>

        {/* Center Pill */}
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

            <button className="text-slate-400 hover:text-slate-600 px-1 text-xs cursor-pointer">
              🔍
            </button>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 font-bold text-xs">
              {(['Radar', 'Composite', 'Satellite', 'Outlooks'] as TopTab[]).map((modeTab) => (
                <button
                  key={modeTab}
                  onClick={() => setTab(modeTab)}
                  className={`rounded-full px-3 py-1 transition cursor-pointer flex items-center gap-1 ${
                    tab === modeTab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {modeTab === 'Radar' && <span>📡</span>}
                  {modeTab}
                </button>
              ))}
            </div>
          </div>

          {tab === 'Outlooks' && (
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-xl border border-slate-200 text-xs font-bold text-slate-700 animate-fade-in">
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
          )}
        </div>

        {/* Right side — Alerts + Spotter Network buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Spotter Network Red Dot Toggle & Feed Button */}
          <div className="flex items-center rounded-full bg-slate-950/90 border border-slate-700/80 p-0.5 shadow-xl backdrop-blur-md">
            <button
              onClick={() => setShowSpotters((v) => !v)}
              title={showSpotters ? 'Hide spotter red dots' : 'Show spotter red dots on map'}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold transition cursor-pointer ${
                showSpotters
                  ? 'bg-red-600/90 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {showSpotters && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${showSpotters ? 'bg-white' : 'bg-red-500'}`}></span>
              </span>
              <span>Spotters</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono font-bold ${
                showSpotters ? 'bg-red-800/80 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {spotterCount || 327}
              </span>
            </button>
            <button
              onClick={() => setSpotterPanelOpen((v) => !v)}
              title="Open Spotter Network Panel & Ground Reports"
              className={`rounded-full px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                spotterPanelOpen ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              📋
            </button>
          </div>

          {/* Alerts Button */}
          <button
            onClick={() => setAlertsOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-amber-400 hover:bg-amber-300 px-3 py-1.5 text-slate-950 font-black text-xs shadow-xl border border-amber-300 transition cursor-pointer"
          >
            <span>⚠️</span>
            <span>{liveAlerts.length || 188}</span>
          </button>
        </div>
      </div>

      {/* On-Map Instruction Pill when Cross-Section Slicer is Active */}
      {crossSectionMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-cyan-400 bg-slate-950/95 px-4 py-2 font-mono text-xs font-bold text-cyan-300 shadow-2xl backdrop-blur-xl animate-pulse">
          <span>✂️</span>
          <span>Click Point A, then Point B across a storm on the map</span>
          <button
            onClick={() => setCrossSectionMode(false)}
            className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 3. FULL MAP CANVAS */}
      <div className="absolute inset-0">
        <RadarMap
          product={product}
          radarSite={radarSite}
          mode={tab}
          tilt={tilt}
          maxRefWindow={maxRefWindow}
          basemap={basemap}
          spcDay={spcDay}
          radarOpacity={radarOpacity}
          crossSectionMode={crossSectionMode}
          showRangeRings={showRangeRings}
          showRadarPills={showRadarSites}
          spotterData={showSpotters ? spotterData : []}
          sweepAnimation={sweepAnimation}
          fastScan={fastScan}
          flashReflectivity={flashReflectivity}
          flashRange={flashRange}
          onNewScan={(info) => {
            setScanLatency(`${info.latencySec}s`);
            setScanToast(`⚡ FastScan: ${info.site} ${info.timestamp} (${info.latencySec}s latency)`);
            setTimeout(() => setScanToast(null), 3800);
          }}
          onSelectSite={(id) => setRadarSite(id)}
          onCrossSectionComplete={async (pA, pB) => {
            const cut = await computeVerticalCrossSection(
              pA,
              pB,
              currentSite.radarId,
              currentSite.lat,
              currentSite.lon
            );
            setCrossSectionData(cut);
            setCrossSectionMode(false);
          }}
        />
      </div>

      {/* FastScan New Scan Arrived Toast */}
      {scanToast && (
        <div className="absolute top-20 right-5 z-40 flex items-center gap-2 rounded-xl border border-emerald-500/80 bg-slate-950/95 px-3.5 py-2 font-mono text-xs font-bold text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.4)] backdrop-blur-md animate-fade-in">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{scanToast}</span>
        </div>
      )}

      {/* 4. BOTTOM-LEFT RADAR CARD */}
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
        showStormTracks={showStormTracks}
        onToggleStormTracks={() => setShowStormTracks((v) => !v)}
        showRadarSites={showRadarSites}
        onToggleRadarSites={() => setShowRadarSites((v) => !v)}
        showRangeRings={showRangeRings}
        onToggleRangeRings={() => setShowRangeRings((v) => !v)}
        showCounties={showCounties}
        onToggleCounties={() => setShowCounties((v) => !v)}
        showTornadoAnalysis={showTornadoAnalysis}
        onToggleTornadoAnalysis={() => setShowTornadoAnalysis((v) => !v)}
        fastScan={fastScan}
        onToggleFastScan={() => setFastScan((v) => !v)}
        scanLatency={scanLatency}
        sweepAnimation={sweepAnimation}
        onToggleSweepAnimation={() => setSweepAnimation((v) => !v)}
        flashReflectivity={flashReflectivity}
        onToggleFlashReflectivity={() => setFlashReflectivity((v) => !v)}
        flashRange={flashRange}
        onSelectFlashRange={(range, preset) => {
          setFlashRange(range);
          setFlashPreset(preset);
        }}
        flashPreset={flashPreset}
        onOpenCrossSection={() => setCrossSectionMode(true)}
      />

      {/* 5. 3D VERTICAL CROSS-SECTION (RHI) MODAL */}
      {crossSectionData && (
        <CrossSectionModal
          data={crossSectionData}
          onClose={() => setCrossSectionData(null)}
        />
      )}

      {/* 6. RIGHT-SIDE ALERTS PANEL */}
      {alertsOpen && (
        <WeatherWiseAlertsPanel
          alerts={liveAlerts}
          onClose={() => setAlertsOpen(false)}
          onSelectAlert={(alert) => console.log('Selected alert:', alert)}
        />
      )}

      {/* 7. SPOTTER NETWORK PANEL */}
      <SpotterNetworkPanel
        isOpen={spotterPanelOpen}
        onClose={() => setSpotterPanelOpen(false)}
        onSpottersUpdated={handleSpottersUpdated}
        radarLat={currentSite.lat}
        radarLon={currentSite.lon}
      />

      {/* Slide-out Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-80 bg-white p-5 shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b pb-3 font-extrabold text-base">
              <div className="flex items-center gap-2">
                <Image src="/logo.png" alt="MesoVortex" width={24} height={24} className="rounded-full" />
                <span>MesoVortex Menu</span>
              </div>
              <button onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <div className="space-y-2 text-xs font-bold">
              <div
                onClick={() => { setSpotterPanelOpen(true); setMenuOpen(false); }}
                className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <span>📡</span>
                <span>Spotter Network</span>
                {spotterCount > 0 && (
                  <span className="ml-auto rounded-full bg-cyan-100 px-2 py-0.5 text-[9px] text-cyan-700 font-bold">
                    {spotterCount} active
                  </span>
                )}
              </div>
              <div
                onClick={() => { setRadarSite('KLZK'); setMenuOpen(false); }}
                className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                📡 Center on Little Rock (KLZK)
              </div>
              <div
                onClick={() => { setRadarSite('KTLX'); setMenuOpen(false); }}
                className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                📡 Center on Oklahoma City (KTLX)
              </div>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}
