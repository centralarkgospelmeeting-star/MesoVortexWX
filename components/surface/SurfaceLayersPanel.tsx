'use client';

import { useMemo, type ReactNode } from 'react';
import { DATA_UNAVAILABLE, formatMinutes, formatTemp, formatWind, stationDetailFields } from '../../lib/surface/station-model';
import { OBSERVATION_MASTER_LAYERS, SURFACE_LAYERS, SURFACE_NETWORKS, type SurfaceLayerId, type StationPlot } from '../../lib/surface/types';

export type SurfaceLayerStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

type Props = {
  layers: Record<SurfaceLayerId, boolean>;
  statuses: Record<SurfaceLayerId, SurfaceLayerStatus>;
  counts: Record<SurfaceLayerId, number>;
  stations: StationPlot[];
  errors: Partial<Record<SurfaceLayerId, string>>;
  onToggle: (layer: SurfaceLayerId, enabled: boolean) => void;
  onFocusStation: (station: StationPlot) => void;
};

const STATUS_TONE: Record<SurfaceLayerStatus, string> = {
  idle: 'text-slate-500',
  loading: 'text-sky-300',
  ready: 'text-emerald-300',
  error: 'text-red-300',
  unavailable: 'text-amber-300',
};

export function SurfaceLayersPanel({ layers, statuses, counts, stations, errors, onToggle, onFocusStation }: Props): ReactNode {
  const sorted = useMemo(
    () => [...stations].sort((a, b) => (a.ageMinutes ?? Infinity) - (b.ageMinutes ?? Infinity)),
    [stations]
  );

  const masterEnabled = layers.observations;
  const enabledGranular = OBSERVATION_MASTER_LAYERS.filter((id) => layers[id]);
  const masterStatus: SurfaceLayerStatus = !masterEnabled
    ? 'idle'
    : enabledGranular.some((id) => statuses[id] === 'loading')
      ? 'loading'
      : enabledGranular.some((id) => statuses[id] === 'error')
        ? 'error'
        : enabledGranular.some((id) => statuses[id] === 'ready')
          ? 'ready'
          : 'unavailable';
  const masterCount = enabledGranular.reduce((sum, id) => sum + (counts[id] ?? 0), 0);

  return (
    <div className="space-y-2 text-[10px] text-slate-300">
      <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
        <span className="font-black uppercase tracking-wider text-sky-300">Surface observations</span>
        <span className="font-mono text-slate-500">{sorted.length} plotted</span>
      </div>

      {/* Single OBSERVATIONS master toggle: enables all supported networks at once. */}
      <div className="flex items-center gap-2 rounded border border-slate-800 bg-[#0b1220] px-1.5 py-1">
        <input
          type="checkbox"
          checked={masterEnabled}
          onChange={(e) => onToggle('observations', e.target.checked)}
          aria-label="Toggle OBSERVATIONS"
          className="h-3 w-3 accent-sky-500"
        />
        <span className="w-36 font-bold text-slate-200">OBSERVATIONS</span>
        <span className={`w-14 font-mono ${STATUS_TONE[masterStatus]}`}>
          {masterStatus === 'unavailable' ? 'NO DATA' : masterStatus === 'loading' ? 'LOADING' : masterStatus === 'error' ? 'ERROR' : masterCount}
        </span>
        <span className="truncate text-slate-500">{masterEnabled ? 'All supported observation networks' : 'All supported observation networks'}</span>
      </div>

      {/* Advanced users may narrow networks; hidden behind a collapsed control. */}
      <details className="border-t border-slate-800 pt-1.5">
        <summary className="cursor-pointer font-black uppercase tracking-wider text-slate-400">Network-specific controls (advanced)</summary>
        <div className="mt-1 space-y-1">
          {SURFACE_LAYERS.filter((layer) => layer.id !== 'observations').map((layer) => {
            const enabled = masterEnabled || layers[layer.id];
            const status = statuses[layer.id];
            return (
              <div key={layer.id} className="flex items-center gap-2 rounded border border-slate-800 bg-[#0b1220] px-1.5 py-1">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={masterEnabled}
                  onChange={(e) => onToggle(layer.id, e.target.checked)}
                  aria-label={`Toggle ${layer.name}`}
                  className="h-3 w-3 accent-sky-500 disabled:opacity-50"
                />
                <span className="w-36 font-bold text-slate-200">{layer.name}</span>
                <span className={`w-14 font-mono ${STATUS_TONE[status]}`}>
                  {status === 'unavailable' ? 'NO DATA' : status === 'loading' ? 'LOADING' : status === 'error' ? 'ERROR' : `${counts[layer.id] ?? 0}`}
                </span>
                <span className="truncate text-slate-500">{layer.note}</span>
              </div>
            );
          })}
        </div>
      </details>

      {Object.entries(errors).map(([layer, message]) => (
        <div key={layer} className="rounded border border-red-500/30 bg-red-950/20 px-1.5 py-1 text-red-300">
          {layer.toUpperCase()}: {message}
        </div>
      ))}

      <div className="border-t border-slate-800 pt-1.5">
        <div className="mb-1 font-black uppercase tracking-wider text-slate-400">Station plots</div>
        {sorted.length === 0 ? (
          <div className="rounded border border-slate-800 bg-[#0b1220] px-1.5 py-2 text-slate-500">
            {DATA_UNAVAILABLE} — enable a verified layer for the current map area.
          </div>
        ) : (
          <div className="max-h-[42vh] space-y-0.5 overflow-y-auto pr-1 font-mono">
            {sorted.map((station) => {
              const details = stationDetailFields(station);
              return (
                <button
                  type="button"
                  key={station.id}
                  onClick={() => onFocusStation(station)}
                  title={details.map((d) => `${d.label}: ${d.value}`).join('\n')}
                  className={`flex w-full items-center gap-1.5 rounded border px-1.5 py-1 text-left hover:border-sky-500/60 hover:bg-sky-950/20 ${
                    station.quality === 'stale' ? 'border-amber-500/40' : station.quality === 'unavailable' ? 'border-slate-800' : 'border-slate-800'
                  }`}
                >
                  <span className={`w-14 font-black ${station.quality === 'stale' ? 'text-amber-300' : 'text-sky-300'}`}>{station.stationId}</span>
                  <span className="w-10 text-slate-500">{station.network.toUpperCase()}</span>
                  <span className={`w-14 ${station.quality === 'stale' ? 'text-amber-300' : 'text-slate-400'}`}>{formatMinutes(station.ageMinutes)}</span>
                  <span className="w-24 text-slate-200">{formatTemp(station.tempC)}</span>
                  <span className="flex-1 truncate text-slate-400">{formatWind(station)}</span>
                  <span className="text-slate-500">{station.pressure.display ?? DATA_UNAVAILABLE}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <details className="border-t border-slate-800 pt-1.5">
        <summary className="cursor-pointer font-black uppercase tracking-wider text-slate-400">Source inventory</summary>
        <div className="mt-1 space-y-0.5 font-mono">
          {SURFACE_NETWORKS.map((network) => (
            <div key={network.id} className="flex gap-1.5 border-b border-slate-900 py-0.5">
              <span className="w-16 text-slate-300">{network.name}</span>
              <span className={`w-20 ${network.implementation === 'VERIFIED' ? 'text-emerald-300' : network.implementation === 'PARTIAL' ? 'text-sky-300' : 'text-amber-300'}`}>
                {network.implementation}
              </span>
              <span className="flex-1 text-slate-500">{network.limitation || network.source || '—'}</span>
            </div>
          ))}
        </div>
      </details>

      <div className="border-t border-slate-800 pt-1.5 font-mono text-[10px] leading-relaxed text-slate-500">
        Station model: temp upper-left · dew point lower-left · pressure upper-right · sky cover center · wind barb · ID lower-center · present weather left.
        Stale observations are amber and dashed. Missing fields are DATA UNAVAILABLE; no value is inferred.
      </div>
    </div>
  );
}
