'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALERT_CATEGORY_META, alertExpiryLabel, formatAlertTime, sortAlerts, type WeatherAlert } from '../lib/alerts/model';
import { distanceMeters, pointInGeometry } from '../lib/map-tools/geo';
import type { ReportDetail } from './reports/ReportDetailPopup';

type NearbyReport = { id: string; hazard?: string; notes?: string; timeIso?: string; lat?: number; lon?: number; distanceM?: number; source?: string };
type NearbyMcd = { id?: string; number?: string; title?: string; distanceM?: number; watchProbability?: string };

type LocationContext = {
  lat: number;
  lon: number;
  alerts: WeatherAlert[];
  nearestRadarSites: Array<{ id: string; name: string; lat: number; lon: number; distanceM: number; bearingDeg: number }>;
  reportsNearby: NearbyReport[];
  spotterReportsNearby: NearbyReport[];
  lsrNearby: NearbyReport[];
  mcdNearby: NearbyMcd[];
  spcProducts: Array<{ label: string; status: 'Available' | 'Unavailable'; detail?: string }>;
};

type Props = {
  alert: WeatherAlert | null;
  context: LocationContext | null;
  onClose: () => void;
  onSelectAlert: (alert: WeatherAlert) => void;
  onSelectNearestRadar: (site: { id: string; name: string; lat: number; lon: number }) => void;
  pinned: boolean;
  onTogglePin: () => void;
  onSelectReport?: (report: ReportDetail) => void;
};

function extractStormMotion(text: string): string {
  const m = text.match(/moving\s+(?:toward\s+)?([A-Z]{1,3}(?:\s+[A-Z]{1,3})?)\s+at\s+(\d+)\s*mph/i);
  if (m) return `${m[1]} at ${m[2]} mph`;
  const m2 = text.match(/storm motion[^.]*?(\d+)\s*deg[^.]*?(\d+)\s*kt/i);
  if (m2) return `${m2[1]}° at ${m2[2]} kt`;
  return 'DATA UNAVAILABLE';
}
function isPds(alert: WeatherAlert): boolean {
  const hay = `${alert.headline} ${alert.description} ${alert.event} ${(alert.parameters?.VTEC || []).join(' ')}`.toLowerCase();
  return hay.includes('particularly dangerous situation') || /\bpds\b/.test(hay);
}

