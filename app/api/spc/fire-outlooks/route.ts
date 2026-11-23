import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get('day') || '1';
  // Probed 2026-11-22: SPC fire weather GeoJSON/shapefile endpoints returned 404
  // (day1fireotlk*.nolyr.geojson, day1fwotlk*.nolyr.geojson, day1fireotlk-shp.zip, day1fwotlk-shp.zip).
  // SPC_wx_outlks MapServer layers contain convective outlooks but no fire weather layers.
  // Do not fabricate fire outlook geometry.
  return NextResponse.json({
    type: 'FeatureCollection',
    features: [],
    _meta: {
      fetchedAt: new Date().toISOString(),
      source: 'https://www.spc.noaa.gov/products/fire_wx/',
      ok: false,
      error: 'DATA UNAVAILABLE - No verified real SPC Fire Weather Outlook GIS/GeoJSON endpoint found. Probed GeoJSON/shapefile names returned 404; NOAA SPC_wx_outlks MapServer has no fire weather layers.',
      product: 'SPC Fire Weather Outlook',
      day,
      evidence: [
        'https://www.spc.noaa.gov/products/fire_wx/day1fireotlk_cat.nolyr.geojson -> 404',
        'https://www.spc.noaa.gov/products/fire_wx/day1fwotlk_cat.nolyr.geojson -> 404',
        'https://www.spc.noaa.gov/products/fire_wx/day1fwotlk-shp.zip -> 404',
        'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer layers: no fire weather layers',
      ],
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
