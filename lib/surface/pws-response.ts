import { NextResponse } from 'next/server';
import { validBbox } from '../metar/surface-feed';
import { normalizeAtmowxStations, type PwsBbox } from './atmowx';

const SOURCE = 'https://atmowx.net/xrpc/net.atmowx.queryStations';

function unavailable(error: string, status: number) {
  return NextResponse.json(
    {
      type: 'FeatureCollection',
      features: [],
      error: `DATA UNAVAILABLE - ${error}`,
      _meta: { ok: false, sourceType: 'pws', source: SOURCE },
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function getPwsResponse(params: URLSearchParams) {
  const parsed = validBbox(params.get('bbox'));
  if (params.get('bbox') && !parsed) return unavailable('invalid bbox (lat0,lon0,lat1,lon1)', 400);
  const bbox: PwsBbox | null = parsed
    ? { lat0: parsed[0], lon0: parsed[1], lat1: parsed[2], lon1: parsed[3] }
    : null;
  try {
    const res = await fetch(SOURCE, {
      headers: { 'User-Agent': 'MesoVortexWX/2.0', Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return unavailable(`atmowx HTTP ${res.status}`, 502);
    const features = normalizeAtmowxStations(await res.json(), bbox);
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features,
        _meta: {
          ok: true,
          fetchedAt: new Date().toISOString(),
          source: SOURCE,
          sourceType: 'pws',
          sourceLabel: 'atmowx public PWS observations',
          filter: 'Keyless public PWS stations only',
          note: 'Sparse network; coverage is not global.',
          count: features.length,
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' } }
    );
  } catch (error: any) {
    return unavailable(String(error?.message || error), 502);
  }
}
