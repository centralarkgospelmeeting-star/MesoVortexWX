'use client';

import { useMemo, useState } from 'react';
import { alertExpiryLabel, formatAlertTime, type WeatherAlert } from '../lib/alerts/model';
import { formatDistance, distanceMeters, pointInGeometry } from '../lib/map-tools/geo';

type NearbyReport = { id: string; hazard?: string; notes?: string; timeIso?: string; lat?: number; lon?: number; distanceM?: number; source?: string };
type NearbyMcd = { id?: string; number?: string; title?: string; distanceM?: number; watchProbability?: string };

type LocationContext = {
  lat: number;
  lon: number;
  alerts: WeatherAlert[];
  nearestRadarSites: Array<{ id: string; name: string; distanceM: number; bearingDeg: number }>;
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
  if (e.includes('tornado emergency')) base = 600;
  else if (e.includes('tornado warning')) base = 500;
  else if (e.includes('severe thunderstorm warning')) base = 400;
  else if (e.includes('flash flood warning')) base = 300;
  else if (e.includes('warning')) base = 200;
  else if (e.includes('watch')) base = 100;
  if (isPds(alert)) base += 50;
  return base;
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

export function sortAlertsForContext(alerts: WeatherAlert[]): WeatherAlert[] {
  return [...alerts].sort((a, b) => warningPriority(b) - warningPriority(a) || Date.parse(b.sent || '') - Date.parse(a.sent || ''));
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-t border-slate-800 py-1 text-[10px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200 break-words">{value || 'Unavailable'}</span>
    </div>
  );
}

function WarningCard({ alert, onSelect }: { alert: WeatherAlert; onSelect: (a: WeatherAlert) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-slate-700 bg-[#0f172a]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[#162033]">
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-slate-100 truncate"><span className="text-amber-300 mr-1">⚠</span>{isPds(alert) ? 'PDS ' : ''}{alert.event}</div>
          <div className="text-[10px] text-slate-500 truncate">{alert.wfo || 'Office unavailable'} · {alertExpiryLabel(alert)}</div>
        </div>
        <span className="text-[10px] text-slate-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-700 px-2 py-2 space-y-1">
          <Row label="Event type" value={alert.event} />
          <Row label="Issuing office" value={alert.senderName || alert.wfo || 'Unavailable'} />
          <Row label="Issue time" value={formatAlertTime(alert.sent)} />
          <Row label="Expiration time" value={formatAlertTime(alert.expires)} />
          <div className="border-t border-slate-800 pt-1">
            <div className="text-[10px] text-slate-500">Impact / Hazard</div>
            <div className="text-[10px] text-slate-200 whitespace-pre-wrap">{alert.headline || alert.description || 'Unavailable'}</div>
          </div>
          <div className="border-t border-slate-800 pt-1">
            <div className="text-[10px] text-slate-500">Instructions</div>
            <div className="text-[10px] text-slate-300 whitespace-pre-wrap">{alert.instruction || 'Unavailable from source.'}</div>
          </div>
          <Row label="Affected locations" value={alert.areaDesc || 'Unavailable'} />
          <button type="button" onClick={() => onSelectAlert(alert)} className="mt-1 w-full rounded-full border border-slate-600 bg-[#111827] px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700">Open full alert details</button>
        </div>
      )}
    </div>
  );
}

