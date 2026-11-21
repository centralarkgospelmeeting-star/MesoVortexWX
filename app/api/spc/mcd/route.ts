import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Official NOAA NWS Storm Prediction Center Mesoscale Discussions GeoJSON Service
    const url =
      'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/spc_mesoscale_discussion/MapServer/0/query?where=1%3D1&outFields=*&f=geojson';

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MesoVortexWX/2.0 (contact@mesovortexwx.internal)',
      },
      next: { revalidate: 60 }, // 1-minute cache
    });

    if (!res.ok) {
      return NextResponse.json({ type: 'FeatureCollection', features: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[SPC MCD Route Error]:', error);
    return NextResponse.json({ type: 'FeatureCollection', features: [] });
  }
}
