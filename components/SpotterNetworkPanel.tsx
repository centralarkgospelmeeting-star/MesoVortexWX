'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SpotterReport = {
  id: string;
  name: string;
  callsign?: string;
  lat: number;
  lon: number;
  timestamp: string;        // ISO or human-readable
  type: 'position' | 'report';
  hazard?: string;
  description?: string;
  magnitude?: string;       // e.g. hail size, wind speed
  verified?: boolean;
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSpottersUpdated: (spotters: SpotterReport[]) => void;
  radarLat?: number;
  radarLon?: number;
};

const SN_CREDS_KEY = 'mv_spotter_network_creds';

// ─── Hazard badge colors ──────────────────────────────────────────────────────
function hazardBadge(hazard?: string) {
  const h = (hazard || '').toLowerCase();
  if (h.includes('tornado')) return { bg: 'bg-red-600', label: '🌪 Tornado' };
  if (h.includes('funnel') || h.includes('wall')) return { bg: 'bg-orange-500', label: '🌀 Funnel/Wall Cloud' };
  if (h.includes('hail')) return { bg: 'bg-yellow-500 text-black', label: '🧊 Hail' };
  if (h.includes('wind') || h.includes('gust')) return { bg: 'bg-amber-500', label: '💨 Wind Damage' };
  if (h.includes('flood') || h.includes('water')) return { bg: 'bg-emerald-600', label: '🌊 Flood' };
  if (h.includes('snow') || h.includes('ice') || h.includes('blizzard')) return { bg: 'bg-sky-400 text-black', label: '❄️ Winter Wx' };
  if (h.includes('fire') || h.includes('smoke')) return { bg: 'bg-orange-700', label: '🔥 Fire/Smoke' };
  return { bg: 'bg-cyan-700', label: '📍 Spotter' };
}