export function AlertDetailsPanel({ alert, context, onClose, onSelectAlert }: Props) {
  const [reportsOpen, setReportsOpen] = useState(false);
  const [lsrOpen, setLsrOpen] = useState(false);
  const [fullAlertOpen, setFullAlertOpen] = useState(false);
  const contextAlerts = useMemo(() => sortAlertsForContext(context?.alerts || []), [context?.alerts]);
  if (!alert && !context) return null;
  const nearest = context?.nearestRadarSites?.[0];

  return (
    <div className="absolute left-3 top-14 z-40 w-[320px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-slate-700 bg-[#111827] shadow-lg text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-700 px-2.5 py-2">
        <div className="text-[10px] font-black uppercase tracking-wider text-sky-300">{context ? 'What matters here' : 'Alert details'}</div>
        <button type="button" onClick={onClose} className="rounded-full px-2 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white text-xs">✕</button>
      </div>
      <div className="max-h-[min(58vh,calc(100vh-8rem))] overflow-auto p-2.5 space-y-2">
        {context && (
          <>
            <div className="rounded-md border border-slate-700 bg-[#0f172a] px-2 py-1.5">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">Nearest Radar</div>
              {nearest ? (
                <button type="button" onClick={() => (window as any).__mvSelectRadarSite?.(nearest.id)} className="mt-0.5 w-full text-left hover:text-sky-300">
                  <div className="text-[12px] font-black text-slate-100">{nearest.id}</div>
                  <div className="text-[10px] text-slate-400">{formatDistance(nearest.distanceM)} · {bearingCardinal(nearest.bearingDeg)} ({Math.round(nearest.bearingDeg)}°)</div>
                </button>
              ) : <div className="text-[10px] text-slate-500">Unavailable</div>}
            </div>

            <div>
              <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-slate-500">Active warnings affecting point</div>
              {contextAlerts.length ? (
                <div className="space-y-1">
                  {contextAlerts.map((a) => <WarningCard key={a.id} alert={a} onSelect={onSelectAlert} />)}
                </div>
              ) : <div className="rounded-md border border-slate-700 bg-[#0f172a] px-2 py-1.5 text-[10px] text-slate-500">No active warnings at this point.</div>}
            </div>

            <div className="rounded-md border border-slate-700 bg-[#0f172a]">
              <button type="button" onClick={() => setReportsOpen(v=>!v)} className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-[#162033]">
                <span>Spotter Reports ({context.spotterReportsNearby.length})</span><span className="text-slate-500">{reportsOpen?'▾':'▸'}</span>
              </button>
              {reportsOpen && (
                <div className="border-t border-slate-700 px-2 py-1.5 space-y-1">
                  {context.spotterReportsNearby.length ? context.spotterReportsNearby.slice(0,5).map((r) => (
                    <div key={r.id} className="text-[10px] text-slate-300">{r.hazard || 'Report'} <span className="text-slate-500">{r.distanceM!=null ? `· ${formatDistance(r.distanceM)}` : ''}</span></div>
                  )) : <div className="text-[10px] text-slate-500">No nearby spotter reports loaded.</div>}
                </div>
              )}
            </div>

            <div className="rounded-md border border-slate-700 bg-[#0f172a]">
              <button type="button" onClick={() => setLsrOpen(v=>!v)} className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-[#162033]">
                <span>Local Storm Reports ({context.lsrNearby.length})</span><span className="text-slate-500">{lsrOpen?'▾':'▸'}</span>
              </button>
              {lsrOpen && (
                <div className="border-t border-slate-700 px-2 py-1.5 space-y-1">
                  {context.lsrNearby.length ? context.lsrNearby.slice(0,5).map((r) => (
                    <div key={r.id} className="text-[10px] text-slate-300">{r.hazard || 'LSR'} <span className="text-slate-500">{r.distanceM!=null ? `· ${formatDistance(r.distanceM)}` : ''}</span></div>
                  )) : <div className="text-[10px] text-slate-500">No nearby local storm reports loaded.</div>}
                </div>
              )}
            </div>
          </>
        )}

        {alert && !context && (
          <section className="rounded-md border border-slate-700 bg-[#0f172a] p-2">
            <div className="text-[11px] font-black text-white">{isPds(alert) ? 'PDS ' : ''}{alert.event}</div>
            <div className="text-[10px] text-slate-500">{alert.wfo || 'Office unavailable'} · {alertExpiryLabel(alert)}</div>
            <button type="button" onClick={() => setFullAlertOpen((v)=>!v)} className="mt-2 w-full rounded-full border border-slate-600 bg-[#111827] px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700">{fullAlertOpen ? 'Hide details' : 'Show details'}</button>
            {fullAlertOpen && (
              <div className="mt-2">
                <Row label="Event type" value={alert.event} />
                <Row label="Issuing office" value={alert.senderName || alert.wfo || 'Unavailable'} />
                <Row label="Issue time" value={formatAlertTime(alert.sent)} />
                <Row label="Expiration time" value={formatAlertTime(alert.expires)} />
                <Row label="Affected locations" value={alert.areaDesc || 'Unavailable'} />
                <div className="border-t border-slate-800 pt-1 mt-1 text-[10px] text-slate-300 whitespace-pre-wrap">{alert.description || alert.headline || 'Unavailable'}</div>
                <div className="border-t border-slate-800 pt-1 mt-1 text-[10px] text-slate-300 whitespace-pre-wrap">{alert.instruction || 'Instructions unavailable from source.'}</div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export function buildLocationContext(lat: number, lon: number, alerts: WeatherAlert[], radarSites: Array<{id:string;name:string;lat:number;lon:number}>, reports: any[], mcdFeatures: any[]): LocationContext {
  const containing = alerts.filter((a) => a.geometry && pointInGeometry([lon, lat], a.geometry));
  const nearestRadarSites = radarSites.map((s) => ({
    id: s.id, name: s.name,
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
  return { lat, lon, alerts: sortAlertsForContext(containing), nearestRadarSites, spotterReportsNearby, lsrNearby, mcdNearby, spcProducts };
}
