'use client';

import {
  ALERT_CATEGORY_META,
  ALL_ALERT_CATEGORIES,
  alertExpiryLabel,
  formatAlertTime,
  type AlertCategory,
  type AlertCategoryFilters,
  type WeatherAlert,
} from '../lib/alerts/model';

type Props = {
  alerts: WeatherAlert[];
  counts: Record<AlertCategory, number>;
  filters: AlertCategoryFilters;
  onToggleFilter: (category: AlertCategory) => void;
  onSetAllFilters: (value: boolean) => void;
  audioEnabled: boolean;
  audioCategories: AlertCategoryFilters;
  onEnableAudio: () => void;
  onDisableAudio: () => void;
  onToggleAudioCategory: (category: AlertCategory) => void;
  onTestTone: (category: AlertCategory) => void;
  lastUpdated: string | null;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
  onClose: () => void;
  onOpenSettings?: () => void;
  onSelectAlert: (alert: WeatherAlert) => void;
  selectedAlertId?: string | null;
  pinned?: boolean;
  onTogglePinned?: () => void;
  sortMode?: 'priority' | 'newest' | 'expiring';
  onChangeSortMode?: (mode: 'priority' | 'newest' | 'expiring') => void;
  filterMode?: 'all' | 'warnings' | 'watches' | 'statements';
  onChangeFilterMode?: (mode: 'all' | 'warnings' | 'watches' | 'statements') => void;
};

function shortTime(iso: string | null): string {
  if (!iso) return '—';
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return '—';
  return new Date(parsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function WeatherWiseAlertsPanel({
  alerts,
  counts,
  filters,
  onToggleFilter,
  onSetAllFilters,
  audioEnabled,
  audioCategories,
  onEnableAudio,
  onDisableAudio,
  onToggleAudioCategory,
  onTestTone,
  lastUpdated,
  error,
  loading,
  onRefresh,
  onClose,
  onOpenSettings,
  onSelectAlert,
  selectedAlertId = null,
  pinned = false,
  onTogglePinned,
  sortMode = 'priority',
  onChangeSortMode,
  filterMode = 'all',
  onChangeFilterMode,
}: Props) {
  const total = alerts.length;

  return (
    <div className="absolute right-0 top-0 bottom-0 z-40 flex w-[380px] max-w-[100vw] flex-col border-l border-slate-700 bg-[#0b1220] text-slate-100 shadow-2xl font-sans select-none">
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-white">Fast Alerts</span>
          <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black text-slate-950">
            {total}
          </span>
          {loading && <span className="text-[10px] font-semibold text-slate-400">syncing…</span>}
        </div>
        <div className="flex items-center gap-1">
          {onTogglePinned && (
            <button type="button" onClick={onTogglePinned} title={pinned ? 'Unpin sidebar' : 'Pin sidebar'} className={`rounded-full px-2 py-1 text-[11px] font-bold transition ${pinned ? 'bg-sky-900/40 text-sky-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>{pinned ? '📌 Pinned' : 'Pin'}</button>
          )}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              title="Alert settings"
              className="rounded-full px-2 py-1 text-[11px] font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              ⚙ Settings
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh alerts"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-3 border-b border-slate-800 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all','warnings','watches','statements'] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => onChangeFilterMode?.(mode)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${filterMode===mode ? 'bg-sky-900/40 text-sky-300 border border-sky-700' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-transparent'}`}>{mode === 'all' ? 'All' : mode[0].toUpperCase()+mode.slice(1)}</button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[10px] text-slate-500">Sort</span>
            <select value={sortMode} onChange={(e)=>onChangeSortMode?.(e.target.value as any)} className="rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-[10px] text-slate-200">
              <option value="priority">Priority</option>
              <option value="newest">Newest</option>
              <option value="expiring">Expiring</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSetAllFilters(true)}
            className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-200 transition hover:bg-slate-700"
          >
            Categories
          </button>
          {ALL_ALERT_CATEGORIES.map((category) => {
            const meta = ALERT_CATEGORY_META[category];
            const active = filters[category];
            return (
              <button
                key={category}
                type="button"
                onClick={() => onToggleFilter(category)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                  active
                    ? 'border-slate-500 bg-slate-700 text-white'
                    : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
                }`}
              >
                <span>{meta.label}</span>
                <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-slate-950 text-slate-200' : 'bg-slate-800 text-slate-500'}`}>
                  {counts[category] || 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111827] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${audioEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                {audioEnabled ? '🔔' : '🔕'}
              </span>
              <div>
                <div className="text-[11px] font-bold text-slate-200">
                  {audioEnabled ? 'Alert tone armed' : 'Alert tone off'}
                </div>
                <div className="text-[10px] text-slate-500">
                  {audioEnabled ? 'New matching alerts play a tone.' : 'Enable to hear new alerts.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={audioEnabled ? onDisableAudio : onEnableAudio}
              className={`rounded-full px-3 py-1 text-[11px] font-black transition ${
                audioEnabled
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              }`}
            >
              {audioEnabled ? 'Mute' : 'Enable'}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {(['warning', 'watch', 'advisory', 'statement'] as AlertCategory[]).map((category) => {
              const active = audioCategories[category];
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onToggleAudioCategory(category)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold transition ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {ALERT_CATEGORY_META[category].label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onTestTone('warning')}
              className="ml-auto rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Test tone
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {alerts.map((alert) => {
          const meta = ALERT_CATEGORY_META[alert.category];
          const selected = selectedAlertId === alert.id;
          return (
            <button
              type="button"
              key={alert.id}
              onClick={() => onSelectAlert(alert)}
              className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-sky-600 bg-sky-900/25' : 'border-slate-800 bg-[#111827] hover:border-slate-600 hover:bg-slate-900'}`}
              style={{ borderLeft: `3px solid ${alert.color}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${meta.badge}`}>
                  {meta.singular}
                </span>
                <span className="font-mono text-[10px] text-slate-500">{shortTime(alert.sent)}</span>
              </div>

              <div className="mt-1.5 text-xs font-black leading-snug text-white">{alert.event}</div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-300">
                {alert.headline}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] font-semibold">
                {alert.wfo && (
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{alert.wfo}</span>
                )}
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">{alert.severity}</span>
                {alert.urgency && alert.urgency !== 'Unknown' && (
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">{alert.urgency}</span>
                )}
              </div>

              <div className="mt-2 truncate text-[10px] text-slate-500">{alert.areaDesc || 'Area unavailable'}</div>
              <div className="mt-1 text-[10px] font-semibold text-amber-300">
                {alertExpiryLabel(alert)} · Issued {formatAlertTime(alert.sent)}
              </div>
            </button>
          );
        })}

        {alerts.length === 0 && !loading && (
          <div className="p-8 text-center text-xs text-slate-500">
            No active alerts match the selected categories.
          </div>
        )}
        {alerts.length === 0 && loading && (
          <div className="p-8 text-center text-xs text-slate-500">Loading NWS alerts…</div>
        )}
      </div>

      <div className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500">
        <div className="flex items-center justify-between gap-2">
          <span>
            Source: NWS active alerts
            {lastUpdated ? ` · updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          <span>Auto-refresh 30 s</span>
        </div>
        {error && <div className="mt-1 font-semibold text-amber-300">{error}</div>}
      </div>
    </div>
  );
}

export default WeatherWiseAlertsPanel;
