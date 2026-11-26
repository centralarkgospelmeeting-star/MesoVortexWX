'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeEnvironmentalIndices,
  DATA_UNAVAILABLE,
  parseSoundingLevels,
  type SoundingIndices,
  type SoundingLevel,
} from '../../lib/sounding/analysis';

type Props = { open: boolean; lat: number; lon: number; onClose: () => void };

type Loaded = {
  station: string;
  source: string;
  observedAt: string | null;
  levels: SoundingLevel[];
  error: string | null;
};

const INDEX_LABELS: Array<{ key: keyof SoundingIndices; label: string }> = [
  { key: 'sbcape', label: 'SBCAPE' },
  { key: 'mlcape', label: 'MLCAPE' },
  { key: 'mucape', label: 'MUCAPE' },
  { key: 'cin', label: 'CIN' },
  { key: 'li', label: 'LI' },
  { key: 'srh01', label: 'SRH 0–1 km' },
  { key: 'srh03', label: 'SRH 0–3 km' },
  { key: 'shear06', label: 'Shear 0–6 km' },
  { key: 'ehi', label: 'EHI' },
  { key: 'stp', label: 'STP' },
  { key: 'scp', label: 'SCP' },
  { key: 'dcape', label: 'DCAPE' },
  { key: 'pwat', label: 'PWAT' },
  { key: 'lclM', label: 'LCL' },
  { key: 'lfcM', label: 'LFC' },
  { key: 'elM', label: 'EL' },
  { key: 'freezingLevelM', label: 'Freezing level' },
  { key: 'wbzM', label: 'WBZ height' },
];

function valueText(value: number | null, key: keyof SoundingIndices): string {
  if (value === null) return DATA_UNAVAILABLE;
  const units = ['lclM', 'lfcM', 'elM', 'freezingLevelM', 'wbzM'].includes(key) ? ' m' : key === 'pwat' ? ' in' : '';
  return `${value}${units}`;
}

