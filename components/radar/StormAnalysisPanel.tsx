'use client';

import { useCallback, useEffect, useState } from 'react';

type Props={siteId:string;siteName:string;onClose:()=>void};
type Analysis={
 site:string;siteName:string;scanTime:string;source:string;liveOnly:boolean;sweepCount:number;
 method:{rotation:string;nrot:string;velocity:string;reflectivity:string;dualPol:string};
 quality:{scanAgeMinutes:number;singleRadar:boolean;archive:boolean;stormMotionCorrected:boolean;terrainCorrectedHeights:boolean};
 rotationCouplets:Array<{rangeKm:number;bearingDegrees:number;deltaVelocityKt:number;inboundKt:number;outboundKt:number;azimuthalShearS1:number;diameterKm:number;lat:number;lon:number;elevationDegrees:number|null}>;
 nrotPeaks:Array<{nrot:number;azimuthalShearS1:number;rangeKm:number;bearingDegrees:number;elevationDegrees:number|null;lat:number;lon:number;sampleCount:number;fitWindow:'5x5'|'3x3';sweep:number}>;
 sweeps:Array<{sweep:number;elevationDegrees:number|null;radialCount:number;reflectivity:{samples:number;min:number;mean:number;median:number|null;p90:number|null;max:number;unit:string;gatesAtLeast35dBZ:number;gatesAtLeast50dBZ:number;gatesAtLeast60dBZ:number}|null;velocity:{measuredRadials:number;couplets:Array<unknown>;dealiasing:{available:boolean;algorithm:string;radialCount:number;nyquistRadials:number;nyquistMissingRadials:number;gatesConsidered:number;gatesCorrected:number;gatesSuspected:number;gatesUnresolved:number;correctionRate:number;maximumFoldOrder:number;quality:'usable'|'partial'|'unavailable';limitations:string[]}};nrot:{available:boolean;method:string;peaks:Array<unknown>;maxCyclonic:number|null;maxAnticyclonic:number|null;gatesAnalyzed:number;gatesExcludedNearRadar:number;gatesRejected:number;quality:{velocityDealiased:boolean;nyquistVelocityAvailable:boolean;aliasSensitive:boolean;minimumRangeKm:number}};dualPol:{rhohv:{samples:number;min:number;mean:number;median:number|null;p90:number|null;max:number;unit:string}|null;zdr:{samples:number;min:number;mean:number;median:number|null;p90:number|null;max:number;unit:string}|null;differentialPhase:{samples:number;min:number;mean:number;median:number|null;p90:number|null;max:number;unit:string}|null;kdp:{samples:number;min:number;mean:number;median:number|null;p90:number|null;max:number;unit:string}|null;available:{rhohv:boolean;zdr:boolean;phi:boolean;kdp:boolean}}}>;
};

