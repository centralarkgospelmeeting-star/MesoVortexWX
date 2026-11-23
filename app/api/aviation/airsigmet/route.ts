import { NextResponse } from 'next/server';
import { fetchJsonWithTimeout, errorPayload } from '../../../../lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'json';
  const type = url.searchParams.get('type') || ''; // sigmet, airmet
  const hazard = url.searchParams.get('hazard') || ''; // conv, turb, ice, ifr, mtn obscn
  const source = new URL('https://aviationweather.gov/api/data/airsigmet');
  source.searchParams.set('format', format);
  if (type) source.searchParams.set('type', type);
  if (hazard) source.searchParams.set('hazard', hazard);
  const result = await fetchJsonWithTimeout(source.toString(), { headers: { 'User-Agent': 'MesoVortexWX/2.0' }, timeoutMs: 12000 });
  if (!result.ok) {
    return NextResponse.json(errorPayload([], source.toString(), result.error), { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ data: result.data, _meta: { fetchedAt: new Date().toISOString(), source: source.toString(), ok: true, product: 'AIRSIGMET', type, hazard } }, { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' } });
}
