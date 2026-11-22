import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

// DATA HONESTY: No fake GLM strikes. This endpoint should only return real GOES GLM data.
// TODO: wire NOAA AWS Open Data GLM-L2-LCFA (NetCDF) parser or verified official GeoJSON feed.
export async function GET() {
  return NextResponse.json({
    available: false,
    source: 'NOAA GOES-R Geostationary Lightning Mapper (GLM) - not yet integrated',
    generatedAt: new Date().toISOString(),
    features: { type: 'FeatureCollection', features: [] },
    reason: 'DATA UNAVAILABLE - verified real GLM feed not integrated in this build. No synthetic lightning.',
  }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
