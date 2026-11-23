import { NextResponse } from 'next/server';
import { fetchJsonWithTimeout, errorPayload } from '../../../../lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const region = url.searchParams.get('region_type') || 'marine';
  const event = url.searchParams.get('event') || '';
  const limit = url.searchParams.get('limit') || '200';
  const source = new URL('https://api.weather.gov/alerts/active');
  source.searchParams.set('limit', limit);
  if (event) source.searchParams.set('event', event);
  else source.searchParams.set('region_type', region);
  const result = await fetchJsonWithTimeout(source.toString(), {
    headers: { 'User-Agent': 'MesoVortexWX/2.0 (contact@mesovortex)', Accept: 'application/geo+json' },
    timeoutMs: 15000,
  });
  if (!result.ok) {
    return NextResponse.json(errorPayload({ type: 'FeatureCollection', features: [] }, source.toString(), result.error), { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ...result.data, _meta: { fetchedAt: new Date().toISOString(), source: source.toString(), ok: true, product: 'NWS Marine Alerts' } }, { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' } });
}
