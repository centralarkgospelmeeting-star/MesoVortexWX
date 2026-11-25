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

const DBZ_LEGEND = [
  { label: '0–9', value: 5 }, { label: '10–19', value: 15 },
  { label: '20–29', value: 25 }, { label: '30–39', value: 35 },
  { label: '40–49', value: 45 }, { label: '50–59', value: 55 },
  { label: '60+', value: 65 },
];

export function CrossSectionModal({ data, onClose }: Props) {
  const [hover, setHover] = useState<{ distanceKm: number; heightFt: number; dbz: number; elevation: number } | null>(null);
  const maxHeightFt = useMemo(
    () => Math.max(1000, ...data.sweeps.flatMap((s) => s.beamHeightFtAboveRadar.filter((v): v is number => v !== null && Number.isFinite(v)))),
    [data],
  );
  const axisMaxFt = Math.max(5000, Math.ceil(maxHeightFt / 5000) * 5000);
  const axisTicks = [0, 0.25, 0.5, 0.75, 1];
  const maxDbz = Math.max(0, ...data.sweeps.flatMap((s) => s.reflectivityDbz.filter((v): v is number => v !== null && Number.isFinite(v))));
  const validGates = data.sweeps.reduce((n, s) => n + s.reflectivityDbz.filter((v) => v !== null).length, 0);
  const distanceMi = data.lengthKm * 0.621371;
  const plot = { left: 12, right: 992, top: 12, bottom: 532 };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;

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
          <div className="flex h-full min-h-[360px] flex-col">
            <div className="flex min-h-0 flex-1">
              <div className="flex w-16 shrink-0 flex-col justify-between pb-1 pr-2 text-right text-[10px] tabular-nums text-slate-400">
                {axisTicks.slice().reverse().map((fraction) => (
                  <span key={fraction}>{Math.round(axisMaxFt * fraction).toLocaleString()} ft</span>
                ))}
              </div>
              <div className="relative min-h-0 flex-1 rounded-lg border border-slate-700 bg-[#030712]" onMouseLeave={() => setHover(null)}>
                <svg className="h-full w-full" viewBox="0 0 1000 545" preserveAspectRatio="none" role="img" aria-label="Measured radar reflectivity gates plotted by distance along the transect and estimated beam height above radar level">
                  {axisTicks.map((fraction) => {
                    const y = plot.bottom - fraction * plotHeight;
                    return <line key={'y'+fraction} x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#475569" strokeDasharray="5 7" strokeOpacity=".65" />;
                  })}
                  {axisTicks.map((fraction) => {
                    const x = plot.left + fraction * plotWidth;
                    return <line key={'x'+fraction} x1={x} x2={x} y1={plot.top} y2={plot.bottom} stroke="#334155" strokeDasharray="4 8" strokeOpacity=".55" />;
                  })}
                  {data.sweeps.map((sweep, sweepIndex) => sweep.reflectivityDbz.map((dbz, column) => {
                    const height = sweep.beamHeightFtAboveRadar[column];
                    if (dbz === null || height === null || !Number.isFinite(height)) return null;
                    const x = plot.left + (data.columns <= 1 ? 0 : column / (data.columns - 1) * plotWidth);
                    const y = plot.bottom - Math.max(0, Math.min(axisMaxFt, height)) / axisMaxFt * plotHeight;
                    const width = Math.max(2.5, plotWidth / Math.max(1, data.columns) * 0.82);
                    return (
                      <rect
                        key={sweepIndex + '-' + column}
                        x={x - width / 2}
                        y={y - 4}
                        width={width}
                        height="8"
                        rx="1.5"
                        fill={dbzColor(dbz)}
                        fillOpacity=".96"
                        stroke="#020617"
                        strokeOpacity=".25"
                        strokeWidth=".6"
                        onMouseEnter={() => setHover({
                          distanceKm: data.lengthKm * column / Math.max(1, data.columns - 1),
                          heightFt: height,
                          dbz,
                          elevation: sweep.elevationDegrees,
                        })}
                      >
                        <title>{dbz.toFixed(1)} dBZ · {Math.round(height).toLocaleString()} ft above radar level · {sweep.elevationDegrees.toFixed(2)}° elevation</title>
                      </rect>
                    );
                  }))}
                </svg>
                {validGates === 0 && <div className="absolute inset-0 flex items-center justify-center p-5 text-center text-sm text-amber-300">No valid reflectivity gates intersected this transect. No synthetic echoes are displayed.</div>}
                {hover && (
                  <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-lg border border-sky-700 bg-slate-950/95 px-3 py-2 text-[11px] text-white shadow-xl">
                    <div className="font-bold text-sky-300">Measured gate</div>
                    <div>{hover.distanceKm.toFixed(1)} km along transect</div>
                    <div>{Math.round(hover.heightFt).toLocaleString()} ft above radar level</div>
                    <div>{hover.dbz.toFixed(1)} dBZ · {hover.elevation.toFixed(2)}° sweep</div>
                  </div>
                )}
              </div>
            </div>
            <div className="ml-16 flex justify-between pt-2 text-[10px] tabular-nums text-slate-400">
              {axisTicks.map((fraction) => <span key={fraction}>{(data.lengthKm * fraction).toFixed(0)} km</span>)}
            </div>
            <div className="ml-16 mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 pt-3">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Reflectivity</span>
              {DBZ_LEGEND.map((item) => (
                <span key={item.label} className="flex items-center gap-1 text-[10px] text-slate-300">
                  <span className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: dbzColor(item.value) }} />
                  {item.label} dBZ
                </span>
              ))}
            </div>
            <div className="ml-16 mt-2 text-[10px] text-slate-500">Horizontal axis: distance along Point A–B transect · Vertical axis: estimated beam height above radar level</div>
          </div>
        </div>

        <footer className="border-t border-amber-500/30 bg-amber-950/30 px-4 py-3 text-[10px] leading-relaxed text-amber-200">
          {data.note} Heights are approximate above radar level, not terrain-corrected AGL. The display plots measured gates at their estimated beam heights; it does not interpolate a Cartesian 3-D volume. A cross section is a sampling transect, not an updraft, hail-size, or storm-severity diagnosis.
        </footer>
      </section>
    </div>
  );
}
