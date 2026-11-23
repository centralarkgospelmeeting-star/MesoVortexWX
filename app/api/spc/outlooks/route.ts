import { NextResponse } from 'next/server';
import { fetchJsonWithTimeout, errorPayload } from '../../../../lib/api-utils';

export const dynamic = 'force-dynamic';

const DAY_URLS: Record<string, string> = {
  '1': 'https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson',
  '2': 'https://www.spc.noaa.gov/products/outlook/day2otlk_cat.nolyr.geojson',
  '3': 'https://www.spc.noaa.gov/products/outlook/day3otlk_cat.nolyr.geojson',
};

export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get('day') || '1';
  const source = DAY_URLS[day];
  if (!source) {
    return NextResponse.json(errorPayload({ type: 'FeatureCollection', features: [] }, 'SPC Convective Outlook', `Invalid day ${day}. Use 1-3.`), {
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
    { ...result.data, _meta: { fetchedAt: new Date().toISOString(), source, ok: true, product: 'SPC Convective Outlook', day } },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } }
  );
}
