import { buildStormAnalysis } from '../../../../lib/radar/storm-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const params=new URL(request.url).searchParams;
  const site=(params.get('site')||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{3,4}$/.test(site)) return Response.json({available:false,error:'Provide a valid NEXRAD site identifier.'},{status:400,headers:{'Cache-Control':'no-store'}});
  try {
    const result=await buildStormAnalysis(site);
    return Response.json(result,{headers:{
      'Cache-Control':'no-store',
      'X-MesoVortex-Source':'NOAA-NEXRAD-Level-II',
      'X-MesoVortex-Site':result.site,
      'X-MesoVortex-Time':result.scanTime,
      'X-MesoVortex-Analysis':'measured-gates-derived',
    }});
  } catch(error) {
    const message=error instanceof Error?error.message:'Unknown storm-analysis error';
    return Response.json({available:false,site,error:message,source:'NOAA NEXRAD Level II on AWS'},{status:502,headers:{'Cache-Control':'no-store','X-MesoVortex-Data':'unavailable'}});
  }
}
