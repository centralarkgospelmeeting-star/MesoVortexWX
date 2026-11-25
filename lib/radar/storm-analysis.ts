import { RADAR_SITES, type RadarSite } from '../radar-config';
import { calculateNrot } from './nrot';
import { dealiasVelocity } from './velocity-dealias';

type Moment = { moment_data?: Array<number | null>; gate_count?: number; gate_size?: number; first_gate?: number };
type Radial = {
  azimuth?: number;
  elevation_angle?: number;
  reflect?: Moment | Array<number | null>;
  velocity?: Moment;
  rho?: Moment;
  zdr?: Moment;
  phi?: Moment;
  spectrum?: Moment;
  radial?: { nyquist_velocity?: number };
};
type Volume = { data: Array<Array<{ record?: Radial }> | undefined>; listElevations(): number[] };
type Frame = { volume: Volume; time: string; site: RadarSite };

const MS_TO_KT = 1.943844492;
const DEG = Math.PI / 180;

function moment(radial: Radial, key: 'reflect' | 'velocity' | 'rho' | 'zdr' | 'phi' | 'spectrum'): Moment | undefined {
  const value = radial[key];
  if (key === 'reflect' && Array.isArray(value)) return { moment_data: value };
  return value as Moment | undefined;
}
function finiteValues(values: Array<number | null> | undefined): number[] {
  return (values || []).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}
