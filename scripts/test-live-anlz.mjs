const base=process.env.ANLZ_BASE_URL||'http://127.0.0.1:3000';
const deadline=Date.now()+60000;let ready=false;
while(Date.now()<deadline){try{const r=await fetch(base,{signal:AbortSignal.timeout(3000)});if(r.status<500){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,1500));}
if(!ready)throw new Error('Production server did not become ready within 60 seconds.');
for(const site of ['KLZK','KTLX']){
 const response=await fetch(base+'/api/radar/storm-analysis?site='+site,{cache:'no-store',signal:AbortSignal.timeout(120000)});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(site+' live ANLZ returned HTTP '+response.status+': '+(payload.error||'unknown error'));
 if(payload.site!==site||payload.liveOnly!==true||!payload.scanTime||!Array.isArray(payload.sweeps)||payload.sweeps.length<1)throw new Error(site+' returned incomplete scan metadata.');
 if(!payload.sweeps.some(s=>s.reflectivity&&s.reflectivity.samples>0))throw new Error(site+' returned no measured reflectivity gates.');
 if(!payload.sweeps.some(s=>s.velocity.measuredRadials>0))throw new Error(site+' returned no measured velocity radials.');
 if(!payload.sweeps.some(s=>s.dualPol.available.rhohv||s.dualPol.available.zdr||s.dualPol.available.phi))throw new Error(site+' returned no dual-polarization moments.');
 if(!payload.method.rotation.includes('not official NROT'))throw new Error(site+' did not identify the rotation algorithm honestly.');
 console.log(JSON.stringify({site,scanTime:payload.scanTime,sweeps:payload.sweepCount,couplets:payload.rotationCouplets.length,reflectivitySweeps:payload.sweeps.filter(s=>s.reflectivity).length,dualPolSweeps:payload.sweeps.filter(s=>s.dualPol.available.rhohv||s.dualPol.available.zdr||s.dualPol.available.phi).length}));
}
console.log('ANLZ live radar tests PASS');
