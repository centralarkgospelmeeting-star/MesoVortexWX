'use client';

import { useMemo, useState } from 'react';
import type { LiveCrossSectionResult } from '../lib/radar/cross-section-types';

type Props = { data: LiveCrossSectionResult; onClose: () => void };

function dbzColor(value: number): string {
  if (value >= 70) return '#ffffff';
  if (value >= 65) return '#9854c6';
  if (value >= 60) return '#f800fd';
  if (value >= 55) return '#d40000';
  if (value >= 50) return '#fd0000';
  if (value >= 45) return '#fd9500';
  if (value >= 40) return '#e5bc00';
  if (value >= 35) return '#fdf802';
  if (value >= 30) return '#008e00';
  if (value >= 25) return '#01c501';
  if (value >= 20) return '#02fd02';
  if (value >= 15) return '#0300f4';
  if (value >= 10) return '#019ff4';
  if (value >= 5) return '#04e9e7';
  return '#64748b';
}

export function CrossSectionModal({ data, onClose }: Props) {
  const [hover, setHover] = useState<{ distanceKm: number; heightFt: number; dbz: number; elevation: number } | null>(null);
  const maxHeightFt = useMemo(() => Math.max(1000, ...data.sweeps.flatMap((s) => s.beamHeightFtAglApprox.filter((v): v is number => v !== null && Number.isFinite(v)))), [data]);
  const maxDbz = Math.max(0, ...data.sweeps.flatMap((s) => s.reflectivityDbz.filter((v): v is number => v !== null && Number.isFinite(v))));
  const validGates = data.sweeps.reduce((n, s) => n + s.reflectivityDbz.filter((v) => v !== null).length, 0);
  const distanceMi = data.lengthKm * 0.621371;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#020617]/95 p-2 sm:p-5 font-sans">
      <section className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-sky-700/70 bg-slate-950 shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black text-white">Reflectivity Vertical Cross-Section · XSEC</h2>
              <span className="rounded-full border border-emerald-500/50 bg-emerald-950/60 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-300">Live Level II measurements</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{data.siteName} ({data.site}) · Scan {data.scanTime || 'time unavailable'} · {data.source}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700">Close ✕</button>
        </header>

        <div className="grid grid-cols-2 gap-2 border-b border-white/10 bg-slate-900/50 p-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-2"><div className="text-[9px] uppercase text-slate-500">Transect length</div><div className="text-sm font-bold text-white">{data.lengthKm.toFixed(1)} km / {distanceMi.toFixed(1)} mi</div></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-2"><div className="text-[9px] uppercase text-slate-500">Elevation sweeps</div><div className="text-sm font-bold text-white">{data.sweeps.length}</div></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-2"><div className="text-[9px] uppercase text-slate-500">Measured gates</div><div className="text-sm font-bold text-white">{validGates.toLocaleString()}</div></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-2"><div className="text-[9px] uppercase text-slate-500">Peak sampled reflectivity</div><div className="text-sm font-bold text-white">{maxDbz.toFixed(0)} dBZ</div></div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
          <div className="flex h-full min-h-[340px]">
            <div className="flex w-14 shrink-0 flex-col justify-between pb-8 pr-2 text-right text-[10px] text-slate-400">
              <span>{Math.ceil(maxHeightFt / 10000) * 10000 / 1000}k ft</span><span>{(maxHeightFt * .75 / 1000).toFixed(0)}k</span><span>{(maxHeightFt * .5 / 1000).toFixed(0)}k</span><span>{(maxHeightFt * .25 / 1000).toFixed(0)}k</span><span>0 ft</span>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-700 bg-[#030712]" onMouseLeave={() => setHover(null)}>
              {[25,50,75].map((v) => <div key={v} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-700/70" style={{top:`${100-v}%`}} />)}
              {data.sweeps.map((sweep, sweepIndex) => sweep.reflectivityDbz.map((dbz, column) => {
                const height = sweep.beamHeightFtAglApprox[column];
                if (dbz === null || height === null || !Number.isFinite(height)) return null;
                const left = data.columns <= 1 ? 0 : column / (data.columns - 1) * 100;
                const top = 100 - Math.max(0, Math.min(100, height / maxHeightFt * 100));
                return <div key={`${sweepIndex}-${column}`} onMouseEnter={() => setHover({distanceKm:data.lengthKm*column/Math.max(1,data.columns-1),heightFt:height,dbz,elevation:sweep.elevationDegrees})} title={`${dbz.toFixed(1)} dBZ · ${Math.round(height).toLocaleString()} ft · ${sweep.elevationDegrees.toFixed(2)}°`} className="absolute" style={{left:`${left}%`,top:`${top}%`,width:`${Math.max(.45,100/data.columns)}%`,height:5,backgroundColor:dbzColor(dbz),transform:'translateY(-50%)',opacity:.95}} />;
              }))}
              {validGates===0 && <div className="absolute inset-0 flex items-center justify-center p-5 text-center text-sm text-amber-300">No valid reflectivity gates intersected this transect. No synthetic echoes are displayed.</div>}
              {hover && <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-lg border border-sky-700 bg-slate-950/95 px-3 py-2 text-[11px] text-white shadow-xl">Distance {hover.distanceKm.toFixed(1)} km · Height {Math.round(hover.heightFt).toLocaleString()} ft above radar level · {hover.dbz.toFixed(1)} dBZ · Elevation {hover.elevation.toFixed(2)}°</div>}
            </div>
          </div>
          <div className="ml-14 flex justify-between pt-2 text-[10px] text-slate-400"><span>Point A · 0 km</span><span>Distance along transect</span><span>Point B · {data.lengthKm.toFixed(1)} km</span></div>
        </div>

        <footer className="border-t border-amber-500/30 bg-amber-950/30 px-4 py-3 text-[10px] leading-relaxed text-amber-200">
          {data.note} Heights are approximate above radar level, not terrain-corrected AGL. The display plots measured gates at their estimated beam heights; it does not interpolate a Cartesian 3-D volume. A cross section is a sampling transect, not an updraft, hail-size, or storm-severity diagnosis.
        </footer>
      </section>
    </div>
  );
}
