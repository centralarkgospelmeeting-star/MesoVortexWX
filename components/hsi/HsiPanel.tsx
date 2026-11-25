'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WeatherAlert } from '../../lib/alerts/model';
import {
  alertsForHsiScope,
  calculateHsi,
  hsiAreaLabel,
  lightningToInput,
  spcCategoryAtPoint,
  stormAnalysisToRadarInput,
  HSI_SCALES,
  type HsiScaleId,
  type IntensityAlert,
  type LightningIntensityInput,
  type OutlookIntensityInput,
  type RadarIntensityInput,
} from '../../lib/hazard-severity';

type Props = {
  open: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  siteLat: number;
  siteLon: number;
  alerts: WeatherAlert[];
  /** Emergency-manager drawn operational area: [lon, lat] points. */
  customPolygon?: Array<[number, number]> | null;
  onStartDraw?: () => void;
  onClearDraw?: () => void;
};

/**
 * Hazard Severity Index (HSI): one source-scoped, deterministic 0–100 hazard
 * ranking for national, regional, state, local, and custom operational areas.
 * Missing inputs reduce confidence and are shown as DATA INCOMPLETE.
 */
export function HsiPanel({
  open,
  onClose,
  siteId,
  siteName,
  siteLat,
  siteLon,
  alerts,
  customPolygon,
  onStartDraw,
  onClearDraw,
}: Props) {
  const [radar, setRadar] = useState<RadarIntensityInput | null>(null);
  const [lightning, setLightning] = useState<LightningIntensityInput | null>(null);
  const [outlook, setOutlook] = useState<OutlookIntensityInput | null>(null);
  const [scale, setScale] = useState<HsiScaleId>('national');
  const [scopeText, setScopeText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const json = async (url: string, timeoutMs: number) => {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    };

    const [radarResult, lightningResult, outlookResult] = await Promise.allSettled([
      json(`/api/radar/storm-analysis?site=${encodeURIComponent(siteId)}`, 90_000),
      json('/api/lightning/glm?minutes=5', 20_000),
      json('/api/spc/outlooks?day=1', 20_000),
    ]);

    setRadar(radarResult.status === 'fulfilled' ? stormAnalysisToRadarInput(radarResult.value) : null);
    setLightning(lightningResult.status === 'fulfilled' ? lightningToInput(lightningResult.value) : null);
    setOutlook(
      outlookResult.status === 'fulfilled'
        ? { available: true, day: '1', category: spcCategoryAtPoint(outlookResult.value, siteLat, siteLon) }
        : null
    );
    setLoading(false);
  }, [siteId, siteLat, siteLon]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load, refreshToken]);

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  const siteState = siteName.split(',').pop()?.trim() || '';
  const effectiveScopeText = scopeText || (scale === 'state' || scale === 'local' ? siteState : '');
  const areaLabel = hsiAreaLabel({ scale, text: effectiveScopeText || (scale === 'custom' && customPolygon?.length ? 'Drawn operational area' : null) });
  const scopedAlerts = useMemo(
    () => alertsForHsiScope(alerts as unknown as IntensityAlert[], {
      scale,
      text: effectiveScopeText,
      polygon: customPolygon,
    }),
    [alerts, scale, effectiveScopeText, customPolygon]
  );

  const result = useMemo(() => calculateHsi({
    scale,
    areaLabel,
    radar,
    lightning,
    outlook,
    alerts: scopedAlerts,
  }), [scale, areaLabel, radar, lightning, outlook, scopedAlerts]);

  const copySummary = useCallback(async () => {
    const lines = [
      `Hazard Severity Index (HSI) — ${areaLabel}`,
      `HSI: ${result.score === null ? 'unavailable' : `${result.score}/100 (${result.bandLabel})`}`,
      result.summary,
      `Confidence: ${Math.round(result.confidence * 100)}% · Unavailable inputs: ${result.unavailable.join(', ') || 'none'}`,
      'Deterministic, source-scoped summary from verified app data. Not official and not a warning.',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {
      // Clipboard can be blocked; close the menu without a false success note.
    }
    setContextMenu(null);
  }, [areaLabel, result.score, result.bandLabel, result.summary, result.confidence, result.unavailable]);

  if (!open) return null;

  const score = result.score;
  const band = result.band;
  const width = score === null ? 0 : Math.max(2, score);
  const color = band?.color || '#64748b';
  const textColor = result.dataIncomplete ? 'text-amber-300' : band?.text || 'text-slate-400';

  return (
    <div
      data-hsi-panel="true"
      onContextMenu={(event) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY }); }}
      className="pointer-events-auto absolute left-3 top-3 z-40 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-slate-700 bg-[#0b1220]/95 p-2.5 text-slate-100 shadow-2xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-300">Hazard Severity Index (HSI)</div>
          <div className="truncate text-[9px] text-slate-500">{areaLabel}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Close Hazard Severity Index"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <div className={`text-3xl font-black leading-none ${textColor}`}>{score === null ? '—' : score}</div>
        <div className="min-w-0 flex-1 pb-0.5">
          <div className={`truncate text-[10px] font-bold ${textColor}`}>
            {loading ? 'Loading verified inputs…' : result.bandLabel}
          </div>
          <div className="text-[9px] text-slate-500">HSI 0–100 · deterministic · not official</div>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-slate-700 bg-slate-900">
        <div className="h-full transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
        <span>Confidence: {Math.round(result.confidence * 100)}% · {result.sourceCount} verified sources</span>
        <span>{result.areaCount} areas</span>
      </div>

      {/* Scale views: national / regional / state / local / custom. */}
      <div className="mt-2 border-t border-slate-800 pt-2">
        <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">HSI scale</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {HSI_SCALES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScale(item.id)}
              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                scale === item.id ? 'border-sky-600 bg-sky-900/40 text-sky-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-1 truncate text-[9px] text-slate-500">
          {HSI_SCALES.find((item) => item.id === scale)?.example}
        </div>
        {scale !== 'national' && (
          <input
            value={scopeText}
            onChange={(event) => setScopeText(event.target.value)}
            placeholder={scale === 'custom' ? 'Operational area name' : 'Area name or state'}
            aria-label="HSI area scope"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 outline-none"
          />
        )}
        {scale === 'custom' && (
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={onStartDraw}
              className="rounded border border-slate-600 bg-[#111827] px-2 py-0.5 text-[9px] font-bold text-slate-200 hover:bg-slate-700"
            >
              Draw operational area
            </button>
            {customPolygon && customPolygon.length >= 3 && (
              <button
                type="button"
                onClick={onClearDraw}
                className="rounded border border-slate-700 px-2 py-0.5 text-[9px] font-bold text-slate-400 hover:bg-slate-800"
              >
                Clear ({customPolygon.length} pts)
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 space-y-1">
        {result.contributors.filter((item) => item.points > 0).slice(0, 4).map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-2 text-[9px] leading-tight">
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-200">{item.label}</div>
              <div className="truncate text-slate-500">{item.detail} · {item.source}</div>
            </div>
            <div className="shrink-0 font-mono font-bold text-amber-300">+{item.points}</div>
          </div>
        ))}
        {loading && result.contributors.length === 0 && (
          <div className="text-[9px] text-slate-500">Reading live radar, lightning, SPC outlook, and alerts…</div>
        )}
        {!loading && result.contributors.length === 0 && (
          <div className="text-[9px] text-slate-400">{result.summary}</div>
        )}
        {result.dataIncomplete && !loading && (
          <div className="rounded border border-amber-500/40 bg-amber-950/20 px-1.5 py-1 text-[9px] text-amber-200">
            DATA INCOMPLETE — {result.unavailable.slice(0, 3).join(', ')}{result.unavailable.length > 3 ? ` +${result.unavailable.length - 3} more` : ''}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 text-[8px] text-slate-500">
        <span className="truncate">{loading ? 'Checking verified sources…' : result.summary}</span>
        <button
          type="button"
          onClick={() => setRefreshToken((v) => v + 1)}
          className="ml-2 shrink-0 rounded border border-slate-700 px-1.5 py-0.5 font-bold text-slate-300 hover:bg-slate-800"
          aria-label="Refresh Hazard Severity Index"
        >
          Refresh
        </button>
      </div>

      {contextMenu && (
        <div
          data-hsi-context-menu="true"
          role="menu"
          aria-label="Hazard Severity Index actions"
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
          className="fixed z-[60] w-44 overflow-hidden rounded-lg border border-slate-600 bg-[#0b1220] py-1 text-[10px] text-slate-200 shadow-2xl"
          style={{
            left: Math.min(contextMenu.x, Math.max(0, window.innerWidth - 184)),
            top: Math.min(contextMenu.y, Math.max(0, window.innerHeight - 132)),
          }}
        >
          <button type="button" role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
            onClick={() => { setRefreshToken((v) => v + 1); setContextMenu(null); }}>
            Refresh HSI
          </button>
          <button type="button" role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
            onClick={() => { void copySummary(); }}>
            Copy summary
          </button>
          <button type="button" role="menuitem" className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
            onClick={onClose}>
            Hide HSI
          </button>
          <div className="border-t border-slate-800 px-3 py-1 text-[8px] text-slate-500">Deterministic · not official</div>
        </div>
      )}
    </div>
  );
}

export default HsiPanel;