function Stat({label,value,unit}:{label:string;value:number|string|null|undefined;unit?:string}){
 return <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2"><div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-sm font-bold text-slate-100">{value==null?'—':typeof value==='number'?value.toFixed(2):value} <span className="text-[9px] font-normal text-slate-500">{unit||''}</span></div></div>;
}
function MomentStats({title,data}:{title:string;data:{samples:number;min:number;mean:number;max:number;unit:string}|null}){
 return <div className="rounded-lg border border-slate-800 p-2"><div className="mb-2 text-[10px] font-black uppercase text-cyan-300">{title}</div>{data?<div className="grid grid-cols-4 gap-1"><Stat label="Samples" value={data.samples}/><Stat label="Min" value={data.min} unit={data.unit}/><Stat label="Mean" value={data.mean} unit={data.unit}/><Stat label="Max" value={data.max} unit={data.unit}/></div>:<div className="text-[10px] text-slate-500">Moment not present in this scan.</div>}</div>;
}
export function StormAnalysisPanel({siteId,siteName,onClose}:Props){
 const [data,setData]=useState<Analysis|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{const response=await fetch('/api/radar/storm-analysis?site='+encodeURIComponent(siteId),{cache:'no-store',signal:AbortSignal.timeout(90000)});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Storm analysis unavailable');
   setData(payload as Analysis);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load radar analysis');setData(null);}
  finally{setLoading(false);}
 },[siteId]);
 useEffect(()=>{void load();},[load,refresh]);
 return <div className="pointer-events-auto absolute inset-x-3 top-16 bottom-24 z-40 mx-auto flex max-w-5xl flex-col overflow-hidden rounded-2xl border border-cyan-700/60 bg-slate-950/95 shadow-2xl backdrop-blur">
  <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
   <div><div className="text-[10px] font-black tracking-widest text-cyan-400">ANLZ · LIVE LEVEL II</div><h2 className="text-sm font-black text-white">Storm Analysis — {siteName} ({siteId})</h2>{data&&<div className="mt-1 text-[10px] text-slate-400">Scan {new Date(data.scanTime).toLocaleString()} · {data.sweepCount} sweeps · {data.quality.scanAgeMinutes} min old</div>}</div>
   <div className="flex gap-2"><button type="button" onClick={()=>setRefresh(v=>v+1)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white">Refresh</button><button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white">Close</button></div>
  </header>
  <div className="min-h-0 flex-1 overflow-auto p-3">
   {loading&&<div className="p-8 text-center text-sm text-cyan-200">Downloading and analyzing the latest NOAA Level II volume…</div>}
   {error&&<div className="rounded-lg border border-rose-700/60 bg-rose-950/30 p-4 text-sm text-rose-200"><b>ANLZ unavailable</b><div className="mt-1">{error}</div></div>}
   {data&&<>
    <div className="mb-3 rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-[10px] leading-relaxed text-amber-100"><b>Interpretation limits:</b> This panel now separates two diagnostics: adjacent-radial couplet screening and an NROT-style normalized azimuthal-shear estimate. The NROT-style calculation is not GR2 Analyst NROT. It uses a continuity-based velocity dealiasing approximation when Nyquist metadata is available; unresolved folding and absolute fold ambiguity remain possible. Neither diagnostic is a tornado detector or warning. Velocity is radial (not storm-relative); results represent one radar volume, not a storm track.</div>
    <section className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Sweeps" value={data.sweepCount}/><Stat label="Scan age" value={data.quality.scanAgeMinutes} unit="min"/><Stat label="Couplets flagged" value={data.rotationCouplets.length}/><Stat label="Source" value="NOAA Level II"/></section>
    <section className="mb-3 rounded-xl border border-slate-800 p-3"><h3 className="mb-2 text-xs font-black uppercase tracking-wide text-cyan-300">Velocity rotation / couplet screening</h3>
     <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Dealiasing quality" value={data.sweeps.every(s=>s.velocity.dealiasing.quality==='usable')?'Usable':data.sweeps.some(s=>s.velocity.dealiasing.available)?'Partial':'Unavailable'}/>
      <Stat label="Gates corrected" value={data.sweeps.reduce((n,s)=>n+s.velocity.dealiasing.gatesCorrected,0)}/>
      <Stat label="Suspected folds" value={data.sweeps.reduce((n,s)=>n+s.velocity.dealiasing.gatesSuspected,0)}/>
      <Stat label="Radials with Nyquist" value={data.sweeps.reduce((n,s)=>n+s.velocity.dealiasing.nyquistRadials,0)}/>
     </div>
     <div className="mb-2 text-[10px] leading-relaxed text-slate-400">Continuity dealiasing is an approximation, not the NOAA ROC/RPG 2DVDA. It uses previous-radial and along-ray continuity; no environmental wind table is applied. Absolute fold offset and sharp-shear ambiguity can remain. Raw Level II arrays are not overwritten.</div>{data.rotationCouplets.length?<div className="overflow-x-auto"><table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">Range</th><th className="p-2">Bearing</th><th className="p-2">Inbound</th><th className="p-2">Outbound</th><th className="p-2">ΔV</th><th className="p-2">Shear</th><th className="p-2">Location</th></tr></thead><tbody>{data.rotationCouplets.map((c,i)=><tr key={i} className="border-t border-slate-800 text-slate-200"><td className="p-2">{c.rangeKm.toFixed(1)} km</td><td className="p-2">{c.bearingDegrees.toFixed(0)}°</td><td className="p-2">{c.inboundKt.toFixed(1)} kt</td><td className="p-2">{c.outboundKt.toFixed(1)} kt</td><td className="p-2 font-bold text-amber-300">{c.deltaVelocityKt.toFixed(1)} kt</td><td className="p-2">{c.azimuthalShearS1.toFixed(4)} s⁻¹</td><td className="p-2">{c.lat.toFixed(3)}, {c.lon.toFixed(3)}</td></tr>)}</tbody></table></div>:<div className="text-[10px] text-slate-500">No adjacent-radial couplets met the documented screening thresholds in this volume.</div>}</section>
    <section className="mb-3 rounded-xl border border-slate-800 p-3"><h3 className="mb-2 text-xs font-black uppercase tracking-wide text-cyan-300">NROT-style normalized rotation</h3>
     <div className="mb-2 rounded-lg border border-amber-700/50 bg-amber-950/20 p-2 text-[10px] leading-relaxed text-amber-100">This is an openly documented NROT-style approximation, not GR2 Analyst NROT. The local quadratic fit estimates azimuthal shear and applies range normalization. Velocity is continuity-dealiased where per-radial Nyquist metadata is available. Residual aliasing, absolute fold ambiguity, and strong-shear errors remain possible. Values are research aids, not tornado detections or warnings. Reference levels above 1 and 2.5 are not probabilities.</div>
     <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Strongest cyclonic NROT" value={data.sweeps.reduce((m,s)=>Math.max(m,s.nrot.maxCyclonic??-Infinity),-Infinity)===-Infinity?null:data.sweeps.reduce((m,s)=>Math.max(m,s.nrot.maxCyclonic??-Infinity),-Infinity)}/>
      <Stat label="Strongest anticyclonic NROT" value={data.sweeps.reduce((m,s)=>Math.min(m,s.nrot.maxAnticyclonic??Infinity),Infinity)===Infinity?null:data.sweeps.reduce((m,s)=>Math.min(m,s.nrot.maxAnticyclonic??Infinity),Infinity)}/>
      <Stat label="Gates analyzed" value={data.sweeps.reduce((sum,s)=>sum+s.nrot.gatesAnalyzed,0)}/>
      <Stat label="Near-radar exclusion" value={8} unit="mi"/>
     </div>
     {data.nrotPeaks.length?<div className="overflow-x-auto"><table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">NROT</th><th className="p-2">Shear</th><th className="p-2">Range</th><th className="p-2">Bearing</th><th className="p-2">Elevation</th><th className="p-2">Fit</th><th className="p-2">Location</th></tr></thead><tbody>{data.nrotPeaks.map((p,i)=><tr key={i} className="border-t border-slate-800 text-slate-200"><td className={"p-2 font-bold "+(Math.abs(p.nrot)>=2.5?'text-rose-300':Math.abs(p.nrot)>=1?'text-amber-300':'text-slate-200')}>{p.nrot>0?'+':''}{p.nrot.toFixed(3)}</td><td className="p-2">{p.azimuthalShearS1.toFixed(5)} s⁻¹</td><td className="p-2">{p.rangeKm.toFixed(1)} km</td><td className="p-2">{p.bearingDegrees.toFixed(0)}°</td><td className="p-2">{p.elevationDegrees??'—'}°</td><td className="p-2">{p.fitWindow} ({p.sampleCount})</td><td className="p-2">{p.lat.toFixed(3)}, {p.lon.toFixed(3)}</td></tr>)}</tbody></table></div>:<div className="text-[10px] text-slate-500">No usable NROT-style estimates were produced from this volume.</div>}
    </section>
    <section className="mb-3 rounded-xl border border-slate-800 p-3"><h3 className="mb-2 text-xs font-black uppercase tracking-wide text-cyan-300">Reflectivity characteristics by elevation</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.sweeps.map(s=><div key={s.sweep} className="rounded-lg border border-slate-800 p-2"><div className="mb-2 text-[10px] font-bold text-slate-300">Sweep {s.sweep} · {s.elevationDegrees??'—'}° · {s.radialCount} radials</div>{s.reflectivity?<div className="grid grid-cols-2 gap-1"><Stat label="Max dBZ" value={s.reflectivity.max}/><Stat label="Mean dBZ" value={s.reflectivity.mean}/><Stat label="≥35 dBZ gates" value={s.reflectivity.gatesAtLeast35dBZ}/><Stat label="≥50 dBZ gates" value={s.reflectivity.gatesAtLeast50dBZ}/></div>:<div className="text-[10px] text-slate-500">REF missing.</div>}</div>)}</div></section>
    <section className="mb-3 rounded-xl border border-slate-800 p-3"><h3 className="mb-2 text-xs font-black uppercase tracking-wide text-cyan-300">Dual-polarization measurements</h3><div className="grid gap-2 sm:grid-cols-2">{data.sweeps.map(s=><div key={s.sweep} className="space-y-2 rounded-lg border border-slate-800 p-2"><div className="text-[10px] font-bold text-slate-300">Sweep {s.sweep} · {s.elevationDegrees??'—'}°</div><MomentStats title="Correlation coefficient (RHOHV)" data={s.dualPol.rhohv}/><MomentStats title="Differential reflectivity (ZDR)" data={s.dualPol.zdr}/><MomentStats title="Differential phase (PHI)" data={s.dualPol.differentialPhase}/><MomentStats title="Derived KDP (PHI gradient)" data={s.dualPol.kdp}/></div>)}</div></section>
    <details className="rounded-lg border border-slate-800 p-3"><summary className="cursor-pointer text-[10px] font-bold text-slate-400">Algorithms, thresholds and quality flags</summary><div className="mt-2 space-y-2 text-[10px] leading-relaxed text-slate-400"><p>{data.method.rotation}</p><p>{data.method.nrot}</p><p>{data.method.velocity}</p><p>{data.method.reflectivity}</p><p>{data.method.dualPol}</p><p>NROT-style fit: 5x5 local quadratic surface (3x3 fallback), reflectivity ≥20 dBZ center gates, every second range gate, exclude within 8 miles, reject local outliers beyond 12 m/s from neighborhood median. Continuity-based dealiasing is applied where Nyquist metadata is available; this is not ROC/RPG 2DVDA. Couplets: ΔV ≥20 kt, inbound ≤−10 kt, outbound ≥+10 kt, shear ≥0.002 s⁻¹, adjacent radial separation ≤3°.</p><p>Quality: single radar={String(data.quality.singleRadar)}; archive={String(data.quality.archive)}; storm-motion corrected={String(data.quality.stormMotionCorrected)}.</p></div></details>
   </>}
  </div>
 </div>;
}
