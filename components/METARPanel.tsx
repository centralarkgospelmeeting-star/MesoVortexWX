'use client';

import { useMemo, type ReactNode } from 'react';

export type SurfaceSource = 'metar' | 'asos';

type METARPanelProps = {
  /** Map camera center used only for nearest-station sorting. */
  center: { lat: number; lon: number } | null;
  /** Normalized features from /api/metar/geojson or /api/asos/geojson. */
  features: any[];
  source: SurfaceSource;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string | null;
};

const FLIGHT_TONE: Record<string, string> = {
  VFR: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/30',
  MVFR: 'text-sky-300 border-sky-500/40 bg-sky-950/30',
  IFR: 'text-amber-300 border-amber-500/40 bg-amber-950/30',
  LIFR: 'text-red-300 border-red-500/40 bg-red-950/30',
};

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function finite(value: unknown): number | null {
  const n = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(n) ? n : null;
}

function milesBetween(lat0: number, lon0: number, lat1: number, lon1: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat1 - lat0);
  const dLon = toRad(lon1 - lon0);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat0)) * Math.cos(toRad(lat1)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeLabel(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(11, 16) + 'Z';
}

export function METARPanel({ center, features, source, status, error }: METARPanelProps): ReactNode {
  const stations = useMemo(() => {
    const usable = features
      .map((feature) => {
        const p = feature?.properties || feature || {};
        const lat = finite(p.lat ?? feature?.geometry?.coordinates?.[1]);
        const lon = finite(p.lon ?? feature?.geometry?.coordinates?.[0]);
        const id = String(p.stationId || p.icaoId || p.stationId || feature?.id || '').trim();
        if (!id || lat === null || lon === null) return null;
        return {
          id,
          name: p.siteName || p.site || null,
          lat,
          lon,
          distance: center ? milesBetween(center.lat, center.lon, lat, lon) : null,
          tempC: finite(p.tempC ?? p.temp),
          dewC: finite(p.dewpointC ?? p.dewp),
          wdir: p.windDirDeg ?? p.wdir,
          wspd: finite(p.windSpeedKt ?? p.wspd),
          wgst: finite(p.windGustKt ?? p.wgst),
          flight: String(p.flightCategory || p.fltcat || '').trim().toUpperCase() || null,
          visib: p.visibilitySm || p.visib || null,
          ceil: finite(p.ceilingFt ?? p.ceil),
          altim: finite(p.altimeterInHg ?? p.altim),
          time: timeLabel(p.obsTime),
          raw: String(p.rawOb || p.raw || ''),
          asos: p.asos === true,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    usable.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    return usable.slice(0, 20);
  }, [features, center]);

  const sourceLabel = source === 'asos'
    ? 'ASOS automated reports · classified from real METAR remarks'
    : 'AviationWeather.gov METAR';

  return (
    <div className="space-y-3 text-[11px] text-slate-300">
      <div className="rounded-lg border border-slate-700 bg-[#0b1220] p-2">
        <div className="font-bold text-sky-300">{sourceLabel}</div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
          <span>{stations.length} nearest shown</span>
          {status === 'loading' && <span className="text-slate-400">updating…</span>}
          {status === 'ready' && <span className="text-emerald-400">live</span>}
          {status === 'error' && <span className="text-red-400">error</span>}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-2 text-red-300">{error}</div>
      )}

      {stations.length === 0 && status !== 'loading' && !error && (
        <div className="text-slate-500">
          No {source === 'asos' ? 'ASOS-marked' : 'METAR'} reports returned for the current map area.
        </div>
      )}

      <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
        {stations.map((s) => (
          <div key={s.id} className="rounded-lg border border-slate-700 bg-[#0b1220] p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black text-sky-300">{s.id}</span>
              <span className="flex items-center gap-1.5">
                {s.asos && (
                  <span className="rounded border border-slate-600 px-1 text-[9px] text-slate-400">ASOS</span>
                )}
                {s.flight && (
                  <span className={`rounded border px-1 text-[9px] font-bold ${FLIGHT_TONE[s.flight] || 'text-slate-300 border-slate-600'}`}>
                    {s.flight}
                  </span>
                )}
                {s.distance !== null && (
                  <span className="text-[9px] text-slate-500">{Math.round(s.distance)} mi</span>
                )}
              </span>
            </div>
            {s.name && <div className="mt-0.5 truncate text-[10px] text-slate-500">{s.name}</div>}
            {s.time && <div className="mt-0.5 text-[9px] text-slate-500">Observed {s.time}</div>}

            <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
              <div>Temp <span className="text-sky-300">{s.tempC !== null ? `${s.tempC}°C / ${cToF(s.tempC)}°F` : '—'}</span></div>
              <div>Dew <span className="text-sky-300">{s.dewC !== null ? `${s.dewC}°C / ${cToF(s.dewC)}°F` : '—'}</span></div>
              <div>Wind <span className="text-sky-300">{s.wspd !== null ? `${String(s.wdir ?? 'VRB')}° ${s.wspd} kt${s.wgst !== null ? ` G${s.wgst}` : ''}` : '—'}</span></div>
              <div>Vis <span className="text-sky-300">{s.visib ?? '—'}{s.visib ? ' sm' : ''}</span></div>
              <div>Ceiling <span className="text-sky-300">{s.ceil !== null ? `${s.ceil} ft` : '—'}</span></div>
              <div>Alt <span className="text-sky-300">{s.altim !== null ? `${s.altim} inHg` : '—'}</span></div>
            </div>
            {s.raw && <div className="mt-1.5 break-all font-mono text-[9px] leading-relaxed text-slate-500">{s.raw}</div>}
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800 pt-2 text-[9px] leading-relaxed text-slate-500">
        Surface conditions are observations, not a forecast or a warning. No value is shown when the real report omits it.
      </div>
    </div>
  );
}
