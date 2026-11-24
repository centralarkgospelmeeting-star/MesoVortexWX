import { fetchLevel2VolumeSummary } from '../../../../lib/radar/level2-polar';
import { RADAR_SITES } from '../../../../lib/radar-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = (searchParams.get('site') || 'KLZK').toUpperCase();
  const site = RADAR_SITES.find((candidate) => candidate.network === 'NEXRAD' && (candidate.id === siteId || candidate.radarId === siteId || candidate.radarId === siteId.replace(/^K/, '')));
  if (!site) {
    return Response.json({ available: false, error: `Unknown NEXRAD site "${siteId}"` }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const summary = await fetchLevel2VolumeSummary(site.id);
    return Response.json({ available: true, ...summary }, {
      headers: { 'Cache-Control': 'no-store', 'X-MesoVortex-Data': 'live-noaa-nexrad-level2' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load live Level II volume';
    return Response.json({ available: false, site: site.id, error: message }, { status: 502, headers: { 'Cache-Control': 'no-store', 'X-MesoVortex-Data': 'unavailable' } });
  }
}
