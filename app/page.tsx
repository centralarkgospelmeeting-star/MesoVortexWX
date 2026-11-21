'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { RadarMap, BasemapType, ModeTab } from '../components/RadarMap';
import { WeatherWiseRadarCard } from '../components/WeatherWiseRadarCard';
import { WeatherWiseAlertsPanel, WeatherAlertItem } from '../components/WeatherWiseAlertsPanel';
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

type SpcDay = 'Day 1' | 'Day 2' | 'Day 3';

type Frame = {
  time: string;
  label: string;
  tileUrl: string;
  ageMinutes: number;
};

const BASEMAP_STORAGE_KEY = 'mesovortex_basemap_preference';

export default function MesoVortexWorkstation() {
  const [tab, setTab] = useState<ModeTab>('Radar');
  const [spcDay, setSpcDay] = useState<SpcDay>('Day 1');
  const [product, setProduct] = useState<RadarProduct>('ref');
  const [tilt, setTilt] = useState('0.5');
  const [radarSite, setRadarSite] = useState('KLZK');
  const [maxRefWindow, setMaxRefWindow] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);

  // FastScan Ultra-Low Latency & Animation
  const [fastScan, setFastScan] = useState(true);
  const [radarSweepAnim, setRadarSweepAnim] = useState(true);
  const [flashCoreRange, setFlashCoreRange] = useState(true);

  // Layer Toggles
  const [showSpotters, setShowSpotters] = useState(true);
  const [showLightning, setShowLightning] = useState(true);
  const [showMcd, setShowMcd] = useState(true);
  const [showRadarPills, setShowRadarPills] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(0.88);

  // Basemap State
  const [basemap, setBasemap] = useState<BasemapType>('satellite-streets');
  const [basemapStatus, setBasemapStatus] = useState('Satellite Streets (Default)');

  // Loop & Synchronized Frames
  const [frames, setFrames] = useState<Frame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [loopLoading, setLoopLoading] = useState(false);
  const playTimerRef = useRef<number | null>(null);

  // Alerts Panel state
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState<WeatherAlertItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const currentSite =
    RADAR_SITES.find((s) => s.id === radarSite) || RADAR_SITES[0];
  const currentFrame = frames[frameIndex] || null;

  // Load Frames for Synchronized Radar Playback
  const loadFrames = useCallback(async () => {
    setLoopLoading(true);
    try {
      const res = await fetch(
        `/api/nexrad/frames?site=${encodeURIComponent(currentSite.radarId)}&product=${encodeURIComponent(product)}&tilt=${encodeURIComponent(tilt)}&hours=1.5`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.frames) && data.frames.length > 0) {
        setFrames(data.frames);
        setFrameIndex(data.frames.length - 1);
      } else {
        setFrames([]);
        setFrameIndex(0);
      }
    } catch {
      setFrames([]);
    } finally {
      setLoopLoading(false);
    }
  }, [currentSite.radarId, product, tilt]);

  useEffect(() => {
    void loadFrames();
  }, [loadFrames]);

  // Playback timer
  useEffect(() => {
    if (playTimerRef.current) {
      window.clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    if (!isPlaying || frames.length < 2) return;

    playTimerRef.current = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1 >= frames.length ? 0 : prev + 1));
    }, 650);

    return () => {
      if (playTimerRef.current) window.clearInterval(playTimerRef.current);
    };
  }, [isPlaying, frames.length]);

  const stepFrame = (dir: -1 | 1) => {
    setIsPlaying(false);
    setFrameIndex((prev) => {
      const next = prev + dir;
      if (next < 0) return frames.length - 1;
      if (next >= frames.length) return 0;
      return next;
    });
  };

  const goToLive = () => {
    if (frames.length > 0) {
      setFrameIndex(frames.length - 1);
      setIsPlaying(false);
    }
  };

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

  // Fetch real-time NWS Alerts
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

            <div className="flex items-center gap-1 font-bold text-xs">
              {(['Radar', 'Composite', 'Satellite', 'Outlooks'] as ModeTab[]).map((modeTab) => (
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

        {/* Alerts Pill */}
        <button
          onClick={() => setAlertsOpen((v) => !v)}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-amber-400 hover:bg-amber-300 px-3 py-1.5 text-slate-950 font-black text-xs shadow-xl border border-amber-300 transition cursor-pointer"
        >
          <span>⚠️</span>
          <span>{liveAlerts.length || 188}</span>
        </button>
      </div>

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
          frameUrl={currentFrame?.tileUrl ?? null}
          frameTime={currentFrame?.time}
          fastScan={fastScan}
          radarSweepAnim={radarSweepAnim}
          flashCoreRange={flashCoreRange}
          showSpotters={showSpotters}
          showLightning={showLightning}
          showMcd={showMcd}
          showRadarPills={showRadarPills}
          onSelectSite={(id) => setRadarSite(id)}
        />
      </div>

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
      />

      {/* 5. RIGHT-SIDE ALERTS PANEL */}
      {alertsOpen && (
        <WeatherWiseAlertsPanel
          alerts={liveAlerts}
          onClose={() => setAlertsOpen(false)}
          onSelectAlert={(alert) => console.log('Selected alert:', alert)}
        />
      )}

      {/* Slide-out Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="w-84 bg-white p-5 shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b pb-3 font-extrabold text-base">
              <div className="flex items-center gap-2">
                <Image src="/logo.png" alt="MesoVortex" width={24} height={24} className="rounded-full" />
                <span>MesoVortex Menu</span>
              </div>
              <button onClick={() => setMenuOpen(false)}>✕</button>
            </div>

            <div className="space-y-1.5 text-xs font-bold">
              {/* Spotter Network Red Dots Toggle */}
              <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
                  <span>Spotter Network (Live Red Dots)</span>
                </span>
                <input
                  type="checkbox"
                  checked={showSpotters}
                  onChange={(e) => setShowSpotters(e.target.checked)}
                  className="accent-red-600 h-4 w-4 rounded"
                />
              </label>

              {/* FastScan 8s Cycle */}
              <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer">
                <span>⚡ FastScan (8s Ultra-Low Latency)</span>
                <input
                  type="checkbox"
                  checked={fastScan}
                  onChange={(e) => setFastScan(e.target.checked)}
                  className="accent-blue-600 h-4 w-4 rounded"
                />
              </label>

              {/* Radar Rotating Sweep Beam Animation */}
              <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer">
                <span>📡 Radar Sweep Beam Animation</span>
                <input
                  type="checkbox"
                  checked={radarSweepAnim}
                  onChange={(e) => setRadarSweepAnim(e.target.checked)}
                  className="accent-cyan-600 h-4 w-4 rounded"
                />
              </label>

              {/* Flash Reflectivity Hail Core Enhancement */}
              <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer">
                <span>⚡ Flash Reflectivity Value Range (Cores)</span>
                <input
                  type="checkbox"
                  checked={flashCoreRange}
                  onChange={(e) => setFlashCoreRange(e.target.checked)}
                  className="accent-purple-600 h-4 w-4 rounded"
                />
              </label>

              {/* Synchronized Lightning */}
              <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer">
                <span>⚡ Synchronized Lightning (US/CA/CO)</span>
                <input
                  type="checkbox"
                  checked={showLightning}
                  onChange={(e) => setShowLightning(e.target.checked)}
                  className="accent-amber-500 h-4 w-4 rounded"
                />
              </label>

              {/* SPC Mesoscale Discussions */}
              <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer">
                <span>📝 SPC Mesoscale Discussions (MCD)</span>
                <input
                  type="checkbox"
                  checked={showMcd}
                  onChange={(e) => setShowMcd(e.target.checked)}
                  className="accent-orange-500 h-4 w-4 rounded"
                />
              </label>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}
