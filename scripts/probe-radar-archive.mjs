#!/usr/bin/env node
/**
 * Sprint 3 archive confidence probe.
 * Samples real IEM RIDGE tiles across sites/timestamps.
 * Output: JSON report to stdout.
 */
const IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';
const PRODUCTS = [
  { key: 'N0B', id: 'ref', kind: 'NEXRAD' },
  { key: 'N0U', id: 'vel', kind: 'NEXRAD' },
  { key: 'N0S', id: 'srvel', kind: 'NEXRAD' },
  { key: 'TZL', id: 'ref_tdw', kind: 'TDWR' },
  { key: 'TV0', id: 'vel_tdw', kind: 'TDWR' },
];
const NEXRAD_SITES = ['LWX','LZK','TLX','MHX','FWS','RTX','OKX','DVN','AMA','PBZ'];
const TDWR_SITES = ['TDFW','TATL','TORD','TMSP','TPHX','TLAS','TMIA','TDEN','TDTW','TCLT'];
// multiple timestamps: recent minutes back, and a few older offsets (hours/days)
const OFFSETS_MIN = [15,30,60,120,180,360,720,1440,2880]; // 15m..2d

function stamp(minsAgo){
  const d=new Date(Date.now()-minsAgo*60000);
  d.setUTCMinutes(Math.floor(d.getUTCMinutes()/5)*5,0,0);
  const p=n=>String(n).padStart(2,'0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}
async function probe(url){
  try{
    const c=new AbortController(); const t=setTimeout(()=>c.abort(),8000);
    const r=await fetch(url,{signal:c.signal,redirect:'follow'});
    clearTimeout(t);
    if(!r.ok) return {ok:false,status:r.status,bytes:0};
    const buf=new Uint8Array(await r.arrayBuffer());
    const magic=buf.length>=4?Array.from(buf.slice(0,4)).map(b=>b.toString(16).padStart(2,'0')).join(''):'';
    return {ok:r.status===200 && magic==='89504e47',status:r.status,bytes:buf.length};
  }catch(e){ return {ok:false,status:'ERR',err:String(e.message||e).slice(0,40)}; }
}
function ridge(sector,prod,st){ return `${IEM}/ridge::${sector}-${prod}-${st}/7/33/50.png`; }

async function main(){
  const out={generatedAt:new Date().toISOString(), products:{}};
  for(const p of PRODUCTS){
    const sites=p.kind==='TDWR'?TDWR_SITES:NEXRAD_SITES;
    const res={product:p.key, kind:p.kind, samples:[], summary:{total:0,ok:0,fail:0}};
    for(const site of sites){
      for(const off of OFFSETS_MIN){
        const st=stamp(off);
        const url=ridge(site,p.key,st);
        const r=await probe(url);
        res.samples.push({site,offsetMin:off,stamp:st,...r});
        res.summary.total++; if(r.ok) res.summary.ok++; else res.summary.fail++;
        process.stderr.write('.');
      }
    }
    res.summary.okRate = res.summary.total ? res.summary.ok/res.summary.total : 0;
    // classification
    const rate=res.summary.okRate;
    res.classification = rate>=0.7 ? 'REAL_ARCHIVE' : res.summary.ok>0 ? 'PARTIAL_ARCHIVE' : 'LIVE_ONLY';
    out.products[p.key]=res;
    process.stderr.write(`\n${p.key} ${res.summary.ok}/${res.summary.total} ${res.classification}\n`);
  }
  console.log(JSON.stringify(out,null,2));
}
main().catch(e=>{ console.error(e); process.exit(1); });
