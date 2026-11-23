import { NextResponse } from 'next/server';
import { fetchJsonWithTimeout, errorPayload } from '../../../../lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = url.searchParams.get('ids') || '';
  const bbox = url.searchParams.get('bbox') || '';
  const hours = url.searchParams.get('hours') || '6';
  const format = url.searchParams.get('format') || 'json';
  if (!ids && !bbox) {
    return NextResponse.json(errorPayload([], 'aviationweather.gov TAF', 'Provide ids or bbox'), { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const source = new URL('https://aviationweather.gov/api/data/taf');
  source.searchParams.set('format', format);
  source.searchParams.set('hours', hours);
  if (ids) source.searchParams.set('ids', ids);
  if (bbox) source.searchParams.set('bbox', bbox);
  const result = await fetchJsonWithTimeout(source.toString(), { headers: { 'User-Agent': 'MesoVortexWX/2.0' }, timeoutMs: 12000 });
  if (!result.ok) {
    return NextResponse.json(errorPayload([], source.toString(), result.error), { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ data: result.data, _meta: { fetchedAt: new Date().toISOString(), source: source.toString(), ok: true, product: 'TAF' } }, { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' } });
}
