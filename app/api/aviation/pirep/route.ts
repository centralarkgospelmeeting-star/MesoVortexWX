import { NextResponse } from 'next/server';
import { fetchJsonWithTimeout, errorPayload } from '../../../../lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bbox = url.searchParams.get('bbox') || '';
  const age = url.searchParams.get('age') || '2';
  const format = url.searchParams.get('format') || 'json';
  if (!bbox) {
    return NextResponse.json(errorPayload([], 'aviationweather.gov PIREP', 'Provide bbox=lat0,lon0,lat1,lon1'), { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const source = new URL('https://aviationweather.gov/api/data/pirep');
  source.searchParams.set('format', format);
  source.searchParams.set('age', age);
  source.searchParams.set('bbox', bbox);
  const result = await fetchJsonWithTimeout(source.toString(), { headers: { 'User-Agent': 'MesoVortexWX/2.0' }, timeoutMs: 12000 });
  if (!result.ok) {
    return NextResponse.json(errorPayload([], source.toString(), result.error), { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ data: result.data, _meta: { fetchedAt: new Date().toISOString(), source: source.toString(), ok: true, product: 'PIREP' } }, { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' } });
}
