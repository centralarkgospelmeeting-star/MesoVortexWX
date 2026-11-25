import { NextResponse } from 'next/server';
import { validBbox } from '../metar/surface-feed';
import { normalizeIemObservations, type MesonetBbox } from './iem-mesonet';

function unavailable(error: string, status: number, network: string | null) {
  return NextResponse.json(
    {
      type: 'FeatureCollection',
      features: [],
      error: `DATA UNAVAILABLE - ${error}`,
      _meta: { ok: false, sourceType: 'mesonet', network, source: 'Iowa Environmental Mesonet' },
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function getIemResponse(params: URLSearchParams) {
  const network = params.get('network')?.trim().toUpperCase() || null;
  if (!network || !/^[A-Z0-9_]{2,24}$/.test(network)) {
    return unavailable('provide a valid network id', 400, network);
  }
  const parsed = validBbox(params.get('bbox'));
  if (params.get('bbox') && !parsed) return unavailable('invalid bbox (lat0,lon0,lat1,lon1)', 400, network);
  const bbox: MesonetBbox | null = parsed
    ? { lat0: parsed[0], lon0: parsed[1], lat1: parsed[2], lon1: parsed[3] }
    : null;

  const sources = [
    `https://mesonet.agron.iastate.edu/api/1/currents.geojson?network=${encodeURIComponent(network)}`,
    `https://mesonet.agron.iastate.edu/api/1/currents.json?network=${encodeURIComponent(network)}`,
  ];
  let lastError = 'IEM request failed';
  for (const source of sources) {
    try {
      const res = await fetch(source, {
        headers: { 'User-Agent': 'MesoVortexWX/2.0 (https://mesovortex-wx.vercel.app)' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        lastError = `IEM HTTP ${res.status}`;
        continue;
      }
      const features = normalizeIemObservations(await res.json(), network, bbox);
      return NextResponse.json(
        {
          type: 'FeatureCollection',
          features,
          _meta: {
            ok: true,
            fetchedAt: new Date().toISOString(),
            source,
            sourceType: 'mesonet',
            sourceLabel: `IEM ${network} mesonet observations`,
            network,
            count: features.length,
            note: features.length === 0 ? 'No station in this network returned usable coordinates and current readings.' : null,
          },
        },
        { headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=360' } }
      );
    } catch (error: any) {
      lastError = String(error?.message || error);
    }
  }
  return unavailable(lastError, 502, network);
}
