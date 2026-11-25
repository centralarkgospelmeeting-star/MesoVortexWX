import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { fetchIemNetwork, type IemStation } from '../../../../lib/surface/iem-stations';

export const dynamic = 'force-dynamic';

function validBbox(bbox: string | null) {
  if (!bbox) return null;
  const parts = bbox.split(',').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [lat0, lon0, lat1, lon1] = parts;
  if (lat0 < -90 || lat1 > 90 || lon0 < -180 || lon1 > 180) return null;
  if (lat0 >= lat1 || lon0 >= lon1) return null;
  return { lat0, lon0, lat1, lon1 };
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const bbox = validBbox(params.get('bbox'));
  const network = (params.get('network') || 'IA_ASOS').trim();
  if (!bbox) {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'DATA UNAVAILABLE - invalid bbox (lat0,lon0,lat1,lon1)' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const jsonHeaders = { 'Cache-Control': 'no-store' };
  try {
    const stations = await fetchIemNetwork(network);
    const inBbox = stations.filter((s: IemStation) => s.isAwos && s.lat >= bbox.lat0 && s.lat <= bbox.lat1 && s.lon >= bbox.lon0 && s.lon <= bbox.lon1);
    if (inBbox.length === 0) {
      return NextResponse.json({ type: 'FeatureCollection', features: [], _meta: { ok: true, sourceType: 'awos', sourceLabel: 'IEM AWOS metadata + AWC METAR', count: 0 } }, { headers: jsonHeaders });
    }
    const ids = inBbox.map((s) => s.id);
    const metaById = new Map<string, IemStation>(inBbox.map((s) => [s.id.toUpperCase(), s]));
    // Map IEM 3-letter FAA LIDs to AWC ICAO ids (K-prefix) for the METAR lookup.
    const awcIds = ids.map((id) => (id.length === 3 ? `K${id}` : id));
    const awcToIem = new Map(awcIds.map((awc, i) => [awc.toUpperCase(), ids[i]]));
    // Fetch AWC METAR for these ids in batches of 20.
    const features: any[] = [];
    for (let i = 0; i < awcIds.length; i += 20) {
      const chunk = awcIds.slice(i, i + 20);
      const url = `https://aviationweather.gov/api/data/metar?format=geojson&hours=3&ids=${chunk.join(',')}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'MesoVortexWX/2.0', Accept: 'application/geo+json' }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const data = await res.json();
      for (const f of data?.features || []) {
        const p = f?.properties || {};
        const sid = String(p.icaoId || p.stationId || p.id || '').trim().toUpperCase();
        const iemId = (awcToIem.get(sid) || sid.replace(/^K/, '')).toUpperCase();
        const m = metaById.get(iemId);
        features.push({
          ...f,
          properties: {
            ...p,
            stationId: sid || p.stationId,
            siteName: m?.name || p.site || p.siteName,
            elev: m?.elevationM ?? p.elev,
            stationType: 'AWOS',
            asos: true,
            surfaceLayer: 'aviation',
            surfaceNetwork: 'awos',
            sourceLabel: 'IEM AWOS metadata + AWC METAR',
            sourceUrl: url,
          },
        });
      }
    }
    return NextResponse.json({
      type: 'FeatureCollection',
      features,
      _meta: { ok: true, sourceType: 'awos', sourceLabel: 'IEM AWOS metadata + AWC METAR', source: `https://mesonet.agron.iastate.edu/geojson/network.py?network=${network}`, count: features.length },
    }, { headers: jsonHeaders });
  } catch (err: any) {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: `DATA UNAVAILABLE - ${err?.message || 'AWOS fetch failed'}` }, { status: 502, headers: jsonHeaders });
  }
}