function bearingDeg(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const y = Math.sin(toRad(toLon - fromLon)) * Math.cos(toRad(toLat));
  const x = Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat)) - Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(toRad(toLon - fromLon));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function bearingCardinal(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/** Compact single-unit distance for a small context card. */
function compactDistance(meters?: number): string {
  if (meters == null || !Number.isFinite(meters)) return 'Unavailable';
  if (meters < 160934) return `${(meters / 1609.344).toFixed(1)} mi`;
  return `${(meters / 1000).toFixed(0)} km`;
}

function relativeAge(timeIso?: string): string {
  if (!timeIso) return 'Time unavailable';
  const ms = Date.parse(timeIso);
  if (!Number.isFinite(ms)) return 'Time unavailable';
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function reportSource(source?: string): string {
  const value = String(source || '').toLowerCase();
  if (value.includes('nws') || value.includes('lsr')) return 'NWS LSR';
  if (value.includes('spotter')) return 'Spotter';
  return source || 'Report';
}

/** One canonical alert priority is used by the sidebar and the map context card. */
export function sortAlertsForContext(alerts: WeatherAlert[]): WeatherAlert[] {
  return sortAlerts(alerts);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-t border-slate-800 py-1.5 text-[11px] leading-snug">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-100 break-words">{value || 'Unavailable'}</span>
    </div>
  );
}

function WarningCard({ alert, onSelect }: { alert: WeatherAlert; onSelect: (a: WeatherAlert) => void }) {
  const [open, setOpen] = useState(false);
  const meta = ALERT_CATEGORY_META[alert.category] || ALERT_CATEGORY_META.warning;
  return (
    <div className="rounded-md border border-slate-700 bg-[#0f172a]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-[#162033]">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${meta.badge}`}>{meta.singular}</span>
            <span className="truncate text-[13px] font-black leading-tight text-white">{isPds(alert) ? 'PDS ' : ''}{alert.event}</span>
          </div>
          <div className="mt-1 truncate text-[12px] font-semibold text-slate-300">{alert.wfo || 'Office unavailable'} · {alertExpiryLabel(alert)}</div>
        </div>
        <span className="text-xs text-slate-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-700 px-2.5 py-2.5 space-y-1.5">
          <Row label="Event type" value={alert.event} />
          <Row label="Issuing office" value={alert.senderName || alert.wfo || 'Unavailable'} />
          <Row label="Issue time" value={formatAlertTime(alert.sent)} />
          <Row label="Expiration time" value={formatAlertTime(alert.expires)} />
          <div className="border-t border-slate-800 pt-1.5">
            <div className="text-[11px] font-semibold text-slate-400">Impact / Hazard</div>
            <div className="text-[11px] leading-snug text-slate-100 whitespace-pre-wrap">{alert.headline || alert.description || 'Unavailable'}</div>
          </div>
          <div className="border-t border-slate-800 pt-1.5">
            <div className="text-[11px] font-semibold text-slate-400">Instructions</div>
            <div className="text-[11px] leading-snug text-slate-200 whitespace-pre-wrap">{alert.instruction || 'Unavailable from source.'}</div>
          </div>
          <Row label="Affected locations" value={alert.areaDesc || 'Unavailable'} />
          <button type="button" onClick={() => onSelect(alert)} className="mt-1.5 w-full rounded-full border border-slate-600 bg-[#111827] px-2 py-1.5 text-[11px] font-bold text-slate-100 hover:bg-slate-700">Open full alert details</button>
        </div>
      )}
    </div>
  );
}

export function AlertDetailsPanel({ alert, context, onClose, onSelectAlert, onSelectNearestRadar, pinned, onTogglePin, onSelectReport }: Props) {
  const [reportsOpen, setReportsOpen] = useState(false);
  const [fullAlertOpen, setFullAlertOpen] = useState(false);
  const SESSION_KEY = 'mesovortex_alert_panel_session_v1';
  const [frame, setFrame] = useState<{ x: number; y: number; w: number; h: number }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if ([saved.x, saved.y, saved.w, saved.h].every((v: unknown) => Number.isFinite(v))) return saved;
        }
      } catch {}
    }
    return { x: 12, y: 56, w: 292, h: 420 };
  });
  const [collapsed, setCollapsed] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(frame)); } catch {}
  }, [frame]);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const onHeaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    dragRef.current = { dx: event.clientX - frame.x, dy: event.clientY - frame.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onHeaderPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const { dx, dy } = dragRef.current;
    setFrame((current) => ({
      ...current,
      x: clamp(event.clientX - dx, 0, Math.max(0, window.innerWidth - current.w)),
      y: clamp(event.clientY - dy, 0, Math.max(0, window.innerHeight - 56)),
    }));
  };
  const onResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeRef.current = { x: event.clientX, y: event.clientY, w: frame.w, h: frame.h };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    const start = resizeRef.current;
    setFrame((current) => ({
      ...current,
      w: clamp(start.w + event.clientX - start.x, 250, Math.max(250, window.innerWidth - current.x - 8)),
      h: clamp(start.h + event.clientY - start.y, 220, Math.max(220, window.innerHeight - current.y - 8)),
    }));
  };
  const contextAlerts = useMemo(() => sortAlertsForContext(context?.alerts || []), [context?.alerts]);
  const warningCount = contextAlerts.filter((a) => a.category === 'warning').length;
  if (!alert && !context) return null;
  const nearest = context?.nearestRadarSites?.[0];

  return (
    <div
      data-alert-panel="true"
      data-pinned={pinned ? 'true' : 'false'}
      className="fixed z-40 flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#111827] shadow-lg text-slate-100"
      style={{ left: frame.x, top: frame.y, width: frame.w, height: collapsed ? undefined : frame.h, maxHeight: '80vh' }}
    >
      <div
        className="flex cursor-move items-center justify-between gap-1 border-b border-slate-700 px-2 py-1.5 select-none"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={() => { dragRef.current = null; }}
        title="Drag to move the warning panel"
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="rounded px-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label={collapsed ? 'Expand warning panel' : 'Collapse warning panel'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <div className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-wider text-sky-300">{context ? 'What matters here' : 'Alert details'}</div>
        <button
          type="button"
          onClick={onTogglePin}
          className={`rounded px-1 ${pinned ? 'text-sky-300' : 'text-slate-400'} hover:bg-slate-800`}
          aria-label={pinned ? 'Unpin warning panel' : 'Pin warning panel'}
          title={pinned ? 'Pinned: panel stays open' : 'Pin to keep panel open'}
        >
          ◆
        </button>
        <button type="button" onClick={onClose} className="rounded px-1 text-slate-400 hover:bg-slate-800 hover:text-white text-sm" aria-label="Close warning panel">✕</button>
      </div>
      {!collapsed && (
      <div className="min-h-0 flex-1 overflow-auto p-3 space-y-2.5">
        {context && (
          <>
            <section data-section="alerts" aria-label="Warnings and alerts">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active warnings affecting point</div>
                <span className="rounded-full bg-red-950 px-2 py-0.5 text-[10px] font-black text-red-200">{warningCount} warning{warningCount === 1 ? '' : 's'}</span>
              </div>
              {contextAlerts.length ? (
                <div className="space-y-1.5">
                  {contextAlerts.slice(0, 4).map((a) => <WarningCard key={a.id} alert={a} onSelect={onSelectAlert} />)}
                </div>
              ) : <div className="rounded-md border border-slate-700 bg-[#0f172a] px-2.5 py-2 text-[11px] text-slate-400">No active alerts at this point.</div>}
            </section>

            <section data-section="radar" aria-label="Nearest radar" className="rounded-md border border-slate-700 bg-[#0f172a] px-2.5 py-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nearest radar sites</div>
              <div className="mt-1 space-y-1">
                {(context.nearestRadarSites || []).slice(0, 3).map((s) => (
                  <button key={s.id} type="button" onClick={() => onSelectNearestRadar(s)} className="block w-full text-left hover:text-sky-300">
                    <span className="text-[13px] font-black text-white">{s.id}</span>
                    <span className="ml-1 text-[11px] text-slate-300">{s.name} · {compactDistance(s.distanceM)}</span>
                  </button>
                ))}
                {!(context.nearestRadarSites || []).length && <div className="text-[11px] text-slate-400">Unavailable</div>}
              </div>
            </section>

            <section data-section="reports" aria-label="Nearby reports" className="rounded-md border border-slate-700 bg-[#0f172a]">
              <button type="button" onClick={() => setReportsOpen(v=>!v)} className="flex w-full items-center justify-between px-2.5 py-2 text-xs font-bold text-slate-100 hover:bg-[#162033]">
                <span>Reports ({context.reportsNearby.length})</span><span className="text-slate-400">{reportsOpen?'▾':'▸'}</span>
              </button>
              {reportsOpen && (
                <div className="border-t border-slate-700 px-2.5 py-2 space-y-2">
                  {context.reportsNearby.length ? context.reportsNearby.slice(0, 5).map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => onSelectReport?.({
                        id: r.id,
                        time: r.timeIso || null,
                        location: Number.isFinite(r.lat) && Number.isFinite(r.lon)
                          ? `${Number(r.lat).toFixed(3)}, ${Number(r.lon).toFixed(3)} · ${compactDistance(r.distanceM)}`
                          : compactDistance(r.distanceM),
                        source: reportSource(r.source),
                        text: r.notes || r.hazard || 'Data unavailable from source.',
                        lat: Number.isFinite(r.lat) ? Number(r.lat) : undefined,
                        lon: Number.isFinite(r.lon) ? Number(r.lon) : undefined,
                      })}
                      className="block w-full rounded border border-slate-800 bg-[#0b1220] px-2 py-1.5 text-left text-[11px] text-slate-200 hover:border-sky-500/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-white">{r.hazard || 'Report'}</span>
                        <span className="shrink-0 text-slate-400">{compactDistance(r.distanceM)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{reportSource(r.source)} · {relativeAge(r.timeIso)}</div>
                      {r.notes && <div className="truncate text-[10px] text-slate-300" title={r.notes}>{r.notes}</div>}
                    </button>
                  )) : <div className="text-[11px] text-slate-400">No nearby reports loaded.</div>}
                </div>
              )}
            </section>
          </>
        )}

        {alert && (
          <section className="rounded-md border border-slate-700 bg-[#0f172a] p-2.5">
            <div className="text-[13px] font-black leading-tight text-white">{isPds(alert) ? 'PDS ' : ''}{alert.event}</div>
            <div className="mt-1 text-[12px] font-semibold text-slate-300">{alert.wfo || 'Office unavailable'} · {alertExpiryLabel(alert)}</div>
            <button type="button" onClick={() => setFullAlertOpen((v)=>!v)} className="mt-2 w-full rounded-full border border-slate-600 bg-[#111827] px-2 py-1.5 text-[11px] font-bold text-slate-100 hover:bg-slate-700">{fullAlertOpen ? 'Hide details' : 'Show details'}</button>
            {fullAlertOpen && (
              <div className="mt-2.5 space-y-0.5">
                <Row label="Event type" value={alert.event} />
                <Row label="WFO" value={alert.wfo || 'Unavailable'} />
                <Row label="VTEC" value={(alert.parameters?.VTEC || []).join(', ') || 'Unavailable'} />
                <Row label="Severity" value={alert.severity || 'Unavailable'} />
                <Row label="Urgency" value={alert.urgency || 'Unavailable'} />
                <Row label="Certainty" value={alert.certainty || 'Unavailable'} />
                <Row label="Issue time" value={formatAlertTime(alert.sent)} />
                <Row label="Expiration time" value={formatAlertTime(alert.expires)} />
                <Row label="Remaining time" value={alertExpiryLabel(alert)} />
                <Row label="Affected area" value={alert.areaDesc || 'Unavailable'} />
                <Row label="Places affected" value={alert.places?.length ? alert.places.join(', ') : 'DATA UNAVAILABLE'} />
                <Row label="Population in polygon" value="DATA UNAVAILABLE" />
                <Row label="Population density" value="DATA UNAVAILABLE" />
                <Row label="Schools" value="DATA UNAVAILABLE" />
                <Row label="Hospitals" value="DATA UNAVAILABLE" />
                <Row label="Storm motion" value={extractStormMotion(alert.description || alert.headline)} />
                <Row label="Storm track" value="DATA UNAVAILABLE" />
                <div className="border-t border-slate-800 pt-1.5 mt-1.5">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Hazard</div>
                  <div className="text-[11px] leading-snug text-slate-100 whitespace-pre-wrap">{alert.headline || 'DATA UNAVAILABLE'}</div>
                </div>
                <div className="border-t border-slate-800 pt-1.5 mt-1.5">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Impacts</div>
                  <div className="text-[11px] leading-snug text-slate-200 whitespace-pre-wrap">
                    {alert.description ? (alert.description.split(/\n\s*\n/)[0] || alert.description).trim() : 'DATA UNAVAILABLE'}
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-1.5 mt-1.5">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Instructions</div>
                  <div className="text-[11px] leading-snug text-slate-200 whitespace-pre-wrap">{alert.instruction || 'DATA UNAVAILABLE'}</div>
                </div>
                <div className="border-t border-slate-800 pt-1.5 mt-1.5">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Full NWS warning text</div>
                  <div className="text-[11px] leading-snug text-slate-200 whitespace-pre-wrap">{alert.description || 'DATA UNAVAILABLE'}</div>
                </div>
                {context && (
                  <div className="border-t border-slate-800 pt-1.5 mt-1.5">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Related information</div>
                    <div className="text-[11px] text-slate-200">LSR: {context.lsrNearby.length} · Spotter: {context.spotterReportsNearby.length} · MCD: {context.mcdNearby.length} · SPC products: {context.spcProducts.filter((p) => p.status === 'Available').length}</div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
      )}
      {!collapsed && (
        <div
          data-resize-handle="true"
          className="h-3 shrink-0 cursor-nwse-resize border-t border-slate-700 bg-slate-800/60"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={() => { resizeRef.current = null; }}
          title="Drag to resize the warning panel"
        />
      )}
    </div>
  );
}

export function buildLocationContext(lat: number, lon: number, alerts: WeatherAlert[], radarSites: Array<{id:string;name:string;lat:number;lon:number}>, reports: any[], mcdFeatures: any[]): LocationContext {
  const containing = alerts.filter((a) => a.geometry && pointInGeometry([lon, lat], a.geometry));
  const nearestRadarSites = radarSites.map((s) => ({
    id: s.id, name: s.name, lat: s.lat, lon: s.lon,
    distanceM: distanceMeters([lon,lat],[s.lon,s.lat]),
    bearingDeg: bearingDeg(lat, lon, s.lat, s.lon),
  })).sort((a,b)=>a.distanceM-b.distanceM).slice(0,3);
  const nearbyReports = (reports || []).map((r:any, idx:number) => {
    const c = r?.geometry?.coordinates;
    const rlon = Array.isArray(c) ? Number(c[0]) : NaN;
    const rlat = Array.isArray(c) ? Number(c[1]) : NaN;
    const distanceM = Number.isFinite(rlat) && Number.isFinite(rlon) ? distanceMeters([lon,lat],[rlon,rlat]) : undefined;
    return { id: String(r?.properties?.id || idx), hazard: r?.properties?.hazard || r?.properties?.reportType, notes: r?.properties?.notes, timeIso: r?.properties?.timeIso, lat: rlat, lon: rlon, distanceM, source: r?.properties?.source };
  }).filter((r:any)=>r.distanceM!=null && r.distanceM <= 160934).sort((a:any,b:any)=>(a.distanceM||0)-(b.distanceM||0));
  const lsrNearby = nearbyReports.filter((r:any)=>String(r.source||'').toLowerCase().includes('nws') || String(r.source||'').toLowerCase().includes('lsr'));
  const spotterReportsNearby = nearbyReports.filter((r:any)=>!lsrNearby.includes(r));
  const reportsNearby = nearbyReports;
  const mcdNearby = (mcdFeatures || []).map((f:any, idx:number) => {
    const id = String(f?.properties?.id || f?.properties?.mcdNumber || idx);
    const title = String(f?.properties?.name || f?.properties?.title || `MCD ${f?.properties?.mcdNumber || ''}`);
    return { id, number: f?.properties?.mcdNumber, title, distanceM: undefined as number | undefined, watchProbability: f?.properties?.watchProbability };
  }).slice(0,5);
  const spcProducts = [
    { label: 'SPC Convective Outlooks', status: 'Available' as const, detail: 'Outlooks tab / SPC feed' },
    { label: 'MCDs', status: (mcdFeatures?.length ? 'Available' : 'Unavailable') as 'Available'|'Unavailable', detail: mcdFeatures?.length ? `${mcdFeatures.length} loaded` : 'No MCD features loaded' },
    { label: 'MPDs', status: 'Unavailable' as const, detail: 'No verified MPD feed integrated in this view' },
  ];
  return { lat, lon, alerts: sortAlertsForContext(containing), nearestRadarSites, reportsNearby, spotterReportsNearby, lsrNearby, mcdNearby, spcProducts };
}
