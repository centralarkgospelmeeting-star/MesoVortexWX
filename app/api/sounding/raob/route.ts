import { NextResponse } from 'next/server';
import { fetchJsonWithTimeout, errorPayload } from '../../../../lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const station = (url.searchParams.get('station') || 'OUN').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
  const ts = url.searchParams.get('ts') || ''; // YYYYMMDDHHmm
  if (!/^\d{12}$/.test(ts)) {
    return NextResponse.json(errorPayload({ profiles: [] }, 'IEM RAOB', 'Provide ts=YYYYMMDDHHmm (UTC)'), { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const source = `https://mesonet.agron.iastate.edu/json/raob.py?ts=${encodeURIComponent(ts)}&station=${encodeURIComponent(station)}`;
  const result = await fetchJsonWithTimeout(source, { headers: { 'User-Agent': 'MesoVortexWX/2.0' }, timeoutMs: 15000 });
  if (!result.ok) {
    return NextResponse.json(errorPayload({ profiles: [] }, source, result.error), { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ...result.data, _meta: { fetchedAt: new Date().toISOString(), source, ok: true, product: 'IEM RAOB', station, ts } }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' } });
}
