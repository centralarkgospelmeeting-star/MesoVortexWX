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
 if(!payload.method.nrot.includes('Not GR2 Analyst NROT'))throw new Error(site+' did not identify the NROT-style method honestly.');
 if(!Array.isArray(payload.nrotPeaks)||!payload.sweeps.every(s=>s.nrot&&typeof s.nrot.gatesAnalyzed==='number'))throw new Error(site+' returned incomplete NROT fields.');
 if(!payload.sweeps.every(s=>s.velocity.dealiasing&&typeof s.velocity.dealiasing.gatesCorrected==='number'&&typeof s.velocity.dealiasing.nyquistRadials==='number'))throw new Error(site+' returned incomplete velocity-dealiasing diagnostics.');
 if(!payload.sweeps.every(s=>typeof s.nrot.quality.velocityDealiased==='boolean'&&s.nrot.quality.aliasSensitive===true))throw new Error(site+' did not expose NROT dealiasing quality.');
 console.log(JSON.stringify({site,scanTime:payload.scanTime,sweeps:payload.sweepCount,couplets:payload.rotationCouplets.length,reflectivitySweeps:payload.sweeps.filter(s=>s.reflectivity).length,dualPolSweeps:payload.sweeps.filter(s=>s.dualPol.available.rhohv||s.dualPol.available.zdr||s.dualPol.available.phi).length,dealiasedGates:payload.sweeps.reduce((n,s)=>n+s.velocity.dealiasing.gatesCorrected,0),nyquistRadials:payload.sweeps.reduce((n,s)=>n+s.velocity.dealiasing.nyquistRadials,0)}));
}
console.log('ANLZ live radar tests PASS');