function timeAgo(isoOrTime: string): string {
  try {
    const d = new Date(isoOrTime);
    if (isNaN(d.getTime())) return isoOrTime;
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  } catch {
    return isoOrTime;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SpotterNetworkPanel({ isOpen, onClose, onSpottersUpdated, radarLat, radarLon }: Props) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [spotters, setSpotters] = useState<SpotterReport[]>([]);
  const [reports, setReports] = useState<SpotterReport[]>([]);
  const [activeTab, setActiveTab] = useState<'spotters' | 'reports' | 'connect'>('connect');
  const [radiusKm, setRadiusKm] = useState(300);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterHazard, setFilterHazard] = useState('all');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const credsSavedRef = useRef(false);

  // Load saved credentials on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SN_CREDS_KEY) || 'null');
      if (saved?.username) {
        setUsername(saved.username);
        setPassword(saved.password || '');
        setRememberMe(true);
        // Auto-connect if credentials exist
        if (saved.autoConnect) {
          credsSavedRef.current = true;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-connect on open if credentials saved
  useEffect(() => {
    if (isOpen && credsSavedRef.current && username && password && status === 'disconnected') {
      handleConnect(username, password);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchSpotterData = useCallback(async (user: string, pass: string, silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const latParam = radarLat ? `&lat=${radarLat}` : '';
      const lonParam = radarLon ? `&lon=${radarLon}` : '';
      const radiusParam = `&radiusKm=${radiusKm}`;

      // Fetch both positions and reports in parallel
      const [posRes, rptRes] = await Promise.allSettled([
        fetch(`/api/spotter?mode=positions&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}${latParam}${lonParam}${radiusParam}`),
        fetch(`/api/spotter?mode=reports&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}${latParam}${lonParam}${radiusParam}`),
      ]);

      const normalize = async (result: PromiseSettledResult<Response>): Promise<SpotterReport[]> => {
        if (result.status !== 'fulfilled') return [];
        try {
          const d = await result.value.json();
          return (d.features || []).map((f: any): SpotterReport => ({
            id: f.properties?.id || `sn-${Math.random()}`,
            name: f.properties?.name || f.properties?.callsign || 'Spotter',
            callsign: f.properties?.callsign,
            lat: f.geometry?.coordinates?.[1] ?? 0,
            lon: f.geometry?.coordinates?.[0] ?? 0,
            timestamp: f.properties?.time || f.properties?.timestamp || new Date().toISOString(),
            type: f.properties?.report ? 'report' : 'position',
            hazard: f.properties?.hazard || f.properties?.type || f.properties?.report_type,
            description: f.properties?.description || f.properties?.report || f.properties?.text,
            magnitude: f.properties?.magnitude || f.properties?.hail_size || f.properties?.wind_speed,
            verified: f.properties?.verified ?? false,
          }));
        } catch {
          return [];
        }
      };

      const [posData, rptData] = await Promise.all([
        normalize(posRes),
        normalize(rptRes),
      ]);

      // Also pull IEM LSR (Local Storm Reports) as a public fallback layer
      let lsrReports: SpotterReport[] = [];
      try {
        const lsrRes = await fetch(
          `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?hours=3${latParam}${lonParam}`
        );
        if (lsrRes.ok) {
          const lsrData = await lsrRes.json();
          lsrReports = (lsrData.features || []).map((f: any): SpotterReport => ({
            id: `lsr-${f.properties?.wfo}-${f.properties?.valid}`,
            name: f.properties?.source || 'LSR Report',
            lat: f.geometry?.coordinates?.[1] ?? 0,
            lon: f.geometry?.coordinates?.[0] ?? 0,
            timestamp: f.properties?.valid || new Date().toISOString(),
            type: 'report',
            hazard: f.properties?.typetext || f.properties?.type,
            description: f.properties?.remark || f.properties?.report,
            magnitude: f.properties?.magnitude
              ? `${f.properties.magnitude} ${f.properties.magf || ''}`
              : undefined,
            verified: true, // LSR reports are NWS-sourced
          }));
        }
      } catch {
        // IEM LSR fallback failed — not critical
      }

      const allReports = [...rptData, ...lsrReports].filter(
        (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
      );

      setSpotters(posData);
      setReports(allReports);
      setLastRefresh(new Date());
      setErrorMsg('');

      // Notify map
      const all = [...posData, ...allReports];
      onSpottersUpdated(all);

      if (posData.length > 0 || allReports.length > 0) {
        setActiveTab(allReports.length > 0 ? 'reports' : 'spotters');
      }
    } catch (err) {
      setErrorMsg('Failed to fetch spotter data. Check your credentials and try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [radarLat, radarLon, radiusKm, onSpottersUpdated]);

  const handleConnect = async (user: string, pass: string) => {
    setStatus('connecting');
    setErrorMsg('');
    try {
      if (rememberMe) {
        localStorage.setItem(SN_CREDS_KEY, JSON.stringify({ username: user, password: pass, autoConnect: true }));
      }
      await fetchSpotterData(user, pass);
      setStatus('connected');

      // Start 60-second auto-refresh
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        fetchSpotterData(user, pass, true);
      }, 60_000);
    } catch {
      setStatus('error');
      setErrorMsg('Connection failed. Check your Spotter Network credentials.');
    }
  };

  const handleDisconnect = () => {
    setStatus('disconnected');
    setSpotters([]);
    setReports([]);
    onSpottersUpdated([]);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!rememberMe) {
      localStorage.removeItem(SN_CREDS_KEY);
    }
  };

  const handleManualRefresh = () => {
    if (status === 'connected') {
      fetchSpotterData(username, password);
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const filteredReports = filterHazard === 'all'
    ? reports
    : reports.filter((r) => (r.hazard || '').toLowerCase().includes(filterHazard));

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-slate-800 bg-[#060d16] shadow-2xl"
      style={{ marginTop: 0 }}>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            status === 'connected' ? 'bg-emerald-400 animate-pulse' :
            status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
            status === 'error' ? 'bg-red-500' : 'bg-slate-600'
          }`} />
          <span className="text-sm font-bold tracking-wide text-white">Spotter Network</span>
          {status === 'connected' && (
            <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[9px] font-bold text-emerald-400">LIVE</span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {(['connect', 'spotters', 'reports'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              activeTab === t
                ? 'border-b-2 border-cyan-500 text-cyan-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'spotters' ? `Spotters${spotters.length ? ` (${spotters.length})` : ''}` :
             t === 'reports' ? `Reports${reports.length ? ` (${reports.length})` : ''}` :
             'Connect'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── CONNECT TAB ── */}
        {activeTab === 'connect' && (
          <div className="space-y-4 p-4">
            {/* Status banner */}
            {status === 'connected' && (
              <div className="rounded-xl border border-emerald-800 bg-emerald-950/60 p-3 text-xs text-emerald-300">
                <div className="font-bold text-emerald-400">✓ Connected to Spotter Network</div>
                <div className="mt-1 text-slate-400">Signed in as <span className="text-white">{username}</span></div>
                {lastRefresh && (
                  <div className="mt-0.5 text-slate-500">Last updated: {lastRefresh.toLocaleTimeString()}</div>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="flex-1 rounded-lg bg-slate-800 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isRefreshing ? '⟳ Refreshing...' : '⟳ Refresh Now'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/50"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}

            {status !== 'connected' && (
              <>
                {/* Info box */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
                  <div className="mb-1 font-semibold text-slate-200">What you get</div>
                  <ul className="space-y-1">
                    <li>🌪 Live ground reports as events unfold</li>
                    <li>📍 Trained spotter positions on map</li>
                    <li>🧊 Hail, wind, tornado & flood reports</li>
                    <li>🔄 Auto-refreshes every 60 seconds</li>
                  </ul>
                  <div className="mt-2 text-slate-500">
                    Don&apos;t have an account?{' '}
                    <a
                      href="https://www.spotternetwork.org/register"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 underline hover:text-cyan-300"
                    >
                      Register free at spotternetwork.org
                    </a>
                  </div>
                </div>

                {/* Error message */}
                {errorMsg && (
                  <div className="rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-xs text-red-300">
                    ⚠ {errorMsg}
                  </div>
                )}

                {/* Login form */}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleConnect(username, password); }}
                  className="space-y-3"
                >
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                      Spotter Network Username
                    </label>
                    <input
                      type="text"
                      autoComplete="username"
                      placeholder="your@email.com or username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-400">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 pr-10 text-xs text-white placeholder-slate-600 focus:border-cyan-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="sn-remember"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="accent-cyan-500"
                    />
                    <label htmlFor="sn-remember" className="text-[11px] text-slate-400">
                      Remember credentials (stored locally)
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!username || !password || status === 'connecting'}
                    className="w-full rounded-xl bg-cyan-600 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {status === 'connecting' ? '⟳ Connecting...' : 'Connect to Spotter Network'}
                  </button>
                </form>
              </>
            )}

            {/* Radius filter */}
            <div className="border-t border-slate-800 pt-3">
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-400">
                Search Radius: <span className="text-cyan-400">{radiusKm} km</span>
              </label>
              <input
                type="range"
                min={50} max={1500} step={50}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="mt-1 flex justify-between text-[9px] text-slate-600">
                <span>50 km</span>
                <span>750 km</span>
                <span>1500 km</span>
              </div>
            </div>

            {/* LSR public feed note */}
            <div className="rounded-lg bg-slate-900/50 p-2.5 text-[10px] text-slate-500">
              <span className="font-semibold text-slate-400">Also shown:</span> IEM Local Storm Reports (NWS-verified, public feed, no login required)
            </div>
          </div>
        )}

        {/* ── SPOTTERS TAB ── */}
        {activeTab === 'spotters' && (
          <div>
            {spotters.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-xs text-slate-500">
                <div className="text-3xl">📡</div>
                <div>
                  {status === 'connected'
                    ? 'No spotters active in your area right now.'
                    : 'Connect your Spotter Network account to see live spotter positions.'}
                </div>
                {status !== 'connected' && (
                  <button
                    onClick={() => setActiveTab('connect')}
                    className="mt-1 rounded-lg bg-cyan-900/50 px-4 py-2 text-xs font-semibold text-cyan-400 hover:bg-cyan-900"
                  >
                    Connect Account →
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="sticky top-0 bg-slate-950/90 px-3 py-2 text-[10px] text-slate-500 backdrop-blur">
                  {spotters.length} active spotters · {radiusKm} km radius
                  {lastRefresh && ` · ${timeAgo(lastRefresh.toISOString())}`}
                </div>
                {spotters.map((s) => (
                  <div
                    key={s.id}
                    className="border-b border-slate-800/60 px-3 py-2.5 hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">📡</span>
                        <div>
                          <div className="text-xs font-semibold text-white">{s.name}</div>
                          {s.callsign && <div className="text-[10px] text-slate-500">{s.callsign}</div>}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(s.timestamp)}</span>
                    </div>
                    <div className="mt-1 font-mono text-[9px] text-slate-600">
                      {s.lat.toFixed(4)}°N {Math.abs(s.lon).toFixed(4)}°W
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {activeTab === 'reports' && (
          <div>
            {/* Hazard filter */}
            <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur">
              <div className="flex flex-wrap gap-1">
                {['all', 'tornado', 'hail', 'wind', 'flood', 'snow'].map((h) => (
                  <button
                    key={h}
                    onClick={() => setFilterHazard(h)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize transition-colors ${
                      filterHazard === h
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-xs text-slate-500">
                <div className="text-3xl">🗺️</div>
                <div>
                  {status === 'connected'
                    ? 'No ground reports in your area right now.'
                    : 'Connect your Spotter Network account for live ground reports.'}
                </div>
                {status !== 'connected' && (
                  <button
                    onClick={() => setActiveTab('connect')}
                    className="mt-1 rounded-lg bg-cyan-900/50 px-4 py-2 text-xs font-semibold text-cyan-400 hover:bg-cyan-900"
                  >
                    Connect Account →
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="bg-slate-950/80 px-3 py-1.5 text-[10px] text-slate-500">
                  {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
                  {lastRefresh && ` · refreshed ${timeAgo(lastRefresh.toISOString())}`}
                </div>
                {filteredReports.map((r) => {
                  const badge = hazardBadge(r.hazard);
                  return (
                    <div
                      key={r.id}
                      className="border-b border-slate-800/60 px-3 py-3 hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${badge.bg} text-white`}>
                          {badge.label}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
                          {r.verified && <span title="NWS Verified" className="text-emerald-400">✓</span>}
                          <span>{timeAgo(r.timestamp)}</span>
                        </div>
                      </div>

                      {r.magnitude && (
                        <div className="mt-1 text-xs font-bold text-yellow-400">{r.magnitude}</div>
                      )}

                      {r.description && (
                        <div className="mt-1 text-[11px] leading-snug text-slate-300">{r.description}</div>
                      )}

                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">{r.name}</span>
                        <span className="font-mono text-[9px] text-slate-600">
                          {r.lat.toFixed(3)}°N {Math.abs(r.lon).toFixed(3)}°W
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 px-3 py-2 text-[9px] text-slate-600">
        Data: Spotter Network · IEM Local Storm Reports · NWS
        {status === 'connected' && (
          <span className="ml-2 text-emerald-600">● Auto-refresh 60s</span>
        )}
      </div>
    </div>
  );
}