/** Atmospheric Analysis: real sounding levels only, no default parameters. */
export function AtmosphericAnalysisPanel({ open, lat, lon, onClose }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState({ w: 720, h: 560 });
  const [collapsed, setCollapsed] = useState(false);
  const skewRef = useRef<HTMLCanvasElement | null>(null);
  const hodoRef = useRef<HTMLCanvasElement | null>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/sounding/nearest?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        setLoaded({
          station: data?.station || DATA_UNAVAILABLE,
          source: data?.source || 'IEM RAOB observed sounding',
          observedAt: data?.observedAt || null,
          levels: parseSoundingLevels(data?.levels),
          error: data?.available ? null : data?.error || DATA_UNAVAILABLE,
        });
      } catch (error) {
        if (!cancelled) setLoaded({ station: DATA_UNAVAILABLE, source: 'IEM RAOB', observedAt: null, levels: [], error: String(error) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, lat, lon]);

  const levels = useMemo(() => loaded?.levels || [], [loaded]);
  const indices = useMemo(() => computeEnvironmentalIndices(levels), [levels]);

  useEffect(() => {
    if (!open || collapsed) return;
    const canvas = skewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#071426';
    ctx.fillRect(0, 0, w, h);
    const usable = levels.filter((l) => l.pressureMb !== null && l.tempC !== null);
    if (!usable.length) return;
    const minP = 200;
    const maxP = 1000;
    const x = (temp: number) => 30 + ((temp + 40) / 90) * (w - 50);
    const y = (p: number) => 12 + ((maxP - p) / (maxP - minP)) * (h - 28);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1;
    for (const p of [1000, 850, 700, 500, 400, 300, 200]) {
      ctx.beginPath(); ctx.moveTo(24, y(p)); ctx.lineTo(w - 8, y(p)); ctx.stroke();
      ctx.fillStyle = '#64748b'; ctx.font = '10px monospace'; ctx.fillText(String(p), 2, y(p) + 3);
    }
    const trace = (field: 'tempC' | 'dewC', color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      let started = false;
      for (const l of usable) {
        const v = l[field];
        if (v === null) continue;
        if (!started) { ctx.moveTo(x(v), y(l.pressureMb as number)); started = true; }
        else ctx.lineTo(x(v), y(l.pressureMb as number));
      }
      ctx.stroke();
    };
    trace('tempC', '#f87171');
    trace('dewC', '#34d399');
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace';
    ctx.fillText('T', x(-10), 12); ctx.fillText('Td', x(-35), 12);
  }, [levels, open, collapsed, size]);

  useEffect(() => {
    if (!open || collapsed) return;
    const canvas = hodoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#071426';
    ctx.fillRect(0, 0, w, h);
    const winds = levels.filter((l) => l.heightM !== null && l.windDirDeg !== null && l.windSpdKt !== null)
      .sort((a, b) => (a.heightM as number) - (b.heightM as number));
    if (!winds.length) return;
    const maxKt = Math.max(30, ...winds.map((l) => l.windSpdKt as number));
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(cx, cy) / (maxKt * 1.1);
    ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 1;
    for (const kt of [10, 20, 30, 50]) {
      ctx.beginPath(); ctx.arc(cx, cy, kt * scale, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath();
    winds.forEach((l, i) => {
      const rad = (l.windDirDeg as number) * Math.PI / 180;
      const u = -(l.windSpdKt as number) * Math.sin(rad);
      const v = -(l.windSpdKt as number) * Math.cos(rad);
      const px = cx + u * scale;
      const py = cy - v * scale;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace'; ctx.fillText('0–6 km wind path', 8, 14);
  }, [levels, open, collapsed, size]);

  const exportPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#050a12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Atmospheric Analysis — ${loaded?.station || DATA_UNAVAILABLE}`, 20, 30);
    ctx.drawImage(skewRef.current!, 20, 50, 560, 560);
    ctx.drawImage(hodoRef.current!, 600, 50, 560, 560);
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px monospace';
    ctx.fillText('Real sounding levels only. Missing parameters are DATA UNAVAILABLE.', 20, 640);
    const link = document.createElement('a');
    link.download = `atmospheric-analysis-${Math.round(lat)}-${Math.round(lon)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!open) return null;

  return (
    <div
      data-atmospheric-analysis="true"
      className="fixed bottom-4 left-4 z-40 flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#0b1220] text-slate-100 shadow-2xl"
      style={{ width: size.w, height: collapsed ? undefined : size.h, maxWidth: 'calc(100vw - 2rem)', maxHeight: 'calc(100vh - 5rem)' }}
    >
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <div className="text-[11px] font-black uppercase tracking-wider text-sky-300">Atmospheric Analysis · {loaded?.station || 'Loading…'}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setCollapsed((v) => !v)} className="rounded px-1 text-slate-400 hover:text-white" aria-label={collapsed ? 'Expand analysis panel' : 'Collapse analysis panel'}>{collapsed ? '▸' : '▾'}</button>
          <button type="button" onClick={exportPng} className="rounded border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:bg-slate-800">Export PNG</button>
          <button type="button" onClick={onClose} className="rounded px-1 text-slate-400 hover:text-white" aria-label="Close analysis panel">✕</button>
        </div>
      </div>
      {!collapsed && (
        <>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className="mb-2 text-[10px] text-slate-500">
              {loading ? 'Reading real sounding levels…' : loaded?.error || `${loaded?.source} · ${loaded?.observedAt || 'time unavailable'}`}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Skew-T / Log-P</div>
                <canvas ref={skewRef} width={560} height={560} className="h-auto w-full rounded border border-slate-800" data-skewt-canvas="true" />
              </div>
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Hodograph · 0–1/3/6 km</div>
                <canvas ref={hodoRef} width={560} height={560} className="h-auto w-full rounded border border-slate-800" data-hodograph-canvas="true" />
                <div className="mt-1 text-[10px] text-slate-500">
                  {indices.stormMotion ? `Storm motion ${indices.stormMotion.dirDeg}° / ${indices.stormMotion.speedKt} kt (real winds)` : DATA_UNAVAILABLE}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1 text-[10px] sm:grid-cols-4">
              {INDEX_LABELS.map(({ key, label }) => (
                <div key={key} className="rounded border border-slate-800 bg-[#0f172a] px-1.5 py-1">
                  <div className="text-slate-500">{label}</div>
                  <div className={`font-mono font-bold ${indices[key] === null ? 'text-amber-300' : 'text-slate-100'}`}>{valueText(indices[key] as number | null, key)}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-slate-500">Parcel path uses real levels; source-provided MLCAPE/MUCAPE/DCAPE/PWAT are not synthesized here.</div>
          </div>
          <div
            data-analysis-resize="true"
            className="h-3 shrink-0 cursor-nwse-resize border-t border-slate-700 bg-slate-800/60"
            onPointerDown={(event) => { resizeRef.current = { x: event.clientX, y: event.clientY, w: size.w, h: size.h }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => {
              if (!resizeRef.current) return;
              const start = resizeRef.current;
              setSize({
                w: Math.max(420, Math.min(window.innerWidth - 32, start.w + event.clientX - start.x)),
                h: Math.max(360, Math.min(window.innerHeight - 80, start.h + event.clientY - start.y)),
              });
            }}
            onPointerUp={() => { resizeRef.current = null; }}
            title="Drag to resize"
          />
        </>
      )}
    </div>
  );
}
