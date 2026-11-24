'use client';

import { useMemo, useState } from 'react';
import { alertExpiryLabel, formatAlertTime, type WeatherAlert } from '../lib/alerts/model';
import { pointInGeometry, formatDistance, distanceMeters } from '../lib/map-tools/geo';

type NearbyReport = { id: string; hazard?: string; notes?: string; timeIso?: string; lat?: number; lon?: number; distanceM?: number; source?: string };
type NearbyMcd = { id?: string; number?: string; title?: string; distanceM?: number; watchProbability?: string };

type LocationContext = {
  lat: number;
  lon: number;
  alerts: WeatherAlert[];
  nearestRadarSites: Array<{ id: string; name: string; distanceM: number }>;
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
};

function isPds(alert: WeatherAlert): boolean {
  const hay = `${alert.headline} ${alert.description} ${alert.event} ${(alert.parameters?.VTEC || []).join(' ')}`.toLowerCase();
  return hay.includes('particularly dangerous situation') || /\bpds\b/.test(hay);
}

function warningPriority(alert: WeatherAlert): number {
  const e = alert.event.toLowerCase();
  let base = 0;
  if (e.includes('tornado warning')) base = 500;
  else if (e.includes('severe thunderstorm warning')) base = 400;
  else if (e.includes('flash flood warning')) base = 300;
  else if (e.includes('warning')) base = 200;
  else if (e.includes('watch')) base = 100;
  if (isPds(alert)) base += 50;
  return base;
}

export function sortAlertsForContext(alerts: WeatherAlert[]): WeatherAlert[] {
  return [...alerts].sort((a, b) => warningPriority(b) - warningPriority(a) || Date.parse(b.sent || '') - Date.parse(a.sent || ''));
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-slate-800 py-1.5 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200 break-words">{value || 'Unavailable'}</span>
    </div>
  );
}

