import { NextResponse } from 'next/server';
import { validBbox } from '../metar/surface-feed';
import { parseLatestObservations, type NdbcBbox, type NdbcNetwork } from './ndbc';

const SOURCE = 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt';

function unavailable(error: string, status: number, network: NdbcNetwork) {
  return NextResponse.json(
    {
      type: 'FeatureCollection',
      features: [],
      error: `DATA UNAVAILABLE - ${error}`,
      _meta: { ok: false, sourceType: network, source: SOURCE },
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function getNdbcResponse(params: URLSearchParams, network: NdbcNetwork) {
  const rawBbox = params.get('bbox');
  const parsed = validBbox(rawBbox);
  if (rawBbox && !parsed) return unavailable('invalid bbox (lat0,lon0,lat1,lon1)', 400, network);
  const bbox: NdbcBbox | null = parsed
    ? { lat0: parsed[0], lon0: parsed[1], lat1: parsed[2], lon1: parsed[3] }
    : null;

  try {
    const res = await fetch(SOURCE, {
      headers: { 'User-Agent': 'MesoVortexWX/2.0 (https://mesovortex-wx.vercel.app)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return unavailable(`NDBC HTTP ${res.status}`, 502, network);
    const features = parseLatestObservations(await res.text(), network, bbox);
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features,
        _meta: {
          ok: true,
          fetchedAt: new Date().toISOString(),
          source: SOURCE,
          sourceType: network,
          sourceLabel: network === 'buoy' ? 'NOAA NDBC buoy observations' : 'NOAA NDBC marine observations',
          filter: network === 'buoy' ? 'Five-digit NDBC buoy station IDs only' : 'Non-buoy NDBC marine station IDs only',
          count: features.length,
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (error: any) {
    return unavailable(String(error?.message || error), 502, network);
  }
}
