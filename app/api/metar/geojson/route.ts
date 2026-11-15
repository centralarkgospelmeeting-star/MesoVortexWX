import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Live METARs from AviationWeather.gov
 * Requires either ?ids=KLIT,KDFW or ?bbox=lat0,lon0,lat1,lon1
 *
 * Examples:
 *   /api/metar/geojson?ids=KLIT,KDFW,KOKC
 *   /api/metar/geojson?bbox=33,-95,36,-91&hours=2
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids')?.trim();
  const bbox = searchParams.get('bbox')?.trim();
  const hours = searchParams.get('hours') || '2';
  const format = searchParams.get('format') || 'geojson';

  if (!ids && !bbox) {
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: [],
        error: 'Provide ids (e.g. KLIT,KDFW) or bbox (lat0,lon0,lat1,lon1)',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const upstream = new URL('https://aviationweather.gov/api/data/metar');
  upstream.searchParams.set('format', format === 'json' ? 'json' : 'geojson');
  upstream.searchParams.set('hours', hours);
  if (ids) upstream.searchParams.set('ids', ids);
  if (bbox) upstream.searchParams.set('bbox', bbox);

  try {
    const res = await fetch(upstream.toString(), {
      headers: {
        'User-Agent': 'MesoVortexWX/2.0 (https://mesovortex-wx.vercel.app)',
        Accept: 'application/geo+json, application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        {
          type: 'FeatureCollection',
          features: [],
          error: `AviationWeather HTTP ${res.status}`,
          detail: text.slice(0, 300),
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const data = await res.json();

    // Normalize: AviationWeather may return FeatureCollection or array
    let features: any[] = [];
    if (Array.isArray(data)) {
      features = data.map((m: any, i: number) => ({
        type: 'Feature',
        id: m.icaoId || m.stationId || i,
        geometry: {
          type: 'Point',
          coordinates: [Number(m.lon ?? m.longitude), Number(m.lat ?? m.latitude)],
        },
        properties: m,
      }));
    } else if (data?.features) {
      features = data.features;
    }

    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features,
        _meta: {
          fetchedAt: new Date().toISOString(),
          source: upstream.toString(),
          ok: true,
          count: features.length,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=180',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: [],
        error: err?.message || 'METAR fetch failed',
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
