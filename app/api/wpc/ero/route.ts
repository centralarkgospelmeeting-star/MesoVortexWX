import { NextResponse } from 'next/server';
import { fetchJsonWithTimeout, errorPayload } from '../../../../lib/api-utils';

export const dynamic = 'force-dynamic';

const DAY_URLS: Record<string, string> = {
  '1': 'https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day1_Latest.geojson',
  '2': 'https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day2_Latest.geojson',
  '3': 'https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day3_Latest.geojson',
  '4': 'https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day4_Latest.geojson',
  '5': 'https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day5_Latest.geojson',
};

export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get('day') || '1';
  const source = DAY_URLS[day];
  if (!source) {
    return NextResponse.json(errorPayload({ type: 'FeatureCollection', features: [] }, 'WPC ERO', `Invalid day ${day}. Use 1-5.`), {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const result = await fetchJsonWithTimeout(source, {
    headers: { 'User-Agent': 'MesoVortexWX/2.0' },
    timeoutMs: 12000,
  });

  if (!result.ok) {
    return NextResponse.json(errorPayload({ type: 'FeatureCollection', features: [] }, source, result.error), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.json(
    { ...result.data, _meta: { fetchedAt: new Date().toISOString(), source, ok: true, product: 'WPC Excessive Rainfall Outlook', day } },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } }
  );
}