export function AlertDetailsPanel({ alert, context, onClose, onSelectAlert }: Props) {
  const [expanded, setExpanded] = useState(true);
  const contextAlerts = useMemo(() => sortAlertsForContext(context?.alerts || []), [context?.alerts]);

  if (!alert && !context) return null;

  return (
    <div className="absolute left-3 top-14 bottom-14 z-40 w-[390px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/96 shadow-2xl backdrop-blur text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="text-[11px] font-black uppercase tracking-wider text-cyan-300">{context ? 'Location / Alert Details' : 'Alert Details'}</div>
        <button type="button" onClick={onClose} className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
      </div>
      <div className="max-h-[calc(100%-41px)] overflow-auto p-3 space-y-3">
        {context && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Map Location Context</div>
            <div className="mt-1 text-xs text-slate-200 font-mono">{context.lat.toFixed(4)}, {context.lon.toFixed(4)}</div>
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-[10px] font-bold text-amber-300 mb-1">Warnings/Alerts at point (priority)</div>
                {contextAlerts.length ? contextAlerts.map((a) => (
                  <button key={a.id} type="button" onClick={() => onSelectAlert(a)} className="mb-1 w-full rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-left hover:border-slate-600">
                    <div className="text-[11px] font-bold text-slate-100">{isPds(a) ? 'PDS ' : ''}{a.event}</div>
                    <div className="text-[10px] text-slate-500">{a.wfo || 'Office unavailable'} · {alertExpiryLabel(a)}</div>
                  </button>
                )) : <div className="text-[10px] text-slate-500">No active warnings/watches/statements contain this point.</div>}
              </div>
              <div>
                <div className="text-[10px] font-bold text-cyan-300 mb-1">Nearest radar sites</div>
                {context.nearestRadarSites.length ? context.nearestRadarSites.map((s) => <div key={s.id} className="text-[10px] text-slate-300">{s.id} - {s.name} <span className="text-slate-500">({formatDistance(s.distanceM)})</span></div>) : <div className="text-[10px] text-slate-500">Unavailable.</div>}
              </div>
              <div>
                <div className="text-[10px] font-bold text-emerald-300 mb-1">Nearby spotter reports</div>
                {context.spotterReportsNearby.length ? context.spotterReportsNearby.slice(0,5).map((r) => <div key={r.id} className="text-[10px] text-slate-300">{r.hazard || 'Report'} <span className="text-slate-500">{r.distanceM!=null ? `(${formatDistance(r.distanceM)})` : '(distance unavailable)'}</span></div>) : <div className="text-[10px] text-slate-500">No nearby spotter reports loaded.</div>}
              </div>
              <div>
                <div className="text-[10px] font-bold text-orange-300 mb-1">Nearby LSR reports</div>
                {context.lsrNearby.length ? context.lsrNearby.slice(0,5).map((r) => <div key={r.id} className="text-[10px] text-slate-300">{r.hazard || 'LSR'} <span className="text-slate-500">{r.distanceM!=null ? `(${formatDistance(r.distanceM)})` : '(distance unavailable)'}</span></div>) : <div className="text-[10px] text-slate-500">No nearby LSR reports loaded.</div>}
              </div>
              <div>
                <div className="text-[10px] font-bold text-violet-300 mb-1">Nearby MCD/MPD</div>
                {context.mcdNearby.length ? context.mcdNearby.slice(0,5).map((m, i) => <div key={m.id || i} className="text-[10px] text-slate-300">{m.title || `MCD ${m.number || ''}`} <span className="text-slate-500">{m.distanceM!=null ? `(${formatDistance(m.distanceM)})` : '(distance unavailable)'}</span></div>) : <div className="text-[10px] text-slate-500">No MCD/MPD context available from loaded data.</div>}
              </div>
              <div>
                <div className="text-[10px] font-bold text-sky-300 mb-1">Relevant SPC products</div>
                {context.spcProducts.map((p) => <div key={p.label} className="text-[10px] text-slate-300">{p.label}: <span className={p.status==='Available'?'text-emerald-400':'text-slate-500'}>{p.status}</span>{p.detail ? <span className="text-slate-500"> - {p.detail}</span> : null}</div>)}
              </div>
            </div>
          </section>
        )}

        {alert && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Warning Details</div>
                <div className="text-sm font-black text-white mt-0.5">{isPds(alert) ? 'PDS ' : ''}{alert.event}</div>
              </div>
              <button type="button" onClick={() => setExpanded((v) => !v)} className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700">{expanded ? 'Collapse' : 'Expand'}</button>
            </div>
            <div className="mt-2">
              <Row label="Event type" value={alert.event} />
              <Row label="Issuing office" value={alert.senderName || alert.wfo || 'Unavailable'} />
              <Row label="Issue time" value={formatAlertTime(alert.sent)} />
              <Row label="Expiration time" value={formatAlertTime(alert.expires)} />
              <Row label="Area affected" value={alert.areaDesc || 'Unavailable'} />
              <Row label="Warning ID" value={alert.id} />
              <Row label="Source office" value={alert.senderName || 'Unavailable'} />
              {expanded && (
                <>
                  <div className="border-t border-slate-800 py-2">
                    <div className="text-[10px] font-bold text-slate-400 mb-1">Impact / Hazard</div>
                    <div className="text-[11px] text-slate-200 whitespace-pre-wrap">{alert.headline || 'Unavailable'}</div>
                    <div className="mt-2 text-[11px] text-slate-300 whitespace-pre-wrap">{alert.description || 'Description unavailable from source.'}</div>
                  </div>
                  <div className="border-t border-slate-800 py-2">
                    <div className="text-[10px] font-bold text-slate-400 mb-1">Instructions</div>
                    <div className="text-[11px] text-slate-300 whitespace-pre-wrap">{alert.instruction || 'Instructions unavailable from source.'}</div>
                  </div>
                  <Row label="Affected counties" value={alert.areaDesc || 'Unavailable'} />
                  <Row label="Population affected" value={'Unavailable (no verified real population source integrated)'} />
                  <Row label="Area affected (computed)" value={'Unavailable (no verified area computation from source geometry displayed)'} />
                  <Row label="Urgency / Severity / Certainty" value={`${alert.urgency} / ${alert.severity} / ${alert.certainty}`} />
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export function buildLocationContext(lat: number, lon: number, alerts: WeatherAlert[], radarSites: Array<{id:string;name:string;lat:number;lon:number}>, reports: any[], mcdFeatures: any[]): LocationContext {
  const containing = alerts.filter((a) => a.geometry && pointInGeometry([lon, lat], a.geometry));
  const nearestRadarSites = radarSites.map((s) => ({ id: s.id, name: s.name, distanceM: distanceMeters([lon,lat],[s.lon,s.lat]) })).sort((a,b)=>a.distanceM-b.distanceM).slice(0,5);
  const nearbyReports = (reports || []).map((r:any, idx:number) => {
    const c = r?.geometry?.coordinates;
    const rlon = Array.isArray(c) ? Number(c[0]) : NaN;
    const rlat = Array.isArray(c) ? Number(c[1]) : NaN;
    const distanceM = Number.isFinite(rlat) && Number.isFinite(rlon) ? distanceMeters([lon,lat],[rlon,rlat]) : undefined;
    return { id: String(r?.properties?.id || idx), hazard: r?.properties?.hazard || r?.properties?.reportType, notes: r?.properties?.notes, timeIso: r?.properties?.timeIso, lat: rlat, lon: rlon, distanceM, source: r?.properties?.source };
  }).filter((r:any)=>r.distanceM!=null && r.distanceM <= 160934).sort((a:any,b:any)=>(a.distanceM||0)-(b.distanceM||0));
  const lsrNearby = nearbyReports.filter((r:any)=>String(r.source||'').toLowerCase().includes('nws') || String(r.source||'').toLowerCase().includes('lsr'));
  const spotterReportsNearby = nearbyReports.filter((r:any)=>!lsrNearby.includes(r));
  const mcdNearby = (mcdFeatures || []).map((f:any, idx:number) => {
    const id = String(f?.properties?.id || f?.properties?.mcdNumber || idx);
    const title = String(f?.properties?.name || f?.properties?.title || `MCD ${f?.properties?.mcdNumber || ''}`);
    // Distance unavailable without expensive geometry centroid; be honest.
    return { id, number: f?.properties?.mcdNumber, title, distanceM: undefined as number | undefined, watchProbability: f?.properties?.watchProbability };
  }).slice(0,5);
  const spcProducts = [
    { label: 'SPC Convective Outlooks', status: 'Available' as const, detail: 'Outlooks tab / SPC feed' },
    { label: 'MCDs', status: (mcdFeatures?.length ? 'Available' : 'Unavailable') as 'Available'|'Unavailable', detail: mcdFeatures?.length ? `${mcdFeatures.length} loaded` : 'No MCD features loaded' },
    { label: 'MPDs', status: 'Unavailable' as const, detail: 'No verified MPD feed integrated in this view' },
  ];
  return { lat, lon, alerts: sortAlertsForContext(containing), nearestRadarSites, spotterReportsNearby, lsrNearby, mcdNearby, spcProducts };
}
