'use client';

import { useState } from 'react';
import { CrossSectionResult } from '../lib/cross-section';

type Props = {
  data: CrossSectionResult;
  onClose: () => void;
};

function getDbzColor(dbz: number): string {
  if (dbz >= 70) return '#ffffff';
  if (dbz >= 65) return '#9854c6';
  if (dbz >= 60) return '#f800fd';
  if (dbz >= 55) return '#d40000';
  if (dbz >= 50) return '#fd0000';
  if (dbz >= 45) return '#fd9500';
  if (dbz >= 40) return '#e5bc00';
  if (dbz >= 35) return '#fdf802';
  if (dbz >= 30) return '#008e00';
  if (dbz >= 25) return '#01c501';
  if (dbz >= 20) return '#02fd02';
  if (dbz >= 15) return '#0300f4';
  if (dbz >= 10) return '#019ff4';
  if (dbz >= 5) return '#04e9e7';
  return 'transparent';
}

export function CrossSectionModal({ data, onClose }: Props) {
  const [hoverData, setHoverData] = useState<{
    altFt: number;
    distNm: number;
    dbz: number;
  } | null>(null);

  const numAltRows = data.grid.length;
  const numDistCols = data.grid[0]?.length || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-xl animate-fade-in select-none font-sans">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-3xl border border-cyan-500/40 bg-slate-950 shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-3.5 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/20 text-xl text-cyan-400 border border-cyan-500/30">
              ✂️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-white">Vertical Cross-Section (SYNTHETIC / DEMO)</h2>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-cyan-300">
                  SYNTHETIC - NOT REAL VOLUMETRIC
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Cut Length: <b className="text-white">{data.lengthNm} nm</b> ({data.lengthMi} mi) · 0 to 60,000 ft AGL · <span className="text-amber-300 font-bold">SYNTHETIC</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 3 Meteorological Diagnostic Pillars: Updraft, Hail Aloft, Storm Lean */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 border-b border-white/10 p-3.5 bg-slate-950 text-xs font-sans">
          {/* Updraft Strength */}
          <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Updraft Strength</span>
              <span className="text-xs">⚡</span>
            </div>
            <div className="text-base font-black text-white mt-0.5">{data.updraftStrength}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              Overshooting Top: <b className="text-purple-300">{data.echoTopFt.toLocaleString()} ft</b>
            </p>
          </div>

          {/* Hail Potential Aloft */}
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Hail Potential Aloft</span>
              <span className="text-xs">🧊</span>
            </div>
            <div className="text-base font-black text-rose-200 mt-0.5">{data.hailPotential}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              Core Aloft: <b className="text-rose-400">{data.maxDbzAloft} dBZ</b> at {data.maxAltitudeFt.toLocaleString()} ft
            </p>
          </div>

          {/* Storm Lean / Tilt */}
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Storm Lean / Tilt</span>
              <span className="text-xs">↗️</span>
            </div>
            <div className="text-sm font-black text-cyan-200 mt-0.5 truncate">{data.stormLeanDirection}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              Displacement: <b className="text-cyan-300">{data.stormLeanDisplacementNm} nm</b> downshear
            </p>
          </div>
        </div>

        {/* Data honesty warning */}
        <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-500/30 text-[11px] text-amber-200 font-sans">
          ⚠ {data.dataHonestyNote || 'SYNTHETIC/MODEL-DERIVED visualization. Not a real volumetric reconstruction. Do not use for operational decisions.'}
        </div>

        {/* Main RHI Vertical Atmospheric Slicing Grid */}
        <div className="relative flex-1 p-5 flex flex-col justify-between bg-[#030611] overflow-hidden">
          {/* 0°C Freezing Level Isotherm */}
          <div className="pointer-events-none absolute left-14 right-6 top-[63%] border-b border-dashed border-cyan-400/60 flex justify-between text-[9px] text-cyan-300 z-10">
            <span className="bg-slate-950/80 px-1 rounded">0°C Freezing Level (~12,500 ft)</span>
          </div>

          {/* -20°C Hail Growth Zone Isotherm */}
          <div className="pointer-events-none absolute left-14 right-6 top-[47%] border-b border-dashed border-amber-400/60 flex justify-between text-[9px] text-amber-300 z-10">
            <span className="bg-slate-950/80 px-1 rounded">-20°C Hail Growth Zone (~22,000 ft)</span>
          </div>

          {/* Vertical Matrix View */}
          <div className="flex flex-1 min-h-0">
            {/* Y-Axis Altitude Scale */}
            <div className="flex flex-col justify-between pr-2 text-[10px] text-slate-500 font-bold select-none text-right w-12">
              <span>60k ft</span>
              <span>45k ft</span>
              <span>30k ft</span>
              <span>15k ft</span>
              <span>0 ft</span>
            </div>

            {/* Canvas Sliced Cells */}
            <div
              className="relative flex-1 border border-white/15 rounded-2xl overflow-hidden flex flex-col cursor-crosshair bg-[#010309]"
              onMouseLeave={() => setHoverData(null)}
            >
              {data.grid.map((row, rIdx) => {
                const altFt = Math.round(((numAltRows - 1 - rIdx) / (numAltRows - 1)) * 60000);
                return (
                  <div key={rIdx} className="flex flex-1">
                    {row.map((val, cIdx) => {
                      const distNm = Math.round((cIdx / (numDistCols - 1)) * data.lengthNm * 10) / 10;
                      return (
                        <div
                          key={cIdx}
                          style={{ backgroundColor: getDbzColor(val) }}
                          className="flex-1 hover:brightness-125 transition-all"
                          onMouseEnter={() =>
                            setHoverData({
                              altFt,
                              distNm,
                              dbz: val,
                            })
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-Axis Baseline Scale */}
          <div className="flex justify-between pl-14 pr-2 pt-2 text-[10px] text-slate-400 font-sans">
            <span className="font-bold text-cyan-400">Point A (0.0 nm)</span>
            <span className="text-slate-500">Horizontal Cut Length ({data.lengthNm} nm)</span>
            <span className="font-bold text-purple-400">Point B ({data.lengthNm} nm)</span>
          </div>

          {/* Live Hover Telemetry Footer */}
          {hoverData && (
            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-cyan-500/40 bg-slate-900/90 px-4 py-2 text-xs animate-fade-in font-mono">
              <div>
                <span className="text-slate-400">Altitude:</span> <b className="text-cyan-400">{hoverData.altFt.toLocaleString()} ft AGL</b>
              </div>
              <div>
                <span className="text-slate-400">Distance Along Cut:</span> <b className="text-white">{hoverData.distNm} nm</b>
              </div>
              <div>
                <span className="text-slate-400">Reflectivity:</span> <b className="text-emerald-400">{hoverData.dbz} dBZ</b>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