function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1, Math.max(0, Math.round((sorted.length-1)*p)))];
}
function summarize(values: number[], unit: string) {
  if (!values.length) return null;
  const min = values.reduce((a,b)=>Math.min(a,b), Number.POSITIVE_INFINITY);
  const max = values.reduce((a,b)=>Math.max(a,b), Number.NEGATIVE_INFINITY);
  return {
    samples: values.length,
    min: Number(min.toFixed(2)),
    mean: Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(2)),
    median: percentile(values,0.5),
    p90: percentile(values,0.9),
    max: Number(max.toFixed(2)),
    unit,
  };
}
function circularDifference(a:number,b:number) {
  const d=Math.abs(a-b)%360;
  return Math.min(d,360-d);
}
function destination(lat:number,lon:number,bearingDeg:number,rangeKm:number) {
  const angular=rangeKm/6371.0088, bearing=bearingDeg*DEG, lat1=lat*DEG, lon1=lon*DEG;
  const lat2=Math.asin(Math.sin(lat1)*Math.cos(angular)+Math.cos(lat1)*Math.sin(angular)*Math.cos(bearing));
  const lon2=lon1+Math.atan2(Math.sin(bearing)*Math.sin(angular)*Math.cos(lat1),Math.cos(angular)-Math.sin(lat1)*Math.sin(lat2));
  return {lat:Number((lat2/DEG).toFixed(5)),lon:Number((((lon2/DEG+540)%360)-180).toFixed(5))};
}
function sweepRecords(frame:Frame) {
  return frame.volume.listElevations().map((index, i) => {
    const radials=(frame.volume.data[index]||[]).map(item=>item.record).filter((r):r is Radial=>Boolean(r&&Number.isFinite(r.azimuth)));
    const angles=radials.map(r=>r.elevation_angle).filter((v):v is number=>Number.isFinite(v));
    const elevation=angles.length?angles.reduce((a,b)=>a+b,0)/angles.length:null;
    return {sweep:i+1,elevationDegrees:elevation===null?null:Number(elevation.toFixed(2)),radials:radials.sort((a,b)=>(a.azimuth||0)-(b.azimuth||0))};
  }).filter(s=>s.radials.length>0);
}
function momentStats(radials:Radial[], key:'reflect'|'rho'|'zdr'|'phi'|'spectrum') {
  const values=radials.flatMap(r=>finiteValues(moment(r,key)?.moment_data));
  return summarize(values,key==='reflect'?'dBZ':key==='rho'?'unitless':key==='zdr'?'dB':key==='phi'?'degrees':'m/s');
}
function kdpStats(radials:Radial[]) {
  const derived:number[]=[];
  for(const r of radials) {
    const phase=moment(r,'phi')?.moment_data;
    const rho=moment(r,'rho')?.moment_data;
    const gateKm=moment(r,'phi')?.gate_size;
    if(!phase||!rho||!Number.isFinite(gateKm)||!gateKm) continue;
    const unwrapped:number[]=[];
    let offset=0, previous:number|undefined;
    for(const raw of phase) {
      if(raw==null||!Number.isFinite(raw)){unwrapped.push(Number.NaN);previous=undefined;offset=0;continue;}
      let v=raw+offset;
      if(previous!==undefined){const d=v-previous;if(d>180){offset-=360;v-=360;}else if(d< -180){offset+=360;v+=360;}}
      unwrapped.push(v);previous=v;
    }
    for(let i=3;i<unwrapped.length-3;i++){
      if(rho[i]==null||!Number.isFinite(rho[i]!)||rho[i]!<0.80) continue;
      const ys=unwrapped.slice(i-3,i+4);
      if(ys.some(v=>!Number.isFinite(v))) continue;
      const xs=[-3,-2,-1,0,1,2,3].map(v=>v*gateKm);
      const meanX=0, meanY=ys.reduce((a,b)=>a+b,0)/7;
      let numerator=0,denominator=0;
      for(let j=0;j<7;j++){numerator+=xs[j]*(ys[j]-meanY);denominator+=xs[j]*xs[j];}
      const kdp=(numerator/denominator)/2;
      if(Number.isFinite(kdp)&&kdp>=-10&&kdp<=20) derived.push(kdp);
    }
  }
  return summarize(derived,'degrees/km');
}
function reflectivitySummary(radials:Radial[]) {
  const values=radials.flatMap(r=>finiteValues(moment(r,'reflect')?.moment_data));
  const valid=values.filter(v=>v>=-32&&v<=95);
  const summary=summarize(valid,'dBZ');
  return summary ? {
    ...summary,
    gatesAtLeast35dBZ:valid.filter(v=>v>=35).length,
    gatesAtLeast50dBZ:valid.filter(v=>v>=50).length,
    gatesAtLeast60dBZ:valid.filter(v=>v>=60).length,
  } : null;
}
function dualPolSummary(radials:Radial[]) {
  const rho=momentStats(radials,'rho'), zdr=momentStats(radials,'zdr'), phi=momentStats(radials,'phi'), kdp=kdpStats(radials);
  return {rhohv:rho,zdr, differentialPhase:phi,kdp,available:{rhohv:Boolean(rho),zdr:Boolean(zdr),phi:Boolean(phi),kdp:Boolean(kdp)}};
}
function velocityCouplets(radials:Radial[], elevation:number|null, site:RadarSite) {
  const candidates:Array<{rangeKm:number;bearingDegrees:number;deltaVelocityKt:number;inboundKt:number;outboundKt:number;azimuthalShearS1:number;diameterKm:number;lat:number;lon:number;elevationDegrees:number|null}>=[];
  if(radials.length<3) return candidates;
  for(let i=0;i<radials.length;i++){
    const a=radials[i], b=radials[(i+1)%radials.length];
    const azA=a.azimuth!, azB=b.azimuth!;
    const deltaAz=circularDifference(azA,azB);
    if(deltaAz<0.05||deltaAz>3.0) continue;
    const ma=moment(a,'velocity'), mb=moment(b,'velocity');
    if(!ma?.moment_data||!mb?.moment_data||!Number.isFinite(ma.gate_size)||!Number.isFinite(mb.gate_size)||!Number.isFinite(ma.first_gate)||!Number.isFinite(mb.first_gate)) continue;
    const gateKm=(ma.gate_size!+mb.gate_size!)/2;
    if(gateKm<=0) continue;
    const start=Math.max(ma.first_gate!,mb.first_gate!);
    const end=Math.min(ma.first_gate!+(ma.moment_data.length-1)*ma.gate_size!,mb.first_gate!+(mb.moment_data.length-1)*mb.gate_size!);
    for(let range=start;range<=end;range+=Math.max(gateKm,0.25)){
      const ia=Math.round((range-ma.first_gate!)/ma.gate_size!), ib=Math.round((range-mb.first_gate!)/mb.gate_size!);
      const va=ma.moment_data[ia], vb=mb.moment_data[ib];
      if(va==null||vb==null||!Number.isFinite(va)||!Number.isFinite(vb)) continue;
      const inbound=Math.min(va,vb)*MS_TO_KT, outbound=Math.max(va,vb)*MS_TO_KT;
      const delta=outbound-inbound;
      if(inbound> -10||outbound<10||delta<20) continue;
      const separationKm=2*range*Math.sin(deltaAz*DEG/2);
      if(separationKm<0.02) continue;
      const shear=(delta/MS_TO_KT)/(separationKm*1000);
      if(!Number.isFinite(shear)||shear<0.002) continue;
      const bearing=(azA+deltaAz/2)%360;
      const position=destination(site.lat,site.lon,bearing,range);
      candidates.push({rangeKm:Number(range.toFixed(2)),bearingDegrees:Number(bearing.toFixed(1)),deltaVelocityKt:Number(delta.toFixed(1)),inboundKt:Number(inbound.toFixed(1)),outboundKt:Number(outbound.toFixed(1)),azimuthalShearS1:Number(shear.toFixed(4)),diameterKm:Number(separationKm.toFixed(2)),...position,elevationDegrees:elevation});
    }
  }
  candidates.sort((a,b)=>b.deltaVelocityKt-a.deltaVelocityKt);
  const unique:Array<typeof candidates[number]>=[];
  for(const item of candidates){
    if(unique.some(other=>Math.abs(other.rangeKm-item.rangeKm)<1.5&&circularDifference(other.bearingDegrees,item.bearingDegrees)<3)) continue;
    unique.push(item);
    if(unique.length>=12) break;
  }
  return unique;
}

