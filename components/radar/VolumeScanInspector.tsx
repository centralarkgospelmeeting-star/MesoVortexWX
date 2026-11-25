'use client';

import { useEffect, useState } from 'react';
import { getRadarCapability } from '../../lib/radar/capability-matrix';

type MomentSummary = { name: string; radials: number; gates: number; gateSizeKm: number | null };
type SweepSummary = { sweep: number; elevationDegrees: number | null; radialCount: number; moments: MomentSummary[] };
type VolumeSummary = { available: boolean; site?: string; siteName?: string; scanTime?: string; source?: string; liveOnly?: boolean; sweeps?: SweepSummary[]; error?: string };

const MOMENT_PRODUCTS: Record<string, string> = { REF: 'ref', VEL: 'vel', SW: 'sw', CC: 'cc', ZDR: 'zdr', PHI: 'kdp' };

/**
 * A Level II sweep reports measured elevation (for example 0.49° or 1.31°),
 * while the renderable IEM products accept fixed codes (0.5/0.9/1.3/1.8).
 * Map only when the measured cut is close enough to a supported code; never
 * relabel a distant sweep as an unsupported tilt.
 */
export function mapMeasuredElevationToTilt(product: string, elevationDegrees: number): string | null {
  if (!Number.isFinite(elevationDegrees)) return null;
  const supported = getRadarCapability(product)?.tiltSupport ?? [];
  let best: string | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const code of supported) {
    const value = Number(code);
    if (!Number.isFinite(value)) continue;
    const delta = Math.abs(value - elevationDegrees);
    if (delta < bestDelta) {
      best = code;
      bestDelta = delta;
    }
  }
  return best && bestDelta <= 0.2 ? best : null;
}

export function VolumeScanInspector({
  siteId,
  onSelectProduct,
  onSelectTilt,
  onSelectMoment,
  onClose,
}: {
  siteId: string;
  onSelectProduct: (product: string) => void;
  onSelectTilt?: (tilt: string) => void;
  onSelectMoment?: (product: string, tilt: string) => void;
  onClose?: () => void;
}) {
  const [summary, setSummary] = useState<VolumeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setSummary(null);
    fetch(`/api/radar/volume?site=${encodeURIComponent(siteId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as VolumeSummary;
        if (!response.ok || !result.available) throw new Error(result.error || `Volume request failed (${response.status})`);
        setSummary(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setSummary({ available: false, error: error instanceof Error ? error.message : 'Unable to load scan' });
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [siteId, refresh]);

  const applyMoment = (product: string, tilt: string) => {
    if (onSelectMoment) {
      onSelectMoment(product, tilt);
      return;
    }
    onSelectTilt?.(tilt);
    onSelectProduct(product);
  };

  return (
    <section data-volume-inspector="open" className="pointer-events-auto absolute right-4 top-4 z-30 w-[min(24rem,calc(100vw-2rem))] max-h-[55vh] overflow-hidden rounded-xl border border-slate-700 bg-[#0b1220]/95 text-slate-100 shadow-2xl backdrop-blur">
      <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div><div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Live NEXRAD Level II</div><h2 className="text-sm font-bold">Volume scan · {siteId}</h2></div>
        <div className="flex items-center gap-1">
          <button className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold hover:bg-slate-700" onClick={() => setRefresh((n) => n + 1)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
          {onClose && <button type="button" onClick={onClose} className="rounded px-1.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close volume inspector">✕</button>}
        </div>
      </header>
      <div className="max-h-[calc(55vh-3.5rem)] overflow-y-auto p-3 text-xs">
        {loading && <p className="p-2 text-slate-300">Fetching the current scan from NOAA’s AWS Level II feed…</p>}
        {!loading && summary?.error && <div className="rounded border border-amber-700/60 bg-amber-950/30 p-3 text-amber-200"><div className="font-bold">Live volume unavailable</div><p className="mt-1 break-words">{summary.error}</p></div>}
        {!loading && summary?.available && <>
          <div data-volume-metadata className="mb-3 rounded bg-slate-900 p-2 text-[10px] text-slate-300">
            <div>{summary.siteName} · Scan time {summary.scanTime ? `${new Date(summary.scanTime).toISOString().replace('T', ' ').slice(0, 19)} UTC` : 'unknown'}</div>
            <div className="mt-1 text-slate-500">{summary.source} · {summary.liveOnly === false ? 'Verified archive' : 'Live only'} · {summary.sweeps?.length ?? 0} sweeps</div>
          </div>
          <div className="space-y-2">
            {(summary.sweeps || []).map((sweep) => (
              <article key={sweep.sweep} className="rounded border border-slate-700 bg-slate-900/80 p-2.5">
                <div className="flex items-center justify-between"><strong>Sweep {sweep.sweep} · {sweep.elevationDegrees == null ? 'angle unavailable' : `${sweep.elevationDegrees.toFixed(2)}° measured`}</strong><span className="text-[10px] text-slate-400">{sweep.radialCount} radials</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sweep.moments.map((moment) => {
                    const product = MOMENT_PRODUCTS[moment.name];
                    const mappedTilt = product && sweep.elevationDegrees != null ? mapMeasuredElevationToTilt(product, sweep.elevationDegrees) : null;
                    const canRender = Boolean(product && mappedTilt);
                    const title = canRender
                      ? `${moment.name}: measured ${sweep.elevationDegrees?.toFixed(2)}° -> renderable ${mappedTilt}° · ${moment.radials} radials · ${moment.gates.toLocaleString()} gates${moment.gateSizeKm ? ` · ${moment.gateSizeKm} km gate spacing` : ''}`
                      : `${moment.name}: ${product ? `measured ${sweep.elevationDegrees?.toFixed(2)}° has no supported renderable tilt` : 'no verified renderable product'}`;
                    return (
                      <button
                        key={moment.name}
                        type="button"
                        disabled={!canRender}
                        data-mapped-tilt={mappedTilt || ''}
                        title={title}
                        onClick={() => product && mappedTilt && applyMoment(product, mappedTilt)}
                        className="rounded bg-slate-800 px-2 py-1 font-mono text-[10px] font-bold text-cyan-200 hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {moment.name}
                        {mappedTilt && <span className="ml-1 text-slate-400">→{mappedTilt}°</span>}
                        <span className="ml-1 text-slate-500">{moment.radials}r</span>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-slate-500">Measured Level II elevations are mapped to supported renderable tilts. Sweeps with no nearby supported code stay disabled rather than being silently relabeled. KDP is derived from the scan’s differential-phase (PHI) moment.</p>
        </>}
      </div>
    </section>
  );
}
