import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sounding?lat=35.22&lon=-97.44&hours=6
 * Fetches atmospheric sounding data from WeatherPower for any point in the US.
 * Requires WEATHERPOWER_API_KEY to be configured server-side.
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.WEATHERPOWER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'DATA UNAVAILABLE - WEATHERPOWER_API_KEY is not configured on the server.',
        _meta: { ok: false, source: 'WeatherPower', reason: 'MISSING_ENV' },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const hours = searchParams.get('hours') || '6';

  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'lat and lon query parameters are required' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
    return NextResponse.json(
      { error: 'lat and lon must be valid numbers' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const url = `https://weatherpower.app/wpcc-api/v1/sounding?lat=${latNum}&lon=${lonNum}&hours=${hours}`;

    const res = await fetch(url, {
      headers: {
        'X-API-Key': apiKey,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[sounding] WeatherPower error:', res.status, text.slice(0, 500));
      return NextResponse.json(
        { error: 'Failed to fetch sounding from WeatherPower', status: res.status },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const data = await res.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[sounding] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error while fetching sounding' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