export async function buildStormAnalysis(siteId:string) {
  const site=RADAR_SITES.find(s=>s.network==='NEXRAD'&&(s.id===siteId.toUpperCase()||s.radarId===siteId.toUpperCase()||s.radarId===siteId.toUpperCase().replace(/^K/,'')));
  if(!site) throw new Error(`Unknown NEXRAD site "${siteId}".`);
  const {Level2Radar}=require('nexrad-level-2-data') as {Level2Radar:new(file:Buffer,options:{logger:false})=>Volume};
  const indexUrl='https://unidata-nexrad-level2.s3.amazonaws.com/';
  const now=new Date();
  let objectKey:string|undefined, scanDate:Date|undefined;
  for(const offset of [0,1]){
    const date=new Date(now.getTime()-offset*86400000);
    const y=date.getUTCFullYear(),m=String(date.getUTCMonth()+1).padStart(2,'0'),d=String(date.getUTCDate()).padStart(2,'0');
    const prefix=`${y}/${m}/${d}/${site.id}/`;
    const response=await fetch(indexUrl+`?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`,{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw new Error(`NOAA Level II index returned HTTP ${response.status}`);
    const xml=await response.text();
    const keys=Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g),m=>m[1]).filter(k=>/_V0[0-9]$/.test(k)).reverse();
    for(const key of keys){
      const match=key.match(/(\d{8})_(\d{6})_V\d+$/);
      if(!match) continue;
      const dt=new Date(`${match[1].slice(0,4)}-${match[1].slice(4,6)}-${match[1].slice(6,8)}T${match[2].slice(0,2)}:${match[2].slice(2,4)}:${match[2].slice(4,6)}Z`);
      if(now.getTime()-dt.getTime()<=20*60000){objectKey=key;scanDate=dt;break;}
    }
    if(objectKey) break;
  }
  if(!objectKey||!scanDate) throw new Error(`No recent Level II scan found for ${site.id} in the last 20 minutes`);
  const response=await fetch(indexUrl+objectKey.split('/').map(encodeURIComponent).join('/'),{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error(`NOAA Level II scan download returned HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>50_000_000) throw new Error('Level II scan exceeds the 50 MB safety limit');
  const volume=new Level2Radar(bytes,{logger:false});
  const frame:Frame={volume,time:scanDate.toISOString(),site};
  const sweeps=sweepRecords(frame).map(s=>{
    const ref=reflectivitySummary(s.radials);
    const dual=dualPolSummary(s.radials);
    // RAD.nyquist_velocity is stored by nexrad-level-2-data in hundredths of m/s.
    const dealiasInput=s.radials.map(r=>({
      ...r,
      reflect:moment(r,'reflect'),
      radial:r.radial ? {...r.radial,nyquist_velocity:r.radial.nyquist_velocity/100} : undefined,
    }));
    const dealias=dealiasVelocity(dealiasInput);
    const analysisRadials=dealias.radials.map(r=>({
      ...r,
      velocityDealiased:Boolean(r.radial?.nyquist_velocity&&r.radial.nyquist_velocity>0),
    }));
    const couplets=velocityCouplets(analysisRadials,s.elevationDegrees,site);
    const nrot=calculateNrot(analysisRadials,site.lat,site.lon);
    return {sweep:s.sweep,elevationDegrees:s.elevationDegrees,radialCount:s.radials.length,reflectivity:ref,velocity:{measuredRadials:s.radials.filter(r=>moment(r,'velocity')?.moment_data?.length).length,couplets,dealiasing:dealias.diagnostics},nrot,dualPol:dual};
  });
  const allCouplets=sweeps.flatMap(s=>s.velocity.couplets).sort((a,b)=>b.deltaVelocityKt-a.deltaVelocityKt).slice(0,20);
  const allNrotPeaks=sweeps.flatMap(s=>s.nrot.peaks.map(p=>({...p,sweep:s.sweep,elevationDegrees:s.elevationDegrees}))).sort((a,b)=>Math.abs(b.nrot)-Math.abs(a.nrot)).slice(0,30);
  return {
    site:site.id,siteName:site.name,scanTime:frame.time,source:'NOAA NEXRAD Level II on AWS',liveOnly:true,
    method:{rotation:'Adjacent-radial inbound/outbound velocity couplet screening; delta-V divided by beam-center separation (s^-1). This is a separate shear-screening diagnostic, not a tornado detector.',nrot:'NROT-style normalized azimuthal shear: local quadratic least-squares fit over a 5x5 polar neighborhood (3x3 fallback), then range normalization using a Stumpf-style minimal-mesocyclone threshold. Not GR2 Analyst NROT. Uses the separate continuity-dealiased velocity field where per-radial Nyquist metadata is available; residual aliasing remains possible.',velocity:'Radial velocity is continuity-dealiased using per-radial Nyquist velocity where available. Original Level-II moment arrays are preserved separately in the parsed volume; no storm-motion subtraction is applied. This is not ROC/RPG 2DVDA.',reflectivity:'Measured REF gate distribution by sweep.',dualPol:'Measured RHOHV, ZDR, PHI and PHI-derived KDP; unavailable moments remain null.'},
    thresholds:{coupletMinimumDeltaKt:20,inboundThresholdKt:-10,outboundThresholdKt:10,minimumShearS1:0.002,maximumAdjacentAzimuthDegrees:3},
    sweepCount:sweeps.length,sweeps,rotationCouplets:allCouplets,nrotPeaks:allNrotPeaks,
    quality:{scanAgeMinutes:Number(((Date.now()-scanDate.getTime())/60000).toFixed(1)),singleRadar:true,archive:false,stormMotionCorrected:false,terrainCorrectedHeights:false},
  };
}
