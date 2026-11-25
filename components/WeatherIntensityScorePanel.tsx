'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WeatherAlert } from '../lib/alerts/model';
import {
  alertsNearSite,
  calculateWeatherIntensity,
  lightningToInput,
  spcCategoryAtPoint,
  stormAnalysisToRadarInput,
  type LightningIntensityInput,
  type OutlookIntensityInput,
  type RadarIntensityInput,
} from '../lib/weather-intensity';

type Props = {
  open: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  siteLat: number;
  siteLon: number;
  alerts: WeatherAlert[];
};

export function WeatherIntensityScorePanel({
  open,
  onClose,
  siteId,
  siteName,
  siteLat,
  siteLon,
  alerts,
}: Props) {
  const [radar, setRadar] = useState<RadarIntensityInput | null>(null);
  const [lightning, setLightning] = useState<LightningIntensityInput | null>(null);
  const [outlook, setOutlook] = useState<OutlookIntensityInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

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
        ? {
            available: true,
            day: '1',
            category: spcCategoryAtPoint(outlookResult.value, siteLat, siteLon),
          }
        : null
    );
    setLoading(false);
  }, [siteId, siteLat, siteLon]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load, refreshToken]);

  const result = useMemo(() => calculateWeatherIntensity({
    radar,
    lightning,
    outlook,
    alerts: alertsNearSite(alerts, siteName),
  }), [radar, lightning, outlook, alerts, siteName]);

  if (!open) return null;

  const score = result.score;
  const band = result.band;
  const width = score === null ? 0 : Math.max(2, score);

  return (
    <div
      data-weather-intensity-panel="true"
      className="pointer-events-auto absolute left-3 top-3 z-40 w-[min(17rem,calc(100vw-1.5rem))] rounded-xl border border-slate-700 bg-[#0b1220]/95 p-2.5 text-slate-100 shadow-2xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-sky-300">
            Weather Intensity Score
          </div>
          <div className="text-[9px] text-slate-500">{siteName}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Close Weather Intensity Score"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <div className={`text-3xl font-black leading-none ${band?.text || 'text-slate-400'}`}>
          {score === null ? '—' : score}
        </div>
        <div className="min-w-0 flex-1 pb-0.5">
          <div className={`truncate text-[10px] font-bold ${band?.text || 'text-slate-400'}`}>
            {band?.label || (loading ? 'Loading verified inputs…' : 'Insufficient verified data')}
          </div>
          <div className="text-[9px] text-slate-500">0–100 · deterministic · not official</div>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-slate-700 bg-slate-900">
        <div
          className="h-full transition-all"
          style={{ width: `${width}%`, backgroundColor: band?.color || '#475569' }}
        />
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
          <div className="text-[9px] text-slate-500">Reading live radar, lightning, outlook, and alerts…</div>
        )}
        {!loading && result.contributors.length === 0 && (
          <div className="text-[9px] text-slate-500">{result.summary}</div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 text-[8px] text-slate-500">
        <span className="truncate">
          {loading
            ? 'Checking verified sources…'
            : result.unavailable.length > 0
              ? `Unavailable: ${result.unavailable.join(', ')}`
              : 'All input sources checked'}
        </span>
        <button
          type="button"
          onClick={() => setRefreshToken((v) => v + 1)}
          className="ml-2 shrink-0 rounded border border-slate-700 px-1.5 py-0.5 font-bold text-slate-300 hover:bg-slate-800"
          aria-label="Refresh Weather Intensity Score"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

export default WeatherIntensityScorePanel;
