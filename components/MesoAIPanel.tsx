'use client';

import { useEffect, useState } from 'react';
import type { AnalysisMode, AnalysisResult, Detection, WatcherSummary, WarningContext, WeatherObservation } from '../lib/mesoai/types';
import type { SatelliteSelection } from '../lib/satellite';

type Props = {
  open: boolean;
  onClose: () => void;
  site: { id: string; name: string; lat: number; lon: number };
  productKey: string;
  warning: WarningContext | null;
  satelliteSelection: SatelliteSelection;
};

const MODES: Array<{ id: AnalysisMode; label: string }> = [
  { id: 'storm', label: 'Analyze Storm' },
  { id: 'product', label: 'Explain Product' },
  { id: 'warning', label: 'Explain Warning' },
  { id: 'model', label: 'Model Analysis' },
];

type AnalyzeResponse = {
  result: AnalysisResult;
  detections: Detection[];
  observations: WeatherObservation[];
};

export function MesoAIPanel({ open, onClose, site, productKey, warning, satelliteSelection }: Props) {
  const [mode, setMode] = useState<AnalysisMode>('storm');
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<WatcherSummary[]>([]);
  const [watcherLoading, setWatcherLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFeedback(null);
    setOutcome(null);

    fetch('/api/mesoai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, site, productKey, warning, satelliteSelection }),
      signal: AbortSignal.timeout(95_000),
    })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
        return payload as AnalyzeResponse;
      })
      .then((payload) => {
        if (!cancelled) setResponse(payload);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Analysis unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, mode, site.id, site.name, site.lat, site.lon, productKey, warning?.event, satelliteSelection.bird, satelliteSelection.sector, satelliteSelection.productId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setWatcherLoading(true);
    const query = new URLSearchParams({
      id: site.id,
      name: site.name,
      lat: String(site.lat),
      lon: String(site.lon),
    });
    fetch(`/api/mesoai/watcher?${query.toString()}`, { cache: 'no-store', signal: AbortSignal.timeout(95_000) })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
        return payload as { summaries: WatcherSummary[] };
      })
      .then((payload) => {
        if (!cancelled) setSummaries(payload.summaries || []);
      })
      .catch(() => {
        if (!cancelled) setSummaries([]);
      })
      .finally(() => {
        if (!cancelled) setWatcherLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, site.id, site.name, site.lat, site.lon]);

  async function sendFeedback(rating: 'helpful' | 'not_helpful' | 'inaccurate') {
    if (!response) return;
    try {
      await fetch('/api/mesoai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: response.result.id,
          mode: response.result.mode,
          rating,
          note: '',
        }),
      });
      setFeedback(rating);
    } catch {
      setFeedback(null);
    }
  }

  async function sendOutcome(label: 'severe_verified' | 'severe_not_verified' | 'no_observation' | 'unknown') {
    if (!response) return;
    try {
      await fetch('/api/mesoai/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: response.result.id,
          mode: response.result.mode,
          outcome: label,
          note: '',
        }),
      });
      setOutcome(label);
    } catch {
      setOutcome(null);
    }
  }

  if (!open) return null;
  const result = response?.result;

  return (
    <div
      data-mesoai-panel="true"
      className="fixed right-3 top-16 z-50 flex max-h-[calc(100vh-5rem)] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#0b1220]/98 text-slate-100 shadow-2xl backdrop-blur"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">MesoAI</div>
          <div className="text-[9px] text-slate-500">{site.name} · structured weather analysis</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close MesoAI" className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-1 border-b border-slate-800 p-2">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            data-mesoai-mode={item.id}
            onClick={() => setMode(item.id)}
            className={`rounded-md px-2 py-1.5 text-[10px] font-bold transition ${
              mode === item.id ? 'bg-sky-700 text-white' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-[11px] leading-relaxed">
        {loading && <div className="text-slate-400">Reading verified sources…</div>}
        {error && <div className="rounded border border-red-800 bg-red-950/40 p-2 text-red-200">{error}</div>}
        {!loading && result && (
          <>
            <div data-mesoai-headline="true" className="text-sm font-black text-white">{result.headline}</div>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-wide text-slate-500">
              <span className="rounded border border-slate-700 px-1.5 py-0.5">{result.renderer === 'qwen' ? 'Qwen renderer' : 'Local renderer'}</span>
              <span>{result.detections.length} detection{result.detections.length === 1 ? '' : 's'}</span>
            </div>
            <p className="text-slate-200">{result.explanation}</p>
            {result.indicators.length > 0 && (
              <div>
                <div className="mb-1 text-[9px] font-black uppercase tracking-wide text-slate-500">Supporting indicators</div>
                <ul className="space-y-0.5">
                  {result.indicators.map((indicator, index) => (
                    <li key={`${indicator}-${index}`} className="rounded bg-slate-800/50 px-2 py-1 text-[10px] text-slate-300">• {indicator}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.sources.length > 0 && (
              <div className="text-[9px] text-slate-500">Sources: {result.sources.join(' · ')}</div>
            )}
            <div className="rounded border border-slate-800 bg-slate-900/60 p-2 text-[9px] text-slate-400">
              {result.caveats.map((caveat, index) => <div key={`${caveat}-${index}`}>• {caveat}</div>)}
            </div>
            <div className="flex items-center gap-1 border-t border-slate-800 pt-2">
              <span className="mr-1 text-[9px] text-slate-500">Feedback</span>
              {([['helpful', 'Helpful'], ['not_helpful', 'Not helpful'], ['inaccurate', 'Inaccurate']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => void sendFeedback(id)}
                  className={`rounded border px-1.5 py-0.5 text-[9px] ${feedback === id ? 'border-sky-500 bg-sky-900/40 text-sky-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1 border-t border-slate-800 pt-2">
              <span className="mr-1 text-[9px] text-slate-500">Outcome</span>
              {([
                ['severe_verified', 'Severe verified'],
                ['severe_not_verified', 'Not verified'],
                ['no_observation', 'No observation'],
                ['unknown', 'Unknown'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  data-mesoai-outcome={id}
                  onClick={() => void sendOutcome(id)}
                  className={`rounded border px-1.5 py-0.5 text-[9px] ${outcome === id ? 'border-emerald-500 bg-emerald-900/40 text-emerald-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="border-t border-slate-800 pt-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-wide text-sky-300">National Weather Watcher</span>
            {watcherLoading && <span className="text-[9px] text-slate-500">scanning…</span>}
          </div>
          {summaries.length === 0 ? (
            <div className="text-[9px] text-slate-500">No new time-bounded summaries.</div>
          ) : (
            <div className="space-y-1">
              {summaries.map((summary) => (
                <div key={summary.id} data-watcher-summary="true" className="rounded border border-slate-800 bg-slate-900/50 p-2">
                  <div className="text-[10px] font-bold text-slate-200">{summary.headline}</div>
                  <div className="text-[9px] text-slate-400">{summary.detail}</div>
                  <div className="text-[8px] text-slate-500">{summary.confidence} · {summary.sources.join(' · ')} · {summary.observedAt}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800 px-3 py-2 text-[8px] text-slate-500">
        MesoAI explains verified data. Not an official warning, probability, or replacement for meteorologists.
      </div>
    </div>
  );
}

export default MesoAIPanel;
