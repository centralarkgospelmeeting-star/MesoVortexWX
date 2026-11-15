'use client';

import { useEffect, useState, type ReactNode } from 'react';

type Observation = {
  station: string;
  text: string;
  temp: string;
  dewpoint: string;
  wind: string;
  time?: string;
};

type METARPanelProps = {
  /** Optional pre-loaded obs (legacy). If omitted, panel fetches live. */
  observations?: Observation[];
  /** ICAO ids for live fetch, e.g. KLIT,KDFW,KOKC */
  stationIds?: string;
  /** Bounding box lat0,lon0,lat1,lon1 for network fetch */
  bbox?: string;
};

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function formatObs(feature: any): Observation | null {
  const p = feature?.properties || feature || {};
  const station = p.icaoId || p.stationId || p.id || feature?.id;
  if (!station) return null;

  const raw = p.rawOb || p.raw_text || p.raw || p.metar || '';
  const tempC = p.temp != null ? Number(p.temp) : p.temp_c != null ? Number(p.temp_c) : null;
  const dewpC = p.dewp != null ? Number(p.dewp) : p.dewpoint_c != null ? Number(p.dewpoint_c) : null;
  const wdir = p.wdir ?? p.wind_dir_degrees;
  const wspd = p.wspd ?? p.wind_speed_kt;
  const wgst = p.wgst ?? p.wind_gust_kt;

  let temp = '—';
  if (tempC != null && !Number.isNaN(tempC)) {
    temp = `${cToF(tempC)}°F (${tempC}°C)`;
  }
  let dewpoint = '—';
  if (dewpC != null && !Number.isNaN(dewpC)) {
    dewpoint = `${cToF(dewpC)}°F (${dewpC}°C)`;
  }
  let wind = '—';
  if (wspd != null) {
    const dir = wdir === 'VRB' || wdir == null ? 'VRB' : `${wdir}°`;
    wind = wgst != null ? `${dir} at ${wspd} kt, gusts ${wgst} kt` : `${dir} at ${wspd} kt`;
  }

  return {
    station: String(station),
    text: String(raw || 'No raw METAR'),
    temp,
    dewpoint,
    wind,
    time: p.obsTime || p.receiptTime || p.reportTime || undefined,
  };
}

const DEFAULT_IDS = 'KLIT,KDFW,KOKC,KMEM,KLZK,KSRX,KSGF,KSHV';

export function METARPanel({
  observations: legacyObs,
  stationIds = DEFAULT_IDS,
  bbox,
}: METARPanelProps): ReactNode {
  const [obs, setObs] = useState<Observation[]>(legacyObs || []);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ok'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If parent still passes static legacy data and no live params, keep it once
    if (legacyObs && legacyObs.length && !stationIds && !bbox) {
      setObs(legacyObs);
      setStatus('ok');
      return;
    }

    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (bbox) qs.set('bbox', bbox);
        else qs.set('ids', stationIds || DEFAULT_IDS);
        qs.set('hours', '3');

        const res = await fetch(`/api/metar/geojson?${qs.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        const features = data.features || [];
        const mapped = features.map(formatObs).filter(Boolean) as Observation[];
        if (!cancelled) {
          setObs(mapped);
          setStatus('ok');
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load METARs');
          setStatus('error');
        }
      }
    };

    load();
    const id = window.setInterval(load, 180_000); // every 3 min
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [stationIds, bbox, legacyObs]);

  return (
    <>
      <div className="border-b border-slate-800 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
          METARs & Surface Obs
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-cyan-300">
          <span>AviationWeather.gov</span>
          {status === 'loading' && <span className="text-[10px] text-slate-500">updating…</span>}
          {status === 'ok' && <span className="text-[10px] text-emerald-400">live</span>}
          {status === 'error' && <span className="text-[10px] text-red-400">error</span>}
        </div>
      </div>

      <div className="space-y-3 p-5 font-mono text-xs leading-relaxed text-slate-200 max-h-[60vh] overflow-y-auto">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-red-300">{error}</div>
        )}

        {obs.length === 0 && status !== 'loading' && !error && (
          <div className="text-slate-500">No METARs returned for these stations.</div>
        )}

        {obs.map((o) => (
          <div key={o.station} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-bold text-cyan-300">{o.station}</span>
              {o.time && (
                <span className="text-[10px] text-slate-500">
                  {new Date(o.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="break-all text-slate-300">{o.text}</div>
            <div className="mt-2 grid grid-cols-1 gap-0.5 text-[10px] text-slate-400">
              <div>
                Temp: <span className="text-cyan-300">{o.temp}</span>
              </div>
              <div>
                Dew: <span className="text-cyan-300">{o.dewpoint}</span>
              </div>
              <div>
                Wind: <span className="text-cyan-300">{o.wind}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800 p-4 text-[10px] text-slate-500">
        Source: AviationWeather.gov · refresh ~3 min
      </div>
    </>
  );
}
