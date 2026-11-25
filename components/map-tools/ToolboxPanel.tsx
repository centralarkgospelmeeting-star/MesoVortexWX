'use client';

import { useMemo, useState } from 'react';
import { distanceMeters } from '../../lib/map-tools/geo';

export type ToolMode = 'none' | 'measure-distance' | 'measure-area' | 'draw-point' | 'draw-line' | 'draw-polygon' | 'annotate';

export interface MeasurementRecord {
  id: string;
  kind: 'distance' | 'area';
  label: string;
  value: string;
  points: Array<[number, number]>;
}

export interface DrawingRecord {
  id: string;
  kind: 'point' | 'line' | 'polygon' | 'annotation';
  label?: string;
  points: Array<[number, number]>;
  color: string;
}

export function ToolboxPanel({
  toolMode,
  onSetToolMode,
  measurements,
  drawings,
  onClearMeasurements,
  onClearDrawings,
  onUndoDrawing,
  onExportPng,
  onExportGif,
  exportBusy,
  exportStatus,
  canExport,
  cursor,
  onCopyCoordinates,
}: {
  toolMode: ToolMode;
  onSetToolMode: (m: ToolMode) => void;
  measurements: MeasurementRecord[];
  drawings: DrawingRecord[];
  onClearMeasurements: () => void;
  onClearDrawings: () => void;
  onUndoDrawing: () => void;
  onExportPng: () => void;
  onExportGif: () => void;
  exportBusy: boolean;
  exportStatus?: string;
  canExport: boolean;
  cursor?: { lat: number; lon: number } | null;
  onCopyCoordinates?: () => void;
}) {
  const btn = (active: boolean) => `rounded-lg px-2 py-1.5 text-[11px] font-bold border transition ${active ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'}`;
  const [motionMinutes, setMotionMinutes] = useState(5);
  const motion = useMemo(() => {
    const line = drawings.filter((d) => d.kind === 'line').slice(-1)[0];
    if (!line || line.points.length < 2) return null;
    const [a, b] = line.points;
    const meters = distanceMeters(a, b);
    const toRad = (d: number) => d * Math.PI / 180;
    const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
    const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
    return {
      bearing: Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360),
      speedKt: Math.round((meters / 1852) / (motionMinutes / 60)),
    };
  }, [drawings, motionMinutes]);
  return (
    <div className="rounded-2xl border border-slate-700 bg-[#0b1220] p-3 shadow-2xl text-slate-100 space-y-3">
      <div>
        <div className="text-[10px] font-black uppercase tracking-wider text-sky-300 mb-2">Workstation Tools</div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className={btn(toolMode==='measure-distance')} onClick={()=>onSetToolMode(toolMode==='measure-distance'?'none':'measure-distance')}>📏 Distance</button>
          <button type="button" className={btn(toolMode==='measure-area')} onClick={()=>onSetToolMode(toolMode==='measure-area'?'none':'measure-area')}>▱ Area</button>
          <button type="button" className={btn(toolMode==='draw-point')} onClick={()=>onSetToolMode(toolMode==='draw-point'?'none':'draw-point')}>• Point</button>
          <button type="button" className={btn(toolMode==='draw-line')} onClick={()=>onSetToolMode(toolMode==='draw-line'?'none':'draw-line')}>／ Line</button>
          <button type="button" className={btn(toolMode==='draw-polygon')} onClick={()=>onSetToolMode(toolMode==='draw-polygon'?'none':'draw-polygon')}>△ Polygon</button>
          <button type="button" className={btn(toolMode==='annotate')} onClick={()=>onSetToolMode(toolMode==='annotate'?'none':'annotate')}>T Annotate</button>
        </div>
        <div className="mt-2 text-[10px] text-slate-400 leading-snug">
          Measurements/drawings are local user annotations (not meteorological data). Double-click to finish line/area. Esc cancels active tool.
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 rounded border border-slate-800 bg-[#0b1220] px-2 py-1.5">
          <span className="font-mono text-[10px] text-slate-200">{cursor ? `${cursor.lat.toFixed(4)}, ${cursor.lon.toFixed(4)}` : 'Move cursor over map'}</span>
          <button type="button" disabled={!cursor} onClick={onCopyCoordinates} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-300 disabled:opacity-40 hover:bg-slate-800">Copy lat/lon</button>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-2">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Storm motion estimate</div>
        <div className="flex items-center gap-2 text-[10px] text-slate-300">
          <label className="flex items-center gap-1">Interval
            <input type="number" min={1} max={60} value={motionMinutes} onChange={(e) => setMotionMinutes(Math.max(1, Math.min(60, Number(e.target.value) || 5)))} className="w-14 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 font-mono text-slate-100" />
          </label>
          <span>min between positions</span>
        </div>
        <div className="mt-1 text-[11px] font-bold text-sky-300">
          {motion ? `${motion.bearing}° at ${motion.speedKt} kt` : 'Draw a line between two positions.'}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">Derived from operator line and interval; not an observed storm track.</div>
      </div>

      <div className="border-t border-slate-800 pt-2">
        <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Measurements</span><button type="button" onClick={onClearMeasurements} className="text-[10px] text-slate-400 hover:text-white">Clear</button></div>
        {measurements.length === 0 ? <div className="text-[10px] text-slate-500">No measurements.</div> : <div className="space-y-1 max-h-24 overflow-auto">{measurements.map(m => <div key={m.id} className="text-[10px] font-mono text-slate-300"><span className="text-sky-300">{m.kind==='distance'?'DIST':'AREA'}:</span> {m.value}</div>)}</div>}
      </div>

      <div className="border-t border-slate-800 pt-2">
        <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Annotations</span><div className="flex gap-2"><button type="button" onClick={onUndoDrawing} className="text-[10px] text-slate-400 hover:text-white">Undo</button><button type="button" onClick={onClearDrawings} className="text-[10px] text-slate-400 hover:text-white">Clear</button></div></div>
        {drawings.length === 0 ? <div className="text-[10px] text-slate-500">No drawings/annotations.</div> : <div className="text-[10px] text-slate-400">{drawings.length} item(s) on map.</div>}
      </div>

      <div className="border-t border-slate-800 pt-2 space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Export (real frames only)</div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={!canExport || exportBusy} onClick={onExportPng} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-slate-200 disabled:opacity-40 hover:bg-slate-800">PNG Snapshot</button>
          <button type="button" disabled={!canExport || exportBusy} onClick={onExportGif} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-slate-200 disabled:opacity-40 hover:bg-slate-800">{exportBusy ? 'Exporting…' : 'GIF Export'}</button>
        </div>
        <div className="text-[10px] text-slate-500 leading-snug">Exports include visible timestamp/source labels. No fabricated/interpolated weather frames are added.</div>
        {exportStatus && <div className="text-[10px] text-amber-300">{exportStatus}</div>}
      </div>
    </div>
  );
}
